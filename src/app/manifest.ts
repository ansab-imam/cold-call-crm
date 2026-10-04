import type { MetadataRoute } from "next";

// Lets a phone's "Add to Home Screen" install this as a standalone app —
// full-screen, no browser address bar — instead of just bookmarking a tab.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Cold Call CRM",
    short_name: "Cold Call CRM",
    description: "A focused workspace for cold calling teams",
    start_url: "/",
    display: "standalone",
    background_color: "#0a0a0f",
    theme_color: "#7c3aed",
    icons: [
      { src: "/icon-192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
