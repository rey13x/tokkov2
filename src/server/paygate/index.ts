export async function provisionPayGateForUser(
  userId: string,
  profile?: {
    username?: string | null;
    name?: string | null;
    email?: string | null;
    password?: string | null;
    authMode?: "register" | "login";
  },
): Promise<void> {
  const { provisionRamashopAccount } = await import("@/server/integrations/ramashop");

  const email = (profile?.email || "").trim().toLowerCase();
  if (!email) {
    throw new Error("Email PayGate wajib diisi.");
  }
  const name = (profile?.username || profile?.name || email.split("@")[0] || "PayGate User").trim();
  const password = profile?.password?.trim();
  if (!password) {
    throw new Error("Password PayGate wajib diisi.");
  }

  await provisionRamashopAccount({
    userId,
    name,
    email,
    password,
    authMode: profile?.authMode,
  });
}
