import type { Metadata } from "next";
import { VideosView } from "@/components/student/videos-view";

export const metadata: Metadata = {
  title: "Educational Video Library — LUCOUS",
  description: "Multilingual YouTube educational video library with AI Teacher integration.",
};

export default function StudentVideosPage() {
  return <VideosView />;
}
