import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { registerOnRamashopAndFetchApiKey } from '@/server/integrations/ramashop';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, name, email, password } = body ?? {};
    if (!userId || !email) {
      return NextResponse.json({ ok: false, error: 'userId and email are required' }, { status: 400 });
    }

    const pwd = password ?? (Math.random() + Date.now()).toString(36).slice(2, 12);
    const res = await registerOnRamashopAndFetchApiKey({ userId, name: name ?? email.split('@')[0], email, password: pwd });
    return NextResponse.json({ ok: true, accountId: res.accountId }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: String(error?.message ?? error) }, { status: 500 });
  }
}
