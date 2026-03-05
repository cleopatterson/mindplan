import { initializeApp, cert, type ServiceAccount } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';
import type { Request, Response, NextFunction } from 'express';

// Lazy init — env vars aren't available at import time (dotenv runs after imports)
let adminAuth: Auth;
function getAdminAuth() {
  if (!adminAuth) {
    const serviceAccount: ServiceAccount = {
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    };
    initializeApp({ credential: cert(serviceAccount) });
    adminAuth = getAuth();
  }
  return adminAuth;
}

export interface AuthUser {
  uid: string;
  email: string | undefined;
  name: string | undefined;
}

/** Verify Firebase ID token from Authorization header */
export async function verifyAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ success: false, error: 'Missing authentication token' });
    return;
  }

  const token = header.slice(7);
  try {
    const decoded = await getAdminAuth().verifyIdToken(token);
    (req as Request & { user: AuthUser }).user = {
      uid: decoded.uid,
      email: decoded.email,
      name: decoded.name,
    };
    next();
  } catch {
    res.status(401).json({ success: false, error: 'Invalid authentication token' });
  }
}
