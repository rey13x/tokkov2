import { NextResponse } from "next/server";
import { getAppMetaValue } from "@/server/db";
import type { FooterSocialLink } from "@/types/store";

const FOOTER_LINKS_KEY = "footerSocialLinks";

const defaultFooterLinks: FooterSocialLink[] = [
  {
    id: "default-whatsapp",
    label: "WhatsApp",
    url: "https://wa.me/6285121579597?text=Halo%20Founder%20aku%20dari%20website%20Tokko%20%F0%9F%91%8B%F0%9F%8F%BB",
    isActive: true,
    sortOrder: 0,
    createdAt: new Date().toISOString(),
  },
  {
    id: "default-instagram",
    label: "Instagram",
    url: "https://www.instagram.com/sixsevenrai/",
    isActive: true,
    sortOrder: 1,
    createdAt: new Date().toISOString(),
  },
  {
    id: "default-telegram",
    label: "Saluran Telegram",
    url: "https://t.me/tokkomarketplace",
    isActive: true,
    sortOrder: 2,
    createdAt: new Date().toISOString(),
  },
  {
    id: "default-whatsapp-channel",
    label: "Saluran Whatsapp",
    url: "https://whatsapp.com/channel/0029VbCXa1ADDmFMNzoE6b0k",
    isActive: true,
    sortOrder: 3,
    createdAt: new Date().toISOString(),
  },
  {
    id: "default-founder",
    label: "Founder",
    url: "https://byrai-three.vercel.app",
    isActive: true,
    sortOrder: 4,
    createdAt: new Date().toISOString(),
  },
];

function normalizeFooterLinks(raw: unknown): FooterSocialLink[] {
  if (!Array.isArray(raw)) {
    return defaultFooterLinks;
  }

  const parsed = raw
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }
      const candidate = item as Record<string, unknown>;
      const label = String(candidate.label ?? "").trim();
      const url = String(candidate.url ?? "").trim();
      if (!label || !url) {
        return null;
      }
      return {
        id: String(candidate.id ?? crypto.randomUUID()),
        label,
        url,
        isActive: Boolean(candidate.isActive ?? true),
        sortOrder: Number(candidate.sortOrder ?? 0),
        createdAt: String(candidate.createdAt ?? new Date().toISOString()),
      } satisfies FooterSocialLink;
    })
    .filter(Boolean) as FooterSocialLink[];

  const sanitized = parsed.filter((item) => item.isActive !== false && item.url.trim());
  return sanitized.length ? sanitized.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)) : defaultFooterLinks;
}

export async function GET() {
  const raw = await getAppMetaValue(FOOTER_LINKS_KEY);
  if (!raw) {
    return NextResponse.json({ links: defaultFooterLinks });
  }

  try {
    return NextResponse.json({ links: normalizeFooterLinks(JSON.parse(raw)) });
  } catch {
    return NextResponse.json({ links: defaultFooterLinks });
  }
}
