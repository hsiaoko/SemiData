import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import bcrypt from 'bcryptjs';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user || (session.user as any).role !== 'ADMIN') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  const { email, name, password, role } = await req.json();
  if (!email || !name || !password || password.length < 4) {
    return NextResponse.json({ error: '邮箱/姓名/密码必填，密码至少 4 位' }, { status: 400 });
  }
  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) return NextResponse.json({ error: '邮箱已存在' }, { status: 400 });
  const hash = await bcrypt.hash(password, 10);
  const u = await prisma.user.create({
    data: { email, name, passwordHash: hash, role: role === 'ADMIN' ? 'ADMIN' : 'USER' },
  });
  return NextResponse.json({ id: u.id });
}
