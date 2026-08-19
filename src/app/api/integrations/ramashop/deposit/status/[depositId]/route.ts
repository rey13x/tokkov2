import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { checkDepositStatus } from '@/server/integrations/ramashop';

export async function GET(req: NextRequest, { params }: { params: { depositId: string } }) {
  try {
    const depositId = params.depositId;
    const userId = req.nextUrl.searchParams.get('userId');
    if (!depositId || !userId) {
      return NextResponse.json({ ok: false, error: 'depositId (path) and userId (query) are required' }, { status: 400 });
    }

    const res = await checkDepositStatus(userId, depositId);
    return NextResponse.json({ ok: true, result: res }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: String(error?.message ?? error) }, { status: 500 });
  }
}
