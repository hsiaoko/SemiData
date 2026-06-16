-- CreateTable
CREATE TABLE "DatasetRuleSet" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "datasetId" TEXT NOT NULL,
    "ruleSetId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DatasetRuleSet_datasetId_fkey" FOREIGN KEY ("datasetId") REFERENCES "Dataset" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DatasetRuleSet_ruleSetId_fkey" FOREIGN KEY ("ruleSetId") REFERENCES "RuleSet" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "DatasetRuleSet_datasetId_idx" ON "DatasetRuleSet"("datasetId");

-- CreateIndex
CREATE INDEX "DatasetRuleSet_ruleSetId_idx" ON "DatasetRuleSet"("ruleSetId");

-- CreateIndex
CREATE UNIQUE INDEX "DatasetRuleSet_datasetId_ruleSetId_key" ON "DatasetRuleSet"("datasetId", "ruleSetId");
