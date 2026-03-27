import { Request, Response } from 'express';
import prisma from '../lib/prisma';

export class ReferenceController {
    async getArchetypes(req: Request, res: Response) {
        try {
            const archetypes = await prisma.ref_archetypes.findMany({
                orderBy: { label: 'asc' }
            });
            return res.json(archetypes);
        } catch (error) {
            console.error('Error fetching archetypes:', error);
            return res.status(500).json({ error: 'Internal server error' });
        }
    }

    async getTechnicalLevels(req: Request, res: Response) {
        try {
            const levels = await prisma.ref_tech_levels.findMany({
                orderBy: { level_number: 'asc' }
            });
            return res.json(levels);
        } catch (error) {
            console.error('Error fetching technical levels:', error);
            return res.status(500).json({ error: 'Internal server error' });
        }
    }

    async getBusinessLevels(req: Request, res: Response) {
        try {
            const levels = await prisma.ref_business_levels.findMany({
                orderBy: { level_number: 'asc' }
            });
            return res.json(levels);
        } catch (error) {
            console.error('Error fetching business levels:', error);
            return res.status(500).json({ error: 'Internal server error' });
        }
    }

    async getOperationalStatus(req: Request, res: Response) {
        try {
            const statuses = await prisma.ref_operational_status.findMany({
                where: { is_active: true },
                orderBy: { id: 'asc' }
            });
            return res.json(statuses);
        } catch (error) {
            console.error('Error fetching operational statuses:', error);
            return res.status(500).json({ error: 'Internal server error' });
        }
    }

    async getDataSensitivities(req: Request, res: Response) {
        try {
            const items = await prisma.ref_sensitivity_levels.findMany({ orderBy: { id: 'asc' } });
            return res.json(items);
        } catch (error) {
            console.error('Error fetching data sensitivities:', error);
            return res.status(500).json({ error: 'Internal server error' });
        }
    }

    async getCriticalities(req: Request, res: Response) {
        try {
            const items = await prisma.ref_business_criticality.findMany({ orderBy: { id: 'asc' } });
            return res.json(items);
        } catch (error) {
            console.error('Error fetching criticalities:', error);
            return res.status(500).json({ error: 'Internal server error' });
        }
    }

    async getRiskStatus(req: Request, res: Response) {
        try {
            const items = await prisma.ref_risk_status.findMany({ orderBy: { id: 'asc' } });
            return res.json(items);
        } catch (error) {
            console.error('Error fetching risk status:', error);
            return res.status(500).json({ error: 'Internal server error' });
        }
    }
}
