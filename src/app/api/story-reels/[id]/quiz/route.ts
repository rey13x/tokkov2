import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  createStoryQuizAttempt,
  finishStoryQuizAttempt,
  listStoryQuizAttemptAnswers,
  listStoryReels,
  saveStoryQuizAttemptAnswer,
} from "@/server/store-data";
import { gradeStoryReelQuiz, storyReelQuizSchema, toPublicStoryReel } from "@/lib/story-reel-quiz";
import type { StoreStoryReel } from "@/types/store";

export const runtime = "nodejs";

type QuizSession = {
  sessionId: string;
  storyId: string;
  startedAt: number;
  expiresAt: number;
  quizHash: string;
};

const quizSessionSchema = z.object({
  sessionId: z.string().uuid(),
  storyId: z.string().min(1),
  startedAt: z.number().int(),
  expiresAt: z.number().int(),
  quizHash: z.string().length(64),
});

const tokenSchema = z.string().min(1).max(2048);

const answerSchema = z.object({
  action: z.literal("answer"),
  token: z.string().min(1).max(2048),
  questionId: z.string().min(1).max(80),
  optionIndex: z.number().int().min(0).max(5),
});

const submissionSchema = z.object({
  action: z.literal("submit"),
  token: tokenSchema,
});

const tokenSecret = process.env.NEXTAUTH_SECRET ?? "tokko-dev-secret";

function signSession(payload: QuizSession) {
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", tokenSecret).update(encodedPayload).digest("base64url");
  return `${encodedPayload}.${signature}`;
}

function verifySession(token: string): QuizSession | null {
  const [encodedPayload, signature, extra] = token.split(".");
  if (!encodedPayload || !signature || extra) {
    return null;
  }

  const expected = createHmac("sha256", tokenSecret).update(encodedPayload).digest();
  const received = Buffer.from(signature, "base64url");
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
    return null;
  }

  try {
    return quizSessionSchema.parse(JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")));
  } catch {
    return null;
  }
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id: storyId } = await context.params;
  const body = await request.json().catch(() => null) as { action?: string } | null;
  const storyReels = await listStoryReels() as StoreStoryReel[];
  const story = storyReels.find((item) => item.id === storyId && item.isActive);
  const parsedQuiz = storyReelQuizSchema.safeParse(story?.quiz);

  if (!story || !parsedQuiz.success) {
    return NextResponse.json({ message: "Quiz ini tidak tersedia." }, { status: 404 });
  }

  if (body?.action === "start") {
    const startedAt = Date.now();
    const expiresAt = startedAt + parsedQuiz.data.durationSeconds * 1000;
    const payload: QuizSession = {
      sessionId: randomUUID(),
      storyId,
      startedAt,
      expiresAt,
      quizHash: createHash("sha256").update(JSON.stringify(parsedQuiz.data)).digest("hex"),
    };
    const created = await createStoryQuizAttempt(payload.sessionId, expiresAt);
    if (!created) {
      return NextResponse.json({ message: "Gagal memulai sesi quiz. Coba lagi." }, { status: 503 });
    }

    return NextResponse.json({ token: signSession(payload), expiresAt, quiz: toPublicStoryReel(story).quiz }, {
      headers: { "Cache-Control": "no-store" },
    });
  }

  const actionSchema = z.object({ action: z.enum(["answer", "submit"]) });
  const parsedAction = actionSchema.safeParse(body);
  if (!parsedAction.success) {
    return NextResponse.json({ message: "Jawaban quiz tidak valid." }, { status: 400 });
  }

  const requestSchema = parsedAction.data.action === "answer" ? answerSchema : submissionSchema;
  const requestData = requestSchema.safeParse(body);
  if (!requestData.success) {
    return NextResponse.json({ message: "Jawaban quiz tidak valid." }, { status: 400 });
  }

  const session = verifySession(requestData.data.token);
  const now = Date.now();
  if (!session || session.storyId !== storyId || session.startedAt > now || now > session.expiresAt + 1500) {
    return NextResponse.json({ message: "Waktu quiz sudah habis atau sesi tidak valid." }, { status: 410 });
  }
  const currentQuiz = storyReelQuizSchema.safeParse(story.quiz);
  const currentQuizHash = currentQuiz.success
    ? createHash("sha256").update(JSON.stringify(currentQuiz.data)).digest("hex")
    : "";
  if (!currentQuiz.success || currentQuizHash !== session.quizHash) {
    return NextResponse.json({ message: "Quiz telah diperbarui. Silakan mulai lagi." }, { status: 409 });
  }

  if (requestData.data.action === "answer") {
    const answerRequest = answerSchema.parse(requestData.data);
    const question = currentQuiz.data.questions.find((item) => item.id === answerRequest.questionId);
    if (!question || answerRequest.optionIndex >= question.options.length) {
      return NextResponse.json({ message: "Pilihan jawaban tidak valid." }, { status: 400 });
    }

    const isCorrect = answerRequest.optionIndex === question.correctOption;
    const saved = await saveStoryQuizAttemptAnswer(session.sessionId, session.expiresAt, {
      questionId: question.id,
      optionIndex: answerRequest.optionIndex,
      isCorrect,
    });
    if (!saved) {
      return NextResponse.json({ message: "Jawaban soal ini sudah dikirim." }, { status: 409 });
    }

    return NextResponse.json({ isCorrect }, { headers: { "Cache-Control": "no-store" } });
  }

  const savedAnswers = await listStoryQuizAttemptAnswers(session.sessionId);
  if (savedAnswers.length !== currentQuiz.data.questions.length) {
    return NextResponse.json({ message: "Jawab semua pertanyaan sebelum menyelesaikan quiz." }, { status: 400 });
  }
  const submitted = await finishStoryQuizAttempt(session.sessionId, session.expiresAt);
  if (!submitted) {
    return NextResponse.json({ message: "Jawaban untuk sesi ini sudah dikirim." }, { status: 409 });
  }
  const result = gradeStoryReelQuiz(currentQuiz.data, savedAnswers);

  return NextResponse.json({
    ...result,
    reward: result.passed ? currentQuiz.data.reward : null,
  }, { headers: { "Cache-Control": "no-store" } });
}