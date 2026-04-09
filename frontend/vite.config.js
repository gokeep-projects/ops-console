import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";

export default defineConfig({
  plugins: [svelte()],
  build: {
    outDir: "../web/static",
    emptyOutDir: false,
    assetsDir: "",
    sourcemap: false,
    rollupOptions: {
      input: "src/main.js",
      output: {
        entryFileNames: "svelte-app.js",
        chunkFileNames: "svelte-chunk-[name].js",
        assetFileNames: ({ name }) => {
          if (name && name.endsWith(".css")) {
            return "svelte-app.css";
          }
          return "svelte-asset-[name][extname]";
        }
      }
    }
  }
});
