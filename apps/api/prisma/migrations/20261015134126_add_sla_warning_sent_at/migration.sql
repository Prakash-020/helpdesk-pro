-- DropIndex
DROP INDEX "tickets_subject_trgm";

-- AlterTable
ALTER TABLE "tickets" ADD COLUMN     "sla_warning_sent_at" TIMESTAMPTZ(6);
