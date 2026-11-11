import { Outlet } from "react-router";
import "../site.css";

// The public pages' layout: it adds no markup (the header, footer and player dock are the root's) and brings the
// stylesheet only those pages use (app/site.css: Capsomer's header, player and reading contexts in the site's look), so the admin never loads it.
export default function Site() {
  return <Outlet />;
}
