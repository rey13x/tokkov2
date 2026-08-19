import { NextResponse } from "next/server";
import { getServerAuthSession } from "@/server/auth";
import { getPayGateAccount } from "@/server/paygate/read";
import { callRamashopApi } from "@/server/integrations/ramashop";

export async function GET(req: Request) {
  const session = await getServerAuthSession();
  if (!session || !session.user || !session.user.id) {
    return NextResponse.json({ ok: false, reason: "unauthenticated" }, { status: 401 });
  }

  const url = new URL(req.url);
  const includeBalance = url.searchParams.get("balance") === "1";

  try {
    const account = await getPayGateAccount(session.user.id);

    let balance: number | null = null;
    if (includeBalance && account) {
      try {
        const res = await callRamashopApi(session.user.id, "/balance", "GET");
        if (res && res.status === 200 && res.data) {
          balance = res.data.data?.balance ?? null;
        }
      } catch (err) {
        console.warn("Failed to get PayGate balance:", err);
      }
    }

    return NextResponse.json({ ok: true, account: account ?? null, balance });
  } catch (err) {
    console.warn("Failed to load PayGate account:", err);
    return NextResponse.json(
      { ok: false, reason: "server_error", error: "Ups, PayGate sedang mengalami gangguan server. Coba lagi sebentar." },
      { status: 503 },
    );
  }
}
