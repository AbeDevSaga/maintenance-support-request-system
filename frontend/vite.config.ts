
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import svgr from "vite-plugin-svgr";

export default defineConfig({
  plugins: [
    react(),
    svgr({
      svgrOptions: {
        icon: true,
        exportType: "named",
        namedExport: "ReactComponent",
      },
    }),
  ],
  define: {
    "process.env": {},
  },
  esbuild: {
    logOverride: { "unused-import": "silent" }, // ignore unused vars in build
  },
  server: {
    host: "0.0.0.0",
    port: 4037,
    fs: {
      strict: false,
    },
  },
  preview: {
    host: "0.0.0.0",
    port: 4037,
  },
});

