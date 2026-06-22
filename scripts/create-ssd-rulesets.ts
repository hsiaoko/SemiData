/* eslint-disable no-console */
// 用法：npx tsx scripts/create-ssd-rulesets.ts [创建者用户名] [规则JSON目录]
//
// 示例：
//   npx tsx scripts/create-ssd-rulesets.ts
//   npx tsx scripts/create-ssd-rulesets.ts zhuxk ./rules/ssd
//
// 规则 JSON 文件格式见 rules/ssd/*.json 示例。
// 每个文件会生成一个 RuleSet，并绑定到 slug = ssd-production 的数据集。

import { PrismaClient } from '@prisma/client';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import type { RuleSpec } from '../lib/grading';

const prisma = new PrismaClient();

const SSD_DATASET_SLUG = 'ssd-production';

const DEFAULT_RULES_DIR = path.join(process.cwd(), 'rules', 'ssd');

type RuleFile = {
  name: string;
  description?: string;
  isDefault?: boolean;
  spec: RuleSpec;
};

function listJsonFiles(dir: string): string[] {
  if (!statSync(dir).isDirectory()) {
    throw new Error(`目录不存在: ${dir}`);
  }
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => path.join(dir, f))
    .sort();
}

function loadRuleFile(filePath: string): RuleFile {
  const raw = readFileSync(filePath, 'utf-8');
  const parsed = JSON.parse(raw);
  if (!parsed.name || !parsed.spec) {
    throw new Error(`文件格式错误: ${filePath}，必须包含 name 和 spec`);
  }
  if (!parsed.spec.fields || !parsed.spec.priceTable) {
    throw new Error(`规则 spec 格式错误: ${filePath}，必须包含 fields 和 priceTable`);
  }
  return parsed as RuleFile;
}

async function getCreator(usernameArg?: string) {
  if (usernameArg) {
    const user = await prisma.user.findUnique({ where: { email: usernameArg } });
    if (!user) {
      console.error(`错误：找不到用户 ${usernameArg}`);
      process.exit(1);
    }
    return user;
  }

  const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
  if (!admin) {
    console.error('错误：找不到任何 ADMIN 用户');
    console.error('请先运行：npx tsx scripts/create-admin.ts <username> <password>');
    process.exit(1);
  }
  return admin;
}

async function main() {
  const [creatorUsername, rulesDirArg] = process.argv.slice(2);
  const rulesDir = rulesDirArg ? path.resolve(rulesDirArg) : DEFAULT_RULES_DIR;

  const creator = await getCreator(creatorUsername);
  console.log(`使用创建者: ${creator.email}`);

  const dataset = await prisma.dataset.findUnique({ where: { slug: SSD_DATASET_SLUG } });
  if (!dataset) {
    console.error(`错误：找不到数据集 ${SSD_DATASET_SLUG}`);
    console.error('请先运行：npx tsx scripts/create-ssd-dataset.ts [username]');
    process.exit(1);
  }

  const files = listJsonFiles(rulesDir);
  if (files.length === 0) {
    console.error(`目录下没有 .json 规则文件: ${rulesDir}`);
    process.exit(1);
  }

  console.log(`发现 ${files.length} 个规则文件`);

  for (const file of files) {
    const { name, description, isDefault, spec } = loadRuleFile(file);

    // 同一个数据集下，按名称去重更新
    const existingBinding = await prisma.datasetRuleSet.findFirst({
      where: {
        datasetId: dataset.id,
        ruleSet: { name, createdById: creator.id },
      },
      include: { ruleSet: true },
    });

    let ruleSetId: string;
    if (existingBinding) {
      const updated = await prisma.ruleSet.update({
        where: { id: existingBinding.ruleSet.id },
        data: {
          description: description ?? existingBinding.ruleSet.description,
          rules: JSON.stringify(spec),
          isDefault: isDefault ?? existingBinding.ruleSet.isDefault,
        },
      });
      ruleSetId = updated.id;
      console.log(`✓ 更新规则集: ${updated.name} (${path.basename(file)})`);
    } else {
      const created = await prisma.ruleSet.create({
        data: {
          name,
          description: description ?? `来自 ${path.basename(file)}`,
          rules: JSON.stringify(spec),
          isDefault: isDefault ?? false,
          createdById: creator.id,
        },
      });
      ruleSetId = created.id;
      await prisma.datasetRuleSet.create({
        data: { datasetId: dataset.id, ruleSetId: created.id },
      });
      console.log(`✓ 新建规则集: ${created.name} (${path.basename(file)})`);
    }

    // 打印规则要点
    const rejectFields = (spec.hardReject ?? []).map((r) => r.field).join(', ') || '无';
    console.log(`  - 评分字段: ${spec.fields.map((f) => f.field).join(', ')}`);
    console.log(`  - 硬否决字段: ${rejectFields}`);
    console.log(`  - 价格表: ${JSON.stringify(spec.priceTable)}`);
  }

  console.log(`\n全部完成，已绑定到数据集: ${dataset.name}`);
  console.log('上传 SSD 数据后，可在网页上选择这些规则集生成报告。');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
