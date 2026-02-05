import { Request, Response } from 'express';
import prisma from '../lib/prisma';

export class PeopleController {
    async listByCompany(req: Request, res: Response) {
        try {
            const companyId = req.params.companyId as string;

            const people = await prisma.people.findMany({
                where: { company_id: companyId },
                include: {
                    ref_archetypes: { select: { label: true } },
                    ref_tech_levels: { select: { label: true } },
                    ref_business_levels: { select: { label: true } }
                },
                orderBy: { name: 'asc' }
            });

            // Map to the format the user requested
            const formattedPeople = (people as any[]).map(person => ({
                id: person.id,
                name: person.name,
                email: person.email,
                job_title: person.job_title,
                phone: person.phone,
                archetype: person.ref_archetypes,
                technical_level: person.ref_tech_levels,
                business_level: person.ref_business_levels
            }));

            return res.json(formattedPeople);
        } catch (error) {
            console.error('Error listing people:', error);
            return res.status(500).json({ error: 'Internal server error' });
        }
    }

    async create(req: Request, res: Response) {
        try {
            const companyId = req.params.companyId as string;
            const {
                name,
                email,
                job_title,
                phone,
                archetype_id,
                technical_level_id,
                business_level_id
            } = req.body;

            if (!name) {
                return res.status(400).json({ error: 'Name is required' });
            }

            const person = await prisma.people.create({
                data: {
                    company_id: companyId,
                    name,
                    email,
                    job_title,
                    phone,
                    archetype_id: archetype_id ? Number(archetype_id) : undefined,
                    tech_level_id: technical_level_id ? Number(technical_level_id) : undefined,
                    business_level_id: business_level_id ? Number(business_level_id) : undefined,
                },
                include: {
                    ref_archetypes: { select: { label: true } },
                    ref_tech_levels: { select: { label: true } },
                    ref_business_levels: { select: { label: true } }
                }
            }) as any;

            return res.status(201).json({
                id: person.id,
                name: person.name,
                email: person.email,
                job_title: person.job_title,
                phone: person.phone,
                archetype: person.ref_archetypes,
                technical_level: person.ref_tech_levels,
                business_level: person.ref_business_levels
            });
        } catch (error) {
            console.error('Error creating person:', error);
            return res.status(500).json({ error: 'Internal server error' });
        }
    }
}
