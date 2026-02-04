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
}
