import { PrismaClient } from '@prisma/client';
import { isProd, isTest } from '../config/env';

/**
 * Single PrismaClient for the process. In dev, tsx watch re-imports modules
 * on reload — caching on globalThis avoids exhausting DB connections.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: isProd || isTest ? ['warn', 'error'] : ['warn', 'error'],
  });

if (!isProd) globalForPrisma.prisma = prisma;
