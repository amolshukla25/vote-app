(function () {
  let config = null;
  let counts = {};
  let arts = [];
  let activeCat = 'all';
  let hasWinnerShown = false;

  const podiumEl = document.getElementById('podium');
  const listEl = document.getElementById('lbList');
  const tabsEl = document.getElementById('lbTabs');
  const statusEl = document.getElementById('statusBadge');
  const titleEl = document.getElementById('eventTitle');
  const totalEl = document.getElementById('totalVotes');
  const votersEl = document.getElementById('voterCount');
  const winnerEl = document.getElementById('winnerBanner');
  const qrImg = document.getElementById('qrImg');

  async function load() {
    config = await api.get('/api/config');
    counts = (await api.get('/api/votes')).counts;

    titleEl.textContent = config.eventTitle;
    document.title = config.eventTitle + ' — Live Results';
    statusEl.textContent = config.votingOpen ? 'Voting open' : 'Voting closed';
    statusEl.className = 'badge ' + (config.votingOpen ? 'badge-open' : 'badge-closed');

    arts = [];
    for (const cat of config.categories) {
      if (cat.start == null || cat.end == null) continue;
      for (let n = cat.start; n <= cat.end; n++) {
        arts.push({ number: n, category: cat });
      }
    }

    renderTabs();
    render();
  }

  function renderTabs() {
    tabsEl.innerHTML = '';
    const cats = [...new Set(arts.map((a) => a.category.id))];
    const mk = (id, label, count) => {
      const b = document.createElement('button');
      b.className = 'tab' + (id === activeCat ? ' active' : '');
      b.innerHTML = esc(label) + ' <span class="tab-count">' + count + '</span>';
      b.onclick = () => {
        activeCat = id;
        document.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
        b.classList.add('active');
        render();
      };
      tabsEl.appendChild(b);
    };
    mk('all', 'All', arts.length);
    for (const id of cats) {
      const cat = arts.find((a) => a.category.id === id).category;
      mk(id, cat.name, arts.filter((a) => a.category.id === id).length);
    }
  }

  function ranked() {
    return arts
      .map((a) => ({ ...a, votes: counts[a.number] || 0 }))
      .filter((a) => activeCat === 'all' || a.category.id === activeCat)
      .sort((a, b) => b.votes - a.votes || a.number - b.number);
  }

  function render() {
    const list = ranked();
    const total = list.reduce((s, a) => s + a.votes, 0);
    const maxVotes = list.length ? list[0].votes : 0;

    totalEl.textContent = Object.values(counts).reduce((s, v) => s + v, 0);
    votersEl.textContent = list.filter((a) => a.votes > 0).length + ' artworks with votes';

    // ---------- Podium (top 3) ----------
    const top3 = list.slice(0, 3);
    const medals = ['🥇', '🥈', '🥉'];
    podiumEl.innerHTML = '';
    top3.forEach((a, i) => {
      const card = document.createElement('div');
      card.className = 'podium-card ' + ['first', 'second', 'third'][i];
      const pct = maxVotes ? Math.round((a.votes / maxVotes) * 100) : 0;
      card.innerHTML =
        (i === 0 ? '<span class="crown">👑</span>' : '') +
        '<div class="place">' + medals[i] + ' ' + ['1st', '2nd', '3rd'][i] + '</div>' +
        '<div class="p-num">#' + a.number + '</div>' +
        '<div class="p-cat">' + esc(a.category.name) + '</div>' +
        '<div class="p-votes">' + a.votes + ' votes</div>' +
        '<div class="p-base"><div style="width:' + pct + '%"></div></div>';
      podiumEl.appendChild(card);
    });
    if (top3.length === 0) {
      podiumEl.innerHTML = '<div class="empty-state" style="grid-column:1/-1"><span class="big">🗳️</span>No votes yet — ask the audience to scan the QR!</div>';
    }

    // ---------- Winner banner (when voting is closed) ----------
    if (!config.votingOpen && list.length && list[0].votes > 0) {
      const w = list[0];
      winnerEl.hidden = false;
      winnerEl.innerHTML =
        '<h2>🏆 Winner: <span class="win-num">#' + w.number + '</span> — ' + esc(w.category.name) + '</h2>' +
        '<p>' + w.votes + ' votes · the audience has spoken!</p>';
      if (!hasWinnerShown) {
        hasWinnerShown = true;
        runConfetti();
      }
    } else {
      winnerEl.hidden = true;
      hasWinnerShown = false;
    }

    // ---------- Full list ----------
    listEl.innerHTML = '';
    list.forEach((a, i) => {
      const row = document.createElement('div');
      row.className = 'lb-row' + (i < 3 ? ' top' : '');
      const pct = maxVotes ? Math.max((a.votes / maxVotes) * 100, 2) : 0;
      const color = catColor(a.category.id);
      row.innerHTML =
        '<span class="lb-rank">' + (i + 1) + '</span>' +
        '<span class="lb-num">#' + a.number + '</span>' +
        '<span class="lb-cat">' + esc(a.category.name) + '</span>' +
        '<div class="lb-bar"><div class="lb-fill" style="width:' + pct + '%; background:linear-gradient(90deg,' + color + ',var(--accent-2))"></div></div>' +
        '<span class="lb-count">' + a.votes + '</span>';
      listEl.appendChild(row);
    });
    if (list.length === 0) {
      listEl.innerHTML = '<div class="empty-state"><span class="big">🎨</span>No artworks configured yet.</div>';
    }
  }

  async function tick() {
    try {
      const votes = await api.get('/api/votes');
      const cfg = await api.get('/api/config');
      counts = votes.counts;
      if (cfg.votingOpen !== config.votingOpen) {
        config.votingOpen = cfg.votingOpen;
        statusEl.textContent = config.votingOpen ? 'Voting open' : 'Voting closed';
        statusEl.className = 'badge ' + (config.votingOpen ? 'badge-open' : 'badge-closed');
      }
      render();
    } catch (e) { /* keep last good state */ }
  }

  // ---------- Confetti ----------
  function runConfetti() {
    const canvas = document.createElement('canvas');
    canvas.id = 'confettiCanvas';
    document.body.appendChild(canvas);
    const ctx = canvas.getContext('2d');
    canvas.width = innerWidth;
    canvas.height = innerHeight;
    const colors = ['#fde047', '#f472b6', '#8b5cf6', '#34d399', '#60a5fa', '#fb7185'];
    const parts = Array.from({ length: 160 }, () => ({
      x: Math.random() * canvas.width,
      y: -20 - Math.random() * canvas.height * 0.4,
      w: 6 + Math.random() * 6,
      h: 8 + Math.random() * 8,
      vy: 2 + Math.random() * 3.2,
      vx: (Math.random() - 0.5) * 1.6,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.18,
      c: colors[(Math.random() * colors.length) | 0]
    }));
    let frames = 0;
    (function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      parts.forEach((p) => {
        p.y += p.vy;
        p.x += p.vx;
        p.rot += p.vr;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.c;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      });
      frames++;
      if (frames < 260 && parts.some((p) => p.y < canvas.height + 40)) requestAnimationFrame(draw);
      else canvas.remove();
    })();
  }

  // ---------- Scan-to-vote QR ----------
  async function setupQr() {
    try {
      const r = await api.get('/api/qr?url=' + encodeURIComponent(location.origin + '/'));
      qrImg.src = r.dataUrl;
    } catch (e) { /* QR unavailable */ }
  }

  (async function init() {
    try {
      await load();
    } catch (e) {
      listEl.innerHTML = '<div class="empty-state"><span class="big">⚠️</span>Could not load results.<br>' + esc(e.message) + '</div>';
      return;
    }
    setupQr();
    setInterval(tick, 2000);
  })();
})();
