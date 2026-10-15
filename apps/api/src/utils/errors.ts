import { ERROR_CODES, type ErrorCode } from '@helpdesk/shared';

/**
 * Application error with a stable, client-facing code.
 * Thrown anywhere in the request pipeline; the error middleware maps it to
 * the standard { error: { code, message, details } } response.
 */
export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: ErrorCode,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const errors = {
  unauthenticated: (message = 'Authentication required') =>
    new AppError(401, ERROR_CODES.UNAUTHENTICATED, message),
  sessionExpired: () => new AppError(401, ERROR_CODES.SESSION_EXPIRED, 'Session has expired'),
  forbidden: (message = 'You do not have permission to perform this action') =>
    new AppError(403, ERROR_CODES.FORBIDDEN, message),
  notFound: (resource = 'Resource') =>
    new AppError(404, ERROR_CODES.NOT_FOUND, `${resource} not found`),
  conflict: (message: string, details?: unknown) =>
    new AppError(409, ERROR_CODES.CONFLICT, message, details),
  forbiddenTransition: (message: string) =>
    new AppError(409, ERROR_CODES.FORBIDDEN_TRANSITION, message),
  badRequest: (message: string, details?: unknown) =>
    new AppError(400, ERROR_CODES.VALIDATION_ERROR, message, details),
};
