/* eslint-disable no-console */
// 用法：npx tsx scripts/generate-mock.ts <数量> [批次名] [规则集名] [创建者用户名] [规则JSON文件]
//
// 示例：
//   npx tsx scripts/generate-mock.ts 500
//   npx tsx scripts/generate-mock.ts 1000 "高压验证批次" "高压规则集" admin ./rules/strict.json
//
// 说明：
// - 数量：生成多少颗芯片（默认 100）
// - 批次名：默认 "[模拟] 批次-<时间戳>"
// - 规则集名：默认 "[模拟] 规则集-<时间戳>"
// - 创建者用户名：默认 admin（对应 User.email）
// - 规则JSON文件：可选，传入则使用该规则；否则使用 DEFAULT_RULE_SPEC

import { PrismaClient } from '@prisma/client';
import { readFileSync, existsSync } from 'node:fs';
import { assessBatch, DEFAULT_RULE_SPEC, type RuleSpec } from '../lib/grading';
import { BUILTIN_CHIP_SCHEMA, BUILTIN_CHIP_SLUG } from '../lib/datasets/builtin';

const prisma = new PrismaClient();

function rnorm(mean: number, std: number): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return mean + std * Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

function chance(p: number): boolean {
  return Math.random() < p;
}

function genChip(i: number) {
  const isBad = chance(0.06);
  const isMarginal = chance(0.15);
  const freq = isBad ? rnorm(350, 30) : isMarginal ? rnorm(440, 22) : rnorm(490, 18);
  const leakage = isBad ? rnorm(120, 30) : isMarginal ? rnorm(55, 12) : rnorm(28, 9);
  const vth = rnorm(0.70, isBad ? 0.08 : 0.03);
  const idd = rnorm(isBad ? 160 : 85, 18);
  const failCount = isBad ? 1 + Math.floor(Math.random() * 3) : 0;
  const passCount = 128 - failCount;

  return {
    chipId: `SD-${String(i).padStart(5, '0')}`,
    lotId: `LOT-2026Q2-${Math.ceil(i / 100)}`,
    waferId: `W${Math.ceil(i / 25)}`,
    dieX: ((i - 1) % 25) - 12,
    dieY: (Math.floor((i - 1) / 25) % 20) - 10,
    productModel: 'SD-MCU-7A',
    testTempC: 25,
    testVoltageV: 3.3,
    packageType: 'QFN48',
    vthV: Math.round(vth * 1000) / 1000,
    iddUa: Math.round(idd * 10) / 10,
    leakageNa: Math.round(Math.max(0, leakage) * 10) / 10,
    frequencyMhz: Math.round(Math.max(0, freq) * 10) / 10,
    powerMw: Math.round(((idd * 3.3) / 1000) * 100) / 100,
    passCount,
    failCount,
    binCode: failCount > 0 ? 'BIN5' : freq > 470 ? 'BIN1' : freq > 430 ? 'BIN2' : 'BIN3',
    testDurationS: Math.round(rnorm(2.1, 0.18) * 100) / 100,
    testTimestamp: new Date(Date.now() - Math.floor(Math.random() * 1000 * 60 * 60 * 72)),
  };
}

function summarize(assessments: ReturnType<typeof assessBatch>) {
  const gradeDist: Record<string, number> = {};
  let totalPrice = 0;
  let totalScore = 0;
  let pass = 0;
  let minPrice = Infinity;
  let maxPrice = -Infinity;

  for (const a of assessments) {
    gradeDist[a.grade] = (gradeDist[a.grade] ?? 0) + 1;
    totalPrice += a.recommendedPriceCny;
    totalScore += a.score;
    if (a.grade !== 'FAIL') pass++;
    if (a.recommendedPriceCny > 0) {
      minPrice = Math.min(minPrice, a.recommendedPriceCny);
      maxPrice = Math.max(maxPrice, a.recommendedPriceCny);
    }
  }

  if (!isFinite(minPrice)) minPrice = 0;
  if (!isFinite(maxPrice)) maxPrice = 0;

  return {
    total: assessments.length,
    yield: assessments.length > 0 ? pass / assessments.length : 0,
    gradeDistribution: gradeDist,
    avgScore: assessments.length > 0 ? totalScore / assessments.length : 0,
    totalRecommendedPriceCny: totalPrice,
    avgPriceCny: assessments.length > 0 ? totalPrice / assessments.length : 0,
    minPriceCny: minPrice,
    maxPriceCny: maxPrice,
  };
}

function loadRuleSpec(path?: string): RuleSpec {
  if (!path) return DEFAULT_RULE_SPEC;
  if (!existsSync(path)) {
    throw new Error(`规则文件不存在: ${path}`);
  }
  const raw = readFileSync(path, 'utf-8');
  const parsed = JSON.parse(raw);
  if (!parsed.fields || !parsed.priceTable) {
    throw new Error('规则文件格式错误，必须包含 fields 和 priceTable');
  }
  return parsed as RuleSpec;
}

async function main() {
  const [
    countArg,
    batchNameArg,
    ruleSetNameArg,
    creatorUsernameArg,
    ruleFileArg,
  ] = process.argv.slice(2);

  const count = countArg ? parseInt(countArg, 10) : 100;
  if (Number.isNaN(count) || count <= 0) {
    console.error('错误：数量必须是大于 0 的整数');
    process.exit(1);
  }

  const now = Date.now();
  const batchName = batchNameArg ?? `[模拟] 批次-${now}`;
  const ruleSetName = ruleSetNameArg ?? `[模拟] 规则集-${now}`;
  const creatorUsername = creatorUsernameArg ?? 'admin';
  const ruleSpec = loadRuleSpec(ruleFileArg);

  const creator = await prisma.user.findUnique({ where: { email: creatorUsername } });
  if (!creator) {
    console.error(`错误：找不到用户 ${creatorUsername}，请先用 create-admin.ts 创建`);
    process.exit(1);
  }

  // 确保内置芯片数据集存在
  const chipDataset = await prisma.dataset.upsert({
    where: { slug: BUILTIN_CHIP_SLUG },
    update: { schema: JSON.stringify(BUILTIN_CHIP_SCHEMA) },
    create: {
      slug: BUILTIN_CHIP_SLUG,
      name: '芯片封测数据',
      description: '内置数据集：完整测试参数 + 自动分级 + 推荐定价报告',
      kind: 'BUILTIN_CHIP',
      schema: JSON.stringify(BUILTIN_CHIP_SCHEMA),
      createdById: creator.id,
    },
  });

  // 创建规则集
  const ruleSet = await prisma.ruleSet.create({
    data: {
      name: ruleSetName,
      description: `模拟生成的规则集，共 ${count} 颗芯片`,
      rules: JSON.stringify(ruleSpec),
      isDefault: false,
      createdById: creator.id,
    },
  });

  // 绑定到数据集（这样 UI 里才能选到这个规则集）
  await prisma.datasetRuleSet.create({
    data: { datasetId: chipDataset.id, ruleSetId: ruleSet.id },
  });

  // 生成芯片数据
  const chipsData = Array.from({ length: count }, (_, i) => genChip(i + 1));
  const batch = await prisma.batch.create({
    data: {
      datasetId: chipDataset.id,
      name: batchName,
      description: `模拟生成批次，共 ${count} 颗 SD-MCU-7A`,
      fileName: `${batchName.replace(/\s+/g, '_')}.csv`,
      fileSize: 0,
      rowCount: chipsData.length,
      uploadedById: creator.id,
      chips: { create: chipsData },
    },
    include: { chips: true },
  });

  // 评级并生成报告
  const assessments = assessBatch(batch.chips as any, ruleSpec);
  const summary = summarize(assessments);

  await prisma.report.create({
    data: {
      batchId: batch.id,
      generatedById: creator.id,
      ruleSetId: ruleSet.id,
      algorithm: 'rules+percentile',
      summary: JSON.stringify(summary),
      assessments: {
        create: batch.chips.map((chip, idx) => ({
          chipId: chip.id,
          grade: assessments[idx].grade,
          score: assessments[idx].score,
          recommendedPriceCny: assessments[idx].recommendedPriceCny,
          rationale: assessments[idx].rationale,
        })),
      },
    },
  });

  console.log(`✓ 数据集: ${chipDataset.name}`);
  console.log(`✓ 规则集: ${ruleSet.name}`);
  console.log(`✓ 批次: ${batch.name} (${batch.chips.length} chips)`);
  console.log(`✓ 报告: 总价 ¥${summary.totalRecommendedPriceCny.toFixed(2)}，良率 ${(summary.yield * 100).toFixed(1)}%`);
  console.log(`  等级分布: ${JSON.stringify(summary.gradeDistribution)}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
