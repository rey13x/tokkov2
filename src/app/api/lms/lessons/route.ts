import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { getFirebaseFirestore } from "@/server/firebase-admin";
import { v4 as uuidv4 } from "crypto";
import type { LMSLesson } from "@/types/store";

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
    const { chapterId, productId, title, videoUrl } = body;

    if (!chapterId || !productId || !title || !videoUrl) {
      return NextResponse.json(
        { error: "chapterId, productId, title, and videoUrl are required" },
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

    // Get highest sort order for this chapter
    const lessonsSnapshot = await db
      .collection("lmsLessons")
      .where("chapterId", "==", chapterId)
      .orderBy("sortOrder", "desc")
      .limit(1)
      .get();

    let nextSortOrder = 1;
    if (!lessonsSnapshot.empty) {
      nextSortOrder = lessonsSnapshot.docs[0].data().sortOrder + 1;
    }

    const lessonId = uuidv4();
    const lesson: LMSLesson = {
      id: lessonId,
      chapterId,
      productId,
      title,
      videoUrl,
      sortOrder: nextSortOrder,
      createdAt: new Date().toISOString(),
    };

    await db.collection("lmsLessons").doc(lessonId).set(lesson);

    return NextResponse.json(lesson, { status: 201 });
  } catch (error) {
    console.error("Failed to create lesson:", error);
    return NextResponse.json(
      { error: "Failed to create lesson" },
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
    const { lessonId, title, videoUrl, sortOrder } = body;

    if (!lessonId) {
      return NextResponse.json(
        { error: "lessonId is required" },
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
    if (videoUrl !== undefined) updateData.videoUrl = videoUrl;
    if (sortOrder !== undefined) updateData.sortOrder = sortOrder;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: "No fields to update" },
        { status: 400 }
      );
    }

    await db.collection("lmsLessons").doc(lessonId).update(updateData);

    const updated = await db.collection("lmsLessons").doc(lessonId).get();
    return NextResponse.json(updated.data());
  } catch (error) {
    console.error("Failed to update lesson:", error);
    return NextResponse.json(
      { error: "Failed to update lesson" },
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
    const lessonId = searchParams.get("lessonId");

    if (!lessonId) {
      return NextResponse.json(
        { error: "lessonId is required" },
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

    // Delete all progress entries for this lesson
    const progressSnapshot = await db
      .collection("userCourseProgress")
      .where("lessonId", "==", lessonId)
      .get();

    for (const doc of progressSnapshot.docs) {
      await doc.ref.delete();
    }

    // Delete lesson
    await db.collection("lmsLessons").doc(lessonId).delete();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete lesson:", error);
    return NextResponse.json(
      { error: "Failed to delete lesson" },
      { status: 500 }
    );
  }
}
