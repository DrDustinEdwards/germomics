import { reactRouter } from "@react-router/dev/vite";
import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { siteScript } from "@dustinedwards/devkit/vite/site-script";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    cloudflare({
      viteEnvironment: { name: "ssr" },
      // The deployed commit for /health's `sha`: CI's deploy passes `--var DEPLOY_SHA:<commit>`. Always written, empty
      // for a local build, so keep_vars never carries an older commit's value into a manual deploy.
      config: { vars: { DEPLOY_SHA: "" } },
    }),
    tailwindcss(),
    reactRouter(),
    // /site.js (app/site.ts): the theme button, the header menus, the share buttons and the player's hydrate-on-intent,
    // with no framework, on every page. A public page sends no React until a reader presses play (app/root.tsx).
    siteScript(),
  ],
  resolve: {
    tsconfigPaths: true,
  },
  // The Worker is minified to stay inside its size budget (.worker-size.json); its source maps still go up with
  // each deploy (upload_source_maps in wrangler.jsonc), so stack traces in Workers Logs stay readable. Nothing in
  // the app depends on a function or class name at runtime.
  environments: { ssr: { build: { minify: true, sourcemap: true } } },
});
