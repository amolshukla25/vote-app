"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { apiGet } from "@/lib/api";
import { catColor } from "@/lib/client-utils";
import type { PublicConfig, Category } from "@/lib/types";
import { runConfetti } from "../_components/confetti";

interface Art {
  number: number;
  category: Category;
}

const MEDALS = ["🥇", "🥈", "🥉"];
const PLACES = ["1st", "2nd", "3rd"];

export default function LeaderboardPage() {
  const [config, setConfig] = useState<PublicConfig | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [activeCat, setActiveCat] = useState("all");
  const [arts, setArts] = useState<Art[]>([]);
  const [qr, setQr] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const configRef = useRef<PublicConfig | null>(null);
  const winnerShown = useRef(false);

  async function load() {
    const [cfg, votes] = await Promise.all([
      apiGet<PublicConfig>("/api/config"),
      apiGet<{ counts: Record<string, number> }>("/api/votes"),
    ]);
    configRef.current = cfg;
    setConfig(cfg);
    setCounts(votes.counts);
    document.title = cfg.eventTitle + " — Live Results";

    const list: Art[] = [];
    for (const cat of cfg.categories) {
      if (cat.start == null || cat.end == null) continue;
      for (let n = cat.start; n <= cat.end; n++) {
        list.push({ number: n, category: cat });
      }
    }
    setArts(list);
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await load();
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Could not load results");
        return;
      }
      try {
        const r = await apiGet<{ dataUrl: string }>(
          "/api/qr?url=" + encodeURIComponent(window.location.origin + "/")
        );
        setQr(r.dataUrl);
      } catch {
        /* QR unavailable */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // ---------- Live refresh ----------
  useEffect(() => {
    const t = setInterval(async () => {
      try {
        if (!configRef.current) return; // initial load failed — don't clobber state
        const [votes, cfg] = await Promise.all([
          apiGet<{ counts: Record<string, number> }>("/api/votes"),
          apiGet<PublicConfig>("/api/config"),
        ]);
        setCounts(votes.counts);
        if (cfg.votingOpen !== configRef.current.votingOpen) {
          const next = { ...configRef.current!, votingOpen: cfg.votingOpen };
          configRef.current = next;
          setConfig(next);
        }
      } catch {
        /* keep last good state */
      }
    }, 2000);
    return () => clearInterval(t);
  }, []);

  const votingClosed = !!config && !config.votingOpen;
  const hasWinner = arts.some((a) => (counts[a.number] || 0) > 0);

  // Fire confetti once when a winner is revealed after voting closes.
  useEffect(() => {
    if (votingClosed && hasWinner && !winnerShown.current) {
      winnerShown.current = true;
      runConfetti();
    }
  }, [votingClosed, hasWinner]);

  if (error) {
    return (
      <div className="lb-wrap">
        <div className="empty-state">
          <span className="big">⚠️</span>
          Could not load results.
          <br />
          {error}
        </div>
      </div>
    );
  }

  const ranked = arts
    .map((a) => ({ ...a, votes: counts[a.number] || 0 }))
    .filter((a) => activeCat === "all" || a.category.id === activeCat)
    .sort((a, b) => b.votes - a.votes || a.number - b.number);

  const totalVotes = Object.values(counts).reduce((s, v) => s + v, 0);
  const maxVotes = ranked.length ? ranked[0].votes : 0;
  const top3 = ranked.slice(0, 3);

  const cats = [...new Set(arts.map((a) => a.category.id))];

  return (
    <>
      <div className="bg-decor" />
      <header className="topbar">
        <div className="brand">
          <span className="brand-dot" />
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <h1>{config?.eventTitle || "Art Showdown"}</h1>
              <span className="gameverse-tag">🎮 Gameverse Art Gallery</span>
            </div>
            <div className="brand-sub">
              Made with <span className="heart">❤️</span> by{" "}
              <a href="https://amolshukla.online" target="_blank" rel="noopener noreferrer" style={{ fontWeight: 700 }}>
                Amol Shukla
              </a>{" "}
              (<a href="https://amolshukla.online" target="_blank" rel="noopener noreferrer">
                amolshukla.online
              </a>)
            </div>
          </div>
        </div>
        <div className="topbar-actions">
          <Link className="toplink" href="/">
            Vote
          </Link>
          <span className="badge badge-live">Live</span>
          <div className={"badge " + (config?.votingOpen ? "badge-open" : "badge-closed")}>
            {config?.votingOpen ? "Voting open" : "Voting closed"}
          </div>
        </div>
      </header>

      <main className="lb-wrap">
        <div className="lb-stats">
          <div className="stat-chip">
            Total votes <b>{totalVotes}</b>
          </div>
          <div className="stat-chip">{arts.filter((a) => (counts[a.number] || 0) > 0).length} artworks with votes</div>
        </div>

        <div className="lb-hero">
          <div className="podium">
            {top3.length === 0 && (
              <div className="empty-state" style={{ gridColumn: "1/-1" }}>
                <span className="big">🗳️</span>
                No votes yet — ask the audience to scan the QR!
              </div>
            )}
            {top3.map((a, i) => {
              const pct = maxVotes ? Math.round((a.votes / maxVotes) * 100) : 0;
              return (
                <div
                  key={a.number}
                  className={"podium-card " + ["first", "second", "third"][i]}
                  style={{ animationDelay: i * 80 + "ms" }}
                >
                  {i === 0 && <span className="crown">👑</span>}
                  <div className="place">
                    {MEDALS[i]} {PLACES[i]}
                  </div>
                  <div className="p-num">#{a.number}</div>
                  <div className="p-cat">{a.category.name}</div>
                  <div className="p-votes">{a.votes} votes</div>
                  <div className="p-base">
                    <div style={{ width: pct + "%" }} />
                  </div>
                </div>
              );
            })}
          </div>

          <aside className="qr-card">
            {qr ? (
              // eslint-disable-next-line @next/next/no-img-element -- data-URL QR code
              <img src={qr} alt="QR code to vote" />
            ) : (
              <div style={{ width: 148, height: 148 }} />
            )}
            <p>
              <b>Scan to vote</b>
              <br />
              from your phone
            </p>
          </aside>
        </div>

        {votingClosed && hasWinner && (
          <div className="winner-banner">
            <h2>
              🏆 Winner: <span className="win-num">#{ranked[0].number}</span> — {ranked[0].category.name}
            </h2>
            <p>{ranked[0].votes} votes · the audience has spoken!</p>
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

        {ranked.length === 0 ? (
          <div className="empty-state">
            <span className="big">🎨</span>
            No artworks configured yet.
          </div>
        ) : (
          <div className="lb-list">
            {ranked.map((a, i) => {
              const pct = maxVotes ? Math.max((a.votes / maxVotes) * 100, 2) : 0;
              const color = catColor(a.category.id);
              return (
                <div key={a.number} className={"lb-row" + (i < 3 ? " top" : "")}>
                  <span className="lb-rank">{i + 1}</span>
                  <span className="lb-num">#{a.number}</span>
                  <span className="lb-cat">{a.category.name}</span>
                  <div className="lb-bar">
                    <div
                      className="lb-fill"
                      style={{
                        width: pct + "%",
                        background: "linear-gradient(90deg," + color + ",var(--accent-2))",
                      }}
                    />
                  </div>
                  <span className="lb-count">{a.votes}</span>
                </div>
              );
            })}
          </div>
        )}
      </main>

      <footer className="app-footer">
        <div className="footer-brand">🎮 Gameverse Art Gallery</div>
        <div className="credit">
          Made with <span className="heart">❤️</span> by{" "}
          <a href="https://amolshukla.online" target="_blank" rel="noopener noreferrer" style={{ fontWeight: 700 }}>
            Amol Shukla
          </a>
        </div>
        <div style={{ fontSize: 12.5, marginTop: 2 }}>
          🌐{" "}
          <a href="https://amolshukla.online" target="_blank" rel="noopener noreferrer">
            amolshukla.online
          </a>
        </div>
      </footer>
    </>
  );
}
