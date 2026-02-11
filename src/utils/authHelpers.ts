import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma';
import { user_role_type } from '../generated/prisma/enums';

/**
 * Get user's role for a specific company
 */
export async function getUserRole(userId: string, companyId: string): Promise<user_role_type | null> {
    const access = await prisma.user_company_access.findUnique({
        where: {
            user_id_company_id: {
                user_id: userId,
                company_id: companyId
            }
        },
        select: { role: true }
    });

    return access?.role || null;
}

/**
 * Check if user has one of the required roles for a company
 */
export async function hasRole(userId: string, companyId: string, allowedRoles: user_role_type[]): Promise<boolean> {
    const userRole = await getUserRole(userId, companyId);
    if (!userRole) return false;
    return allowedRoles.includes(userRole);
}

/**
 * Middleware factory to require specific roles
 * Usage: requireRole(['OWNER', 'ADMIN'])
 */
export function requireRole(allowedRoles: user_role_type[]) {
    return async (req: Request, res: Response, next: NextFunction) => {
        const userId = (req as any).user?.id;
        const companyId = (req.query?.companyId || req.body?.companyId) as string;

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized: No user found' });
        }

        if (!companyId) {
            return res.status(400).json({ error: 'Bad Request: companyId is required' });
        }

        const hasAccess = await hasRole(userId, companyId, allowedRoles);

        if (!hasAccess) {
            return res.status(403).json({
                error: 'Forbidden: Insufficient permissions',
                required: allowedRoles,
            });
        }

        next();
    };
}

/**
 * Check if a user can modify another user's role
 * Rules:
 * - OWNER can modify any role
 * - ADMIN cannot modify OWNER roles
 * - EDITOR and VIEWER cannot modify any roles
 */
export function canModifyRole(requesterRole: user_role_type, targetRole: user_role_type): boolean {
    // OWNER can modify any role
    if (requesterRole === 'OWNER') {
        return true;
    }

    // ADMIN cannot modify OWNER roles
    if (requesterRole === 'ADMIN' && targetRole === 'OWNER') {
        return false;
    }

    // ADMIN can modify ADMIN, EDITOR, and VIEWER
    if (requesterRole === 'ADMIN') {
        return true;
    }

    // EDITOR and VIEWER cannot modify roles
    return false;
}

/**
 * Validate if a role value is valid
 */
export function isValidRole(role: string): role is user_role_type {
    return ['OWNER', 'ADMIN', 'EDITOR', 'VIEWER'].includes(role);
}
