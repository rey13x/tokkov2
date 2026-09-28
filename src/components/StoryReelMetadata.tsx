import type { StoreStoryReel } from "@/types/store";
import styles from "./StoryReelMetadata.module.css";

function formatUploadTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
}

export default function StoryReelMetadata({ story }: { story: StoreStoryReel }) {
  const publishedAt = formatUploadTime(story.publishedAt || story.createdAt);

  return (
    <div className={styles.metadata}>
      <span>Penulis: {story.author || "Sobat News"}</span>
      {publishedAt ? <time dateTime={story.publishedAt || story.createdAt}>Upload: {publishedAt}</time> : null}
      {story.location ? <span>Lokasi: {story.location}</span> : null}
      {story.editedAt ? <strong>Diedit</strong> : null}
    </div>
  );
}