import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { applyColumnMap, coerceValue, type ColumnMap } from '@/lib/csv/parser';
import type { ChipField } from '@/lib/csv/aliases';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const user = session.user as any;
  if (user.role !== 'ADMIN') {
    return NextResponse.json({ error: '仅管理员可上传数据' }, { status: 403 });
  }

  const body = await req.json();
  const { datasetId, name, description, fileName, fileSize, columnMap, rows } = body as {
    datasetId: string;
    name: string;
    description?: string;
    fileName: string;
    fileSize: number;
    columnMap: Record<string, string>;
    rows: Record<string, string>[];
  };

  if (!datasetId) return NextResponse.json({ error: '请选择目标数据集' }, { status: 400 });
  if (!name || !Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: '缺少必要字段或行为空' }, { status: 400 });
  }
  if (rows.length > 200_000) {
    return NextResponse.json({ error: '单次最多 20 万行' }, { status: 400 });
  }

  const dataset = await prisma.dataset.findUnique({ where: { id: datasetId } });
  if (!dataset) return NextResponse.json({ error: '数据集不存在' }, { status: 404 });

  const batch = await prisma.batch.create({
    data: {
      datasetId: dataset.id,
      name: name.slice(0, 120),
      description: description?.slice(0, 300),
      fileName,
      fileSize,
      rowCount: rows.length,
      uploadedById: user.id,
    },
  });

  if (dataset.kind === 'BUILTIN_CHIP') {
    // 走 Chip 表（保留原有评级算法路径）
    const chips = rows.map((r) => {
      const parsed = applyColumnMap(r, columnMap as ColumnMap);
      const f = parsed.fields;
      return {
        chipId: (f.chipId as string) ?? `AUTO-${Math.random().toString(36).slice(2, 10)}`,
        lotId: (f.lotId as string) ?? null,
        waferId: (f.waferId as string) ?? null,
        dieX: (f.dieX as number) ?? null,
        dieY: (f.dieY as number) ?? null,
        productModel: (f.productModel as string) ?? null,
        testTempC: (f.testTempC as number) ?? null,
        testVoltageV: (f.testVoltageV as number) ?? null,
        packageType: (f.packageType as string) ?? null,
        vthV: (f.vthV as number) ?? null,
        iddUa: (f.iddUa as number) ?? null,
        leakageNa: (f.leakageNa as number) ?? null,
        frequencyMhz: (f.frequencyMhz as number) ?? null,
        powerMw: (f.powerMw as number) ?? null,
        passCount: (f.passCount as number) ?? null,
        failCount: (f.failCount as number) ?? null,
        binCode: (f.binCode as string) ?? null,
        testDurationS: (f.testDurationS as number) ?? null,
        testTimestamp: f.testTimestamp instanceof Date ? f.testTimestamp : null,
        rawExtras: Object.keys(parsed.extras).length > 0 ? JSON.stringify(parsed.extras) : null,
      };
    });
    const CHUNK = 500;
    for (let i = 0; i < chips.length; i += CHUNK) {
      await prisma.chip.createMany({
        data: chips.slice(i, i + CHUNK).map((c) => ({ ...c, batchId: batch.id })),
      });
    }
  } else {
    // 自定义 dataset：走 DatasetRecord
    const schema = JSON.parse(dataset.schema) as { fields: { name: string; type: string }[] };
    const typeByName = new Map(schema.fields.map((f) => [f.name, f.type]));
    const records = rows.map((r) => {
      const data: Record<string, any> = {};
      const extras: Record<string, string> = {};
      for (const [header, target] of Object.entries(columnMap)) {
        const raw = r[header];
        if (target === '__skip__') continue;
        if (target === '__extras__') {
          if (raw != null && raw !== '') extras[header] = String(raw);
          continue;
        }
        const t = typeByName.get(target);
        const v = coerceCustom(t, String(raw ?? ''));
        if (v !== null) data[target] = v;
      }
      if (Object.keys(extras).length > 0) data.__extras = extras;
      return {
        datasetId: dataset.id,
        batchId: batch.id,
        dataJson: JSON.stringify(data),
        uploadedById: user.id,
      };
    });
    const CHUNK = 500;
    for (let i = 0; i < records.length; i += CHUNK) {
      await prisma.datasetRecord.createMany({ data: records.slice(i, i + CHUNK) });
    }
  }

  return NextResponse.json({ id: batch.id, rowCount: batch.rowCount, datasetId: dataset.id });
}

function coerceCustom(type: string | undefined, raw: string): any {
  if (raw == null || raw === '') return null;
  const v = raw.trim();
  if (v === '') return null;
  switch (type) {
    case 'integer': {
      const n = Number(v);
      return Number.isNaN(n) ? null : Math.round(n);
    }
    case 'number': {
      const n = Number(v);
      return Number.isNaN(n) ? null : n;
    }
    case 'boolean': {
      const lc = v.toLowerCase();
      if (['true', '1', 'yes', 'y', '是', '通过'].includes(lc)) return true;
      if (['false', '0', 'no', 'n', '否', '失败'].includes(lc)) return false;
      return null;
    }
    case 'datetime': {
      const d = new Date(v);
      return isNaN(d.getTime()) ? null : d.toISOString();
    }
    default:
      return v;
  }
}
