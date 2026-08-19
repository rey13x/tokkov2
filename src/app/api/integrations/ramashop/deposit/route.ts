import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { createDeposit } from '@/server/integrations/ramashop';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, amount } = body ?? {};
    if (!userId || typeof amount !== 'number') {
      return NextResponse.json({ ok: false, error: 'userId and numeric amount are required' }, { status: 400 });
    }

    const res = await createDeposit(userId, amount);
    return NextResponse.json({ ok: true, result: res }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: String(error?.message ?? error) }, { status: 500 });
  }
}
