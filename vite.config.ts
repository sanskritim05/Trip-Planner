import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import { nitro } from "nitro/vite";

// Load server secrets (e.g. GROQ_API_KEY) from .env into process.env for the dev server.
// Vite itself only exposes VITE_* variables to browser code.
try {
  process.loadEnvFile(".env");
} catch {
  // No .env file: AI features stay off, everything else works.
}

export default defineConfig({
  server: { port: 3000 },
  resolve: { dedupe: ["react", "react-dom", "@tanstack/react-router", "@tanstack/react-start"] },
  plugins: [
    tsConfigPaths(),
    // Route TanStack Start's server entry through src/server.ts (SSR error wrapper).
    tanstackStart({ server: { entry: "server" } }),
    // Node server output (.output/server/index.mjs). Set NITRO_PRESET to target another host.
    nitro(),
    viteReact(),
    tailwindcss(),
  ],
});
