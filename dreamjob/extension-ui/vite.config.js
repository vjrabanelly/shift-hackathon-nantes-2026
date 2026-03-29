import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { crx } from "@crxjs/vite-plugin";
import manifest from "./src/manifest";
export default defineConfig({
    server: {
        host: "127.0.0.1",
        port: 5173,
        strictPort: true,
        hmr: {
            host: "127.0.0.1",
            port: 5173,
            protocol: "ws",
        },
    },
    plugins: [react(), crx({ manifest: manifest })],
});
