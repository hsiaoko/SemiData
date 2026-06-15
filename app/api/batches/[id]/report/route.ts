import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { createReport } from '@/lib/report/generate';
import { canViewDataset, isAdmin } from '@/lib/permissions';

export const runtime = 'nodejs';

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const user = session.user as any;
  const userId = user.id as string;

  const batch = await prisma.batch.findUnique({ where: { id: params.id } });
  if (!batch) return NextResponse.json({ error: 'batch not found' }, { status: 404 });
  if (!isAdmin(user) && !(await canViewDataset(user, batch.datasetId))) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  const body = await _req.json().catch(() => ({} as any));
  const { reportId, summary } = await createReport({
    batchId: batch.id,
    userId,
    ruleSetId: body?.ruleSetId,
  });
  return NextResponse.json({ reportId, summary });
}
