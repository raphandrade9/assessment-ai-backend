import { Request, Response } from 'express';
import prisma from '../lib/prisma';
import { assessment_status_enum } from '../generated/prisma/client';

export class AssessmentController {
    async getQuestions(req: Request, res: Response) {
        try {
            const questions = await prisma.questions.findMany({
                include: {
                    question_options: true,
                    assessment_sections: true,
                },
                orderBy: {
                    order_index: 'asc',
                },
            });

            return res.json(questions);
        } catch (error) {
            console.error('Error fetching questions:', error);
            return res.status(500).json({ error: 'Internal server error' });
        }
    }

    // 1. POST /api/assessment/init
    async init(req: Request, res: Response) {
        try {
            const { application_id } = req.body;
            const userId = req.user.id;

            if (!application_id) {
                return res.status(400).json({ error: 'Missing application_id' });
            }

            // Validar se a aplicação existe e se o usuário tem acesso
            const application = await prisma.applications.findUnique({
                where: { id: application_id },
                include: {
                    companies: {
                        include: {
                            user_company_access: {
                                where: { user_id: userId },
                            },
                        },
                    },
                },
            });

            if (!application || !application.companies?.user_company_access.length) {
                return res.status(403).json({ error: 'Unauthorized access to this application' });
            }

            // VERIFICAÇÃO: Se já existe um assessment IN_PROGRESS para esta aplicação, vamos retorná-lo
            const existingAssessment = await prisma.assessments.findFirst({
                where: {
                    application_id,
                    status: assessment_status_enum.IN_PROGRESS
                },
                include: {
                    assessment_answers: true
                }
            });

            if (existingAssessment) {
                console.log(`[AssessmentController] Resuming existing assessment ${existingAssessment.id} with ${existingAssessment.assessment_answers.length} answers`);
                return res.status(200).json(existingAssessment);
            }

            // Buscar template ativo
            const template = await prisma.assessment_templates.findFirst({
                where: { is_active: true },
                orderBy: { version_number: 'desc' },
            });

            const assessment = await prisma.assessments.create({
                data: {
                    application_id,
                    template_id: template?.id,
                    status: assessment_status_enum.IN_PROGRESS,
                    started_at: new Date(),
                },
                include: {
                    assessment_answers: true
                }
            });

            console.log(`[AssessmentController] Initialized new assessment ${assessment.id}`);
            return res.status(201).json(assessment);
        } catch (error) {
            console.error('Init Assessment Error:', error);
            return res.status(500).json({ error: 'Internal server error' });
        }
    }

    // Novo método para buscar assessment por ID (incluindo respostas e diagnóstico)
    async getById(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const userId = req.user.id;

            const assessment = await prisma.assessments.findUnique({
                where: { id: id as string },
                include: {
                    assessment_answers: true,
                    assessment_diagnosis: true,
                    applications: {
                        include: {
                            companies: {
                                include: {
                                    user_company_access: {
                                        where: { user_id: userId }
                                    }
                                }
                            }
                        }
                    }
                }
            });

            if (!assessment) {
                console.log(`[AssessmentController] Assessment ${id} not found.`);
                return res.status(404).json({ error: 'Assessment not found' });
            }

            const assessmentData = assessment as any;

            // Validar acesso
            if (!assessmentData.applications?.companies?.user_company_access?.length) {
                console.warn(`[AssessmentController] Unauthorized access attempt to assessment ${id} by user ${userId}.`);
                return res.status(403).json({ error: 'Unauthorized access to this assessment' });
            }

            console.log(`[AssessmentController] GET assessment ${id} with ${assessmentData.assessment_answers?.length} answers`);
            return res.json(assessment);
        } catch (error) {
            console.error('Get Assessment Error:', error);
            return res.status(500).json({ error: 'Internal server error' });
        }
    }

    // 2. PUT /api/assessment/:id/answers
    async saveAnswer(req: Request, res: Response) {
        const assessmentId = req.params.id as string;
        const { question_id, selected_option_id } = req.body;

        try {
            if (!question_id || !selected_option_id) {
                return res.status(400).json({ error: 'Missing question_id or selected_option_id' });
            }

            const qId = Number(question_id);
            const optId = Number(selected_option_id);

            if (isNaN(qId) || isNaN(optId)) {
                return res.status(400).json({ error: 'Invalid question_id or selected_option_id format' });
            }

            // Snapshot de pontuação: Buscamos o valor da opção antes de salvar
            const option = await prisma.question_options.findUnique({
                where: { id: optId }
            });

            if (!option) {
                return res.status(404).json({ error: 'Option not found' });
            }

            // Upsert resposta utilizando a chave composta gerada pelo Prisma
            await prisma.assessment_answers.upsert({
                where: {
                    assessment_id_question_id: {
                        assessment_id: assessmentId,
                        question_id: qId,
                    },
                },
                update: {
                    selected_option_id: optId,
                    score_awarded: option.score_value || 0
                },
                create: {
                    assessment_id: assessmentId,
                    question_id: qId,
                    selected_option_id: optId,
                    score_awarded: option.score_value || 0
                },
            });

            return res.json({ success: true });
        } catch (error: any) {
            console.error('CRITICAL: Save Answer Error Detailed:', {
                assessmentId,
                question_id,
                selected_option_id,
                error: error.message,
                stack: error.stack
            });
            return res.status(500).json({ error: 'Failed to persist answer', details: error.message });
        }
    }

    // 3. POST /api/assessment/:id/finalize
    async finalize(req: Request, res: Response) {
        const assessmentId = req.params.id as string;
        const { answers } = req.body;

        try {
            const result = await prisma.$transaction(async (tx) => {
                // a) Upsert em massa se vierem respostas no payload (backup do auto-save)
                if (answers && Array.isArray(answers)) {
                    for (const ans of answers) {
                        const qId = Number(ans.question_id);
                        const optId = Number(ans.selected_option_id);

                        if (!isNaN(qId) && !isNaN(optId)) {
                            const option = await tx.question_options.findUnique({
                                where: { id: optId }
                            });

                            await tx.assessment_answers.upsert({
                                where: {
                                    assessment_id_question_id: {
                                        assessment_id: assessmentId,
                                        question_id: qId,
                                    },
                                },
                                update: {
                                    selected_option_id: optId,
                                    score_awarded: option?.score_value || 0
                                },
                                create: {
                                    assessment_id: assessmentId,
                                    question_id: qId,
                                    selected_option_id: optId,
                                    score_awarded: option?.score_value || 0
                                },
                            });
                        }
                    }
                }

                // b) Calcular Score total buscando dados reais do banco
                const allAnswersWithSections = await tx.assessment_answers.findMany({
                    where: { assessment_id: assessmentId },
                    include: {
                        questions: {
                            select: {
                                section_id: true,
                                assessment_sections: {
                                    select: { title: true }
                                }
                            }
                        }
                    },
                });

                if (allAnswersWithSections.length === 0) {
                    throw new Error('No answers found to finalize assessment');
                }

                // 1. Cálculo do Score Global (Média Aritmética)
                const totalSum = allAnswersWithSections.reduce((acc, curr) => acc + (curr.score_awarded || 0), 0);
                const globalScore = Number((totalSum / allAnswersWithSections.length).toFixed(2));

                // 2. Cálculo por Eixo (Média por Section)
                const axisMap: Record<number, { title: string, sum: number, count: number }> = {};
                allAnswersWithSections.forEach(ans => {
                    const sectionId = ans.questions?.section_id;
                    if (sectionId) {
                        if (!axisMap[sectionId]) {
                            axisMap[sectionId] = {
                                title: (ans.questions as any).assessment_sections?.title || `Eixo ${sectionId}`,
                                sum: 0,
                                count: 0
                            };
                        }
                        axisMap[sectionId].sum += (ans.score_awarded || 0);
                        axisMap[sectionId].count += 1;
                    }
                });

                const axisAnalysis = Object.keys(axisMap).map(key => {
                    const id = Number(key);
                    const data = axisMap[id];
                    return {
                        section_id: id,
                        title: data.title,
                        score: Number((data.sum / data.count).toFixed(2))
                    };
                });

                // 3. Determinação de Level e Risco
                let maturity_level = "Iniciante";
                let risk_label = "Crítico";

                if (globalScore >= 70) {
                    maturity_level = "Avançado";
                    risk_label = "Baixo";
                } else if (globalScore >= 40) {
                    maturity_level = "Intermediário";
                    risk_label = "Moderado";
                }

                // 4. Salvar Diagnóstico
                const diagnosis = await tx.assessment_diagnosis.upsert({
                    where: { assessment_id: assessmentId },
                    update: {
                        maturity_level,
                        risk_label,
                        axis_analysis: axisAnalysis as any,
                        action_plan: {} // MVP Placeholder
                    },
                    create: {
                        assessment_id: assessmentId,
                        maturity_level,
                        risk_label,
                        axis_analysis: axisAnalysis as any,
                        action_plan: {} // MVP Placeholder
                    }
                });

                // c) Atualizar assessment para COMPLETED e salvar score calculado
                const updatedAssessment = await tx.assessments.update({
                    where: { id: assessmentId },
                    data: {
                        calculated_score: globalScore,
                        status: assessment_status_enum.COMPLETED,
                        finished_at: new Date(),
                    },
                });

                return {
                    id: updatedAssessment.id,
                    score: globalScore,
                    maturity_level,
                    risk_label,
                    axis_analysis: axisAnalysis
                };
            });

            return res.json(result);
        } catch (error: any) {
            console.error('CRITICAL: Finalize Assessment Error Detailed:', {
                assessmentId,
                error: error.message,
                stack: error.stack
            });
            return res.status(500).json({ error: 'Failed to finalize assessment', details: error.message });
        }
    }
}
