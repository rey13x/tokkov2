import type { StoreStoryMediaItem, StoreStoryReel } from "@/types/store";

type StoryReelContentUpdate = Partial<Pick<
  StoreStoryReel,
  "title" | "description" | "author" | "location" | "publishedAt" | "mediaGallery" | "quiz" | "linkUrl"
>>;

function normalizeMediaGallery(items: StoreStoryMediaItem[]) {
  return items.map((item) => ({
    url: item.url,
    type: item.type ?? "image",
    alt: item.alt ?? "",
    title: item.title ?? "",
    description: item.description ?? "",
    linkUrl: item.linkUrl ?? "",
  }));
}

function sameMinute(left: string, right: string) {
  const leftTime = new Date(left).getTime();
  const rightTime = new Date(right).getTime();
  return Number.isFinite(leftTime) && Number.isFinite(rightTime) &&
    Math.floor(leftTime / 60000) === Math.floor(rightTime / 60000);
}

export function hasStoryReelContentChanged(
  current: StoreStoryReel,
  update: StoryReelContentUpdate,
) {
  return (
    (update.title !== undefined && update.title.trim() !== current.title) ||
    (update.description !== undefined && update.description.trim() !== current.description) ||
    (update.author !== undefined && update.author.trim() !== current.author) ||
    (update.location !== undefined && update.location.trim() !== current.location) ||
    (update.publishedAt !== undefined && !sameMinute(update.publishedAt, current.publishedAt)) ||
    (update.linkUrl !== undefined && update.linkUrl.trim() !== current.linkUrl) ||
    (update.quiz !== undefined && JSON.stringify(update.quiz ?? null) !== JSON.stringify(current.quiz ?? null)) ||
    (update.mediaGallery !== undefined &&
      JSON.stringify(normalizeMediaGallery(update.mediaGallery)) !==
        JSON.stringify(normalizeMediaGallery(current.mediaGallery)))
  );
}

export function slugifyStoryReelTitle(title: string) {
  return title
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "") || "sobat-news";
}

type StoryReelSlugSource = Pick<StoreStoryReel, "id" | "title">;

export function getStoryReelSlug(reel: StoryReelSlugSource, siblings: StoryReelSlugSource[]) {
  const baseSlug = slugifyStoryReelTitle(reel.title);
  const matchingReels = siblings.filter((item) => slugifyStoryReelTitle(item.title) === baseSlug);
  const duplicateIndex = matchingReels.findIndex((item) => item.id === reel.id);
  return duplicateIndex > 0 ? `${baseSlug}-${duplicateIndex + 1}` : baseSlug;
}

export function findStoryReelBySlug<T extends StoryReelSlugSource>(storyReels: T[], slug: string): T | null {
  return storyReels.find((reel) => getStoryReelSlug(reel, storyReels) === slug) ?? null;
}