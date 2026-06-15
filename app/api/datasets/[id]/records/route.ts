import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { canViewDataset } from '@/lib/permissions';

export const runtime = 'nodejs';

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const user = session.user as any;
  if (!(await canViewDataset(user, params.id))) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  const url = new URL(req.url);
  const limit = Math.min(5000, Number(url.searchParams.get('limit') ?? '500'));
  const records = await prisma.datasetRecord.findMany({
    where: { datasetId: params.id },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: { id: true, dataJson: true, createdAt: true },
  });
  return NextResponse.json(records);
}
