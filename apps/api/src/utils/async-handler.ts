import type { NextFunction, Request, RequestHandler, Response } from 'express';

/**
 * Express 4 does not forward rejected promises from async handlers to the
 * error middleware — an unhandled rejection crashes the process. Wrap every
 * async controller with `ah()` so errors funnel into the central handler.
 */
export function ah(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}
