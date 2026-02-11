import { Request, Response } from 'express';
import prisma from '../lib/prisma';
import { calculateMaturityPercentage } from '../utils/metrics';

export class ApplicationController {
    list = async (req: any, res: any) => {
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
                    business_areas: { select: { id: true, name: true } },
                    business_sub_areas: { select: { id: true, name: true } },
                    ref_risk_status: { select: { id: true, label: true } },
                    ref_business_criticality: { select: { id: true, label: true } },
                    ref_sensitivity_levels: { select: { id: true, label: true } },
                    ref_operational_status: { select: { id: true, label: true } },
                    people_applications_business_owner_idTopeople: { select: { id: true, name: true } },
                    people_applications_tech_owner_idTopeople: { select: { id: true, name: true } },
                    assessments: {
                        orderBy: { started_at: 'desc' },
                        take: 1,
                        include: {
                            _count: {
                                select: { assessment_answers: true }
                            }
                        }
                    }
                },
            });

            // Format response to match required structure
            const formattedApps = (applications as any[]).map(app => {
                const latestAssessment = app.assessments[0];

                const answersCount = latestAssessment?._count?.assessment_answers || 0;
                const progress = Math.min(Math.round((answersCount / 20) * 100), 100);

                return {
                    id: app.id,
                    name: app.name,
                    description: app.description,
                    business_owner_id: app.business_owner_id,
                    tech_owner_id: app.tech_owner_id,
                    business_area_id: app.business_area_id,
                    sub_area_id: app.sub_area_id,
                    risk_status_id: app.risk_status_id,
                    criticality_id: app.criticality_id,
                    operational_status_id: app.operational_status_id,
                    data_sensitivity_id: app.data_sensitivity_id,
                    business_owner: app.people_applications_business_owner_idTopeople,
                    technical_owner: app.people_applications_tech_owner_idTopeople,
                    business_area: app.business_areas,
                    sub_area: app.business_sub_areas,
                    risk_status: app.ref_risk_status,
                    criticality: app.ref_business_criticality,
                    sensitivity: app.ref_sensitivity_levels,
                    operational_status: app.ref_operational_status,
                    assessment: latestAssessment ? {
                        id: latestAssessment.id,
                        status: latestAssessment.status,
                        progress: progress,
                        maturity_score: calculateMaturityPercentage(Number(latestAssessment.calculated_score || 0))
                    } : null
                };
            });

            console.log(`[ApplicationController] Found ${formattedApps.length} applications for company ${companyIdStr}`);
            return res.json(formattedApps);
        } catch (error) {
            console.error('List Applications Error:', error);
            return res.status(500).json({ error: 'Internal server error' });
        }
    }

    create = async (req: any, res: any) => {
        try {
            const {
                company_id, name, description,
                business_owner_id, tech_owner_id,
                business_area_id, sub_area_id,
                risk_status_id, criticality_id,
                operational_status_id, data_sensitivity_id
            } = req.body;
            const userId = req.user.id;

            if (!company_id || !name) {
                return res.status(400).json({ error: 'Missing company_id or name' });
            }

            const access = await prisma.user_company_access.findUnique({
                where: {
                    user_id_company_id: {
                        user_id: userId,
                        company_id: String(company_id),
                    },
                },
            });

            if (!access) {
                return res.status(403).json({ error: 'Unauthorized access to this company' });
            }

            // Helper to clean empty strings or invalid IDs to null
            const cleanId = (id: any) => (id && id !== '' ? String(id) : null);
            const cleanNumber = (val: any) => (val !== undefined && val !== null && val !== '' ? Number(val) : null);

            const application = await prisma.applications.create({
                data: {
                    company_id: String(company_id),
                    name,
                    description: description || null,
                    business_owner_id: cleanId(business_owner_id),
                    tech_owner_id: cleanId(tech_owner_id),
                    business_area_id: cleanId(business_area_id),
                    sub_area_id: cleanId(sub_area_id),
                    risk_status_id: cleanNumber(risk_status_id),
                    criticality_id: cleanNumber(criticality_id),
                    operational_status_id: cleanNumber(operational_status_id),
                    data_sensitivity_id: cleanNumber(data_sensitivity_id),
                },
            });

            return res.status(201).json(application);
        } catch (error) {
            console.error('Create Application Error:', error);
            return res.status(500).json({ error: 'Internal server error' });
        }
    }

    update = async (req: any, res: any) => {
        try {
            const { id } = req.params;
            const userId = req.user.id;
            const data = req.body;

            // 1. Find the application and check access
            const existingApp = await prisma.applications.findUnique({
                where: { id },
                select: { company_id: true }
            });

            if (!existingApp) {
                return res.status(404).json({ error: 'Application not found' });
            }

            if (!existingApp.company_id) {
                return res.status(400).json({ error: 'Application has no company associated' });
            }

            const access = await prisma.user_company_access.findUnique({
                where: {
                    user_id_company_id: {
                        user_id: userId,
                        company_id: existingApp.company_id,
                    },
                },
            });

            if (!access) {
                return res.status(403).json({ error: 'Unauthorized access to this application' });
            }

            // 2. Prepare update data - only include fields present in request
            const updateData: any = {};
            const fields = [
                'name', 'description', 'business_owner_id', 'tech_owner_id',
                'business_area_id', 'sub_area_id', 'risk_status_id',
                'criticality_id', 'operational_status_id', 'data_sensitivity_id'
            ];

            const idFields = ['business_owner_id', 'tech_owner_id', 'business_area_id', 'sub_area_id'];
            const numberFields = ['risk_status_id', 'criticality_id', 'operational_status_id', 'data_sensitivity_id'];

            fields.forEach(field => {
                if (data.hasOwnProperty(field)) {
                    if (idFields.includes(field)) {
                        updateData[field] = data[field] && data[field] !== '' ? String(data[field]) : null;
                    } else if (numberFields.includes(field)) {
                        updateData[field] = data[field] !== undefined && data[field] !== null && data[field] !== '' ? Number(data[field]) : null;
                    } else {
                        updateData[field] = data[field];
                    }
                }
            });

            const updatedApplication = await prisma.applications.update({
                where: { id },
                data: updateData,
            });

            return res.json(updatedApplication);
        } catch (error) {
            console.error('Update Application Error:', error);
            return res.status(500).json({ error: 'Internal server error' });
        }
    }
}
