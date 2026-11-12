import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { RouterContextProvider } from "react-router";
import { cloudflareContext } from "@dustinedwards/site-runtime/context";
import { action } from "~/routes/api.operator";

// The operator API (app/routes/api.operator.ts): a good call runs the files backup passes into BACKUPS (copy only)
// and backup_status reads them back. The bearer is site-runtime's ./operator, tested where it lives. Fake token, fake data.
const TOKEN = "t".repeat(40);

function call(
  headers: Record<string, string>,
  over: Partial<Env> = {},
  tool = "run_job",
  args: Record<string, unknown> = { backup: true },
) {
  const context = new RouterContextProvider();
  context.set(cloudflareContext, {
    env: { ...(env as unknown as Env), OPERATOR_TOKEN: TOKEN, ...over },
    ctx: {} as ExecutionContext,
  });
  const request = new Request("https://germomics.com/api/operator", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify({ tool, args }),
  });
  return action({ request, params: {}, context } as never) as Promise<Response>;
}

describe("operator API", () => {
  it("runs the backup jobs now through run_job for the right bearer and copies a file", async () => {
    await (env as unknown as Env).GAME_ASSETS.put("sample/level.json", "{}");
    const res = await call({ authorization: `Bearer ${TOKEN}` });
    expect(res.status).toBe(200);
    const { data } = (await res.json()) as {
      data: { runs: Array<{ job: string; status: string; result?: { complete?: boolean } }> };
    };
    // The test database has no tables, so the D1 dump fails as an outcome; the three files passes still run.
    expect(data.runs.map((r) => r.job)).toEqual([
      "backup",
      "audio-backup",
      "images-backup",
      "game-assets-backup",
    ]);
    expect(data.runs.slice(1).every((r) => r.status === "ok" && r.result?.complete)).toBe(true);
    expect(
      await (env as unknown as Env).BACKUPS.head("files/game-assets/sample/level.json"),
    ).not.toBeNull();

    // backup_status reads the pass it just wrote, uncached.
    const status = (await (
      await call({ authorization: `Bearer ${TOKEN}` }, {}, "backup_status")
    ).json()) as { data: { files: { "game-assets": { last_ok: string | null } } } };
    expect(status.data.files["game-assets"].last_ok).not.toBeNull();
  });
});
