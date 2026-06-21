// show_config is a single row describing the podcast (channel-level feed data + subscribe
// links). Falls back to sensible defaults if the row is not present yet.
import { getDb } from "~/db/index.server";
import { showConfig, type ShowConfig } from "~/db/schema";

export const DEFAULT_SHOW: ShowConfig = {
  id: 0,
  title: "germomics",
  description: "A podcast about microbiology and history — the purple stain, retold.",
  author: "Dustin Edwards",
  ownerEmail: "emaildustinedwards@gmail.com",
  artwork: "https://images.germomics.com/cover.jpg",
  appleCategory: "Science",
  language: "en-us",
  itunesType: "episodic",
  explicit: false,
  subscribeLinks: {},
  fundingUrl: null,
};

export async function getShowConfig(env: Env): Promise<ShowConfig> {
  const db = getDb(env);
  const rows = await db.select().from(showConfig).limit(1);
  return rows[0] ?? DEFAULT_SHOW;
}
