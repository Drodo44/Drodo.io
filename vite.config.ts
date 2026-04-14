import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const host = process.env.TAURI_DEV_HOST;

export default defineConfig(async () => ({
  plugins: [react(), tailwindcss()],
  clearScreen: false,
  assetsInclude: ['**/*.ndjson'],
  build: {
    reportCompressedSize: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/src/data/skills/')) return 'skills-data'
          if (id.includes('/src/data/workflows/')) return 'workflow-data'
          if (id.includes('/model_registry/')) return 'model-registry'
          if (id.includes('/node_modules/react/') || id.includes('/node_modules/react-dom/')) return 'react-core'
          if (id.includes('/node_modules/zustand/')) return 'zustand'
          if (id.includes('/node_modules/@radix-ui/')) return 'radix'
          if (id.includes('/node_modules/lucide-react/')) return 'lucide'
          if (id.includes('/node_modules/@supabase/')) return 'supabase'
          return undefined
        },
      },
    },
    chunkSizeWarningLimit: 50000,
  },
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
}));
