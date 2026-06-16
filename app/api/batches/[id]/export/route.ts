import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { buildExcel } from '@/lib/report/excel';
import { buildPdf } from '@/lib/report/pdf';
import { buildCustomExcel, type CustomReportRow } from '@/lib/report/custom-excel';
import { buildCustomPdf } from '@/lib/report/custom-pdf';
import { canViewDataset, isAdmin } from '@/lib/permissions';
import { attachmentHeader } from '@/lib/export/csv';

export const runtime = 'nodejs';

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const user = session.user as any;

  const url = new URL(req.url);
  const format = url.searchParams.get('format') ?? 'xlsx';

  const batch = await prisma.batch.findUnique({
    where: { id: params.id },
    include: {
      reports: { orderBy: { createdAt: 'desc' }, take: 1 },
      dataset: { select: { kind: true, schema: true, name: true } },
    },
  });
  if (!batch) return NextResponse.json({ error: 'batch not found' }, { status: 404 });
  if (!isAdmin(user) && !(await canViewDataset(user, batch.datasetId))) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  const report = batch.reports[0];
  if (!report) return NextResponse.json({ error: '尚未生成报告' }, { status: 400 });

  const summary = JSON.parse(report.summary);
  const fileBase = batch.name;

  // BUILTIN_CHIP 走原报告导出
  if (batch.dataset.kind === 'BUILTIN_CHIP') {
    const assessments = await prisma.chipAssessment.findMany({
      where: { reportId: report.id },
      include: { chip: true },
    });
    if (format === 'pdf') {
      const buf = await buildPdf({
        batchName: batch.name,
        reportId: report.id,
        createdAt: report.createdAt,
        summary,
        assessments,
      });
      return new NextResponse(new Uint8Array(buf), {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': attachmentHeader(fileBase, 'pdf'),
        },
      });
    }
    const buf = await buildExcel({
      batchName: batch.name,
      reportId: report.id,
      createdAt: report.createdAt,
      summary,
      assessments,
    });
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': attachmentHeader(fileBase, 'xlsx'),
      },
    });
  }

  // CUSTOM 报告导出
  const items = report.assessmentsJson ? JSON.parse(report.assessmentsJson) : [];
  const recordIds = items.map((i: any) => i.recordId);
  const records = recordIds.length
    ? await prisma.datasetRecord.findMany({
        where: { id: { in: recordIds } },
        select: { id: true, dataJson: true },
      })
    : [];
  const recordById = new Map(records.map((r) => [r.id, JSON.parse(r.dataJson)]));

  const schema = JSON.parse(batch.dataset.schema) as {
    fields: { name: string; label: string; type: string; required?: boolean }[];
  };
  const extraFields = schema.fields
    .filter((f) => f.type === 'integer' || f.type === 'number')
    .slice(0, 3)
    .map((f) => ({ name: f.name, label: f.label }));
  const idField =
    schema.fields.find((f) => f.required) ?? schema.fields[0];
  const idLabel = idField?.label ?? '记录';

  const rows: CustomReportRow[] = items.map((a: any) => {
    const data = recordById.get(a.recordId) ?? {};
    return {
      displayId: idField ? String(data[idField.name] ?? a.recordId.slice(-6)) : a.recordId.slice(-6),
      grade: a.grade,
      score: a.score,
      recommendedPriceCny: a.recommendedPriceCny,
      rationale: a.rationale,
      extras: Object.fromEntries(extraFields.map((f) => [f.name, data[f.name] ?? null])),
    };
  });

  if (format === 'pdf') {
    const buf = await buildCustomPdf({
      batchName: batch.name,
      datasetName: batch.dataset.name,
      reportId: report.id,
      createdAt: report.createdAt,
      summary,
      rows,
      idLabel,
      extraFields,
    });
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': attachmentHeader(fileBase, 'pdf'),
      },
    });
  }
  const buf = await buildCustomExcel({
    batchName: batch.name,
    datasetName: batch.dataset.name,
    reportId: report.id,
    createdAt: report.createdAt,
    summary,
    rows,
    idLabel,
    extraFields,
  });
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': attachmentHeader(fileBase, 'xlsx'),
    },
  });
}
