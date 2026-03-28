import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type RibremonInsert = {
  title: string;
  isbn: string;
  image_url: string;
  stats: Record<string, unknown>;
};

export async function POST(request: Request) {
  let body: RibremonInsert;
  try {
    body = (await request.json()) as RibremonInsert;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { title, isbn, image_url, stats } = body;
  if (
    typeof title !== "string" ||
    typeof isbn !== "string" ||
    typeof image_url !== "string" ||
    stats === null ||
    typeof stats !== "object" ||
    Array.isArray(stats)
  ) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  try {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from("ribremons")
      .insert({
        title,
        isbn,
        image_url,
        stats,
      })
      .select("id")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ id: data.id });
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
