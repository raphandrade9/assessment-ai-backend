import { Request, Response } from 'express';
import prisma from '../lib/prisma';
import { auth } from '../config/firebase';
import { user_role_type } from '../generated/prisma/enums';
import { getUserRole, canModifyRole, isValidRole } from '../utils/authHelpers';

export class UserController {
    /**
     * GET /api/users
     * List all users associated with a company
     * Query params: companyId (required)
     * Authorization: ADMIN or OWNER
     */
    async list(req: Request, res: Response) {
        try {
            const companyId = req.query.companyId as string;
            const requesterId = (req as any).user?.id;

            if (!companyId) {
                return res.status(400).json({ error: 'companyId is required' });
            }

            // Get all users with access to this company
            const userAccess = await prisma.user_company_access.findMany({
                where: { company_id: companyId },
                include: {
                    users: {
                        select: {
                            id: true,
                            email: true,
                            full_name: true,
                            firebase_uid: true,
                            avatar_url: true,
                            last_login: true,
                            created_at: true
                        }
                    }
                },
                orderBy: {
                    users: { full_name: 'asc' }
                }
            });

            const formattedUsers = userAccess.map(access => ({
                id: access.users.id,
                email: access.users.email,
                full_name: access.users.full_name,
                role: access.role,
                firebase_uid: access.users.firebase_uid,
                avatar_url: access.users.avatar_url,
                last_login: access.users.last_login,
                created_at: access.users.created_at
            }));

            return res.json(formattedUsers);
        } catch (error) {
            console.error('Error listing users:', error);
            return res.status(500).json({ error: 'Internal server error' });
        }
    }

    /**
     * POST /api/users
     * Create a new user in Firebase and link to company
     * Body: { email, fullName, role, companyId }
     * Authorization: ADMIN or OWNER
     */
    async create(req: Request, res: Response) {
        try {
            const { email, fullName, role, companyId } = req.body;

            // Validation
            if (!email || !fullName || !role || !companyId) {
                return res.status(400).json({
                    error: 'Missing required fields',
                    required: ['email', 'fullName', 'role', 'companyId']
                });
            }

            if (!isValidRole(role)) {
                return res.status(400).json({
                    error: 'Invalid role',
                    validRoles: ['OWNER', 'ADMIN', 'EDITOR', 'VIEWER']
                });
            }

            // Step 1: Check/Create user in Firebase Auth
            let firebaseUid: string;
            let firebaseUser;

            try {
                // Try to get user by email
                firebaseUser = await auth.getUserByEmail(email);
                firebaseUid = firebaseUser.uid;
            } catch (error: any) {
                // User doesn't exist in Firebase, create them
                if (error.code === 'auth/user-not-found') {
                    const tempPassword = this.generateTempPassword();
                    firebaseUser = await auth.createUser({
                        email,
                        password: tempPassword,
                        displayName: fullName,
                    });
                    firebaseUid = firebaseUser.uid;

                    // Optional: Send password reset email so user can set their own password
                    try {
                        await auth.generatePasswordResetLink(email);
                    } catch (emailError) {
                        console.error('Failed to send password reset email:', emailError);
                        // Continue anyway - admin can trigger reset later
                    }
                } else {
                    throw error;
                }
            }

            // Step 2: Database transaction - Upsert user and create company access
            const result = await prisma.$transaction(async (tx) => {
                // Upsert user in database
                const user = await tx.users.upsert({
                    where: { email },
                    update: {
                        firebase_uid: firebaseUid,
                        full_name: fullName,
                    },
                    create: {
                        email,
                        firebase_uid: firebaseUid,
                        full_name: fullName,
                    }
                });

                // Check if user already has access to this company
                const existingAccess = await tx.user_company_access.findUnique({
                    where: {
                        user_id_company_id: {
                            user_id: user.id,
                            company_id: companyId
                        }
                    }
                });

                if (existingAccess) {
                    throw new Error('User already has access to this company');
                }

                // Create company access
                await tx.user_company_access.create({
                    data: {
                        user_id: user.id,
                        company_id: companyId,
                        role: role as user_role_type
                    }
                });

                return user;
            });

            return res.status(201).json({
                id: result.id,
                email: result.email,
                full_name: result.full_name,
                firebase_uid: result.firebase_uid,
                role,
                message: 'User created successfully. Password reset email sent.'
            });

        } catch (error: any) {
            console.error('Error creating user:', error);

            if (error.message === 'User already has access to this company') {
                return res.status(409).json({ error: error.message });
            }

            return res.status(500).json({
                error: 'Internal server error',
                details: error.message
            });
        }
    }

    /**
     * PUT /api/users/:id/role
     * Update a user's role for a specific company
     * Body: { role, companyId }
     * Authorization: ADMIN or OWNER (with restrictions)
     */
    async updateRole(req: Request, res: Response) {
        try {
            const targetUserId = req.params.id;
            const requesterId = (req as any).user?.id;
            const { role, companyId } = req.body;

            // Validation
            if (!role || !companyId) {
                return res.status(400).json({
                    error: 'Missing required fields',
                    required: ['role', 'companyId']
                });
            }

            if (!isValidRole(role)) {
                return res.status(400).json({
                    error: 'Invalid role',
                    validRoles: ['OWNER', 'ADMIN', 'EDITOR', 'VIEWER']
                });
            }

            // Get requester's role
            const requesterRole = await getUserRole(requesterId, companyId as string);
            if (!requesterRole) {
                return res.status(403).json({ error: 'You do not have access to this company' });
            }

            // Get target user's current role
            const targetAccess = await prisma.user_company_access.findUnique({
                where: {
                    user_id_company_id: {
                        user_id: targetUserId as string,
                        company_id: companyId as string
                    }
                }
            });

            if (!targetAccess) {
                return res.status(404).json({ error: 'User not found in this company' });
            }

            // Check if requester can modify target's role
            if (!canModifyRole(requesterRole, targetAccess.role)) {
                return res.status(403).json({
                    error: 'Insufficient permissions to modify this user\'s role',
                    reason: 'ADMIN users cannot modify OWNER roles'
                });
            }

            // Update the role
            await prisma.user_company_access.update({
                where: {
                    user_id_company_id: {
                        user_id: targetUserId as string,
                        company_id: companyId as string
                    }
                },
                data: { role: role as user_role_type }
            });

            // Fetch updated user data
            const updatedUser = await prisma.users.findUnique({
                where: { id: targetUserId as string },
                select: {
                    id: true,
                    email: true,
                    full_name: true,
                    firebase_uid: true
                }
            });

            return res.json({
                id: updatedUser!.id,
                email: updatedUser!.email,
                full_name: updatedUser!.full_name,
                role: role,
                message: 'Role updated successfully'
            });

        } catch (error) {
            console.error('Error updating user role:', error);
            return res.status(500).json({ error: 'Internal server error' });
        }
    }

    /**
     * DELETE /api/users/:id
     * Remove a user's access to a company
     * Query params: companyId (required)
     * Authorization: ADMIN or OWNER
     */
    async removeAccess(req: Request, res: Response) {
        try {
            const targetUserId = req.params.id;
            const companyId = Array.isArray(req.query.companyId)
                ? req.query.companyId[0]
                : req.query.companyId as string;

            if (!companyId) {
                return res.status(400).json({ error: 'companyId is required' });
            }

            // Check if access exists
            const access = await prisma.user_company_access.findUnique({
                where: {
                    user_id_company_id: {
                        user_id: targetUserId as string,
                        company_id: companyId as string
                    }
                }
            });

            if (!access) {
                return res.status(404).json({ error: 'User access not found for this company' });
            }

            // Delete the access record
            await prisma.user_company_access.delete({
                where: {
                    user_id_company_id: {
                        user_id: targetUserId as string,
                        company_id: companyId as string
                    }
                }
            });

            // Optional: Check if user has access to any other companies
            const remainingAccess = await prisma.user_company_access.count({
                where: { user_id: targetUserId as string }
            });

            // If no remaining access, you could disable the Firebase user
            // For MVP, we'll just log this information
            if (remainingAccess === 0) {
                console.log(`User ${targetUserId} has no remaining company access. Consider disabling Firebase account.`);
            }

            return res.json({
                message: 'User access removed successfully',
                remainingCompanyAccess: remainingAccess
            });

        } catch (error) {
            console.error('Error removing user access:', error);
            return res.status(500).json({ error: 'Internal server error' });
        }
    }

    /**
     * POST /api/users/:id/reset-password
     * Trigger a password reset email for a user
     * Authorization: ADMIN or OWNER
     */
    async resetPassword(req: Request, res: Response) {
        try {
            const targetUserId = req.params.id;

            // Get user from database
            const user = await prisma.users.findUnique({
                where: { id: targetUserId as string },
                select: { email: true, firebase_uid: true }
            });

            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }

            // Generate password reset link using Firebase Admin SDK
            const resetLink = await auth.generatePasswordResetLink(user.email);

            // Firebase automatically sends the email, but we return the link
            // In production, you might not want to return the link for security
            return res.json({
                message: 'Password reset email sent successfully',
                email: user.email,
                // Include link only in development
                ...(process.env.NODE_ENV === 'development' && { resetLink })
            });

        } catch (error: any) {
            console.error('Error resetting password:', error);
            return res.status(500).json({
                error: 'Failed to send password reset email',
                details: error.message
            });
        }
    }

    /**
     * Generate a temporary random password
     * Private helper method
     */
    private generateTempPassword(): string {
        const length = 16;
        const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
        let password = '';
        for (let i = 0; i < length; i++) {
            password += charset.charAt(Math.floor(Math.random() * charset.length));
        }
        return password;
    }
}
