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
            const user = req.user;
            const userId = user.id;

            if (!name) {
                return res.status(400).json({ error: 'Company name is required' });
            }

            const company = await prisma.$transaction(async (tx) => {
                // 1. Verificação de Tenant do Usuário
                let tenantUser = await tx.tenant_users.findFirst({
                    where: { user_id: userId },
                });

                let tenantId: string;

                if (!tenantUser) {
                    // 2. Criação do Tenant (Cenário A: Primeira Empresa)
                    const tenantName = `Organization de ${user.full_name || user.email}`;
                    const baseSlug = (user.full_name || user.email.split('@')[0])
                        .toLowerCase()
                        .replace(/ /g, '-')
                        .replace(/[^\w-]+/g, '');

                    const slug = `${baseSlug}-${Date.now()}`; // Garantir unicidade simples

                    const newTenant = await tx.tenants.create({
                        data: {
                            name: tenantName,
                            slug,
                        },
                    });

                    // Criar vínculo do usuário com o novo tenant
                    await tx.tenant_users.create({
                        data: {
                            user_id: userId,
                            tenant_id: newTenant.id,
                            role: 'OWNER',
                        },
                    });

                    tenantId = newTenant.id;
                } else {
                    // Cenário B: Já existe tenant
                    tenantId = tenantUser.tenant_id as string;
                }

                // 3. Criação da Empresa com Tenant Obrigatório
                const newCompany = await tx.companies.create({
                    data: {
                        name,
                        cnpj: document,
                        tenant_id: tenantId,
                    },
                });

                // 4. Vínculo User-Company
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
