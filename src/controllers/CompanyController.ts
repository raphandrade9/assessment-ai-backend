import { Request, Response } from 'express';
import prisma from '../lib/prisma';
import { calculateMaturityPercentage } from '../utils/metrics';

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

    async getMetrics(req: Request, res: Response) {
        try {
            const id = req.params.id as string;

            const [avgMaturity, attentionRequired, pendingAssessments, totalApps, completedAssessments] = await Promise.all([
                // 1. Média de Maturidade (Normalizada 0-100)
                prisma.assessments.aggregate({
                    where: {
                        applications: { company_id: id },
                        status: 'COMPLETED'
                    },
                    _avg: { calculated_score: true }
                }),

                // 2. Atenção Requerida (Regras de Negócio Ajustadas)
                prisma.applications.count({
                    where: {
                        company_id: id,
                        OR: [
                            // Risco Alto/Atenção
                            {
                                ref_risk_status: {
                                    OR: [
                                        { label: { contains: 'Atenção', mode: 'insensitive' } },
                                        { label: { contains: 'Crític', mode: 'insensitive' } },
                                        { label: { contains: 'Alto', mode: 'insensitive' } }
                                    ]
                                }
                            },
                            // Nota Baixa (< 40% de 2000pts = 800pts)
                            {
                                assessments: {
                                    some: {
                                        status: 'COMPLETED',
                                        calculated_score: { lt: 800 }
                                    }
                                }
                            },
                            // Crítico ou Alto sem Assessment
                            {
                                AND: [
                                    {
                                        ref_business_criticality: {
                                            OR: [
                                                { label: { contains: 'Crítica', mode: 'insensitive' } },
                                                { label: { contains: 'Alta', mode: 'insensitive' } }
                                            ]
                                        }
                                    },
                                    { assessments: { none: {} } }
                                ]
                            }
                        ]
                    }
                }),

                // 3. Avaliações Pendentes (IN_PROGRESS)
                prisma.applications.count({
                    where: {
                        company_id: id,
                        assessments: {
                            some: { status: 'IN_PROGRESS' }
                        }
                    }
                }),

                // 4. Total de Aplicações
                prisma.applications.count({
                    where: { company_id: id }
                }),

                // 5. Assessments Concluídos (Completed)
                prisma.assessments.count({
                    where: {
                        applications: { company_id: id },
                        status: 'COMPLETED'
                    }
                })
            ]);

            // Normalização: 0-2000 -> 0-100
            const normalizedAvg = calculateMaturityPercentage(avgMaturity?._avg?.calculated_score as any);

            return res.json({
                avg_maturity: normalizedAvg,
                attention_required: attentionRequired,
                pending_assessments: pendingAssessments,
                completed_assessments: completedAssessments,
                total_applications: totalApps
            });
        } catch (error) {
            console.error('Error getting company metrics:', error);
            return res.status(500).json({ error: 'Internal server error' });
        }
    }

    async getMetricsByArea(req: Request, res: Response) {
        try {
            const companyId = req.params.id as string;

            const apps = await prisma.applications.findMany({
                where: { company_id: companyId },
                include: {
                    business_areas: true,
                    assessments: {
                        where: { status: 'COMPLETED' },
                        select: { calculated_score: true }
                    }
                }
            });

            const areaGroups: Record<string, any> = {};

            apps.forEach(app => {
                const areaId = app.business_area_id || 'unassigned';
                const areaName = app.business_areas?.name || 'Sem Área Identificada';

                if (!areaGroups[areaId]) {
                    areaGroups[areaId] = {
                        id: app.business_area_id,
                        name: areaName,
                        app_count: 0,
                        total_score: 0,
                        assessed_count: 0
                    };
                }

                areaGroups[areaId].app_count++;

                if (app.assessments.length > 0) {
                    const appScore = Number(app.assessments[0].calculated_score || 0);
                    areaGroups[areaId].total_score += appScore;
                    areaGroups[areaId].assessed_count++;
                }
            });

            const result = Object.values(areaGroups).map(group => ({
                id: group.id,
                name: group.name,
                app_count: group.app_count,
                avg_score: group.assessed_count > 0
                    ? calculateMaturityPercentage(group.total_score / group.assessed_count)
                    : 0
            }));

            return res.json({ areas: result });
        } catch (error) {
            console.error('Error getting metrics by area:', error);
            return res.status(500).json({ error: 'Internal server error' });
        }
    }

    async getMetricsBySubArea(req: Request, res: Response) {
        try {
            const companyId = req.params.id as string;
            const areaId = req.params.areaId;

            const whereClause: any = { company_id: companyId };

            if (areaId === 'unassigned') {
                whereClause.business_area_id = null;
            } else {
                whereClause.business_area_id = areaId;
            }

            const apps = await prisma.applications.findMany({
                where: whereClause,
                include: {
                    business_sub_areas: true,
                    assessments: {
                        where: { status: 'COMPLETED' },
                        select: { calculated_score: true }
                    }
                }
            });

            const subAreaGroups: Record<string, any> = {};

            apps.forEach(app => {
                const subId = app.sub_area_id || 'unassigned';
                const subName = app.business_sub_areas?.name || 'Sem Sub-Área Identificada';

                if (!subAreaGroups[subId]) {
                    subAreaGroups[subId] = {
                        id: app.sub_area_id,
                        name: subName,
                        app_count: 0,
                        total_score: 0,
                        assessed_count: 0
                    };
                }

                subAreaGroups[subId].app_count++;

                if (app.assessments.length > 0) {
                    const appScore = Number(app.assessments[0].calculated_score || 0);
                    subAreaGroups[subId].total_score += appScore;
                    subAreaGroups[subId].assessed_count++;
                }
            });

            const result = Object.values(subAreaGroups).map(group => ({
                id: group.id,
                name: group.name,
                app_count: group.app_count,
                avg_score: group.assessed_count > 0
                    ? calculateMaturityPercentage(group.total_score / group.assessed_count)
                    : 0
            }));

            return res.json({ sub_areas: result });
        } catch (error) {
            console.error('Error getting metrics by sub-area:', error);
            return res.status(500).json({ error: 'Internal server error' });
        }
    }
    async getApplicationsByStatus(req: Request, res: Response) {
        try {
            const companyId = req.params.id as string;
            const groupBy = (req.query.group_by as string) || 'area'; // 'area' | 'sub_area'
            const parentId = req.query.parent_id as string | undefined;

            const whereClause: any = { company_id: companyId };

            // Filtro opcional de parent (ex: ao clicar em uma área, ver sub-áreas dela)
            if (parentId) {
                if (groupBy === 'sub_area') {
                    whereClause.business_area_id = parentId;
                }
            }

            const apps = await prisma.applications.findMany({
                where: whereClause,
                include: {
                    business_areas: true,
                    business_sub_areas: true,
                    assessments: {
                        select: { status: true }
                    }
                }
            });

            const groups: Record<string, any> = {};

            apps.forEach(app => {
                let groupId = 'unassigned';
                let groupName = 'Não Identificado';

                if (groupBy === 'area') {
                    groupId = app.business_area_id || 'unassigned';
                    groupName = app.business_areas?.name || 'Sem Área';
                } else if (groupBy === 'sub_area') {
                    groupId = app.sub_area_id || 'unassigned';
                    groupName = app.business_sub_areas?.name || 'Sem Sub-Área';
                }

                if (!groups[groupId]) {
                    groups[groupId] = {
                        id: groupId === 'unassigned' ? null : groupId,
                        name: groupName,
                        completed: 0,
                        in_progress: 0,
                        not_started: 0,
                        total: 0
                    };
                }

                groups[groupId].total++;

                // Determinar status da aplicação
                // Prioridade: COMPLETED > IN_PROGRESS > NOT_STARTED
                const hasCompleted = app.assessments.some(a => a.status === 'COMPLETED');
                const hasInProgress = app.assessments.some(a => a.status === 'IN_PROGRESS');

                if (hasCompleted) {
                    groups[groupId].completed++;
                } else if (hasInProgress) {
                    groups[groupId].in_progress++;
                } else {
                    groups[groupId].not_started++;
                }
            });

            const result = Object.values(groups);
            return res.json(result);
        } catch (error) {
            console.error('Error getting applications by status:', error);
            return res.status(500).json({ error: 'Internal server error' });
        }
    }
}
