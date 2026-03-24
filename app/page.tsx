"use client";

import { FormEvent, useMemo, useState } from "react";
import {
  BookOpenText,
  CircleDashed,
  Crosshair,
  Flame,
  Sparkles,
  Swords,
  WandSparkles,
} from "lucide-react";

type BookData = {
  title: string;
  author: string;
  ndc: string;
};

type MonsterStats = {
  mana: number;
  might: number;
  wisdom: number;
  agility: number;
};

const statMeta: Array<{ key: keyof MonsterStats; label: string; icon: string }> = [
  { key: "mana", label: "MANA", icon: "✦" },
  { key: "might", label: "MIGHT", icon: "⚔" },
  { key: "wisdom", label: "WISDOM", icon: "☽" },
  { key: "agility", label: "AGILITY", icon: "✧" },
];

function normalizeIsbn(raw: string) {
  return raw.replace(/[^\d]/g, "");
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function hashWords(input: string) {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function createStats(isbn: string, book: BookData): MonsterStats {
  const seed = hashWords(`${isbn}${book.title}${book.author}${book.ndc}`);
  const ndcNumber = Number.parseInt(book.ndc.slice(0, 3), 10);
  const ndcBoost = Number.isFinite(ndcNumber) ? ndcNumber % 15 : 0;

  return {
    mana: clamp(35 + (seed % 52) + ndcBoost, 1, 100),
    might: clamp(28 + ((seed >>> 4) % 58), 1, 100),
    wisdom: clamp(30 + ((seed >>> 8) % 55) + Math.floor(book.title.length / 3), 1, 100),
    agility: clamp(24 + ((seed >>> 12) % 63), 1, 100),
  };
}

export default function Home() {
  const [isbnInput, setIsbnInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [book, setBook] = useState<BookData | null>(null);
  const [stats, setStats] = useState<MonsterStats | null>(null);

  const cleanIsbn = useMemo(() => normalizeIsbn(isbnInput), [isbnInput]);
  const isValidIsbn = cleanIsbn.length === 13;

  const handleSummon = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setBook(null);
    setStats(null);

    if (!isValidIsbn) {
      setError("ISBNは13桁で入力してください。");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/ndl?isbn=${cleanIsbn}`);
      if (!response.ok) {
        const errorPayload = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(errorPayload?.error || "国立国会図書館APIへの接続に失敗しました。");
      }

      const parsed = (await response.json()) as BookData;
      setBook(parsed);
      setStats(createStats(cleanIsbn, parsed));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "召喚に失敗しました。");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#09090b] via-[#0f0a19] to-[#050507] text-zinc-100">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 py-10 md:py-14">
        <header className="rounded-2xl border border-fuchsia-400/20 bg-black/30 p-6 shadow-[0_0_40px_rgba(168,85,247,0.08)] backdrop-blur">
          <div className="mb-3 flex items-center gap-3 text-fuchsia-300">
            <CircleDashed className="h-5 w-5" />
            <p className="text-xs tracking-[0.35em]">RITUAL TERMINAL</p>
          </div>
          <h1 className="text-3xl font-semibold tracking-wide md:text-4xl">LibreMon Summoning Gate</h1>
          <p className="mt-3 max-w-2xl text-sm text-zinc-300/90 md:text-base">
            円盤石の代わりに、小説のISBNを刻め。言葉の力を解析し、リブルモンを召喚する。
          </p>
        </header>

        <section className="rounded-2xl border border-zinc-700/70 bg-zinc-950/70 p-6 shadow-[inset_0_0_30px_rgba(99,102,241,0.08)]">
          <form onSubmit={handleSummon} className="flex flex-col gap-4 md:flex-row md:items-end">
            <label className="w-full">
              <span className="mb-2 flex items-center gap-2 text-xs font-medium tracking-[0.25em] text-zinc-300">
                <BookOpenText className="h-4 w-4 text-indigo-300" />
                ISBN CODE (13 DIGITS)
              </span>
              <input
                value={isbnInput}
                onChange={(event) => setIsbnInput(event.target.value)}
                placeholder="9784041024621"
                className="w-full rounded-xl border border-zinc-700 bg-black/50 px-4 py-3 text-lg tracking-[0.16em] outline-none transition focus:border-fuchsia-400 focus:ring-2 focus:ring-fuchsia-500/30"
              />
            </label>

            <button
              type="submit"
              disabled={loading || !isValidIsbn}
              className="inline-flex h-[52px] items-center justify-center gap-2 rounded-xl border border-fuchsia-400/40 bg-fuchsia-500/20 px-6 text-sm font-semibold tracking-[0.18em] text-fuchsia-100 transition hover:bg-fuchsia-400/30 disabled:cursor-not-allowed disabled:opacity-45"
            >
              <WandSparkles className="h-4 w-4" />
              SUMMON
            </button>
          </form>

          <div className="mt-3 flex items-center justify-between text-xs text-zinc-400">
            <span>入力中: {cleanIsbn.length}/13</span>
            {!isValidIsbn && <span>13桁になると儀式を開始できます</span>}
          </div>

          {error && (
            <p className="mt-4 rounded-lg border border-rose-500/50 bg-rose-950/30 px-3 py-2 text-sm text-rose-200">
              {error}
            </p>
          )}
        </section>

        {loading && (
          <section className="rounded-2xl border border-indigo-400/30 bg-indigo-950/20 p-6">
            <div className="flex items-center gap-3 text-indigo-200">
              <Sparkles className="h-5 w-5 animate-pulse" />
              <p className="text-sm font-semibold tracking-[0.25em]">ANALYZING...</p>
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-zinc-800">
              <div className="h-full w-1/2 animate-[pulse_1.2s_ease-in-out_infinite] rounded-full bg-gradient-to-r from-indigo-400 via-fuchsia-400 to-violet-300" />
            </div>
          </section>
        )}

        {book && stats && (
          <section className="grid gap-6 md:grid-cols-[1.15fr_0.85fr]">
            <article className="rounded-2xl border border-zinc-700/70 bg-zinc-950/75 p-6">
              <div className="mb-4 flex items-center gap-2 text-emerald-300">
                <Crosshair className="h-5 w-5" />
                <p className="text-xs tracking-[0.26em]">BOOK RESONANCE PROFILE</p>
              </div>
              <div className="space-y-3 text-sm md:text-base">
                <p>
                  <span className="text-zinc-400">Title:</span> {book.title}
                </p>
                <p>
                  <span className="text-zinc-400">Author:</span> {book.author}
                </p>
                <p>
                  <span className="text-zinc-400">NDC:</span> {book.ndc}
                </p>
              </div>
            </article>

            <article className="rounded-2xl border border-fuchsia-400/35 bg-gradient-to-br from-fuchsia-900/20 to-indigo-900/20 p-6">
              <div className="mb-5 flex items-center gap-2 text-fuchsia-200">
                <Swords className="h-5 w-5" />
                <p className="text-xs tracking-[0.26em]">SUMMONED LIBREMON</p>
              </div>

              <div className="mb-5 flex flex-col items-center justify-center rounded-xl border border-zinc-700 bg-black/30 py-8">
                <div className="mb-2 rounded-full border border-fuchsia-400/40 bg-fuchsia-500/15 p-6">
                  <Flame className="h-12 w-12 text-fuchsia-200" />
                </div>
                <p className="text-sm tracking-[0.18em] text-zinc-300">PHANTOM GRIMOIRE BEAST</p>
              </div>

              <div className="space-y-3">
                {statMeta.map((meta) => {
                  const value = stats[meta.key];
                  return (
                    <div key={meta.key}>
                      <div className="mb-1 flex items-center justify-between text-xs tracking-[0.12em]">
                        <span className="text-zinc-300">
                          {meta.icon} {meta.label}
                        </span>
                        <span className="font-semibold text-zinc-100">{value}</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-indigo-400 to-fuchsia-400"
                          style={{ width: `${value}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </article>
          </section>
        )}
      </div>
    </main>
  );
}
