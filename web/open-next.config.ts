import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// Cloudflare Workers build of the app (see README, "Хостване в Cloudflare").
// No incremental cache bucket: every page here is rendered per request.
export default defineCloudflareConfig();
