import type { Request, Response } from 'express';
import * as service from './tickets.service';

/** Controllers stay thin — auth'd user + validated input → service → DTO. */

export async function list(req: Request, res: Response) {
  res.json(await service.listTickets(req.user!, req.query as never));
}

export async function get(req: Request, res: Response) {
  res.json(await service.getTicket(req.user!, req.params.id as string));
}

export async function create(req: Request, res: Response) {
  const ticket = await service.createTicket(req.user!, req.body);
  res.status(201).json(ticket);
}

export async function update(req: Request, res: Response) {
  res.json(await service.updateTicket(req.user!, req.params.id as string, req.body));
}

export async function updateStatus(req: Request, res: Response) {
  res.json(await service.updateStatus(req.user!, req.params.id as string, req.body));
}

export async function assign(req: Request, res: Response) {
  res.json(await service.assignTicket(req.user!, req.params.id as string, req.body));
}

export async function listComments(req: Request, res: Response) {
  res.json(await service.listComments(req.user!, req.params.id as string));
}

export async function addComment(req: Request, res: Response) {
  const comment = await service.addComment(req.user!, req.params.id as string, req.body);
  res.status(201).json(comment);
}
