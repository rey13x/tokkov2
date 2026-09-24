import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/server/admin";
import { getAppMetaValue, upsertAppMetaValue } from "@/server/db";
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

const footerLinkSchema = z.object({
  id: z.string().trim().max(120).optional(),
  label: z.string().trim().min(1).max(80),
  url: z.string().trim().min(1).max(2000),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().min(0).max(9999).default(0),
});

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

  return parsed
    .slice()
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    .map((item, index) => ({ ...item, sortOrder: Number(item.sortOrder ?? index) }));
}

async function readFooterLinks() {
  const raw = await getAppMetaValue(FOOTER_LINKS_KEY);
  if (!raw) {
    return [...defaultFooterLinks];
  }

  try {
    const parsed = JSON.parse(raw);
    return normalizeFooterLinks(parsed);
  } catch {
    return [...defaultFooterLinks];
  }
}

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return auth.response;
  }

  const links = await readFooterLinks();
  return NextResponse.json({ links });
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const body = await request.json();
    const payload = footerLinkSchema.parse(body);
    const current = await readFooterLinks();
    const next = [...current];
    const id = payload.id || crypto.randomUUID();

    const existingIndex = next.findIndex((item) => item.id === id);
    const nextItem: FooterSocialLink = {
      id,
      label: payload.label,
      url: payload.url,
      isActive: payload.isActive,
      sortOrder: Number(payload.sortOrder ?? 0),
      createdAt: existingIndex >= 0 ? next[existingIndex].createdAt : new Date().toISOString(),
    };

    if (existingIndex >= 0) {
      next[existingIndex] = nextItem;
    } else {
      next.push(nextItem);
    }

    const sorted = next
      .slice()
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
      .map((item, index) => ({ ...item, sortOrder: Number(item.sortOrder ?? index) }));

    await upsertAppMetaValue(FOOTER_LINKS_KEY, JSON.stringify(sorted));

    return NextResponse.json(
      { message: existingIndex >= 0 ? "Link footer berhasil diperbarui." : "Link footer berhasil ditambahkan.", links: sorted },
      { status: existingIndex >= 0 ? 200 : 201 },
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: "Data link footer belum lengkap atau formatnya tidak valid." },
        { status: 400 },
      );
    }

    console.error("POST /api/admin/footer-links failed:", error);
    return NextResponse.json(
      { message: "Gagal menyimpan link footer." },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id")?.trim();
    if (!id) {
      return NextResponse.json({ message: "ID link footer wajib diisi." }, { status: 400 });
    }

    const current = await readFooterLinks();
    const filtered = current.filter((item) => item.id !== id);
    await upsertAppMetaValue(FOOTER_LINKS_KEY, JSON.stringify(filtered));

    return NextResponse.json({ message: "Link footer berhasil dihapus.", links: filtered });
  } catch (error) {
    console.error("DELETE /api/admin/footer-links failed:", error);
    return NextResponse.json(
      { message: "Gagal menghapus link footer." },
      { status: 500 },
    );
  }
}
