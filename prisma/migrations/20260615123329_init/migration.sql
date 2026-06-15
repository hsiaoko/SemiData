-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'USER',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Batch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "rowCount" INTEGER NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Batch_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Chip" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "batchId" TEXT NOT NULL,
    "chipId" TEXT NOT NULL,
    "lotId" TEXT,
    "waferId" TEXT,
    "dieX" INTEGER,
    "dieY" INTEGER,
    "productModel" TEXT,
    "testTempC" REAL,
    "testVoltageV" REAL,
    "packageType" TEXT,
    "vthV" REAL,
    "iddUa" REAL,
    "leakageNa" REAL,
    "frequencyMhz" REAL,
    "powerMw" REAL,
    "passCount" INTEGER,
    "failCount" INTEGER,
    "binCode" TEXT,
    "testDurationS" REAL,
    "testTimestamp" DATETIME,
    "rawExtras" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Chip_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Report" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "batchId" TEXT NOT NULL,
    "generatedById" TEXT NOT NULL,
    "ruleSetId" TEXT,
    "algorithm" TEXT NOT NULL DEFAULT 'rules+percentile',
    "summary" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Report_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Report_generatedById_fkey" FOREIGN KEY ("generatedById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Report_ruleSetId_fkey" FOREIGN KEY ("ruleSetId") REFERENCES "RuleSet" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ChipAssessment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reportId" TEXT NOT NULL,
    "chipId" TEXT NOT NULL,
    "grade" TEXT NOT NULL,
    "score" REAL NOT NULL,
    "recommendedPriceCny" REAL NOT NULL,
    "rationale" TEXT NOT NULL,
    CONSTRAINT "ChipAssessment_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "Report" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ChipAssessment_chipId_fkey" FOREIGN KEY ("chipId") REFERENCES "Chip" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RuleSet" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "rules" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RuleSet_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Batch_uploadedById_idx" ON "Batch"("uploadedById");

-- CreateIndex
CREATE INDEX "Chip_batchId_idx" ON "Chip"("batchId");

-- CreateIndex
CREATE INDEX "Chip_chipId_idx" ON "Chip"("chipId");

-- CreateIndex
CREATE INDEX "Chip_lotId_waferId_idx" ON "Chip"("lotId", "waferId");

-- CreateIndex
CREATE INDEX "Report_batchId_idx" ON "Report"("batchId");

-- CreateIndex
CREATE INDEX "ChipAssessment_grade_idx" ON "ChipAssessment"("grade");

-- CreateIndex
CREATE UNIQUE INDEX "ChipAssessment_reportId_chipId_key" ON "ChipAssessment"("reportId", "chipId");
