// show_config is a single row describing the podcast (channel-level feed data + subscribe
// links + iTunes categories + funding). Falls back to sensible defaults if the row is absent.
import { eq } from "drizzle-orm";
import { getDb } from "~/db/index.server";
import { showConfig, type ShowConfig } from "~/db/schema";

export const DEFAULT_SHOW: ShowConfig = {
  id: 0,
  title: "germomics",
  description: "A podcast about microbiology and history.",
  author: "Dustin Edwards",
  ownerEmail: "emaildustinedwards@gmail.com",
  artwork: "https://images.germomics.com/cover.jpg",
  appleCategory: "Science",
  language: "en-us",
  itunesType: "episodic",
  explicit: false,
  subscribeLinks: {},
  fundingUrl: null,
  categories: [
    { category: "Science", subcategory: "Life Sciences" },
    { category: "Society & Culture", subcategory: "Documentary" },
    { category: "Education", subcategory: "Courses" },
  ],
  fundingLabel: null,
};

export async function getShowConfig(env: Env): Promise<ShowConfig> {
  const db = getDb(env);
  const rows = await db.select().from(showConfig).limit(1);
  return rows[0] ?? DEFAULT_SHOW;
}

/** Upsert the single show_config row (id = 1). Admin-only writer. */
export async function upsertShowConfig(env: Env, fields: Partial<ShowConfig>): Promise<void> {
  const db = getDb(env);
  const existing = await db.select({ id: showConfig.id }).from(showConfig).limit(1);
  if (existing[0]) {
    await db.update(showConfig).set(fields).where(eq(showConfig.id, existing[0].id));
    return;
  }
  // First write — seed from defaults merged with the provided fields.
  const { id: _id, ...defaults } = DEFAULT_SHOW;
  void _id;
  await db.insert(showConfig).values({ ...defaults, ...fields });
}
