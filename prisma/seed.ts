/* eslint-disable @typescript-eslint/no-var-requires */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { DEFAULT_RULE_SPEC, assessBatch } from '../lib/grading';
import { BUILTIN_CHIP_SCHEMA, BUILTIN_CHIP_SLUG } from '../lib/datasets/builtin';
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const prisma = new PrismaClient();

function rnorm(mean: number, std: number): number {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return mean + std * Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}
function chance(p: number): boolean { return Math.random() < p; }

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
    dieY: Math.floor((i - 1) / 25) % 20 - 10,
    productModel: 'SD-MCU-7A',
    testTempC: 25,
    testVoltageV: 3.3,
    packageType: 'QFN48',
    vthV: Math.round(vth * 1000) / 1000,
    iddUa: Math.round(idd * 10) / 10,
    leakageNa: Math.round(Math.max(0, leakage) * 10) / 10,
    frequencyMhz: Math.round(Math.max(0, freq) * 10) / 10,
    powerMw: Math.round((idd * 3.3) / 1000 * 100) / 100,
    passCount,
    failCount,
    binCode: failCount > 0 ? 'BIN5' : freq > 470 ? 'BIN1' : freq > 430 ? 'BIN2' : 'BIN3',
    testDurationS: Math.round(rnorm(2.1, 0.18) * 100) / 100,
    testTimestamp: new Date(Date.now() - Math.floor(Math.random() * 1000 * 60 * 60 * 72)),
  };
}

async function main() {
  console.log('🧪 seeding…');

  const adminPw = await bcrypt.hash('admin1234', 10);
  const userPw = await bcrypt.hash('demo1234', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin' },
    update: { company: 'YieldEx 内部' },
    create: { email: 'admin', passwordHash: adminPw, name: '管理员', company: 'YieldEx 内部', role: 'ADMIN' },
  });
  const demoUser = await prisma.user.upsert({
    where: { email: 'demo' },
    update: { company: '示例公司' },
    create: { email: 'demo', passwordHash: userPw, name: '测试工程师', company: '示例公司', role: 'USER' },
  });
  console.log(`✓ users: admin=${admin.email} demo=${demoUser.email}（demo 默认无任何数据集权限）`);

  // 1) 内置 chip dataset
  const chipDataset = await prisma.dataset.upsert({
    where: { slug: BUILTIN_CHIP_SLUG },
    update: { schema: JSON.stringify(BUILTIN_CHIP_SCHEMA) },
    create: {
      slug: BUILTIN_CHIP_SLUG,
      name: '芯片封测数据',
      description: '内置数据集：完整测试参数 + 自动分级 + 推荐定价报告',
      kind: 'BUILTIN_CHIP',
      schema: JSON.stringify(BUILTIN_CHIP_SCHEMA),
      createdById: admin.id,
    },
  });
  console.log(`✓ dataset(BUILTIN_CHIP): ${chipDataset.name}`);

  // 2) 默认规则集
  const defaultRuleSet = await prisma.ruleSet.upsert({
    where: { id: 'default-ruleset-v1' },
    update: { rules: JSON.stringify(DEFAULT_RULE_SPEC) },
    create: {
      id: 'default-ruleset-v1',
      name: '默认规则集 v1',
      description: '基于 frequencyMhz / leakageNa / vthV / iddUa 的标准评级',
      rules: JSON.stringify(DEFAULT_RULE_SPEC),
      isDefault: true,
      createdById: admin.id,
    },
  });
  console.log(`✓ default ruleset: ${defaultRuleSet.name}`);

  // 3) 示例批次（清理旧的）
  await prisma.batch.deleteMany({ where: { name: { startsWith: '[示例]' } } });
  const chipsData = Array.from({ length: 600 }, (_, i) => genChip(i + 1));
  const batch = await prisma.batch.create({
    data: {
      datasetId: chipDataset.id,
      name: '[示例] LOT-2026Q2-1 封测批次',
      description: '内置演示数据，共 600 颗 SD-MCU-7A',
      fileName: 'demo-batch-lot2026q2.csv',
      fileSize: 0,
      rowCount: chipsData.length,
      uploadedById: admin.id,
      chips: { create: chipsData },
    },
    include: { chips: true },
  });
  console.log(`✓ batch: ${batch.name} (${batch.chips.length} chips)`);

  const assessments = assessBatch(batch.chips as any, DEFAULT_RULE_SPEC);
  const summary = summarize(assessments);
  await prisma.report.create({
    data: {
      batchId: batch.id,
      generatedById: admin.id,
      ruleSetId: defaultRuleSet.id,
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
  console.log(`✓ report · 总价 ¥${summary.totalRecommendedPriceCny.toFixed(2)}`);

  // 4) 一个自定义 Dataset 演示
  await prisma.dataset.upsert({
    where: { slug: 'reliability-trial' },
    update: {},
    create: {
      slug: 'reliability-trial',
      name: '老化测试',
      description: '示例自定义数据集 — 老化试验记录',
      kind: 'CUSTOM',
      schema: JSON.stringify({
        fields: [
          { name: 'sample_id', label: '试样编号', type: 'string', required: true },
          { name: 'hours', label: '老化时长 (h)', type: 'number', required: true },
          { name: 'failure_mode', label: '失效模式', type: 'string' },
          { name: 'passed', label: '是否通过', type: 'boolean' },
          { name: 'observed_at', label: '观察时间', type: 'datetime' },
        ],
      }),
      createdById: admin.id,
    },
  });
  console.log(`✓ dataset(CUSTOM): 老化测试`);

  // 5) 示例 CSV
  const samplePath = path.join(process.cwd(), 'public', 'sample-data');
  mkdirSync(samplePath, { recursive: true });
  const headers = [
    'chip_id', 'lot_id', 'wafer_id', 'die_x', 'die_y', 'product_model',
    'test_temp_c', 'test_voltage_v', 'package_type',
    'vth_v', 'idd_ua', 'leakage_na', 'frequency_mhz', 'power_mw',
    'pass_count', 'fail_count', 'bin_code', 'test_duration_s', 'test_timestamp',
  ];
  const sampleRows = Array.from({ length: 200 }, (_, i) => genChip(10000 + i));
  const csv = [
    headers.join(','),
    ...sampleRows.map((c) => [
      c.chipId, c.lotId, c.waferId, c.dieX, c.dieY, c.productModel,
      c.testTempC, c.testVoltageV, c.packageType,
      c.vthV, c.iddUa, c.leakageNa, c.frequencyMhz, c.powerMw,
      c.passCount, c.failCount, c.binCode, c.testDurationS, c.testTimestamp.toISOString(),
    ].join(',')),
  ].join('\n');
  writeFileSync(path.join(samplePath, 'sample-200.csv'), csv);
  console.log(`✓ sample CSV: public/sample-data/sample-200.csv`);

  console.log('\n登录账号：');
  console.log('  管理员: admin / admin1234 — 全部权限');
  console.log('  普通用户: demo / demo1234 — 默认无任何数据集权限');
  console.log('  新注册用户登录后进入"等待授权"页，需 admin 在 /datasets/[id] 勾选授权\n');
}

function summarize(assessments: ReturnType<typeof assessBatch>) {
  const gradeDist: Record<string, number> = {};
  let totalPrice = 0, totalScore = 0, pass = 0;
  let minPrice = Infinity, maxPrice = -Infinity;
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

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
