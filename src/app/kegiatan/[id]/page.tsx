import { redirect } from "next/navigation";
import { listStoryReels } from "@/server/store-data";
import { getStoryReelSlug } from "@/lib/story-reel";
import type { StoreStoryReel } from "@/types/store";

export default async function KegiatanDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const stories = (await listStoryReels() as StoreStoryReel[]).filter((story) => story.isActive);
  const story = stories.find((item) => item.id === id);
  redirect(story ? `/sobatnews/${getStoryReelSlug(story, stories)}` : "/sobatnews");
}
