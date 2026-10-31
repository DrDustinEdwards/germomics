import { chartStylesheet } from "~/lib/charts.server";

export function loader() {
  return new Response(chartStylesheet, {
    headers: { "Content-Type": "text/css; charset=utf-8", "Cache-Control": "public, max-age=3600" },
  });
}
