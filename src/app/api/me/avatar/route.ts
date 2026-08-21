import { NextResponse } from "next/server";
import { getServerAuthSession } from "@/server/auth";
import { createUser, findUserByEmail, updateUserById } from "@/server/db";
import { updateBookStoryUserProfile, updateTestimonialUserProfile } from "@/server/store-data";

const ALLOWED_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/gif", "image/webp"]);
const MAX_AVATAR_SIZE_BYTES = 450 * 1024;

function toInlineDataUrl(file: File, buffer: Buffer) {
  return `data:${file.type};base64,${buffer.toString("base64")}`;
}

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ message: "File tidak ditemukan." }, { status: 400 });
    }

    if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
      return NextResponse.json(
        { message: "Hanya PNG, JPG, GIF, dan WEBP yang diizinkan." },
        { status: 400 },
      );
    }

    if (file.size > MAX_AVATAR_SIZE_BYTES) {
      return NextResponse.json(
        { message: "Ukuran file maksimal 5MB." },
        { status: 400 },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    if (buffer.length > MAX_AVATAR_SIZE_BYTES) {
      return NextResponse.json(
        { message: "Ukuran avatar terlalu besar untuk Firestore. Maksimal 450KB." },
        { status: 400 },
      );
    }

    const avatarUrl = toInlineDataUrl(file, buffer);

    let userId = session.user.id;
    if (session.user.id === "dev-admin-hardcoded") {
      let adminUser = await findUserByEmail("digitalawanku2@gmail.com").catch(() => null);
      if (!adminUser) {
        adminUser = await createUser({
          username: session.user.name || session.user.username || "Admin Tokko",
          email: "digitalawanku2@gmail.com",
          phone: "",
          avatarUrl: "",
          passwordHash: null,
          role: "admin",
        });
      }
      if (!adminUser) {
        return NextResponse.json({ message: "Gagal update avatar." }, { status: 500 });
      }
      userId = adminUser.id;
    }

    const updated = await updateUserById(userId, {
      avatarUrl,
    });
    if (!updated) {
      return NextResponse.json({ message: "Gagal update avatar." }, { status: 500 });
    }

    await updateBookStoryUserProfile(updated.id, {
      userName: updated.username,
      userEmail: updated.email,
      userAvatarUrl: updated.avatarUrl,
    }).catch(() => {});
    await updateTestimonialUserProfile(updated.id, {
      userName: updated.username,
      userAvatarUrl: updated.avatarUrl,
    }).catch(() => {});
    if (session.user.id !== updated.id) {
      await updateBookStoryUserProfile(session.user.id, {
        userName: updated.username,
        userEmail: updated.email,
        userAvatarUrl: updated.avatarUrl,
      }).catch(() => {});
      await updateTestimonialUserProfile(session.user.id, {
        userName: updated.username,
        userAvatarUrl: updated.avatarUrl,
      }).catch(() => {});
    }

    return NextResponse.json({
      message: "Foto profil berhasil diperbarui.",
      avatarUrl: updated.avatarUrl,
    });
  } catch {
    return NextResponse.json(
      { message: "Gagal upload foto profil." },
      { status: 500 },
    );
  }
}
