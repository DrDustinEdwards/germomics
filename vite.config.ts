import { reactRouter } from "@react-router/dev/vite";
import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    cloudflare({ viteEnvironment: { name: "ssr" } }),
    tailwindcss(),
    reactRouter(),
  ],
  resolve: {
    tsconfigPaths: true,
  },
  // The Worker is minified to stay inside its size budget (.worker-size.json); its source maps still go up with
  // each deploy (upload_source_maps in wrangler.jsonc), so stack traces in Workers Logs stay readable. Nothing in
  // the app depends on a function or class name at runtime.
  environments: { ssr: { build: { minify: true, sourcemap: true } } },
});
