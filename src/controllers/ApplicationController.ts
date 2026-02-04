import { Request, Response } from 'express';
import prisma from '../lib/prisma';

export class ApplicationController {
    async list(req: Request, res: Response) {
        try {
            const { company_id } = req.query;
            const userId = req.user.id;

            if (!company_id) {
                return res.status(400).json({ error: 'Missing company_id query parameter' });
            }

            const companyIdStr = String(company_id);

            // Verificar acesso à empresa antes de listar aplicações
            const access = await prisma.user_company_access.findUnique({
                where: {
                    user_id_company_id: {
                        user_id: userId,
                        company_id: companyIdStr,
                    },
                },
            });

            if (!access) {
                return res.status(403).json({ error: 'Unauthorized access to this company' });
            }

            const applications = await prisma.applications.findMany({
                where: {
                    company_id: companyIdStr,
                },
                include: {
                    _count: {
                        select: { assessments: true },
                    },
                },
            });

            return res.json(applications);
        } catch (error) {
            console.error('List Applications Error:', error);
            return res.status(500).json({ error: 'Internal server error' });
        }
    }

    async create(req: Request, res: Response) {
        try {
            const { company_id, name, description } = req.body;
            const userId = req.user.id;

            if (!company_id || !name) {
                return res.status(400).json({ error: 'Missing company_id or name' });
            }

            // Verificar se a empresa pertence ao usuário ou se ele tem acesso
            const access = await prisma.user_company_access.findUnique({
                where: {
                    user_id_company_id: {
                        user_id: userId,
                        company_id: company_id,
                    },
                },
            });

            if (!access) {
                return res.status(403).json({ error: 'Unauthorized access to this company' });
            }

            const application = await prisma.applications.create({
                data: {
                    company_id,
                    name,
                    description,
                },
            });

            return res.status(201).json(application);
        } catch (error) {
            console.error('Create Application Error:', error);
            return res.status(500).json({ error: 'Internal server error' });
        }
    }
}
