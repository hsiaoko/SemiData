import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import bcrypt from 'bcryptjs';

export const runtime = 'nodejs';

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user || (session.user as any).role !== 'ADMIN') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  const body = await req.json();
  const data: any = {};
  if (body.role) data.role = body.role === 'ADMIN' ? 'ADMIN' : 'USER';
  if (body.name) data.name = String(body.name).slice(0, 80);
  if (body.password) {
    if (String(body.password).length < 4) return NextResponse.json({ error: '密码至少 4 位' }, { status: 400 });
    data.passwordHash = await bcrypt.hash(body.password, 10);
  }
  await prisma.user.update({ where: { id: params.id }, data });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user || (session.user as any).role !== 'ADMIN') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  const me = (session.user as any).id as string;
  if (me === params.id) return NextResponse.json({ error: '不可删除当前账号' }, { status: 400 });
  await prisma.user.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
