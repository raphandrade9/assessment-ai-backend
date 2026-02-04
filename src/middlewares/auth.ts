import { Request, Response, NextFunction } from 'express';
import { auth } from '../config/firebase';
import prisma from '../lib/prisma';

// Extend Express Request to include user
declare global {
    namespace Express {
        interface Request {
            user?: any;
        }
    }
}

export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];

    try {
        const decodedToken = await auth.verifyIdToken(token);
        const { uid, email, name, picture } = decodedToken;

        if (!email) {
            return res.status(401).json({ error: 'Invalid token: email not found' });
        }

        // User Sync Logic
        let user = await prisma.users.findUnique({
            where: { firebase_uid: uid },
        });

        if (!user) {
            // Check if user exists by email but without firebase_uid
            user = await prisma.users.findUnique({
                where: { email },
            });

            if (user) {
                // Link existing user to Firebase
                user = await prisma.users.update({
                    where: { email },
                    data: { firebase_uid: uid, last_login: new Date() },
                });
            } else {
                // Create new user (Sync on Login)
                user = await prisma.users.create({
                    data: {
                        firebase_uid: uid,
                        email,
                        full_name: name || email.split('@')[0], // Provisory name from email split
                        avatar_url: picture,
                        last_login: new Date(),
                    },
                });
            }
        } else {
            // Just update login timestamp
            await prisma.users.update({
                where: { id: user.id },
                data: { last_login: new Date() },
            });
        }

        // Attach user (UUID) to request
        req.user = user;
        next();
    } catch (error) {
        console.error('Firebase Auth Error:', error);
        return res.status(401).json({ error: 'Unauthorized' });
    }
};
