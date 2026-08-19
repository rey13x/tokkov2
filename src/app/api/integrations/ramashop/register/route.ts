import { NextResponse } from 'next/server';
import { getServerAuthSession } from '@/server/auth';
import { provisionPayGateForUser } from '@/server/paygate';
import { getRamashopAccountByUserId } from '@/server/integrations/ramashop';
import { getAppMetaValue, upsertAppMetaValue } from '@/server/db';

const REGISTER_COOLDOWN_MS = 15 * 60 * 1000;

function getPublicErrorMessage(error: unknown, authMode: 'register' | 'login') {
  const message = error instanceof Error ? error.message : String(error || '');
  if (/too many|terlalu banyak|rate.?limit|coba lagi dalam 1 jam/i.test(message)) {
    return 'Registrasi sedang dibatasi sementara. Jika akun sudah pernah dibuat, gunakan Login dengan email dan password yang sama.';
  }
  if (/already exists|sudah terdaftar|sudah ada|duplicate/i.test(message)) {
    return 'Akun PayGate ini sudah terdaftar. Silakan gunakan Login.';
  }
  if (/invalid|incorrect|wrong|salah|tidak ditemukan|not found|unauthor/i.test(message)) {
    return 'Email atau password PayGate belum sesuai. Coba cek lagi, ya.';
  }
  if (authMode === 'login') {
    return 'Ups, PayGate sedang mengalami gangguan server. Coba lagi sebentar atau konfirmasi ke admin.';
  }
  return 'Ups, PayGate sedang mengalami gangguan server. Coba lagi sebentar atau konfirmasi ke admin.';
}

export async function POST(request: Request) {
  let requestedAuthMode: 'register' | 'login' = 'register';
  try {
    const session = await getServerAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json({ ok: false, error: 'unauthenticated' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const authMode = body?.mode === 'login' ? 'login' : 'register';
    requestedAuthMode = authMode;
    const username = typeof body?.username === 'string' ? body.username.trim() : '';
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = typeof body?.password === 'string' ? body.password : '';
    if (authMode === 'register' && !username) {
      return NextResponse.json({ ok: false, error: 'Username PayGate wajib diisi.' }, { status: 400 });
    }
    if (!email) {
      return NextResponse.json({ ok: false, error: 'Email PayGate wajib diisi.' }, { status: 400 });
    }
    if (!password) {
      return NextResponse.json({ ok: false, error: 'Password PayGate wajib diisi.' }, { status: 400 });
    }

    if (authMode === 'register') {
      const cooldownKey = `paygate_register_cooldown:${session.user.id}`;
      const lastAttempt = Number(await getAppMetaValue(cooldownKey) ?? 0);
      const remaining = REGISTER_COOLDOWN_MS - (Date.now() - lastAttempt);
      if (Number.isFinite(lastAttempt) && lastAttempt > 0 && remaining > 0) {
        const minutes = Math.ceil(remaining / 60000);
        return NextResponse.json(
          { ok: false, error: `Registrasi sedang cooldown. Coba lagi sekitar ${minutes} menit lagi, atau gunakan Login.` },
          { status: 429 },
        );
      }
      await upsertAppMetaValue(cooldownKey, String(Date.now()));
    }

    await provisionPayGateForUser(session.user.id, {
      username: username || email.split('@')[0],
      name: username || email.split('@')[0],
      email,
      password,
      authMode,
    });

    const account = await getRamashopAccountByUserId(session.user.id);
    if (!account) {
      return NextResponse.json(
        { ok: false, error: 'PayGate belum bisa aktif. Akun belum berhasil tersimpan, silakan coba lagi.' },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true, accountId: account.id }, { status: 200 });
  } catch (error: unknown) {
    console.error('Failed to setup PayGate account:', error);
    const publicError = getPublicErrorMessage(error, requestedAuthMode);
    const isRateLimited = /dibatasi|cooldown/i.test(publicError);
    return NextResponse.json({ ok: false, error: publicError }, { status: isRateLimited ? 429 : 500 });
  }
}
