import { NextResponse } from "next/server";
import { getCurrentUser } from "@/shared/lib/auth/session";

const STREAM_NAME_PATTERN = /^[a-z][a-z0-9_-]*$/;
const SEGMENT_PATTERN = /^[a-zA-Z0-9._-]+$/;
const MEDIAMTX_BASE =
  process.env.MEDIAMTX_INTERNAL_URL ?? "http://mediamtx:8888";

export async function GET(
  request: Request,
  context: { params: Promise<{ name: string; path: string[] }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { name, path } = await context.params;

  if (!STREAM_NAME_PATTERN.test(name)) {
    return NextResponse.json({ error: "Invalid stream name" }, { status: 400 });
  }

  if (path.some((segment) => !SEGMENT_PATTERN.test(segment))) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  const upstream = `${MEDIAMTX_BASE}/${name}/${path.join("/")}`;

  let response: Response;
  try {
    response = await fetch(upstream, {
      headers: { Accept: request.headers.get("Accept") ?? "*/*" },
    });
  } catch {
    return NextResponse.json({ error: "Stream unavailable" }, { status: 502 });
  }

  if (!response.ok) {
    return new NextResponse(null, { status: response.status });
  }

  return new NextResponse(response.body, {
    status: response.status,
    headers: {
      "Content-Type":
        response.headers.get("Content-Type") ?? "application/octet-stream",
      "Cache-Control": "no-store",
    },
  });
}
