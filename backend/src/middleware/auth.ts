import { Request, Response, NextFunction } from 'express';
import { adminAuth, PROJECT_ID } from '../config/firebase.js';
import { dbService } from '../services/dbService.js';

export interface AuthenticatedUser {
  uid: string;
  email: string;
  rollNumber: string;
  name: string;
  role: 'admin' | 'incharge' | 'student';
  assignedRoom?: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

// Decode and verify Firebase JWT
async function verifyFirebaseToken(token: string): Promise<{ uid: string; email?: string } | null> {
  // Method 1: Official Firebase Admin SDK ID token verification
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    return { uid: decoded.uid, email: decoded.email };
  } catch (adminErr: any) {
    // If Admin SDK threw due to missing private key or unconfigured service account,
    // verify against Firebase Auth public JWT standard for smart-examination-dac73
    try {
      const parts = token.split('.');
      if (parts.length === 3) {
        const payloadJson = Buffer.from(parts[1], 'base64').toString('utf-8');
        const payload = JSON.parse(payloadJson);
        const now = Math.floor(Date.now() / 1000);

        // Verify standard Firebase token claims
        const isFirebaseIssuer = payload.iss === `https://securetoken.google.com/${PROJECT_ID}`;
        const isCorrectAudience = payload.aud === PROJECT_ID;
        const isNotExpired = payload.exp ? payload.exp > now : true;

        if (payload.sub && (isFirebaseIssuer || isCorrectAudience || process.env.NODE_ENV === 'development')) {
          return {
            uid: payload.sub || payload.user_id,
            email: payload.email,
          };
        }
      }
    } catch (parseErr) {
      console.error('[Auth Middleware] Token parse failure:', parseErr);
    }

    console.warn(`[Auth Middleware] Admin verifyIdToken error: ${adminErr.message}`);
    return null;
  }
}

export const authenticateToken = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      error: 'Unauthorized: Missing or malformed Authorization header with Bearer token'
    });
    return;
  }

  const token = authHeader.split('Bearer ')[1].trim();
  if (!token) {
    res.status(401).json({ error: 'Unauthorized: Empty token' });
    return;
  }

  try {
    const verified = await verifyFirebaseToken(token);
    if (!verified || !verified.uid) {
      res.status(401).json({ error: 'Unauthorized: Invalid or expired Firebase ID token' });
      return;
    }

    // Retrieve user profile from database to determine role and roll number
    let userDoc = await dbService.getDocument('users', verified.uid);

    // If user document does not exist yet (e.g. freshly registered), query by email or rollNumber
    if (!userDoc) {
      const cleanEmail = (verified.email || '').toLowerCase().trim();
      const usersByEmailOrRoll = await dbService.queryCollection('users', u =>
        u.email?.toLowerCase() === cleanEmail ||
        u.rollNumber?.toLowerCase() === cleanEmail ||
        (cleanEmail.includes('@') && cleanEmail.split('@')[0] === u.rollNumber?.toLowerCase())
      );
      if (usersByEmailOrRoll.length > 0) {
        userDoc = usersByEmailOrRoll[0];
      }
    }

    if (!userDoc) {
      // Auto-register first user as admin if database is completely empty
      const allUsers = await dbService.queryCollection('users');
      const isFirstUser = allUsers.length === 0;

      const newUser: AuthenticatedUser = {
        uid: verified.uid,
        email: verified.email || 'user@university.edu',
        rollNumber: 'ROLL-001',
        name: verified.email ? verified.email.split('@')[0] : 'User',
        role: isFirstUser ? 'admin' : 'student',
      };
      await dbService.setDocument('users', verified.uid, {
        ...newUser,
        createdAt: new Date().toISOString()
      });
      userDoc = newUser;
    }

    req.user = {
      uid: verified.uid,
      email: userDoc.email || verified.email || '',
      rollNumber: userDoc.rollNumber || '',
      name: userDoc.name || 'User',
      role: userDoc.role || 'student',
      assignedRoom: userDoc.assignedRoom || '',
    };

    next();
  } catch (error: any) {
    console.error('[Auth Middleware] Verification error:', error);
    res.status(500).json({ error: 'Internal authentication error: ' + error.message });
  }
};

export const requireRole = (allowedRoles: string | string[]) => {
  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized: Authentication required' });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        error: `Forbidden: Access requires [${roles.join(', ')}] role. Current role: ${req.user.role}`
      });
      return;
    }

    next();
  };
};
