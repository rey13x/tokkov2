import { describe, expect, it } from "vitest";
import type { StoreStoryReel } from "../src/types/store";
import {
  getStoryReelSlug,
  hasStoryReelContentChanged,
  slugifyStoryReelTitle,
} from "../src/lib/story-reel";
import { gradeStoryReelQuiz, storyReelQuizSchema, toPublicStoryReel } from "../src/lib/story-reel-quiz";

function createStory(id: string, title: string): StoreStoryReel {
  return {
    id,
    title,
    description: "Isi berita",
    author: "Penulis",
    location: "Jakarta",
    publishedAt: "2026-09-28T10:00:00.000Z",
    editedAt: null,
    mediaGallery: [],
    linkUrl: "",
    isActive: true,
    sortOrder: 0,
    createdAt: "2026-09-28T10:00:00.000Z",
  };
}

describe("Sobat News metadata and slugs", () => {
  it("creates readable title-based slugs", () => {
    expect(slugifyStoryReelTitle("Orientasi Sobat News")).toBe("orientasi-sobat-news");
  });

  it("keeps slugs unique when titles match", () => {
    const first = createStory("one", "Berita Baru");
    const second = createStory("two", "Berita Baru");
    const siblings = [first, second];

    expect(getStoryReelSlug(first, siblings)).toBe("berita-baru");
    expect(getStoryReelSlug(second, siblings)).toBe("berita-baru-2");
  });

  it("marks changed content but not visibility-only changes as edited", () => {
    const story = createStory("one", "Berita Baru");
    const storyWithUploadSeconds = { ...story, publishedAt: "2026-09-28T10:00:45.000Z" };

    expect(hasStoryReelContentChanged(story, { description: "Isi yang diperbarui" })).toBe(true);
    expect(hasStoryReelContentChanged(story, { title: story.title, description: story.description })).toBe(false);
    expect(hasStoryReelContentChanged(storyWithUploadSeconds, { publishedAt: story.publishedAt })).toBe(false);
  });
});

describe("Sobat News quizzes", () => {
  const quiz = {
    title: "Quiz Berita",
    joinButtonText: "Join Quiz",
    reward: "Hadiah untuk pemenang",
    durationSeconds: 90,
    questions: [{
      id: "q1",
      prompt: "Pilihan mana yang benar?",
      options: ["A", "B", "C", "D"],
      correctOption: 2,
    }],
  };

  it("validates answer indexes against the available options", () => {
    expect(storyReelQuizSchema.safeParse(quiz).success).toBe(true);
    expect(storyReelQuizSchema.safeParse({
      ...quiz,
      questions: [{ ...quiz.questions[0], correctOption: 4 }],
    }).success).toBe(false);
    expect(storyReelQuizSchema.safeParse({
      ...quiz,
      questions: [quiz.questions[0], { ...quiz.questions[0], prompt: "Pertanyaan duplikat" }],
    }).success).toBe(false);
  });

  it("does not expose correct options in public Sobat News data", () => {
    const publicStory = toPublicStoryReel({ ...createStory("one", "Berita Baru"), quiz });
    expect(publicStory.quiz?.questions[0]).toEqual({
      id: "q1",
      prompt: "Pilihan mana yang benar?",
      options: ["A", "B", "C", "D"],
    });
    expect(publicStory.quiz?.questions[0]).not.toHaveProperty("correctOption");
  });

  it("awards the quiz reward only after every answer is correct", () => {
    expect(gradeStoryReelQuiz(quiz, [{ questionId: "q1", optionIndex: 2 }])).toEqual({
      score: 1,
      total: 1,
      passed: true,
    });
    expect(gradeStoryReelQuiz(quiz, [{ questionId: "q1", optionIndex: 0 }]).passed).toBe(false);
  });
});
