-- CreateEnum
DO $$
BEGIN
    CREATE TYPE "LeaveStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'MORE_INFORMATION', 'ALTERNATIVE_SUGGESTED', 'CANCELLED');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "LeaveType" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeaveType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "LeaveRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "managerId" TEXT,
    "leaveTypeId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "attachmentUrl" TEXT,
    "status" "LeaveStatus" NOT NULL DEFAULT 'PENDING',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeaveRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "LeaveComment" (
    "id" TEXT NOT NULL,
    "leaveRequestId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeaveComment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "LeaveType_name_key" ON "LeaveType"("name");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "LeaveRequest_userId_idx" ON "LeaveRequest"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "LeaveRequest_managerId_idx" ON "LeaveRequest"("managerId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "LeaveRequest_leaveTypeId_idx" ON "LeaveRequest"("leaveTypeId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "LeaveRequest_status_idx" ON "LeaveRequest"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "LeaveRequest_requestedAt_idx" ON "LeaveRequest"("requestedAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "LeaveComment_leaveRequestId_idx" ON "LeaveComment"("leaveRequestId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "LeaveComment_authorId_idx" ON "LeaveComment"("authorId");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'LeaveRequest_userId_fkey'
    ) THEN
        ALTER TABLE "LeaveRequest"
        ADD CONSTRAINT "LeaveRequest_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'LeaveRequest_managerId_fkey'
    ) THEN
        ALTER TABLE "LeaveRequest"
        ADD CONSTRAINT "LeaveRequest_managerId_fkey"
        FOREIGN KEY ("managerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'LeaveRequest_leaveTypeId_fkey'
    ) THEN
        ALTER TABLE "LeaveRequest"
        ADD CONSTRAINT "LeaveRequest_leaveTypeId_fkey"
        FOREIGN KEY ("leaveTypeId") REFERENCES "LeaveType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'LeaveComment_leaveRequestId_fkey'
    ) THEN
        ALTER TABLE "LeaveComment"
        ADD CONSTRAINT "LeaveComment_leaveRequestId_fkey"
        FOREIGN KEY ("leaveRequestId") REFERENCES "LeaveRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'LeaveComment_authorId_fkey'
    ) THEN
        ALTER TABLE "LeaveComment"
        ADD CONSTRAINT "LeaveComment_authorId_fkey"
        FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
