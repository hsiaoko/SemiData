/* eslint-disable no-console */
// 用法：npx tsx scripts/create-ssd-dataset.ts [创建者用户名]
// 说明：仅创建/更新 SSD 测试数据集（CUSTOM）及其 schema，不生成模拟数据行。

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const SSD_DATASET_SCHEMA = {
  fields: [
    { name: 'batch_name', label: '所在批次', type: 'string' },
    { name: 'index_no', label: 'Index', type: 'integer', required: true },
    { name: 'customer', label: 'Customer', type: 'string', required: true },
    { name: 'user_id', label: 'User ID', type: 'string', required: true },
    { name: 'machine_id', label: 'Machine ID', type: 'string', required: true },
    { name: 'tray_id', label: 'Tray ID', type: 'string' },
    { name: 'operator', label: 'Operator', type: 'string', required: true },
    { name: 'port_number', label: 'Port Number', type: 'integer' },
    { name: 'ymd', label: 'YMD', type: 'datetime' },
    { name: 'hms', label: 'HMS', type: 'string' },
    { name: 'duration_s', label: 'Duration (second)', type: 'number' },
    { name: 'action', label: 'Action', type: 'string', required: true },
    { name: 'result', label: 'Result', type: 'string', required: true },
    { name: 'mid_hex', label: 'MID (Hex)', type: 'string' },
    { name: 'oid_hex', label: 'OID (Hex)', type: 'string' },
    { name: 'product_name', label: 'ProductName', type: 'string' },
    { name: 'revision_hex', label: 'Revision (Hex)', type: 'string' },
    { name: 'manufacture_date', label: 'ManufactureDate', type: 'datetime' },
    { name: 'serial_number_hex', label: 'Serial Number (Hex)', type: 'string' },
    { name: 'capacity', label: 'Capacity', type: 'string', required: true },
    { name: 'total_sectors', label: 'Total Sectors', type: 'integer' },
    { name: 'write_speed', label: 'Write Speed', type: 'number', unit: 'MB/s' },
    { name: 'read_speed', label: 'Read Speed', type: 'number', unit: 'MB/s' },
    { name: 'bad_address', label: 'Bad Address', type: 'integer' },
    { name: 'current_ma', label: 'Current (mA)', type: 'number', unit: 'mA' },
    { name: 'controller', label: 'Controller', type: 'string' },
    { name: 'wafer_pn', label: 'Wafer P/N', type: 'string' },
    { name: 'remark', label: 'Remark', type: 'string' },
  ],
};

async function main() {
  const creatorUsername = process.argv[2] ?? 'admin';

  const creator = await prisma.user.findUnique({ where: { email: creatorUsername } });
  if (!creator) {
    console.error(`错误：找不到用户 ${creatorUsername}`);
    console.error('请先运行：npx tsx scripts/create-admin.ts <username> <password>');
    process.exit(1);
  }

  const dataset = await prisma.dataset.upsert({
    where: { slug: 'ssd-production' },
    update: { schema: JSON.stringify(SSD_DATASET_SCHEMA) },
    create: {
      slug: 'ssd-production',
      name: 'SSD 测试数据',
      description: '闪存测试原始数据：Index、Customer、Machine ID、容量、读写速度、坏地址等字段',
      kind: 'CUSTOM',
      schema: JSON.stringify(SSD_DATASET_SCHEMA),
      createdById: creator.id,
    },
  });

  console.log(`✓ 数据集已就绪：${dataset.name}（slug: ${dataset.slug}）`);
  console.log(`  字段数：${SSD_DATASET_SCHEMA.fields.length}`);
  console.log(`  必填字段：${SSD_DATASET_SCHEMA.fields.filter((f) => f.required).map((f) => f.name).join(', ')}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
