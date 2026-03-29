import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
    return {
        name: "BlindSpot",
        short_name: "BlindSpot",
        description: "On hacke vos articles pour exposer leurs angles morts.",
        start_url: "/search",
        display: "standalone",
        background_color: "#0a0a0a",
        theme_color: "#0a0a0a",
        icons: [
            {
                src: "/icons/favicon-192.png",
                sizes: "192x192",
                type: "image/png",
                purpose: "any"
            },
            {
                src: "/icons/favicon-512.png",
                sizes: "512x512",
                type: "image/png",
                purpose: "any"
            }
        ],
        share_target: {
            action: '/share',
            method: 'GET',
            params: {
                title: 'title',
                text: 'text',
                url: 'url',
            },
        },
    };
}
