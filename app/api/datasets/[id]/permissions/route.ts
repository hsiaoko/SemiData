import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { z } from 'zod';

export const runtime = 'nodejs';

const body = z.object({
  userIds: z.array(z.string()).max(1000),
});

// 全量替换：传入 userIds 列表，即为该 dataset 的全部 VIEW 权限用户
export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user || (session.user as any).role !== 'ADMIN') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });

  const dataset = await prisma.dataset.findUnique({ where: { id: params.id } });
  if (!dataset) return NextResponse.json({ error: 'dataset not found' }, { status: 404 });

  const currentPerms = await prisma.datasetPermission.findMany({ where: { datasetId: dataset.id } });
  const currentIds = new Set(currentPerms.map((p) => p.userId));
  const targetIds = new Set(parsed.data.userIds);

  const toAdd = [...targetIds].filter((id) => !currentIds.has(id));
  const toRemove = [...currentIds].filter((id) => !targetIds.has(id));

  await prisma.$transaction([
    ...toAdd.map((userId) =>
      prisma.datasetPermission.create({
        data: { datasetId: dataset.id, userId, canView: true },
      }),
    ),
    ...(toRemove.length > 0
      ? [prisma.datasetPermission.deleteMany({ where: { datasetId: dataset.id, userId: { in: toRemove } } })]
      : []),
  ]);

  return NextResponse.json({ added: toAdd.length, removed: toRemove.length });
}
