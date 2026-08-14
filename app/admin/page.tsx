"use client";

import { useCallback, useEffect, useState } from "react";
import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/api";
import type { AdminState, Category, VoterTicket } from "@/lib/types";
import { useToast } from "../_components/toast";

const PIN_KEY = "artAdminPin";

interface EditableCat {
  key: string;
  id: string;
  name: string;
  start: string;
  end: string;
}

function toEditable(cats: Category[]): EditableCat[] {
  return cats.map((c) => ({
    key: c.id + "-" + Math.random().toString(36).slice(2, 7),
    id: c.id,
    name: c.name,
    start: c.start == null ? "" : String(c.start),
    end: c.end == null ? "" : String(c.end),
  }));
}

export default function AdminPage() {
  const [pin, setPin] = useState("");
  const [savedPin, setSavedPin] = useState<string>(() =>
    typeof window !== "undefined" ? localStorage.getItem(PIN_KEY) || "" : ""
  );
  const [unlocked, setUnlocked] = useState(false);
  const [state, setState] = useState<AdminState | null>(null);
  const [cats, setCats] = useState<EditableCat[]>([]);
  const [tickets, setTickets] = useState<VoterTicket[] | null>(null);
  const [pinErr, setPinErr] = useState("");
  const [qrCount, setQrCount] = useState(10);
  const [busy, setBusy] = useState(false);
  const [artNumInput, setArtNumInput] = useState("");
  const [voteDeltaInput, setVoteDeltaInput] = useState("1");
  const [artSearch, setArtSearch] = useState("");
  const [ticketSearch, setTicketSearch] = useState("");
  const { show, el: toastEl } = useToast();

  const headers = useCallback(() => ({ "X-Admin-Pin": savedPin }), [savedPin]);

  const refreshState = useCallback(async () => {
    const s = await apiGet<AdminState>("/api/admin/state", headers());
    setState(s);
    setCats(toEditable(s.categories));
    document.title = "Admin — " + s.eventTitle;
  }, [headers]);

  async function adjustVotes(artNumber: number, count: number, action: "add" | "remove" | "clear" = "add") {
    try {
      if (action === "clear" && !confirm(`Clear ALL votes for Candidate #${artNumber}?`)) return;
      setBusy(true);
      const res = await apiPost<{ success: boolean; artNumber: number; artVotes: number }>(
        "/api/admin/votes",
        { artNumber, count, action },
        headers()
      );
      if (res.success) {
        const msg =
          action === "clear"
            ? `Cleared all votes for Candidate #${artNumber} ✓`
            : `${action === "add" ? "Added +" : "Removed -"}${count} vote${count > 1 ? "s" : ""} for Candidate #${artNumber} (Total: ${res.artVotes}) ✓`;
        show(msg, "success");
        await refreshState();
      }
    } catch (err) {
      show(err instanceof Error ? err.message : "Failed to update candidate votes", "error");
    } finally {
      setBusy(false);
    }
  }

  async function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    const num = parseInt(artNumInput, 10);
    const count = parseInt(voteDeltaInput, 10) || 1;
    if (isNaN(num) || num <= 0) {
      show("Please enter a valid candidate/artwork number", "error");
      return;
    }
    await adjustVotes(num, count, "add");
    setArtNumInput("");
  }

  const loadTickets = useCallback(async () => {
    const r = await apiGet<{ voters: VoterTicket[] }>("/api/admin/voters", headers());
    setTickets(r.voters);
  }, [headers]);

  // ---------- Boot: auto-unlock if a saved PIN still works ----------
  useEffect(() => {
    if (!savedPin) return;
    apiGet<AdminState>("/api/admin/state", headers())
      .then(async (s) => {
        setUnlocked(true);
        setState(s);
        setCats(toEditable(s.categories));
        document.title = "Admin — " + s.eventTitle;
      })
      .catch(() => {
        localStorage.removeItem(PIN_KEY);
        setSavedPin("");
      });
  }, [savedPin, headers]);

  async function tryLogin() {
    setPinErr("");
    if (!pin.trim()) return;
    try {
      await apiGet<AdminState>("/api/admin/state", { "X-Admin-Pin": pin.trim() });
      localStorage.setItem(PIN_KEY, pin.trim());
      setSavedPin(pin.trim());
      setPin("");
      setUnlocked(true);
      await refreshState();
    } catch {
      setPinErr("Wrong PIN. Try again.");
    }
  }

  // ---------- Settings ----------
  async function saveSettings() {
    if (!state) return;
    const newPinInput = (document.getElementById("adminPinInput") as HTMLInputElement)?.value.trim();
    const body: Record<string, unknown> = {
      eventTitle: (document.getElementById("eventTitleInput") as HTMLInputElement).value,
      votingOpen: (document.getElementById("votingOpenToggle") as HTMLInputElement).checked,
      votesPerVoter: parseInt((document.getElementById("votesPerVoter") as HTMLInputElement).value, 10) || 1,
    };
    if (newPinInput) body.adminPin = newPinInput;

    await apiPost("/api/admin/config", body, headers());
    if (newPinInput) {
      localStorage.setItem(PIN_KEY, newPinInput);
      setSavedPin(newPinInput);
    }
    if (document.getElementById("adminPinInput")) {
      (document.getElementById("adminPinInput") as HTMLInputElement).value = "";
    }
    await refreshState();
    show("Settings saved ✓", "success");
  }

  // ---------- Categories ----------
  function updateCat(key: string, field: keyof EditableCat, value: string) {
    setCats((prev) => prev.map((c) => (c.key === key ? { ...c, [field]: value } : c)));
  }

  function addCategory() {
    setCats((prev) => [
      ...prev,
      { key: "new-" + Math.random().toString(36).slice(2, 8), id: "new", name: "New Category", start: "", end: "" },
    ]);
  }

  async function saveCategories() {
    const normalized = cats.map((c, i) => ({
      id:
        c.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-") || "category-" + (i + 1),
      name: c.name.trim() || "Category " + (i + 1),
      start: c.start === "" ? null : parseInt(c.start, 10),
      end: c.end === "" ? null : parseInt(c.end, 10),
    }));
    await apiPost("/api/admin/config", { categories: normalized }, headers());
    await refreshState();
    show("Categories saved ✓", "success");
  }

  // ---------- QR tickets ----------
  async function generateQr() {
    setBusy(true);
    try {
      const r = await apiPost<{ created: VoterTicket[] }>(
        "/api/admin/voters",
        { count: qrCount },
        headers()
      );
      show(r.created.length + " QR ticket" + (r.created.length > 1 ? "s" : "") + " generated ✓", "success");
      await loadTickets();
    } finally {
      setBusy(false);
    }
  }

  async function removeTicket(token: string) {
    await apiDelete("/api/admin/voter/" + encodeURIComponent(token), headers());
    await loadTickets();
    await refreshState();
  }

  async function toggleBlockVoter(token: string, currentBlocked: boolean) {
    try {
      setBusy(true);
      await apiPatch(`/api/admin/voter/${encodeURIComponent(token)}`, { blocked: !currentBlocked }, headers());
      show(`Voter ticket ${!currentBlocked ? "blocked 🚫" : "unblocked 🟢"}`, !currentBlocked ? "error" : "success");
      await loadTickets();
    } catch (err) {
      show(err instanceof Error ? err.message : "Failed to update voter block status", "error");
    } finally {
      setBusy(false);
    }
  }

  async function toggleBlockCandidate(artNumber: number, currentBlocked: boolean) {
    if (!state) return;
    try {
      setBusy(true);
      const currentBlockedList = state.blockedArtworks || [];
      const updatedBlockedList = currentBlocked
        ? currentBlockedList.filter((n) => n !== artNumber)
        : [...currentBlockedList, artNumber];
      await apiPost("/api/admin/config", { blockedArtworks: updatedBlockedList }, headers());
      show(
        `Candidate #${artNumber} ${!currentBlocked ? "blocked 🚫" : "unblocked 🟢"}`,
        !currentBlocked ? "error" : "success"
      );
      await refreshState();
    } catch (err) {
      show(err instanceof Error ? err.message : "Failed to update candidate block status", "error");
    } finally {
      setBusy(false);
    }
  }

  function printAll() {
    document.body.classList.add("printing");
    setTimeout(() => {
      window.print();
      setTimeout(() => document.body.classList.remove("printing"), 300);
    }, 120);
  }

  // ---------- Danger zone ----------
  async function resetVotes() {
    if (!confirm("Reset ALL votes? This cannot be undone.")) return;
    await apiPost("/api/admin/reset", { type: "votes" }, headers());
    await refreshState();
    await loadTickets();
    show("All votes cleared ✓", "success");
  }

  async function resetAll() {
    if (!confirm("Wipe votes AND all voter tickets? This cannot be undone.")) return;
    await apiPost("/api/admin/reset", { type: "all" }, headers());
    setTickets(null);
    await refreshState();
    show("Everything reset ✓", "success");
  }

  function logout() {
    localStorage.removeItem(PIN_KEY);
    window.location.reload();
  }

  // ---------- PIN gate ----------
  if (!unlocked) {
    return (
      <>
        <div className="bg-decor" />
        <div className="gate">
          <div className="gate-card">
            <div style={{ fontSize: 38, marginBottom: 8 }}>🔐</div>
            <h2>Admin Login</h2>
            <p>Enter the admin PIN to manage the art show.</p>
            <input
              id="pinInput"
              type="password"
              placeholder="Admin PIN"
              autoComplete="off"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && tryLogin()}
              style={{ marginBottom: 12 }}
            />
            <div style={{ color: "var(--danger)", fontSize: 13, minHeight: 18, marginBottom: 6 }}>{pinErr}</div>
            <button className="btn primary" style={{ width: "100%" }} onClick={tryLogin}>
              Unlock
            </button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="bg-decor" />
      <header className="topbar">
        <div className="brand">
          <span className="brand-dot" />
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <h1>{state?.eventTitle || "Admin Panel"}</h1>
              <span className="gameverse-tag">🎮 Gameverse Art Gallery</span>
            </div>
            <div className="brand-sub">
              Made with <span className="heart">❤️</span> by{" "}
              <a href="https://amolshukla.online" target="_blank" rel="noopener noreferrer" style={{ fontWeight: 700 }}>
                amolshukla.online
              </a>
            </div>
          </div>
        </div>
        <button className="btn small" onClick={logout}>
          Log out
        </button>
      </header>

      <div className="admin-wrap">
        {/* Stats */}
        <div className="admin-stats">
          <div className="stat-card">
            <div className="s-label">Total votes</div>
            <div className="s-value">{state?.totalVotes ?? 0}</div>
            <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 2 }}>
              {state?.totalPublicVotes ?? 0} audience · {state?.totalAdminVotes ?? 0} admin
            </div>
          </div>
          <div className="stat-card">
            <div className="s-label">Leader</div>
            <div className="s-value" style={{ fontSize: 20, lineHeight: 1.3 }}>
              {state?.winner ? (
                <>
                  #{state.winner.number}{" "}
                  <span style={{ fontSize: 12.5, color: "var(--text-dim)" }}>({state.winner.category.name})</span>
                </>
              ) : (
                "—"
              )}
            </div>
          </div>
          <div className="stat-card">
            <div className="s-label">Voters</div>
            <div className="s-value">{state?.voterCount ?? 0}</div>
          </div>
          <div className="stat-card">
            <div className="s-label">Artworks</div>
            <div className="s-value">{state?.artCount ?? 0}</div>
          </div>
        </div>

        {/* Candidate Vote Management */}
        <div className="panel">
          <h3>🗳️ Candidate Vote Management</h3>
          <div className="panel-sub">
            Manually increase or adjust votes for any candidate / artwork. Changes update the leaderboard in real time.
          </div>

          <form onSubmit={handleManualSubmit} className="actions" style={{ marginBottom: 20 }}>
            <div className="field" style={{ maxWidth: 160, margin: 0 }}>
              <label>Candidate #</label>
              <input
                type="number"
                min={1}
                placeholder="e.g. 5"
                value={artNumInput}
                onChange={(e) => setArtNumInput(e.target.value)}
              />
            </div>
            <div className="field" style={{ maxWidth: 140, margin: 0 }}>
              <label>Votes to add</label>
              <input
                type="number"
                min={1}
                max={500}
                value={voteDeltaInput}
                onChange={(e) => setVoteDeltaInput(e.target.value)}
              />
            </div>
            <button type="submit" className="btn primary" style={{ alignSelf: "end" }} disabled={busy}>
              + Add Votes
            </button>
          </form>

          {state?.artworks && state.artworks.length > 0 && (
            <>
              <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 14, flexWrap: "wrap" }}>
                <input
                  type="text"
                  placeholder="🔍 Search candidate # or category..."
                  value={artSearch}
                  onChange={(e) => setArtSearch(e.target.value)}
                  style={{ maxWidth: 280, fontSize: 13.5 }}
                />
                <span style={{ fontSize: 12.5, color: "var(--text-dim)" }}>
                  Showing {
                    state.artworks.filter((a) =>
                      !artSearch.trim() ||
                      String(a.number).includes(artSearch.trim()) ||
                      a.category.name.toLowerCase().includes(artSearch.trim().toLowerCase())
                    ).length
                  } of {state.artworks.length} candidates
                </span>
              </div>

              <div style={{ maxHeight: 380, overflowY: "auto", borderRadius: 8, border: "1px solid var(--card-border)" }}>
                <table className="cat-table" style={{ margin: 0 }}>
                  <thead>
                    <tr>
                      <th style={{ width: 110 }}>Candidate #</th>
                      <th>Category</th>
                      <th style={{ width: 150 }}>
                        Current Votes
                        <div style={{ fontSize: 11, fontWeight: 500, color: "var(--text-dim)" }}>public · admin</div>
                      </th>
                      <th style={{ width: 140 }}>Voting Control</th>
                      <th style={{ textAlign: "right", paddingRight: 16 }}>Quick Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {state.artworks
                      .filter((a) =>
                        !artSearch.trim() ||
                        String(a.number).includes(artSearch.trim()) ||
                        a.category.name.toLowerCase().includes(artSearch.trim().toLowerCase())
                      )
                      .map((art) => (
                        <tr key={art.number}>
                          <td style={{ fontWeight: 700, fontSize: 15 }}>#{art.number}</td>
                          <td>
                            <span className="legend-range" style={{ textTransform: "uppercase" }}>
                              {art.category.name}
                            </span>
                          </td>
                          <td>
                            <span
                              style={{
                                display: "inline-block",
                                padding: "3px 10px",
                                borderRadius: 999,
                                fontWeight: 700,
                                fontSize: 13,
                                background: art.votes > 0 ? "rgba(139, 92, 246, 0.2)" : "rgba(255,255,255,0.06)",
                                color: art.votes > 0 ? "#c084fc" : "var(--text-dim)",
                                border: art.votes > 0 ? "1px solid rgba(192, 132, 252, 0.3)" : "none",
                              }}
                            >
                              {art.votes} {art.votes === 1 ? "vote" : "votes"}
                            </span>
                            <div style={{ fontSize: 11.5, color: "var(--text-dim)", marginTop: 4 }}>
                              {art.publicVotes} public · {art.adminVotes} admin
                            </div>
                          </td>
                          <td>
                            <button
                              type="button"
                              className="btn small"
                              disabled={busy}
                              onClick={() => toggleBlockCandidate(art.number, !!art.blocked)}
                              title={
                                art.blocked
                                  ? "Unblock candidate to allow further votes"
                                  : "Block candidate from receiving further votes"
                              }
                              style={
                                art.blocked
                                  ? {
                                      background: "rgba(34,197,94,0.2)",
                                      borderColor: "rgba(34,197,94,0.5)",
                                      color: "#4ade80",
                                      fontWeight: 700,
                                    }
                                  : {
                                      background: "rgba(239,68,68,0.15)",
                                      borderColor: "rgba(239,68,68,0.4)",
                                      color: "#ef4444",
                                      fontWeight: 700,
                                    }
                              }
                            >
                              {art.blocked ? "🟢 Unblock" : "🚫 Block Art"}
                            </button>
                          </td>
                          <td style={{ textAlign: "right", paddingRight: 12 }}>
                            <div style={{ display: "inline-flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
                              <button
                                type="button"
                                className="btn small primary"
                                disabled={busy}
                                onClick={() => adjustVotes(art.number, 1, "add")}
                                title="Add 1 vote"
                              >
                                +1
                              </button>
                              <button
                                type="button"
                                className="btn small primary"
                                disabled={busy}
                                onClick={() => adjustVotes(art.number, 5, "add")}
                                title="Add 5 votes"
                              >
                                +5
                              </button>
                              <button
                                type="button"
                                className="btn small primary"
                                disabled={busy}
                                onClick={() => adjustVotes(art.number, 10, "add")}
                                title="Add 10 votes"
                              >
                                +10
                              </button>
                              {art.votes > 0 && (
                                <>
                                  <button
                                    type="button"
                                    className="btn small"
                                    disabled={busy}
                                    onClick={() => adjustVotes(art.number, 1, "remove")}
                                    title="Remove 1 vote"
                                    style={{ color: "var(--danger)", borderColor: "rgba(248,113,113,0.3)" }}
                                  >
                                    -1
                                  </button>
                                  <button
                                    type="button"
                                    className="btn small danger"
                                    disabled={busy}
                                    onClick={() => adjustVotes(art.number, 0, "clear")}
                                    title="Clear all votes for this candidate"
                                  >
                                    🗑️ Clear
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {/* Settings */}
        <div className="panel">
          <h3>⚙️ Event settings</h3>
          <div className="panel-sub">How the game behaves for voters.</div>
          <div className="field-row">
            <div className="field">
              <label>Event title</label>
              <input type="text" id="eventTitleInput" defaultValue={state?.eventTitle} placeholder="Art Showdown 2026" />
            </div>
            <div className="field">
              <label>Votes per voter</label>
              <input type="number" id="votesPerVoter" min={1} max={50} defaultValue={state?.votesPerVoter ?? 1} />
            </div>
          </div>
          <div className="switch-row">
            <label className="switch">
              <input type="checkbox" id="votingOpenToggle" defaultChecked={state?.votingOpen} />
              <span className="track" />
            </label>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>Voting open</div>
              <div style={{ fontSize: 12.5, color: "var(--text-dim)" }}>
                Turn off to lock votes and reveal the winner
              </div>
            </div>
          </div>
          <div className="field" style={{ maxWidth: 280 }}>
            <label>Change admin PIN (optional)</label>
            <input type="text" id="adminPinInput" placeholder="Leave blank to keep current PIN" />
          </div>
          <div className="actions">
            <button className="btn primary" onClick={saveSettings}>
              Save settings
            </button>
          </div>
        </div>

        {/* Categories */}
        <div className="panel">
          <h3>🗂️ Categories &amp; number ranges</h3>
          <div className="panel-sub">
            Edit the name and range of each category, then save. Ranges are inclusive — e.g. 2D from 53 to 78 covers
            artworks #53–#78. To disable a category, leave its range empty.
          </div>
          <table className="cat-table">
            <thead>
              <tr>
                <th>Category</th>
                <th>From #</th>
                <th>To #</th>
                <th>Artworks</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {cats.map((c) => {
                const n = c.start && c.end ? parseInt(c.end, 10) - parseInt(c.start, 10) + 1 : null;
                return (
                  <tr key={c.key}>
                    <td>
                      <input
                        className="cat-name"
                        value={c.name}
                        placeholder="Category name"
                        onChange={(e) => updateCat(c.key, "name", e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        className="num-input cat-start"
                        type="number"
                        value={c.start}
                        placeholder="—"
                        onChange={(e) => updateCat(c.key, "start", e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        className="num-input cat-end"
                        type="number"
                        value={c.end}
                        placeholder="—"
                        onChange={(e) => updateCat(c.key, "end", e.target.value)}
                      />
                    </td>
                    <td className="art-count">
                      {n !== null && n > 0 ? (
                        n + " artworks"
                      ) : (
                        <span className="cat-empty">{c.start || c.end ? "fill both" : "no range yet"}</span>
                      )}
                    </td>
                    <td>
                      <button
                        className="cat-remove"
                        title="Remove category"
                        onClick={() => setCats((prev) => prev.filter((x) => x.key !== c.key))}
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="actions">
            <button className="btn" onClick={addCategory}>
              + Add category
            </button>
            <button className="btn primary" onClick={saveCategories}>
              Save categories
            </button>
          </div>
        </div>

        {/* QR tickets */}
        <div className="panel">
          <h3>🪪 Voter QR tickets</h3>
          <div className="panel-sub">
            Generate printable QR tickets — one per voter. Each scan opens the voting page locked to that voter, so
            nobody can vote twice. Print them, cut them out, and hand one to each guest. (You can also just show the
            big QR on the leaderboard screen.)
          </div>
          <div className="actions">
            <div className="field" style={{ maxWidth: 130, margin: 0 }}>
              <label>How many?</label>
              <input type="number" min={1} max={500} value={qrCount} onChange={(e) => setQrCount(parseInt(e.target.value, 10) || 1)} />
            </div>
            <button className="btn primary" style={{ alignSelf: "end" }} disabled={busy} onClick={generateQr}>
              Generate tickets
            </button>
            <button className="btn" style={{ alignSelf: "end" }} onClick={printAll}>
              🖨️ Print all
            </button>
            <button
              className="btn"
              style={{ alignSelf: "end" }}
              onClick={async () => {
                await loadTickets();
              }}
            >
              ↻ Refresh list
            </button>
          </div>
          {tickets !== null && tickets.length > 0 && (
            <div style={{ marginTop: 14, marginBottom: 14 }}>
              <input
                type="text"
                placeholder="🔍 Search voter ticket # or token to remove..."
                value={ticketSearch}
                onChange={(e) => setTicketSearch(e.target.value)}
                style={{ maxWidth: 300, fontSize: 13.5 }}
              />
            </div>
          )}
          <div className="qr-list" id="qrList">
            {tickets === null ? (
              <div className="empty-state" style={{ gridColumn: "1/-1", padding: 30 }}>
                <span className="big">🪪</span>
                No tickets loaded — generate some above.
              </div>
            ) : tickets.length === 0 ? (
              <div className="empty-state" style={{ gridColumn: "1/-1", padding: 30 }}>
                <span className="big">🪪</span>
                No voter tickets yet — generate some above.
              </div>
            ) : (
              [...tickets.filter((t) => t.voteCount === 0), ...tickets.filter((t) => t.voteCount > 0)]
                .filter(
                  (t) =>
                    !ticketSearch.trim() ||
                    t.short.toLowerCase().includes(ticketSearch.trim().toLowerCase()) ||
                    t.token.toLowerCase().includes(ticketSearch.trim().toLowerCase()) ||
                    t.votes.some((v) => String(v).includes(ticketSearch.trim()))
                )
                .map((v) => (
                  <div key={v.token} className={"qr-ticket" + (v.voteCount > 0 ? " voted" : "") + (v.blocked ? " blocked" : "")}>
                    <div className="t-label">Art Showdown · Vote</div>
                    <div className="t-token">#{v.short}</div>
                    {v.qr ? (
                      // eslint-disable-next-line @next/next/no-img-element -- data-URL QR ticket
                      <img src={v.qr} alt="QR" />
                    ) : (
                      <div className="t-qr">⚠️ QR failed</div>
                    )}
                    <div className="t-meta">
                      {v.voteCount > 0 ? "Voted: #" + v.votes.join(", #") : "Not voted yet"}
                    </div>
                    {v.blocked ? (
                      <div style={{ color: "#ef4444", fontWeight: 700, fontSize: 12, margin: "4px 0" }}>
                        ⛔ BLOCKED FROM VOTING
                      </div>
                    ) : (
                      <div className="t-qr">🔒 scan to vote</div>
                    )}
                    <div style={{ display: "flex", gap: 6, marginTop: 6, width: "100%", justifyContent: "center" }}>
                      <button
                        className="btn small"
                        disabled={busy}
                        style={
                          v.blocked
                            ? { background: "rgba(34,197,94,0.2)", borderColor: "rgba(34,197,94,0.5)", color: "#4ade80", fontWeight: 700, flex: 1 }
                            : { color: "var(--danger)", borderColor: "rgba(248,113,113,0.4)", flex: 1 }
                        }
                        onClick={() => toggleBlockVoter(v.token, !!v.blocked)}
                        title={v.blocked ? "Unblock voter" : "Block voter from casting or updating further votes"}
                      >
                        {v.blocked ? "🟢 Unblock" : "🚫 Block"}
                      </button>
                      <button
                        className="btn small danger"
                        disabled={busy}
                        style={{ flex: 1 }}
                        onClick={() => {
                          if (confirm(`Remove voter ticket #${v.short}? This will also delete their votes.`)) {
                            removeTicket(v.token);
                          }
                        }}
                        title="Remove this voter ticket and revoke their votes"
                      >
                        🗑️ Remove
                      </button>
                    </div>
                  </div>
                ))
            )}
          </div>
        </div>

        {/* Danger zone */}
        <div className="panel" style={{ borderColor: "rgba(248,113,113,0.3)" }}>
          <h3>⚠️ Danger zone</h3>
          <div className="panel-sub">These actions affect every voter — use with care.</div>
          <div className="actions">
            <button className="btn danger" onClick={resetVotes}>
              Reset all votes
            </button>
            <button className="btn danger" onClick={resetAll}>
              Wipe votes + voter tickets
            </button>
          </div>
        </div>
      </div>

      <footer className="app-footer">
        <div className="footer-brand">🎮 Gameverse Art Gallery</div>
        <div className="credit">
          Made with <span className="heart">❤️</span> by{" "}
          <a href="https://amolshukla.online" target="_blank" rel="noopener noreferrer" style={{ fontWeight: 700 }}>
            amolshukla.online
          </a>
        </div>
      </footer>

      {toastEl}
    </>
  );
}
