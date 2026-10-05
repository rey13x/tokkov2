import { z } from "zod";
import type { PublicStoreStoryReel, StoreStoryQuiz, StoreStoryReel } from "@/types/store";

const quizQuestionSchema = z.object({
  id: z.string().min(1).max(80),
  prompt: z.string().min(1).max(500),
  options: z.array(z.string().min(1).max(200)).min(2).max(6),
  correctOption: z.number().int().min(0).max(5),
}).superRefine((question, context) => {
  if (question.correctOption >= question.options.length) {
    context.addIssue({ code: "custom", message: "Pilihan jawaban benar tidak valid." });
  }
});

export const storyReelQuizSchema = z.object({
  title: z.string().min(1).max(120),
  joinButtonText: z.string().min(1).max(40),
  reward: z.string().min(1).max(300),
  durationSeconds: z.number().int().min(15).max(3600),
  questions: z.array(quizQuestionSchema).min(1).max(40),
}).superRefine((quiz, context) => {
  const questionIds = new Set<string>();
  for (const [index, question] of quiz.questions.entries()) {
    if (questionIds.has(question.id)) {
      context.addIssue({ code: "custom", path: ["questions", index, "id"], message: "ID pertanyaan harus unik." });
    }
    questionIds.add(question.id);
  }
});

export function toPublicStoryReel(storyReel: StoreStoryReel): PublicStoreStoryReel {
  const { quiz, ...publicStoryReel } = storyReel;
  if (!quiz) {
    return { ...publicStoryReel, quiz: quiz ?? null };
  }

  return {
    ...publicStoryReel,
    quiz: {
      title: quiz.title,
      joinButtonText: quiz.joinButtonText,
      reward: quiz.reward,
      durationSeconds: quiz.durationSeconds,
      questions: quiz.questions.map((question) => ({
        id: question.id,
        prompt: question.prompt,
        options: [...question.options],
      })),
    },
  };
}

export function gradeStoryReelQuiz(
  quiz: StoreStoryQuiz,
  answers: Array<{ questionId: string; optionIndex: number }>,
) {
  const answerByQuestionId = new Map(answers.map((answer) => [answer.questionId, answer.optionIndex]));
  const score = quiz.questions.reduce((total, question) =>
    total + Number(answerByQuestionId.get(question.id) === question.correctOption), 0);
  return { score, total: quiz.questions.length, passed: score === quiz.questions.length };
}