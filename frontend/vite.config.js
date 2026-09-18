import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "./",
  preview: {
    host: "127.0.0.1",
    port: 4173,
    allowedHosts: true,
  },
});
