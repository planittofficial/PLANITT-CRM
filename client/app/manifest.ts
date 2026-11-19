import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Planitt CRM",
    short_name: "Planitt",
    description: "Enterprise CRM & Team Collaboration Workspace",
    start_url: "/dashboard",
    display: "standalone",
    orientation: "any",
    background_color: "#f5f6f9",
    theme_color: "#5b5fc7",
    icons: [
      {
        src: "/icon.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
