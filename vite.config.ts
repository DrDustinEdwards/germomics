import { reactRouter } from "@react-router/dev/vite";
import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    cloudflare({
      viteEnvironment: { name: "ssr" },
      // The deployed commit for /health's `sha`: Workers Builds sets WORKERS_CI_COMMIT_SHA in the build. Always written,
      // empty for a local build, so keep_vars never carries an older commit's value into a manual deploy.
      config: { vars: { DEPLOY_SHA: process.env.WORKERS_CI_COMMIT_SHA ?? "" } },
    }),
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
