"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { apiGet, apiPost, ApiError } from "@/lib/api";
import { catColor, shortToken } from "@/lib/client-utils";
import type { PublicConfig, Category } from "@/lib/types";
import { useToast } from "./_components/toast";

interface Art {
  number: number;
  category: Category;
  img: string | null;
}

const TOKEN_KEY = "artVoterToken";

export default function VotePage() {
  const [config, setConfig] = useState<PublicConfig | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [myVotes, setMyVotes] = useState<number[]>([]);
  const [activeCat, setActiveCat] = useState("all");
  const [arts, setArts] = useState<Art[]>([]);
  const [hint, setHint] = useState<React.ReactNode>("Loading…");
  const [error, setError] = useState<string | null>(null);

  const tokenRef = useRef<string | null>(null);
  const configRef = useRef<PublicConfig | null>(null);
  const { show, el: toastEl } = useToast();

  // ---------- Voter identity (QR check-in) ----------
  const ensureVoter = useCallback(async () => {
    const fromUrl = new URLSearchParams(window.location.search).get("t");
    let token = fromUrl || localStorage.getItem(TOKEN_KEY);

    if (token) {
      try {
        const me = await apiGet<{ votes: number[] }>("/api/me?token=" + encodeURIComponent(token));
        tokenRef.current = token;
        setMyVotes(me.votes || []);
        setHint(
          <>You are voting as <b>{shortToken(token)}</b>. Tap an artwork to vote — tap again to change it.</>
        );
        return;
      } catch {
        /* token unknown — fall through and register a fresh one */
      }
    }

    const r = await apiPost<{ token: string }>("/api/voter", {});
    token = r.token;
    localStorage.setItem(TOKEN_KEY, token);
    tokenRef.current = token;
    setMyVotes([]);
    setHint(
      <>You are voting as <b>{shortToken(token)}</b>. Tap an artwork to vote — tap again to change it.</>
    );
  }, []);

  // ---------- Load data ----------
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await ensureVoter();
        const [cfg, votes] = await Promise.all([
          apiGet<PublicConfig>("/api/config"),
          apiGet<{ counts: Record<string, number> }>("/api/votes"),
        ]);
        if (cancelled) return;
        setConfig(cfg);
        configRef.current = cfg;
        setCounts(votes.counts);
        document.title = "Vote — " + cfg.eventTitle;

        const list: Art[] = [];
        for (const cat of cfg.categories) {
          if (cat.start == null || cat.end == null) continue;
          for (let n = cat.start; n <= cat.end; n++) {
            list.push({ number: n, category: cat, img: cfg.artImages[String(n)] || null });
          }
        }
        setArts(list);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Could not load the voting app");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ensureVoter]);

  // ---------- Voting ----------
  async function vote(num: number) {
    const cfg = configRef.current;
    if (!cfg || !cfg.votingOpen) {
      show("Voting is closed — check the leaderboard!", "error");
      return;
    }

    try {
      const r = await apiPost<{
        voted: boolean;
        myVotes: number[];
        counts: Record<string, number>;
        votingOpen?: boolean;
      }>("/api/vote", { token: tokenRef.current, artNumber: num });

      setMyVotes(r.myVotes);
      setCounts(r.counts);
      if (r.votingOpen !== undefined) {
        setConfig((prev) => (prev ? { ...prev, votingOpen: r.votingOpen! } : prev));
      }
      show(r.voted ? "Vote cast for #" + num + " 🎉" : "Vote removed from #" + num, r.voted ? "success" : "");
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        // Token became invalid (e.g. admin reset) — re-register this device.
        localStorage.removeItem(TOKEN_KEY);
        try {
          await ensureVoter();
        } catch {
          show("Could not re-register. Refresh the page.", "error");
          return;
        }
        return vote(num);
      }
      show(e instanceof Error ? e.message : "Vote failed", "error");
      if (e instanceof ApiError && e.status === 409) shakeVoted();
    }
  }

  function shakeVoted() {
    document.querySelectorAll(".art-card.voted").forEach((c) => {
      c.animate(
        [
          { transform: "translateX(0)" },
          { transform: "translateX(-5px)" },
          { transform: "translateX(5px)" },
          { transform: "translateX(0)" },
        ],
        { duration: 300 }
      );
    });
  }

  // ---------- Live refresh ----------
  useEffect(() => {
    const t = setInterval(async () => {
      try {
        const data = await apiGet<{ counts: Record<string, number> }>("/api/votes");
        setCounts(data.counts);
      } catch {
        /* ignore */
      }
    }, 3000);
    return () => clearInterval(t);
  }, []);

  if (error) {
    return (
      <div className="wrap">
        <div className="empty-state">
          <span className="big">⚠️</span>
          Could not load the voting app.
          <br />
          {error}
        </div>
      </div>
    );
  }

  const cats = [...new Set(arts.map((a) => a.category.id))];

  return (
    <>
      <div className="bg-decor" />
      <header className="topbar">
        <div className="brand">
          <span className="brand-dot" />
          <h1>{config?.eventTitle || "Art Showdown"}</h1>
        </div>
        <div className="topbar-actions">
          <Link className="toplink" href="/leaderboard">
            Leaderboard
          </Link>
          <div className={"badge " + (config?.votingOpen ? "badge-open" : "badge-closed")}>
            {config?.votingOpen ? "Voting open" : "Voting closed"}
          </div>
        </div>
      </header>

      <main className="wrap">
        <div className="voter-hint">{hint}</div>

        {config && (
          <div className="cat-legend">
            {config.categories
              .filter((c) => c.start != null && c.end != null)
              .map((cat) => (
                <div
                  key={cat.id}
                  className="legend-chip"
                  style={{ ["--lc" as string]: catColor(cat.id) } as React.CSSProperties}
                >
                  <span className="legend-dot" />
                  <span className="legend-name">{cat.name}</span>
                  <span className="legend-range">
                    #{cat.start} – #{cat.end}
                  </span>
                </div>
              ))}
          </div>
        )}

        <div className="tabs">
          <button
            className={"tab" + (activeCat === "all" ? " active" : "")}
            onClick={() => setActiveCat("all")}
          >
            All <span className="tab-count">{arts.length}</span>
          </button>
          {cats.map((id) => {
            const cat = arts.find((a) => a.category.id === id)!.category;
            const n = arts.filter((a) => a.category.id === id).length;
            return (
              <button
                key={id}
                className={"tab" + (activeCat === id ? " active" : "")}
                onClick={() => setActiveCat(id)}
              >
                {cat.name} <span className="tab-count">{n}</span>
              </button>
            );
          })}
        </div>

        {arts.length === 0 ? (
          <div className="empty-state">
            <span className="big">🎨</span>
            No artworks here yet.
            <br />
            Add a number range in the admin panel.
          </div>
        ) : (
          <div className="grid">
            {arts
              .filter((a) => activeCat === "all" || a.category.id === activeCat)
              .map((art, i) => {
                const voted = myVotes.includes(art.number);
                const color = catColor(art.category.id);
                return (
                  <button
                    key={art.number}
                    className={"art-card" + (voted ? " voted" : "")}
                    style={
                      {
                        animationDelay: Math.min(i * 14, 400) + "ms",
                        ["--cat" as string]: color,
                      } as React.CSSProperties
                    }
                    onClick={() => vote(art.number)}
                  >
                    {art.img ? (
                      <div className="art-media">
                        {" "}
                        {/* eslint-disable-next-line @next/next/no-img-element -- dynamic /art/* files added by the organizer */}
                        <img src={art.img} alt={"Artwork " + art.number} loading="lazy" />
                      </div>
                    ) : (
                      <div className="art-media">
                        <div className="art-num">{art.number}</div>
                      </div>
                    )}
                    <div className="art-check">✓</div>
                    <div className="art-meta">
                      <span className="art-cat">{art.category.name}</span>
                      <span className="art-votes">
                        <b>{counts[art.number] || 0}</b> votes
                      </span>
                    </div>
                  </button>
                );
              })}
          </div>
        )}
      </main>

      {toastEl}
    </>
  );
}
