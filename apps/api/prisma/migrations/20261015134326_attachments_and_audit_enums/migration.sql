-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'TICKET_DELETED';
ALTER TYPE "AuditAction" ADD VALUE 'COMMENT_EDITED';
ALTER TYPE "AuditAction" ADD VALUE 'COMMENT_DELETED';
ALTER TYPE "AuditAction" ADD VALUE 'ATTACHMENT_UPLOADED';
ALTER TYPE "AuditAction" ADD VALUE 'ATTACHMENT_DELETED';
ALTER TYPE "AuditAction" ADD VALUE 'SLA_TARGET_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE 'SLA_WARNING_SENT';

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'ATTACHMENT_ADDED';
