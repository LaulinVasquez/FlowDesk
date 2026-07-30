import { NextRequest, NextResponse } from "next/server";
import { parseSearchIntent, validateSearchIntent } from "@/lib/search";

const requests = new Map<string, { count: number; reset: number }>();
const WINDOW = 60_000, LIMIT = 30;

export async function POST(request: NextRequest) {
  const key = request.headers.get("x-forwarded-for")?.split(",")[0] || "local";
  const now = Date.now(), bucket = requests.get(key);
  if (bucket && bucket.reset > now && bucket.count >= LIMIT) return NextResponse.json({ error: "Too many searches" }, { status: 429 });
  requests.set(key, !bucket || bucket.reset <= now ? { count: 1, reset: now + WINDOW } : { ...bucket, count: bucket.count + 1 });

  const body = await request.json().catch(() => null);
  const query = typeof body?.query === "string" ? body.query.slice(0, 300) : "";
  const projects = Array.isArray(body?.projects) ? body.projects.filter((p: unknown) => p && typeof p === "object" && typeof (p as {id?:unknown}).id === "string" && typeof (p as {name?:unknown}).name === "string").slice(0, 50) : [];
  if (!query.trim()) return NextResponse.json({ intent: {}, source: "local" });
  const fallback = parseSearchIntent(query, projects);
  if (!process.env.OPENAI_API_KEY) return NextResponse.json({ intent: fallback, source: "local" });

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: process.env.OPENAI_SEARCH_MODEL || "gpt-5.6-sol",
        input: [
          { role: "system", content: "Parse a todo search query into JSON only. Use only these keys: text,status,priorities,projectIds,tags,dueFrom,dueTo,overdue,sortBy. Dates must be YYYY-MM-DD. Never invent project IDs. Current date: " + new Date().toISOString().slice(0,10) + ". Projects: " + JSON.stringify(projects) },
          { role: "user", content: query }
        ],
        text: { format: { type: "json_object" } }
      }),
      signal: AbortSignal.timeout(8_000)
    });
    if (!response.ok) throw new Error("AI search unavailable");
    const data = await response.json();
    const output = data.output?.flatMap((item: {content?:{text?:string}[]}) => item.content || []).find((item: {text?:string}) => item.text)?.text;
    const intent = validateSearchIntent(JSON.parse(output || "{}"), projects.map((p:{id:string}) => p.id));
    return NextResponse.json({ intent, source: "ai" });
  } catch {
    return NextResponse.json({ intent: fallback, source: "local", fallback: true });
  }
}
