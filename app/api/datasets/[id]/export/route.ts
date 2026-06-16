import { NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { canViewDataset, isAdmin } from '@/lib/permissions';
import { rowsToCsv, attachmentHeader } from '@/lib/export/csv';
import { FIELD_LABELS, type ChipField } from '@/lib/csv/aliases';
import { assessBatch, type RuleSpec } from '@/lib/grading';

export const runtime = 'nodejs';

const CHIP_FIELDS: ChipField[] = [
  'chipId', 'lotId', 'waferId', 'dieX', 'dieY', 'productModel',
  'testTempC', 'testVoltageV', 'packageType',
  'vthV', 'iddUa', 'leakageNa', 'frequencyMhz', 'powerMw',
  'passCount', 'failCount', 'binCode', 'testDurationS', 'testTimestamp',
];

const Y_HEADERS = ['推荐等级 (grade)', '综合分 (score)', '推荐价 ¥ (price)', '评级理由 (rationale)'];

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const user = session.user as any;
  if (!isAdmin(user) && !(await canViewDataset(user, params.id))) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const dataset = await prisma.dataset.findUnique({ where: { id: params.id } });
  if (!dataset) return NextResponse.json({ error: 'dataset not found' }, { status: 404 });

  const url = new URL(req.url);
  const format = url.searchParams.get('format') ?? 'csv';
  const fileBase = `${dataset.name} · 全量数据`;

  // 找该 dataset 绑定的规则集（默认优先，否则第一条）— 用于附加 Y 列
  const bindings = await prisma.datasetRuleSet.findMany({
    where: { datasetId: dataset.id },
    include: { ruleSet: true },
    orderBy: { createdAt: 'asc' },
  });
  const ruleSet = bindings.find((b) => b.ruleSet.isDefault)?.ruleSet ?? bindings[0]?.ruleSet;
  const ruleSpec: RuleSpec | null = ruleSet ? JSON.parse(ruleSet.rules) : null;

  // 准备数据
  let headers: string[];
  let baseRows: any[][];
  let rowDataForGrading: Record<string, any>[];

  if (dataset.kind === 'BUILTIN_CHIP') {
    const chips = await prisma.chip.findMany({
      where: { batch: { datasetId: dataset.id } },
      include: { batch: { select: { name: true } } },
      orderBy: { createdAt: 'asc' },
    });
    headers = ['所在批次', ...CHIP_FIELDS.map((f) => `${FIELD_LABELS[f]}(${f})`)];
    baseRows = chips.map((c) => [c.batch.name, ...CHIP_FIELDS.map((f) => (c as any)[f] ?? null)]);
    rowDataForGrading = chips.map((c) => {
      const d: Record<string, any> = {};
      for (const f of CHIP_FIELDS) d[f] = (c as any)[f];
      return d;
    });
  } else {
    const schema = JSON.parse(dataset.schema) as { fields: { name: string; label: string; type: string }[] };
    const records = await prisma.datasetRecord.findMany({
      where: { datasetId: dataset.id },
      include: { batch: { select: { name: true } } },
      orderBy: { createdAt: 'asc' },
    });
    headers = ['所在批次', ...schema.fields.map((f) => `${f.label}(${f.name})`)];
    rowDataForGrading = records.map((r) => JSON.parse(r.dataJson));
    baseRows = records.map((r, i) => {
      const data = rowDataForGrading[i];
      return [
        r.batch?.name ?? '—',
        ...schema.fields.map((f) => (data[f.name] === undefined ? null : data[f.name])),
      ];
    });
  }

  // 如果有规则集，跑评级并附加 Y 列
  let allRows: any[][] = baseRows;
  if (ruleSpec && rowDataForGrading.length > 0) {
    const assessments = assessBatch(rowDataForGrading, ruleSpec);
    headers = [...headers, ...Y_HEADERS];
    allRows = baseRows.map((row, i) => [
      ...row,
      assessments[i].grade,
      assessments[i].score,
      assessments[i].recommendedPriceCny,
      assessments[i].rationale,
    ]);
  }

  if (format === 'xlsx') {
    const buf = await buildXlsx(dataset.name, headers, allRows, !!ruleSpec);
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': attachmentHeader(fileBase, 'xlsx'),
      },
    });
  }
  const csv = rowsToCsv(headers, allRows);
  return new NextResponse(new Uint8Array(csv), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': attachmentHeader(fileBase, 'csv'),
    },
  });
}

const GRADE_FILL: Record<string, string> = {
  S: 'FF1B4FE3', A: 'FF3FAE6B', B: 'FFE8A53C', C: 'FFC24A4A', D: 'FF8E5BAB', FAIL: 'FF5A5A60',
};

async function buildXlsx(sheetName: string, headers: string[], rows: any[][], hasY: boolean): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'YieldEx';
  const safeSheet = sheetName.replace(/[*?:\\/\[\]]/g, '_').slice(0, 30) || 'Sheet1';
  const ws = wb.addWorksheet(safeSheet, {
    views: [{ state: 'frozen', xSplit: 1, ySplit: 1 }],
  });
  ws.addRow(headers);
  ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF15171B' } };
  ws.getRow(1).height = 22;

  const yStart = hasY ? headers.length - 3 : -1; // 推荐等级列号（1-based）

  for (const r of rows) {
    const row = ws.addRow(r);
    if (hasY) {
      const gradeCell = row.getCell(yStart);
      const grade = String(gradeCell.value ?? '');
      if (GRADE_FILL[grade]) {
        gradeCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GRADE_FILL[grade] } };
        gradeCell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        gradeCell.alignment = { horizontal: 'center' };
      }
      row.getCell(yStart + 2).numFmt = '"¥"#,##0.00'; // 推荐价
      row.getCell(yStart + 1).numFmt = '0.00'; // 综合分
    }
  }

  headers.forEach((_, i) => {
    let max = headers[i].length + 4;
    for (const r of rows) {
      const v = r[i];
      if (v != null) max = Math.max(max, String(v).length + 2);
    }
    ws.getColumn(i + 1).width = Math.min(max, 50);
  });
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: headers.length } };

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}
