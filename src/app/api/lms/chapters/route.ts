import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { getFirebaseFirestore } from "@/server/firebase-admin";
import { randomUUID } from "crypto";
import type { LMSChapter } from "@/types/store";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession();

    // Admin only
    if (!session?.user?.email || session.user.role !== "admin") {
      return NextResponse.json(
        { error: "Unauthorized - Admin only" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { productId, title } = body;

    if (!productId || !title) {
      return NextResponse.json(
        { error: "productId and title are required" },
        { status: 400 }
      );
    }

    const db = getFirebaseFirestore();
    if (!db) {
      return NextResponse.json(
        { error: "Database not configured" },
        { status: 500 }
      );
    }

    // Get highest sort order
    const chaptersSnapshot = await db
      .collection("lmsChapters")
      .where("productId", "==", productId)
      .orderBy("sortOrder", "desc")
      .limit(1)
      .get();

    let nextSortOrder = 1;
    if (!chaptersSnapshot.empty) {
      nextSortOrder = chaptersSnapshot.docs[0].data().sortOrder + 1;
    }

    const chapterId = randomUUID();
    const chapter: LMSChapter = {
      id: chapterId,
      productId,
      title,
      sortOrder: nextSortOrder,
      createdAt: new Date().toISOString(),
    };

    await db.collection("lmsChapters").doc(chapterId).set(chapter);

    return NextResponse.json(chapter, { status: 201 });
  } catch (error) {
    console.error("Failed to create chapter:", error);
    return NextResponse.json(
      { error: "Failed to create chapter" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession();

    // Admin only
    if (!session?.user?.email || session.user.role !== "admin") {
      return NextResponse.json(
        { error: "Unauthorized - Admin only" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { chapterId, title, sortOrder } = body;

    if (!chapterId) {
      return NextResponse.json(
        { error: "chapterId is required" },
        { status: 400 }
      );
    }

    const db = getFirebaseFirestore();
    if (!db) {
      return NextResponse.json(
        { error: "Database not configured" },
        { status: 500 }
      );
    }

    const updateData: any = {};
    if (title !== undefined) updateData.title = title;
    if (sortOrder !== undefined) updateData.sortOrder = sortOrder;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: "No fields to update" },
        { status: 400 }
      );
    }

    await db.collection("lmsChapters").doc(chapterId).update(updateData);

    const updated = await db.collection("lmsChapters").doc(chapterId).get();
    return NextResponse.json(updated.data());
  } catch (error) {
    console.error("Failed to update chapter:", error);
    return NextResponse.json(
      { error: "Failed to update chapter" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession();

    // Admin only
    if (!session?.user?.email || session.user.role !== "admin") {
      return NextResponse.json(
        { error: "Unauthorized - Admin only" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const chapterId = searchParams.get("chapterId");

    if (!chapterId) {
      return NextResponse.json(
        { error: "chapterId is required" },
        { status: 400 }
      );
    }

    const db = getFirebaseFirestore();
    if (!db) {
      return NextResponse.json(
        { error: "Database not configured" },
        { status: 500 }
      );
    }

    // Delete all lessons in chapter first
    const lessonsSnapshot = await db
      .collection("lmsLessons")
      .where("chapterId", "==", chapterId)
      .get();

    for (const doc of lessonsSnapshot.docs) {
      await doc.ref.delete();
    }

    // Delete chapter
    await db.collection("lmsChapters").doc(chapterId).delete();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete chapter:", error);
    return NextResponse.json(
      { error: "Failed to delete chapter" },
      { status: 500 }
    );
  }
}
