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

            // Validar se a aplicação existe e se o usuário tem acesso à empresa dela
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
            });

            return res.status(201).json({ id: assessment.id });
        } catch (error) {
            console.error('Init Assessment Error:', error);
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
                },
                create: {
                    assessment_id: assessmentId,
                    question_id: qId,
                    selected_option_id: optId,
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
                            await tx.assessment_answers.upsert({
                                where: {
                                    assessment_id_question_id: {
                                        assessment_id: assessmentId,
                                        question_id: qId,
                                    },
                                },
                                update: {
                                    selected_option_id: optId,
                                },
                                create: {
                                    assessment_id: assessmentId,
                                    question_id: qId,
                                    selected_option_id: optId,
                                },
                            });
                        }
                    }
                }

                // b) Calcular Score total buscando dados reais do banco
                const allAnswers = await tx.assessment_answers.findMany({
                    where: { assessment_id: assessmentId },
                    include: {
                        question_options: {
                            select: { score_value: true }
                        },
                    },
                });

                let totalScore = 0;
                for (const ans of allAnswers) {
                    totalScore += (ans as any).question_options?.score_value || 0;
                }

                // c) Atualizar assessment para COMPLETED e salvar score calculado
                const updatedAssessment = await tx.assessments.update({
                    where: { id: assessmentId },
                    data: {
                        calculated_score: totalScore,
                        status: assessment_status_enum.COMPLETED,
                        finished_at: new Date(),
                    },
                });

                return {
                    id: updatedAssessment.id,
                    calculated_score: totalScore,
                    status: updatedAssessment.status
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
