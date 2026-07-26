import react from "@vitejs/plugin-react";
import { defineConfig, transformWithOxc } from "vite";

const jsxInJavaScript = {
  name: "nova-jsx-in-javascript",
  enforce: "pre",
  async transform(code, id) {
    if (!id.includes("/components/") || !id.endsWith(".js")) return null;
    return transformWithOxc(code, id, { lang: "jsx" });
  },
};

export default defineConfig({
  root: "static",
  base: "/",
  plugins: [jsxInJavaScript, react()],
  build: {
    outDir: "../static-dist",
    emptyOutDir: true,
    sourcemap: false,
  },
});
