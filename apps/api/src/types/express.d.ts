import type { Role } from '@helpdesk/shared';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
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
