import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Inter } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

const geistSans = Geist({
    variable: "--font-geist-sans",
    subsets: ["latin"]
});

const geistMono = Geist_Mono({
    variable: "--font-geist-mono",
    subsets: ["latin"]
});

export const metadata: Metadata = {
    title: "BlindSpot",
    description: "On hacke vos articles pour exposer leurs angles morts.",
    manifest: "/manifest.webmanifest",
    appleWebApp: {
        capable: true,
        statusBarStyle: "black-translucent",
        title: "BlindSpot"
    },
    icons: {
        icon: [
            { url: "/favicon.ico" },
            {
                url: "/icons/favicon-192.png",
                sizes: "192x192",
                type: "image/png"
            },
            {
                url: "/icons/favicon-512.png",
                sizes: "512x512",
                type: "image/png"
            }
        ]
    }
};

export const viewport: Viewport = {
    themeColor: "#0a0a0a"
};

export default function RootLayout({
    children
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html
            lang="fr"
            className={cn(
                "h-full",
                "antialiased",
                geistSans.variable,
                geistMono.variable,
                "font-sans",
                inter.variable
            )}>
            <body className="min-h-full flex flex-col" suppressHydrationWarning>
                {children}
            </body>
        </html>
    );
}
