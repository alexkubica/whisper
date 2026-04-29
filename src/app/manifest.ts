import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Whisper",
    short_name: "Whisper",
    description: "הופכים הודעות קוליות ארוכות לטקסט.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f4f8ff",
    theme_color: "#0f172a",
    icons: [
      {
        src: "/pwa-icon-192.png",
        sizes: "1254x1254",
        type: "image/png",
      },
      {
        src: "/pwa-icon-512.png",
        sizes: "1254x1254",
        type: "image/png",
      },
      {
        src: "/pwa-icon-512.png",
        sizes: "1254x1254",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    share_target: {
      action: "/share-target",
      method: "POST",
      enctype: "multipart/form-data",
      params: {
        files: [
          {
            name: "file",
            accept: [
              "audio/*",
              "video/*",
              ".aac",
              ".m4a",
              ".mkv",
              ".mov",
              ".mp3",
              ".mp4",
              ".mpeg",
              ".mpga",
              ".ogg",
              ".opus",
              ".wav",
              ".webm",
            ],
          },
        ],
      },
    },
  };
}
