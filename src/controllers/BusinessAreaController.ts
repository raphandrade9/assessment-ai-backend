
import { Request, Response } from 'express';
import prisma from '../lib/prisma';

export class BusinessAreaController {
    // 1. List Areas (Optional: Include Sub-areas)
    async listByCompany(req: Request, res: Response) {
        try {
            const companyId = req.params.companyId as string;

            const areas = await prisma.business_areas.findMany({
                where: { company_id: companyId },
                include: {
                    business_sub_areas: {
                        orderBy: { name: 'asc' }
                    }
                },
                orderBy: { name: 'asc' }
            });

            return res.json(areas);
        } catch (error) {
            console.error('Error listing areas:', error);
            return res.status(500).json({ error: 'Internal server error' });
        }
    }

    // 2. Create Area
    async createArea(req: Request, res: Response) {
        try {
            const companyId = req.params.companyId as string;
            const { name, description } = req.body;

            if (!name) {
                return res.status(400).json({ error: 'Name is required' });
            }

            const area = await prisma.business_areas.create({
                data: {
                    company_id: companyId,
                    name,
                    description
                },
                include: { business_sub_areas: true }
            });

            return res.status(201).json(area);
        } catch (error) {
            console.error('Error creating area:', error);
            return res.status(500).json({ error: 'Internal server error' });
        }
    }

    // 3. Update Area
    async updateArea(req: Request, res: Response) {
        try {
            const id = req.params.id as string;
            const { name, description } = req.body;

            const area = await prisma.business_areas.update({
                where: { id },
                data: { name, description },
                include: { business_sub_areas: true }
            });

            return res.json(area);
        } catch (error) {
            console.error('Error updating area:', error);
            return res.status(500).json({ error: 'Internal server error' });
        }
    }

    // 4. Delete Area
    async deleteArea(req: Request, res: Response) {
        try {
            const id = req.params.id as string;

            await prisma.business_areas.delete({
                where: { id }
            });

            return res.status(204).send();
        } catch (error) {
            console.error('Error deleting area:', error);
            return res.status(500).json({ error: 'Internal server error' });
        }
    }

    // --- Sub-Areas ---

    // 5. Create Sub-Area
    async createSubArea(req: Request, res: Response) {
        try {
            const areaId = req.params.areaId as string;
            const { name } = req.body;

            if (!name) {
                return res.status(400).json({ error: 'Name is required' });
            }

            const subArea = await prisma.business_sub_areas.create({
                data: {
                    area_id: areaId,
                    name
                }
            });

            return res.status(201).json(subArea);
        } catch (error) {
            console.error('Error creating sub-area:', error);
            return res.status(500).json({ error: 'Internal server error' });
        }
    }

    // 6. Update Sub-Area
    async updateSubArea(req: Request, res: Response) {
        try {
            const id = req.params.id as string;
            const { name } = req.body;

            const subArea = await prisma.business_sub_areas.update({
                where: { id },
                data: { name }
            });

            return res.json(subArea);
        } catch (error) {
            console.error('Error updating sub-area:', error);
            return res.status(500).json({ error: 'Internal server error' });
        }
    }

    // 7. Delete Sub-Area
    async deleteSubArea(req: Request, res: Response) {
        try {
            const id = req.params.id as string;

            await prisma.business_sub_areas.delete({
                where: { id }
            });

            return res.status(204).send();
        } catch (error) {
            console.error('Error deleting sub-area:', error);
            return res.status(500).json({ error: 'Internal server error' });
        }
    }
}
