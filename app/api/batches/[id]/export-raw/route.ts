import { NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { canViewDataset, isAdmin } from '@/lib/permissions';
import { rowsToCsv, attachmentHeader } from '@/lib/export/csv';
import { FIELD_LABELS, type ChipField } from '@/lib/csv/aliases';

export const runtime = 'nodejs';

const CHIP_FIELDS: ChipField[] = [
  'chipId', 'lotId', 'waferId', 'dieX', 'dieY', 'productModel',
  'testTempC', 'testVoltageV', 'packageType',
  'vthV', 'iddUa', 'leakageNa', 'frequencyMhz', 'powerMw',
  'passCount', 'failCount', 'binCode', 'testDurationS', 'testTimestamp',
];

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const user = session.user as any;

  const batch = await prisma.batch.findUnique({
    where: { id: params.id },
    include: { dataset: { select: { kind: true, schema: true } } },
  });
  if (!batch) return NextResponse.json({ error: 'batch not found' }, { status: 404 });
  if (!isAdmin(user) && !(await canViewDataset(user, batch.datasetId))) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const url = new URL(req.url);
  const format = url.searchParams.get('format') ?? 'csv';

  const fileBase = `${batch.name} · 原始数据`;

  if (batch.dataset.kind === 'BUILTIN_CHIP') {
    const chips = await prisma.chip.findMany({
      where: { batchId: batch.id },
      orderBy: { chipId: 'asc' },
    });
    const headers = CHIP_FIELDS.map((f) => FIELD_LABELS[f] + `(${f})`);
    const rows = chips.map((c) => CHIP_FIELDS.map((f) => (c as any)[f] ?? null));

    if (format === 'xlsx') {
      const buf = await buildXlsx(`${batch.name}`, headers, rows);
      return new NextResponse(new Uint8Array(buf), {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': attachmentHeader(fileBase, 'xlsx'),
        },
      });
    }
    const csv = rowsToCsv(headers, rows);
    return new NextResponse(new Uint8Array(csv), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': attachmentHeader(fileBase, 'csv'),
      },
    });
  }

  // 自定义 dataset 批次：从 DatasetRecord 取
  const schema = JSON.parse(batch.dataset.schema) as { fields: { name: string; label: string }[] };
  const records = await prisma.datasetRecord.findMany({
    where: { batchId: batch.id },
    orderBy: { createdAt: 'asc' },
  });
  const fields = schema.fields;
  const headers = fields.map((f) => `${f.label}(${f.name})`);
  const rows = records.map((r) => {
    const data = JSON.parse(r.dataJson);
    return fields.map((f) => {
      const v = data[f.name];
      return v === undefined ? null : v;
    });
  });

  if (format === 'xlsx') {
    const buf = await buildXlsx(`${batch.name}`, headers, rows);
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': attachmentHeader(fileBase, 'xlsx'),
      },
    });
  }
  const csv = rowsToCsv(headers, rows);
  return new NextResponse(new Uint8Array(csv), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': attachmentHeader(fileBase, 'csv'),
    },
  });
}

async function buildXlsx(sheetName: string, headers: string[], rows: any[][]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'YieldEx';
  // Excel 不允许 sheet 名含 * ? : \ / [ ]，且最长 31 字
  const safeSheet = sheetName.replace(/[*?:\\/\[\]]/g, '_').slice(0, 30) || 'Sheet1';
  const ws = wb.addWorksheet(safeSheet, {
    views: [{ state: 'frozen', xSplit: 1, ySplit: 1 }],
  });
  ws.addRow(headers);
  ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF15171B' } };
  ws.getRow(1).height = 22;
  for (const r of rows) ws.addRow(r);
  // auto width 估算
  headers.forEach((_, i) => {
    let max = headers[i].length + 4;
    for (const r of rows) {
      const v = r[i];
      if (v != null) max = Math.max(max, String(v).length + 2);
    }
    ws.getColumn(i + 1).width = Math.min(max, 40);
  });
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: headers.length } };
  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}
