import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { buildExcel } from '@/lib/report/excel';
import { buildPdf } from '@/lib/report/pdf';
import { canViewDataset, isAdmin } from '@/lib/permissions';

export const runtime = 'nodejs';

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const user = session.user as any;

  const url = new URL(req.url);
  const format = url.searchParams.get('format') ?? 'xlsx';

  const batch = await prisma.batch.findUnique({
    where: { id: params.id },
    include: { reports: { orderBy: { createdAt: 'desc' }, take: 1 } },
  });
  if (!batch) return NextResponse.json({ error: 'batch not found' }, { status: 404 });
  if (!isAdmin(user) && !(await canViewDataset(user, batch.datasetId))) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  const report = batch.reports[0];
  if (!report) return NextResponse.json({ error: '尚未生成报告' }, { status: 400 });

  const summary = JSON.parse(report.summary);
  const assessments = await prisma.chipAssessment.findMany({
    where: { reportId: report.id },
    include: { chip: true },
  });

  const safe = batch.name.replace(/[\\/:*?"<>|]/g, '_').slice(0, 60);
  // RFC 5987：ASCII fallback + 标准 UTF-8 文件名，避免下载弹窗里中文乱码
  const asciiFallback = safe.replace(/[^\x20-\x7E]/g, '_');
  const utf8 = encodeURIComponent(safe);
  const disposition = (ext: string) =>
    `attachment; filename="${asciiFallback}.${ext}"; filename*=UTF-8''${utf8}.${ext}`;

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
        'Content-Disposition': disposition('pdf'),
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
      'Content-Disposition': disposition('xlsx'),
    },
  });
}
