import { NextResponse } from "next/server";

type BookData = {
  title: string;
  author: string;
  ndc: string;
};

function extractTag(xml: string, tags: string[]) {
  for (const tag of tags) {
    const escaped = tag.replace(":", "\\:");
    const pattern = new RegExp(`<${escaped}>([\\s\\S]*?)</${escaped}>`, "i");
    const match = xml.match(pattern);
    if (match?.[1]) {
      return match[1].trim();
    }
  }
  return "";
}

function parseBookFromXml(xml: string): BookData | null {
  const itemMatch = xml.match(/<item>([\s\S]*?)<\/item>/i);
  if (!itemMatch?.[1]) return null;

  const itemXml = itemMatch[1];
  return {
    title: extractTag(itemXml, ["title"]) || "Unknown Tome",
    author: extractTag(itemXml, ["author", "dc:creator", "creator"]) || "Unknown Author",
    ndc: extractTag(itemXml, ["dcndl:ndc", "ndc", "category"]) || "000",
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const isbn = (searchParams.get("isbn") || "").replace(/[^\d]/g, "");

  if (isbn.length !== 13) {
    return NextResponse.json(
      { error: "ISBN must be 13 digits." },
      { status: 400 },
    );
  }

  try {
    const ndlRes = await fetch(
      `https://ndlsearch.ndl.go.jp/api/opensearch?isbn=${encodeURIComponent(isbn)}`,
      {
        cache: "no-store",
      },
    );

    if (!ndlRes.ok) {
      return NextResponse.json(
        { error: "Failed to connect to NDL API." },
        { status: 502 },
      );
    }

    const xml = await ndlRes.text();
    const book = parseBookFromXml(xml);
    if (!book) {
      return NextResponse.json(
        { error: "No matching book found for this ISBN." },
        { status: 404 },
      );
    }

    return NextResponse.json(book);
  } catch {
    return NextResponse.json(
      { error: "Unexpected error while calling NDL API." },
      { status: 500 },
    );
  }
}
