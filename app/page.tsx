"use client";

import Image from "next/image";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createSupabaseBrowserClient, signInWithEmail, signUpWithEmail, signOut as supabaseSignOut, signInAnonymously } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";

/** DiceBear HTTP API: same title → same avatar (deterministic). */
function libreMonAvatarUrl(bookTitle: string) {
  const seed = bookTitle.trim() || "LibreMon";
  const params = new URLSearchParams({
    seed,
    size: "256",
    backgroundColor: "1a1520",
  });
  return `https://api.dicebear.com/9.x/lorelei/png?${params.toString()}`;
}

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
  level?: number; // ← 追加
};

const statMeta: Array<{ key: keyof MonsterStats; label: string; icon: string }> = [
  { key: "mana", label: "MANA", icon: "M" },
  { key: "might", label: "MIGHT", icon: "S" },
  { key: "wisdom", label: "WISDOM", icon: "W" },
  { key: "agility", label: "AGILITY", icon: "A" },
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

function generateMonsterName(book: BookData): string {
  const prefixes = ["Phantom", "Crimson", "Ancient", "Shadow", "Eternal", "Mystic", "Arcane", "Void"];
  const suffixes = ["Tome", "Grimoire", "Chronicle", "Codex", "Scripture", "Manuscript", "Folio"];
  const types = ["Beast", "Spirit", "Wraith", "Specter", "Guardian", "Sentinel", "Keeper"];
  
  const seed = hashWords(book.title + book.author);
  const prefix = prefixes[seed % prefixes.length];
  const suffix = suffixes[(seed >>> 4) % suffixes.length];
  const type = types[(seed >>> 8) % types.length];
  
  return `${prefix} ${suffix} ${type}`;
}

// Magic Circle SVG Component
function MagicCircle({ className, reverse = false }: { className?: string; reverse?: boolean }) {
  return (
    <svg 
      viewBox="0 0 400 400" 
      className={`${className} ${reverse ? 'animate-magic-reverse' : 'animate-magic-spin'}`}
      fill="none"
    >
      {/* Outer ring */}
      <circle cx="200" cy="200" r="195" stroke="currentColor" strokeWidth="1" opacity="0.3" />
      <circle cx="200" cy="200" r="185" stroke="currentColor" strokeWidth="2" opacity="0.5" />
      
      {/* Rune circle */}
      <circle cx="200" cy="200" r="160" stroke="currentColor" strokeWidth="1" strokeDasharray="10 5" opacity="0.4" />
      
      {/* Inner patterns */}
      <circle cx="200" cy="200" r="120" stroke="currentColor" strokeWidth="1" opacity="0.3" />
      
      {/* Hexagram */}
      <polygon 
        points="200,50 280,150 280,250 200,350 120,250 120,150" 
        stroke="currentColor" 
        strokeWidth="1" 
        opacity="0.4"
      />
      <polygon 
        points="200,350 280,250 280,150 200,50 120,150 120,250" 
        stroke="currentColor" 
        strokeWidth="1" 
        opacity="0.4"
        transform="rotate(60 200 200)"
      />
      
      {/* Cross patterns */}
      <line x1="200" y1="20" x2="200" y2="80" stroke="currentColor" strokeWidth="2" opacity="0.5" />
      <line x1="200" y1="320" x2="200" y2="380" stroke="currentColor" strokeWidth="2" opacity="0.5" />
      <line x1="20" y1="200" x2="80" y2="200" stroke="currentColor" strokeWidth="2" opacity="0.5" />
      <line x1="320" y1="200" x2="380" y2="200" stroke="currentColor" strokeWidth="2" opacity="0.5" />
      
      {/* Decorative dots */}
      {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => (
        <circle
          key={angle}
          cx={200 + 175 * Math.cos((angle * Math.PI) / 180)}
          cy={200 + 175 * Math.sin((angle * Math.PI) / 180)}
          r="4"
          fill="currentColor"
          opacity="0.6"
        />
      ))}
    </svg>
  );
}

// Ornamental Divider Component
function OrnamentalDivider() {
  return (
    <div className="flex items-center justify-center gap-4 py-4">
      <div className="h-px flex-1 bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
      <svg viewBox="0 0 40 20" className="h-5 w-10 text-primary" fill="currentColor">
        <path d="M20 0L25 10L20 20L15 10Z" opacity="0.8" />
        <path d="M10 5L15 10L10 15L5 10Z" opacity="0.6" />
        <path d="M30 5L35 10L30 15L25 10Z" opacity="0.6" />
      </svg>
      <div className="h-px flex-1 bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
    </div>
  );
}

// Particle Effect Component
function SummonParticles({ active }: { active: boolean }) {
  if (!active) return null;
  
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {Array.from({ length: 20 }).map((_, i) => (
        <div
          key={i}
          className="absolute bottom-0 h-2 w-2 rounded-full bg-primary"
          style={{
            left: `${10 + (i * 4)}%`,
            animation: `particle-float 2s ease-out forwards`,
            animationDelay: `${i * 0.1}s`,
            ['--x-drift' as string]: `${((i * 37) % 60) - 30}px`,
          }}
        />
      ))}
    </div>
  );
}

// Gothic Frame Component
function GothicFrame({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`relative ${className}`}>
      {/* Corner ornaments */}
      <svg className="absolute -left-2 -top-2 h-8 w-8 text-primary" viewBox="0 0 32 32" fill="none" stroke="currentColor">
        <path d="M2 30V10C2 5.58 5.58 2 10 2H30" strokeWidth="2" />
        <circle cx="10" cy="10" r="3" fill="currentColor" opacity="0.5" />
      </svg>
      <svg className="absolute -right-2 -top-2 h-8 w-8 text-primary" viewBox="0 0 32 32" fill="none" stroke="currentColor">
        <path d="M30 30V10C30 5.58 26.42 2 22 2H2" strokeWidth="2" />
        <circle cx="22" cy="10" r="3" fill="currentColor" opacity="0.5" />
      </svg>
      <svg className="absolute -bottom-2 -left-2 h-8 w-8 text-primary" viewBox="0 0 32 32" fill="none" stroke="currentColor">
        <path d="M2 2V22C2 26.42 5.58 30 10 30H30" strokeWidth="2" />
        <circle cx="10" cy="22" r="3" fill="currentColor" opacity="0.5" />
      </svg>
      <svg className="absolute -bottom-2 -right-2 h-8 w-8 text-primary" viewBox="0 0 32 32" fill="none" stroke="currentColor">
        <path d="M30 2V22C30 26.42 26.42 30 22 30H2" strokeWidth="2" />
        <circle cx="22" cy="22" r="3" fill="currentColor" opacity="0.5" />
      </svg>
      {children}
    </div>
  );
}

// Logo Component
function LibreMonLogo() {
  return (
    <div className="flex flex-col items-center">
      {/* Decorative top element */}
      <svg viewBox="0 0 120 40" className="mb-2 h-8 w-24 text-primary animate-glow-pulse">
        <path 
          d="M60 0L70 15H50L60 0Z" 
          fill="currentColor"
        />
        <path 
          d="M10 40L20 25H0L10 40Z" 
          fill="currentColor"
          opacity="0.6"
        />
        <path 
          d="M110 40L120 25H100L110 40Z" 
          fill="currentColor"
          opacity="0.6"
        />
        <line x1="20" y1="30" x2="50" y2="15" stroke="currentColor" strokeWidth="1" opacity="0.5" />
        <line x1="100" y1="30" x2="70" y2="15" stroke="currentColor" strokeWidth="1" opacity="0.5" />
      </svg>
      
      {/* Main title */}
      <h1 className="font-[var(--font-cinzel-decorative)] text-5xl font-black tracking-[0.2em] text-primary text-shadow-gold md:text-7xl lg:text-8xl">
        LibreMon
      </h1>
      
      {/* Subtitle */}
      <p className="mt-2 font-sans text-xs tracking-[0.5em] text-foreground/60 md:text-sm">
        SUMMONER OF THE FORBIDDEN TOMES
      </p>
      
      {/* Decorative bottom element */}
      <svg viewBox="0 0 200 20" className="mt-3 h-5 w-48 text-primary">
        <line x1="0" y1="10" x2="70" y2="10" stroke="currentColor" strokeWidth="1" />
        <circle cx="80" cy="10" r="3" fill="currentColor" />
        <circle cx="100" cy="10" r="5" fill="currentColor" />
        <circle cx="120" cy="10" r="3" fill="currentColor" />
        <line x1="130" y1="10" x2="200" y2="10" stroke="currentColor" strokeWidth="1" />
      </svg>
    </div>
  );
}

// Summon Button Component
function SummonButton({ 
  loading, 
  disabled, 
  onClick 
}: { 
  loading: boolean; 
  disabled: boolean; 
  onClick: () => void;
}) {
  return (
    <button
      type="submit"
      disabled={loading || disabled}
      onClick={onClick}
      className="group relative mt-4 overflow-hidden md:mt-0"
    >
      {/* Glow effect */}
      <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-secondary/0 via-primary/20 to-secondary/0 opacity-0 blur-xl transition-opacity duration-500 group-hover:opacity-100" />
      
      {/* Button content */}
      <div className="relative flex h-14 items-center justify-center gap-3 rounded-lg border-2 border-primary/50 bg-gradient-to-b from-muted to-background px-10 font-sans text-sm font-bold tracking-[0.3em] text-primary transition-all duration-300 hover:border-primary hover:text-shadow-gold disabled:cursor-not-allowed disabled:opacity-40 md:h-16 md:px-12">
        {loading ? (
          <>
            <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" opacity="0.3" />
              <path d="M12 2C6.48 2 2 6.48 2 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <span>SUMMONING...</span>
          </>
        ) : (
          <>
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
              <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
            </svg>
            <span>SUMMON</span>
          </>
        )}
      </div>
      
      {/* Corner accents */}
      <div className="absolute left-0 top-0 h-3 w-3 border-l-2 border-t-2 border-primary opacity-60" />
      <div className="absolute right-0 top-0 h-3 w-3 border-r-2 border-t-2 border-primary opacity-60" />
      <div className="absolute bottom-0 left-0 h-3 w-3 border-b-2 border-l-2 border-primary opacity-60" />
      <div className="absolute bottom-0 right-0 h-3 w-3 border-b-2 border-r-2 border-primary opacity-60" />
    </button>
  );
}

// Book Info Card Component
function BookInfoCard({ book }: { book: BookData }) {
  return (
    <GothicFrame className="rounded-lg border border-border bg-card p-6">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded border border-primary/30 bg-primary/10">
          <svg viewBox="0 0 24 24" className="h-5 w-5 text-primary" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
          </svg>
        </div>
        <div>
          <p className="font-sans text-xs tracking-[0.3em] text-muted-foreground">TOME RESONANCE</p>
          <p className="font-sans text-lg font-semibold text-primary">IDENTIFIED</p>
        </div>
      </div>
      
      <OrnamentalDivider />
      
      <dl className="space-y-4 font-sans text-sm">
        <div>
          <dt className="text-xs tracking-[0.2em] text-muted-foreground">TITLE</dt>
          <dd className="mt-1 text-lg text-foreground">{book.title}</dd>
        </div>
        <div>
          <dt className="text-xs tracking-[0.2em] text-muted-foreground">AUTHOR</dt>
          <dd className="mt-1 text-foreground">{book.author}</dd>
        </div>
        <div>
          <dt className="text-xs tracking-[0.2em] text-muted-foreground">NDC CLASSIFICATION</dt>
          <dd className="mt-1 font-mono text-primary">{book.ndc}</dd>
        </div>
      </dl>
    </GothicFrame>
  );
}

// Monster Card Component
function MonsterCard({ book, stats, showAnimation, combinedSeed }: { book: BookData; stats: MonsterStats; showAnimation: boolean; combinedSeed: string }) {
  const monsterName = useMemo(() => generateMonsterName(book), [book]);
  const currentLevel = stats.level || 1; // デフォルトは1
  // 
  // レベルに応じてアバターの背景色やエフェクトを変えるための設定
  const levelColor = currentLevel > 1 ? "text-secondary" : "text-primary";
  const glowIntensity = Math.min(currentLevel * 5, 30); // レベルが高いほど光る

  const avatarSrc = useMemo(() => {
    const params = new URLSearchParams({
      seed: combinedSeed, // 🌟 ここを combinedSeed に変える！
      size: "256",
      backgroundColor: "1a1520",
    });
    return `https://api.dicebear.com/9.x/lorelei/png?${params.toString()}`;
  }, [combinedSeed]);

  return (
    <GothicFrame className={`rounded-lg border border-secondary/50 bg-gradient-to-b from-card to-background p-6 ${showAnimation ? 'animate-reveal-monster' : ''}`}>
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded border border-secondary/30 bg-secondary/10">
            <svg viewBox="0 0 24 24" className="h-5 w-5 text-secondary" fill="currentColor">
              <path d="M12 2C13.1 2 14 2.9 14 4C14 4.74 13.6 5.39 13 5.73V7H14C17.31 7 20 9.69 20 13C20 16.31 17.31 19 14 19H13V21H11V19H10C6.69 19 4 16.31 4 13C4 9.69 6.69 7 10 7H11V5.73C10.4 5.39 10 4.74 10 4C10 2.9 10.9 2 12 2M10 9C7.79 9 6 10.79 6 13S7.79 17 10 17H14C16.21 17 18 15.21 18 13S16.21 9 14 9H10Z" />
            </svg>
          </div>
          <div>
            <p className="font-sans text-xs tracking-[0.3em] text-muted-foreground">
              {currentLevel > 1 ? `EVOLVED LIBREMON` : `SUMMONED LIBREMON`}
            </p>
            <p className={`font-sans text-lg font-semibold ${levelColor}`}>
              {monsterName} <span className="ml-2 text-sm opacity-80">Lv.{currentLevel}</span>
            </p>
          </div>
        </div>
      </div>
      
      {/* モンスター表示エリア：レベルが高いと光を強くする */}
      <div className="relative mb-6 overflow-hidden rounded-lg border border-border bg-background/50 py-12">
        <div className="absolute inset-0 flex items-center justify-center opacity-20">
          <MagicCircle className={`h-64 w-64 ${levelColor}`} />
        </div>
        
        <div className="relative flex flex-col items-center justify-center">
          <div 
            className="relative mb-4 h-40 w-40 overflow-hidden rounded-full border-2 border-secondary/50 shadow-lg animate-glow-pulse"
            style={{ boxShadow: `0 0 ${glowIntensity}px rgba(201,169,98,0.5)` }}
          >
            <Image src={avatarSrc} alt={monsterName} width={256} height={256} unoptimized />
          </div>
        </div>
      </div>
      
      {/* Stats */}
      <div className="space-y-4">
        <p className="text-center font-sans text-xs tracking-[0.3em] text-muted-foreground">COMBAT ATTRIBUTES</p>
        <OrnamentalDivider />
        {statMeta.map((meta, index) => {
          const value = stats[meta.key];
          return (
            <div key={meta.key}>
              <div className="mb-1 flex items-center justify-between font-sans text-xs">
                <span className="flex items-center gap-2 tracking-[0.15em] text-muted-foreground">
                  <span className="flex h-5 w-5 items-center justify-center rounded border border-primary/30 bg-primary/10 text-[10px] font-bold text-primary">
                    {meta.icon}
                  </span>
                  {meta.label}
                </span>
                <span className="font-mono font-bold text-foreground">{value}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-secondary via-primary to-secondary animate-stat-fill"
                  style={{ 
                    width: `${value}%`,
                    animationDelay: `${index * 0.15}s`
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </GothicFrame>
  );
}

// reading_logsの型を定義
type ReadingLog = {
  id: string;
  user_id: string;
  isbn: string;
  title: string;
  created_at: string; // ISO形式の文字列で返ってきます
};

export default function Home() {
  const [isFetching, setIsFetching] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [isbnInput, setIsbnInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [book, setBook] = useState<BookData | null>(null);
  const [stats, setStats] = useState<MonsterStats | null>(null);
  const [showAnimation, setShowAnimation] = useState(false);
  const [summoningPhase, setSummoningPhase] = useState<'idle' | 'summoning' | 'complete'>('idle');
  const [catalogToast, setCatalogToast] = useState<string | null>(null);
  const catalogToastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 認証関連の状態
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const cleanIsbn = useMemo(() => normalizeIsbn(isbnInput), [isbnInput]);
  const isValidIsbn = cleanIsbn.length === 13;

  // 1. ステートの追加
  const [logs, setLogs] = useState<ReadingLog[]>([]);

  // page.tsx の Home 関数内、useStateたちのすぐ下あたり
  const combinedSeed = useMemo(() => {
    if (logs.length === 0) return "LibreMon";
    // 読んだ本のタイトルを全部つなげてシードにする
    return logs.map(log => log.title.trim()).join("");
  }, [logs]);

  const fetchLogs = useCallback(async () => {
    if (!isMounted) return; // isFetching のチェックを外してシンプルに

    const supabase = createSupabaseBrowserClient();
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    
    if (currentUser) {
      const { data, error } = await supabase
        .from('reading_logs')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (!error && data) {
        setLogs(data);
      }
    }
  }, [isMounted]); // 依存関係は isMounted だけでOK

  const handleSummon = useCallback(async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setBook(null);
    setStats(null);
    setShowAnimation(false);
    setSummoningPhase('idle');
    setCatalogToast(null);
    if (catalogToastTimer.current) {
      clearTimeout(catalogToastTimer.current);
      catalogToastTimer.current = null;
    }

    if (!isValidIsbn) {
      setError("ISBNコードは13桁で入力してください。");
      return;
    }

    setLoading(true);
    setSummoningPhase('summoning');
    
    try {
      const response = await fetch(`/api/ndl?isbn=${cleanIsbn}`);
      if (!response.ok) {
        const errorPayload = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(errorPayload?.error || "国立国会図書館APIへの接続に失敗しました。");
      }

      const parsed = (await response.json()) as BookData;

      // Add dramatic delay for effect
      await new Promise((resolve) => setTimeout(resolve, 1500));

      const monsterStats = createStats(cleanIsbn, parsed);
      const imageUrl = libreMonAvatarUrl(parsed.title);

      setBook(parsed);
      setStats(monsterStats);
      setSummoningPhase("complete");
      setShowAnimation(true);

      const { data: { session } } = await createSupabaseBrowserClient().auth.getSession();
      const saveRes = await fetch("/api/ribremons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: parsed.title,
          isbn: cleanIsbn,
          image_url: imageUrl,
          stats: monsterStats,
          access_token: session?.access_token ?? null,
          refresh_token: session?.refresh_token ?? null,
        }),
      });

      const saveResult = await saveRes.json();

      // 進化した場合、APIから返ってきたレベルを反映させる
      const finalStats = {
        ...monsterStats,
        level: saveResult.level || 1 // APIが返したレベルを使う
      };

      setBook(parsed);
      setStats(finalStats); // ここでレベル入りのステータスをセット
      setSummoningPhase("complete");

      if (saveResult.status === "evolved") {
        setCatalogToast(`リブレモンが Lv.${saveResult.level} に進化しました！`);
      } else {
        setCatalogToast("図鑑に登録されました！");
      }

      // if (saveRes.ok) {
      //   setCatalogToast("図鑑に登録されました！");
      //   if (catalogToastTimer.current) clearTimeout(catalogToastTimer.current);
      //   catalogToastTimer.current = setTimeout(() => {
      //     setCatalogToast(null);
      //     catalogToastTimer.current = null;
      //   }, 4500);
      // }

      // Reset animation flag after animation completes
      setTimeout(() => setShowAnimation(false), 1500);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "召喚の儀式に失敗しました。");
      setSummoningPhase('idle');
    } finally {
      setLoading(false);
    }
  }, [cleanIsbn, isValidIsbn]);

  useEffect(() => {
    setIsMounted(true);
    
    // マウント時に一度だけ実行
    fetchLogs();

    const supabase = createSupabaseBrowserClient();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      setAuthLoading(false);
      if (session?.user) {
        fetchLogs(); // ログイン状態が変わった時だけ再取得
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchLogs]); // fetchLogs は stable なので初回だけ実行されます

  // ログイン処理
  const handleSignIn = useCallback(async (email: string, password: string) => {
    try {
      const { error } = await signInWithEmail(email, password);
      if (error) throw error;
    } catch (error) {
      console.error('Sign in error:', error);
      alert(error instanceof Error ? error.message : 'ログインに失敗しました');
    }
  }, []);

  // サインアップ処理
  const handleSignUp = useCallback(async (email: string, password: string) => {
    try {
      const userName = prompt('Name:');
      if (!userName) {
        alert('名前を入力してください');
        return;
      }

      const { error } = await signUpWithEmail(email, password, userName);
      if (error) throw error;
      alert('アカウントを作成しました。必要であればメールを確認してください。');
    } catch (error) {
      console.error('Sign up error:', error);
      alert(error instanceof Error ? error.message : 'サインアップに失敗しました');
    }
  }, []);

  // ゲストログイン処理
  const handleGuestSignIn = useCallback(async () => {
    try {
      const { error } = await signInAnonymously();
      if (error) throw error;
      alert('ゲストとしてログインしました');
    } catch (error) {
      console.error('Guest sign in error:', error);
      alert('ゲストログインに失敗しました');
    }
  }, []);

  // ログアウト処理
  const handleSignOut = useCallback(async () => {
    try {
      const { error } = await supabaseSignOut();
      if (error) throw error;
    } catch (error) {
      console.error('Sign out error:', error);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (catalogToastTimer.current) clearTimeout(catalogToastTimer.current);
    };
  }, []);

  return (
    <main className="relative min-h-screen overflow-hidden bg-background">
      {/* Background decorations */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {/* Vignette effect */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(10,9,8,0.8)_100%)]" />
        
        {/* Subtle texture overlay */}
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
        }} />
        
        {/* Floating magic circles */}
        <div className="absolute -left-32 top-1/4 opacity-10">
          <MagicCircle className="h-96 w-96 text-primary" />
        </div>
        <div className="absolute -right-32 bottom-1/4 opacity-10">
          <MagicCircle className="h-80 w-80 text-secondary" reverse />
        </div>
      </div>

      {catalogToast && (
        <div
          role="status"
          className="fixed left-1/2 top-4 z-[100] max-w-md -translate-x-1/2 rounded-lg border border-primary/50 bg-card/95 px-6 py-3 text-center font-sans text-sm font-medium tracking-wide text-foreground shadow-[0_0_24px_rgba(201,169,98,0.25)] backdrop-blur"
        >
          {catalogToast}
        </div>
      )}

      <div className="relative mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-8 md:gap-12 md:px-6 md:py-16">
        {/* Header with Logo */}
        <header className="flex flex-col items-center pt-8">
          <LibreMonLogo />
          
          {/* 認証UI */}
          <div className="mt-6 flex items-center gap-4">
            {authLoading ? (
              <div className="font-sans text-xs tracking-[0.3em] text-muted-foreground">LOADING...</div>
            ) : user ? (
              <div className="flex items-center gap-4">
                <div className="font-sans text-xs tracking-[0.3em] text-muted-foreground">
                  WELCOME, {user.user_metadata?.user_name ? user.user_metadata.user_name.toString() : user.email?.includes('guest_') ? 'GUEST' : user.email?.split('@')[0].toUpperCase()}
                </div>
                <button
                  onClick={handleSignOut}
                  className="rounded border border-primary/50 bg-background px-4 py-2 font-sans text-xs tracking-[0.3em] text-primary hover:border-primary hover:text-shadow-gold"
                >
                  LOGOUT
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-4">
                <button
                  onClick={() => {
                    const email = prompt('Email:');
                    const password = prompt('Password:');
                    if (email && password) handleSignIn(email, password);
                  }}
                  className="rounded border border-primary/50 bg-background px-4 py-2 font-sans text-xs tracking-[0.3em] text-primary hover:border-primary hover:text-shadow-gold"
                >
                  LOGIN
                </button>
                <button
                  onClick={() => {
                    const email = prompt('Email:');
                    const password = prompt('Password:');
                    if (email && password) handleSignUp(email, password);
                  }}
                  className="rounded border border-primary/50 bg-background px-4 py-2 font-sans text-xs tracking-[0.3em] text-primary hover:border-primary hover:text-shadow-gold"
                >
                  SIGN UP
                </button>
                <button
                  onClick={handleGuestSignIn}
                  className="rounded border border-secondary/50 bg-background px-4 py-2 font-sans text-xs tracking-[0.3em] text-secondary hover:border-secondary hover:text-shadow-gold"
                >
                  GUEST LOGIN
                </button>
              </div>
            )}
          </div>
          
          <p className="mt-8 max-w-lg text-center font-sans text-sm leading-relaxed text-muted-foreground md:text-base">
            禁断の書物に刻まれしISBNコードを解読し、古の魔物を現世に召喚せよ。
          </p>
        </header>

        <OrnamentalDivider />

        {/* Summoning Form */}
        <section className="mx-auto w-full max-w-2xl">
          <GothicFrame className="rounded-lg border border-border bg-card/80 p-6 backdrop-blur md:p-8">
            <div className="mb-6 text-center">
              <p className="font-sans text-xs tracking-[0.4em] text-muted-foreground">RITUAL INCANTATION</p>
              <h2 className="mt-2 font-sans text-xl font-semibold tracking-wider text-foreground">召喚の儀式</h2>
            </div>
            
            <form onSubmit={handleSummon} className="flex flex-col items-center gap-4">
              <label className="w-full">
                <span className="mb-2 flex items-center justify-center gap-2 font-sans text-xs tracking-[0.3em] text-muted-foreground">
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                  </svg>
                  ISBN CODE
                </span>
                <div className="relative">
                  <input
                    value={isbnInput}
                    onChange={(event) => setIsbnInput(event.target.value)}
                    placeholder="978-4-04-102462-1"
                    className="w-full rounded-lg border-2 border-border bg-background px-4 py-4 text-center font-mono text-xl tracking-[0.2em] text-foreground outline-none transition-all duration-300 placeholder:text-muted-foreground/50 focus:border-primary focus:shadow-[0_0_20px_rgba(201,169,98,0.2)] animate-border-glow"
                  />
                  {/* Input decorative corners */}
                  <div className="absolute left-1 top-1 h-2 w-2 border-l border-t border-primary/50" />
                  <div className="absolute right-1 top-1 h-2 w-2 border-r border-t border-primary/50" />
                  <div className="absolute bottom-1 left-1 h-2 w-2 border-b border-l border-primary/50" />
                  <div className="absolute bottom-1 right-1 h-2 w-2 border-b border-r border-primary/50" />
                </div>
              </label>

              {/* Progress indicator */}
              <div className="flex w-full items-center justify-between px-2 font-sans text-xs text-muted-foreground">
                <span>{cleanIsbn.length}/13 digits</span>
                {isValidIsbn ? (
                  <span className="text-primary">Ready to summon</span>
                ) : (
                  <span>Enter 13 digits to begin</span>
                )}
              </div>

              <SummonButton 
                loading={loading} 
                disabled={!isValidIsbn} 
                onClick={() => {}}
              />
            </form>

            {error && (
              <div className="mt-6 rounded-lg border border-secondary/50 bg-secondary/10 p-4 text-center">
                <p className="font-sans text-sm text-secondary">{error}</p>
              </div>
            )}
          </GothicFrame>
        </section>

        {/* Summoning Animation */}
        {summoningPhase === 'summoning' && (
          <section className="mx-auto w-full max-w-2xl">
            <div className="relative flex flex-col items-center justify-center py-12">
              {/* Spinning magic circles */}
              <div className="relative h-64 w-64">
                <MagicCircle className="absolute inset-0 h-full w-full text-primary" />
                <MagicCircle className="absolute inset-8 h-48 w-48 text-secondary" reverse />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="h-16 w-16 animate-pulse rounded-full bg-gradient-to-b from-primary/30 to-secondary/30 blur-xl" />
                </div>
              </div>
              
              <p className="mt-8 animate-pulse font-sans text-sm tracking-[0.4em] text-primary">
                ANALYZING TOME RESONANCE...
              </p>
              
              {/* Loading bar */}
              <div className="mt-4 h-1 w-48 overflow-hidden rounded-full bg-muted">
                <div className="h-full w-1/2 animate-[pulse_1.2s_ease-in-out_infinite] rounded-full bg-gradient-to-r from-secondary via-primary to-secondary" />
              </div>
            </div>
          </section>
        )}

        {/* Results */}
        {book && stats && summoningPhase === 'complete' && (
          <section className="grid gap-6 md:grid-cols-2">
            <BookInfoCard book={book} />
            <MonsterCard book={book} stats={stats} showAnimation={showAnimation} combinedSeed={combinedSeed} />
          </section>
        )}
        {/* 読書ログセクション */}
        {isMounted && (
          <section className="mt-12">
            <h2 className="mb-6 font-sans text-xl font-bold tracking-widest text-primary">
              READING LOGS <span className="text-xs opacity-50">/ 読書記録</span>
            </h2>
            
            <div className="grid gap-4">
              {logs.length === 0 ? (
                <p className="text-sm text-muted-foreground">まだ記録がありません。魔導書を読み解きましょう。</p>
              ) : (
                logs.map((log) => (
                  <div key={log.id} className="flex items-center justify-between border-b border-border/50 pb-3">
                    <div>
                      <p className="font-medium text-foreground">{log.title}</p>
                      <p className="text-xs text-muted-foreground">ISBN: {log.isbn}</p>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {new Date(log.created_at).toLocaleDateString()}
                    </p>
                  </div>
                ))
              )}
            </div>
          </section>
        )}

        {/* Footer */}
        <footer className="mt-8 text-center">
          <OrnamentalDivider />
          <p className="font-sans text-xs tracking-[0.2em] text-muted-foreground/60">
            POWERED BY NATIONAL DIET LIBRARY API
          </p>
        </footer>
        <div>
          <p>スプーキーズ採用担当者様へ。このアプリは「LibreMon(リブレモン)」という読書管理アプリです。魔導書から魔物（リブレモン）を召喚するというコンセプトで、国立国会図書館のAPIを利用してISBNコードから書籍情報を取得し、ユーザーだけの魔物を生成することができます。リブレモンの画像生成はOpenAIのAPIを利用する予定でしたが、有料であったために断念してDiceBearのAPIを利用しています。将来的には、ユーザーが新しく読んだ書籍に応じてリブレモンが進化していき、リブレモンを通じて趣味の合うユーザー同士がコミュニケーションを取れるアプリになる予定です。データベースとしてsupabaseに接続するところまで成功し、生成されたリブレモンのデータが保存されるようになっていますが、認証機能の実装が未実装のため、保存されたデータを表示することができておりません。採用担当者様におかれましては、私のアプリ開発に対する熱意と独創性を評価していただけたら嬉しく思います。</p>
          <br />
          <p>リブレモンを召喚するためのISBNコードの例を以下に示します。</p>
          <br />
          <p>9784883377800（Android アプリ サンプルプログラム大全）</p>
          <p>9784873116303（Team Geek ―Googleのギークたちはいかにしてチームを作るのか）</p>
          <p>9784873115658（リーダブルコード ―より良いコードを書くためのシンプルで実践的なテクニック）</p>
        </div>
      </div>
    </main>
  );
}
