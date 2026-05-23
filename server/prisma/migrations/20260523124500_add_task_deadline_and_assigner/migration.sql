ALTER TABLE "Task"
  ADD COLUMN IF NOT EXISTS "deadlineAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "assignedById" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'Task_assignedById_fkey'
  ) THEN
    ALTER TABLE "Task"
      ADD CONSTRAINT "Task_assignedById_fkey"
      FOREIGN KEY ("assignedById") REFERENCES "User"("id")
      ON DELETE SET NULL
      ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "Task_assignedById_idx" ON "Task"("assignedById");
CREATE INDEX IF NOT EXISTS "Task_deadlineAt_idx" ON "Task"("deadlineAt");
