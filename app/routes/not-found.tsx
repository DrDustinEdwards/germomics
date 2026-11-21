// Every address no route matches: a 404, drawn by the public layout's ErrorBoundary (routes/_site.tsx).
export function loader(): never {
  throw new Response("Not found", { status: 404 });
}

export default function NotFound() {
  return null;
}
