import { prisma } from '@/lib/db';

export type SessionUser = { id: string; role: string };

export function isAdmin(user: SessionUser | undefined | null): boolean {
  return user?.role === 'ADMIN';
}

export async function getVisibleDatasetIds(user: SessionUser): Promise<string[] | 'ALL'> {
  if (isAdmin(user)) return 'ALL';
  const perms = await prisma.datasetPermission.findMany({
    where: { userId: user.id, canView: true },
    select: { datasetId: true },
  });
  return perms.map((p) => p.datasetId);
}

export async function canViewDataset(user: SessionUser, datasetId: string): Promise<boolean> {
  if (isAdmin(user)) return true;
  const p = await prisma.datasetPermission.findUnique({
    where: { userId_datasetId: { userId: user.id, datasetId } },
  });
  return !!p?.canView;
}

export function datasetWhereForUser(user: SessionUser, visible: string[] | 'ALL'): any {
  if (visible === 'ALL') return {};
  return { id: { in: visible } };
}

export function batchWhereForUser(visible: string[] | 'ALL'): any {
  if (visible === 'ALL') return {};
  return { datasetId: { in: visible } };
}
