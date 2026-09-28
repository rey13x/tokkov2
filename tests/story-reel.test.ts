import { describe, expect, it } from "vitest";
import type { StoreStoryReel } from "../src/types/store";
import {
  getStoryReelSlug,
  hasStoryReelContentChanged,
  slugifyStoryReelTitle,
} from "../src/lib/story-reel";

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
