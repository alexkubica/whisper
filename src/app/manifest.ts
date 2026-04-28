import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Transcribe",
    short_name: "Transcribe",
    description: "Upload, transcribe, and revisit saved audio or video files.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#ece6d8",
    theme_color: "#17120d",
    icons: [
      {
        src: "/pwa-icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/pwa-icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/pwa-icon-512.png",
        sizes: "512x512",
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
