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
  if (!isAdmin(user) && !(await canViewDataset(user, params.id))) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const dataset = await prisma.dataset.findUnique({ where: { id: params.id } });
  if (!dataset) return NextResponse.json({ error: 'dataset not found' }, { status: 404 });

  const url = new URL(req.url);
  const format = url.searchParams.get('format') ?? 'csv';
  const fileBase = `${dataset.name} · 全量数据`;

  // 准备数据
  let headers: string[];
  let rows: any[][];
  if (dataset.kind === 'BUILTIN_CHIP') {
    const chips = await prisma.chip.findMany({
      where: { batch: { datasetId: dataset.id } },
      include: { batch: { select: { name: true } } },
      orderBy: { createdAt: 'asc' },
    });
    headers = ['所在批次', ...CHIP_FIELDS.map((f) => `${FIELD_LABELS[f]}(${f})`)];
    rows = chips.map((c) => [c.batch.name, ...CHIP_FIELDS.map((f) => (c as any)[f] ?? null)]);
  } else {
    const schema = JSON.parse(dataset.schema) as { fields: { name: string; label: string }[] };
    const records = await prisma.datasetRecord.findMany({
      where: { datasetId: dataset.id },
      include: { batch: { select: { name: true } } },
      orderBy: { createdAt: 'asc' },
    });
    headers = ['所在批次', ...schema.fields.map((f) => `${f.label}(${f.name})`)];
    rows = records.map((r) => {
      const data = JSON.parse(r.dataJson);
      return [
        r.batch?.name ?? '—',
        ...schema.fields.map((f) => {
          const v = data[f.name];
          return v === undefined ? null : v;
        }),
      ];
    });
  }

  if (format === 'xlsx') {
    const buf = await buildXlsx(dataset.name, headers, rows);
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
  const safeSheet = sheetName.replace(/[*?:\\/\[\]]/g, '_').slice(0, 30) || 'Sheet1';
  const ws = wb.addWorksheet(safeSheet, {
    views: [{ state: 'frozen', xSplit: 1, ySplit: 1 }],
  });
  ws.addRow(headers);
  ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF15171B' } };
  ws.getRow(1).height = 22;
  for (const r of rows) ws.addRow(r);
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
