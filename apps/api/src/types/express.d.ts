import type { Role } from '@helpdesk/shared';

declare global {
  namespace Express {
    interface Request {
      /** Populated by attachUser when a valid session cookie is present. */
      user?: {
        id: string;
        email: string;
        name: string;
        role: Role;
      };
      sessionId?: string;
    }
  }
}

export {};
