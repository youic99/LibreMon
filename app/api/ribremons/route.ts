import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type RibremonInsert = {
  title: string;
  isbn: string;
  image_url: string;
  stats: Record<string, unknown>;
  access_token?: string | null;
  refresh_token?: string | null;
};

export async function POST(request: Request) {
  let body: RibremonInsert;
  try {
    body = (await request.json()) as RibremonInsert;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { title, isbn, image_url, stats, access_token, refresh_token } = body;
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
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const authHeader = request.headers.get("authorization");
    const accessToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

    const supabase = createClient(url, anonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    if (access_token && refresh_token) {
      await supabase.auth.setSession({ access_token, refresh_token });
    }

    const { data: { user } } = await supabase.auth.getUser();
    console.log('User from getUser:', user);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("ribremons")
      .insert({
        title,
        isbn,
        image_url,
        stats,
        user_id: user.id,
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
