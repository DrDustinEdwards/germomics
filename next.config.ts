import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	images: {
		// `IMAGES` is bound to R2 (germomics-blog-images), not the native CF Images binding,
		// so the OpenNext optimizer is intentionally bypassed. Images are pre-sized in R2 and
		// served from the custom domain.
		unoptimized: true,
		remotePatterns: [
			{ protocol: 'https', hostname: 'images.germomics.com' },
			{ protocol: 'https', hostname: 'media.germomics.com' },
		],
	},
};

export default nextConfig;

// Enable calling `getCloudflareContext()` in `next dev`.
// See https://opennext.js.org/cloudflare/bindings#local-access-to-bindings.
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
initOpenNextCloudflareForDev();
