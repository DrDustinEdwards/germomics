import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { RouterContextProvider } from "react-router";
import { cloudflareContext } from "~/lib/context.server";
import { action } from "~/routes/api.operator";

// The operator API (app/routes/api.operator.ts): a good call runs the files backup passes into BACKUPS (copy only)
// and backup_status reads them back. The bearer is site-runtime's ./operator, tested where it lives. Fake token, fake data.
const TOKEN = "t".repeat(40);

function call(headers: Record<string, string>, over: Partial<Env> = {}, tool = "backup_media") {
  const context = new RouterContextProvider();
  context.set(cloudflareContext, { env: { ...(env as unknown as Env), OPERATOR_TOKEN: TOKEN, ...over }, ctx: {} as ExecutionContext });
  const request = new Request("https://germomics.com/api/operator", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify({ tool, args: {} }),
  });
  return action({ request, params: {}, context } as never) as Promise<Response>;
}

describe("operator API", () => {
  it("runs the three files passes for the right bearer and copies a file", async () => {
    await (env as unknown as Env).GAME_ASSETS.put("sample/level.json", "{}");
    const res = await call({ authorization: `Bearer ${TOKEN}` });
    expect(res.status).toBe(200);
    const { data } = (await res.json()) as { data: { files: Array<{ name: string; complete: boolean }> } };
    expect(data.files.map((f) => f.name)).toEqual(["audio", "images", "game-assets"]);
    expect(data.files.every((f) => f.complete)).toBe(true);
    expect(await (env as unknown as Env).BACKUPS.head("files/game-assets/sample/level.json")).not.toBeNull();

    // backup_status reads the pass it just wrote, uncached.
    const status = (await (await call({ authorization: `Bearer ${TOKEN}` }, {}, "backup_status")).json()) as { data: { files: { gameAssets: { last_ok: string | null } } } };
    expect(status.data.files.gameAssets.last_ok).not.toBeNull();
  });
});
