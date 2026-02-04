import { Request, Response } from 'express';
import prisma from '../lib/prisma';

export class CompanyController {
    async list(req: Request, res: Response) {
        try {
            const userId = req.user.id;

            // Buscar empresas onde o usuário tem acesso
            const userAccess = await prisma.user_company_access.findMany({
                where: { user_id: userId },
                include: {
                    companies: true,
                },
            });

            const companies = userAccess.map((access) => ({
                ...access.companies,
                role: access.role,
            }));

            return res.json(companies);
        } catch (error) {
            console.error('Error listing companies:', error);
            return res.status(500).json({ error: 'Internal server error' });
        }
    }

    async create(req: Request, res: Response) {
        try {
            const { name, document } = req.body;
            const userId = req.user.id;

            if (!name) {
                return res.status(400).json({ error: 'Company name is required' });
            }

            // Criar empresa e vínculo em uma transação
            const company = await prisma.$transaction(async (tx) => {
                const newCompany = await tx.companies.create({
                    data: {
                        name,
                        cnpj: document,
                        // Nota: tenant_id é opcional no schema, mas em um sistema multi-tenant real
                        // você provavelmente criaria um tenant ou associaria a um existente aqui.
                    },
                });

                await tx.user_company_access.create({
                    data: {
                        user_id: userId,
                        company_id: newCompany.id,
                        role: 'OWNER',
                    },
                });

                return newCompany;
            });

            return res.status(201).json(company);
        } catch (error) {
            console.error('Error creating company:', error);
            return res.status(500).json({ error: 'Internal server error' });
        }
    }
}
