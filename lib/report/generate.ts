import { prisma } from '@/lib/db';
import { assessBatch, DEFAULT_RULE_SPEC, type RuleSpec, type AssessmentResult } from '@/lib/grading';

export type ReportSummary = {
  total: number;
  yield: number;
  gradeDistribution: Record<string, number>;
  avgScore: number;
  totalRecommendedPriceCny: number;
  avgPriceCny: number;
  minPriceCny: number;
  maxPriceCny: number;
};

export type RecordAssessment = AssessmentResult & {
  recordId: string;
};

function summarize(assessments: AssessmentResult[]): ReportSummary {
  const gradeDistribution: Record<string, number> = {};
  let totalPrice = 0, totalScore = 0, minPrice = Infinity, maxPrice = -Infinity, pass = 0;
  for (const a of assessments) {
    gradeDistribution[a.grade] = (gradeDistribution[a.grade] ?? 0) + 1;
    totalPrice += a.recommendedPriceCny;
    totalScore += a.score;
    if (a.recommendedPriceCny > 0) {
      minPrice = Math.min(minPrice, a.recommendedPriceCny);
      maxPrice = Math.max(maxPrice, a.recommendedPriceCny);
    }
    if (a.grade !== 'FAIL') pass++;
  }
  if (!isFinite(minPrice)) minPrice = 0;
  if (!isFinite(maxPrice)) maxPrice = 0;
  return {
    total: assessments.length,
    yield: assessments.length > 0 ? pass / assessments.length : 0,
    gradeDistribution,
    avgScore: assessments.length > 0 ? totalScore / assessments.length : 0,
    totalRecommendedPriceCny: totalPrice,
    avgPriceCny: assessments.length > 0 ? totalPrice / assessments.length : 0,
    minPriceCny: minPrice,
    maxPriceCny: maxPrice,
  };
}

export async function createReport(opts: {
  batchId: string;
  userId: string;
  ruleSetId?: string;
}): Promise<{ reportId: string; summary: ReportSummary }> {
  const batch = await prisma.batch.findUnique({
    where: { id: opts.batchId },
    include: { dataset: { select: { kind: true } } },
  });
  if (!batch) throw new Error('batch not found');

  const ruleSet = opts.ruleSetId
    ? await prisma.ruleSet.findUnique({ where: { id: opts.ruleSetId } })
    : await prisma.ruleSet.findFirst({ where: { isDefault: true } });
  const spec: RuleSpec = ruleSet ? JSON.parse(ruleSet.rules) : DEFAULT_RULE_SPEC;

  if (batch.dataset.kind === 'BUILTIN_CHIP') {
    // 内置 chip dataset：走 Chip 表 + ChipAssessment
    const chips = await prisma.chip.findMany({ where: { batchId: batch.id } });
    const assessments = assessBatch(chips as any[], spec);
    const summary = summarize(assessments);

    const report = await prisma.report.create({
      data: {
        batchId: batch.id,
        generatedById: opts.userId,
        ruleSetId: ruleSet?.id,
        algorithm: 'rules+percentile',
        summary: JSON.stringify(summary),
        assessments: {
          create: chips.map((chip, idx) => ({
            chipId: chip.id,
            grade: assessments[idx].grade,
            score: assessments[idx].score,
            recommendedPriceCny: assessments[idx].recommendedPriceCny,
            rationale: assessments[idx].rationale,
          })),
        },
      },
    });
    return { reportId: report.id, summary };
  }

  // CUSTOM dataset：走 DatasetRecord，把每条 record 的 dataJson 解析后跑算法
  const records = await prisma.datasetRecord.findMany({
    where: { batchId: batch.id },
    select: { id: true, dataJson: true },
  });
  const rows = records.map((r) => JSON.parse(r.dataJson));
  const assessments = assessBatch(rows, spec);
  const summary = summarize(assessments);

  const recordAssessments: RecordAssessment[] = records.map((r, i) => ({
    recordId: r.id,
    ...assessments[i],
  }));

  const report = await prisma.report.create({
    data: {
      batchId: batch.id,
      generatedById: opts.userId,
      ruleSetId: ruleSet?.id,
      algorithm: 'rules+percentile',
      summary: JSON.stringify(summary),
      assessmentsJson: JSON.stringify(recordAssessments),
    },
  });
  return { reportId: report.id, summary };
}
