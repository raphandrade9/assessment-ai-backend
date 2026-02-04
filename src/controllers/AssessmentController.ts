import { Request, Response } from 'express';
import prisma from '../lib/prisma';

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
                    status: 'IN_PROGRESS',
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
        try {
            const assessmentId = req.params.id as string;
            const { question_id, selected_option_id } = req.body;

            if (!question_id || !selected_option_id) {
                return res.status(400).json({ error: 'Missing question_id or selected_option_id' });
            }

            // Upsert resposta
            await prisma.assessment_answers.upsert({
                where: {
                    assessment_id_question_id: {
                        assessment_id: assessmentId,
                        question_id: question_id,
                    },
                },
                update: {
                    selected_option_id,
                },
                create: {
                    assessment_id: assessmentId,
                    question_id,
                    selected_option_id,
                },
            });

            return res.json({ success: true });
        } catch (error) {
            console.error('Save Answer Error:', error);
            return res.status(500).json({ error: 'Internal server error' });
        }
    }

    // 3. POST /api/assessment/:id/finalize
    async finalize(req: Request, res: Response) {
        try {
            const assessmentId = req.params.id as string;
            const { answers } = req.body;

            const result = await prisma.$transaction(async (tx) => {
                // a) Upsert em massa se vierem respostas no payload
                if (answers && Array.isArray(answers)) {
                    for (const ans of answers) {
                        await tx.assessment_answers.upsert({
                            where: {
                                assessment_id_question_id: {
                                    assessment_id: assessmentId,
                                    question_id: ans.question_id,
                                },
                            },
                            update: {
                                selected_option_id: ans.selected_option_id,
                            },
                            create: {
                                assessment_id: assessmentId,
                                question_id: ans.question_id,
                                selected_option_id: ans.selected_option_id,
                            },
                        });
                    }
                }

                // b) Calcular Score total somando as respostas do banco
                const allAnswers = await tx.assessment_answers.findMany({
                    where: { assessment_id: assessmentId },
                    include: {
                        question_options: true,
                    },
                });

                let totalScore = 0;
                for (const ans of allAnswers) {
                    totalScore += (ans as any).question_options?.score_value || 0;
                }

                // c) Atualizar assessment para COMPLETED e salvar score
                const updatedAssessment = await tx.assessments.update({
                    where: { id: assessmentId },
                    data: {
                        calculated_score: totalScore,
                        status: 'COMPLETED',
                        finished_at: new Date(),
                    },
                });

                return {
                    id: updatedAssessment.id,
                    calculated_score: totalScore,
                };
            });

            return res.json(result);
        } catch (error) {
            console.error('Finalize Assessment Error:', error);
            return res.status(500).json({ error: 'Internal server error' });
        }
    }
}
