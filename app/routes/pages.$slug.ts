import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Route } from "./+types/pages.$slug";

export async function loader({ params }: Route.LoaderArgs) {
  const slug = params.slug;

  if (!/^[a-zA-Z0-9_-]+$/.test(slug)) {
    return new Response("Not found", { status: 404 });
  }

  const filePath = path.join(process.cwd(), "public", "pages", slug, "index.html");

  try {
    const html = await readFile(filePath, "utf-8");
    return new Response(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "public, max-age=300, s-maxage=3600",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
