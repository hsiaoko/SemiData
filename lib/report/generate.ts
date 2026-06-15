import { prisma } from '@/lib/db';
import { assessBatch, DEFAULT_RULE_SPEC, type RuleSpec } from '@/lib/grading';

export type ReportSummary = {
  total: number;
  yield: number; // 非 FAIL 比例
  gradeDistribution: Record<string, number>;
  avgScore: number;
  totalRecommendedPriceCny: number;
  avgPriceCny: number;
  minPriceCny: number;
  maxPriceCny: number;
};

export async function createReport(opts: {
  batchId: string;
  userId: string;
  ruleSetId?: string;
}): Promise<{ reportId: string; summary: ReportSummary }> {
  const ruleSet = opts.ruleSetId
    ? await prisma.ruleSet.findUnique({ where: { id: opts.ruleSetId } })
    : await prisma.ruleSet.findFirst({ where: { isDefault: true } });

  const spec: RuleSpec = ruleSet ? JSON.parse(ruleSet.rules) : DEFAULT_RULE_SPEC;

  const chips = await prisma.chip.findMany({ where: { batchId: opts.batchId } });
  const assessments = assessBatch(chips as any[], spec);

  // 汇总
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
  const summary: ReportSummary = {
    total: assessments.length,
    yield: assessments.length > 0 ? pass / assessments.length : 0,
    gradeDistribution,
    avgScore: assessments.length > 0 ? totalScore / assessments.length : 0,
    totalRecommendedPriceCny: totalPrice,
    avgPriceCny: assessments.length > 0 ? totalPrice / assessments.length : 0,
    minPriceCny: minPrice,
    maxPriceCny: maxPrice,
  };

  const report = await prisma.report.create({
    data: {
      batchId: opts.batchId,
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
