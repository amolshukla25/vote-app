(function () {
  let config = null;
  let counts = {};
  let myVotes = [];
  let token = null;
  let activeCat = 'all';
  let arts = []; // flattened list of artworks

  const grid = document.getElementById('grid');
  const tabsEl = document.getElementById('tabs');
  const titleEl = document.getElementById('eventTitle');
  const badgeEl = document.getElementById('statusBadge');
  const hintEl = document.getElementById('voterHint');

  // ---------- Voter identity (QR check-in) ----------
  async function ensureVoter() {
    const fromUrl = new URLSearchParams(location.search).get('t');
    token = fromUrl || localStorage.getItem('artVoterToken');
    if (token) {
      // Validate the token still exists on the server
      try {
        const me = await api.get('/api/me?token=' + encodeURIComponent(token));
        myVotes = me.votes || [];
        hintEl.innerHTML = 'You are voting as <b>#' + token.slice(0, 6).toUpperCase() + '</b>. Tap an artwork to vote — tap again to change it.';
        return;
      } catch (e) { /* token unknown — fall through and register a fresh one */ }
    }
    const r = await api.post('/api/voter', {});
    token = r.token;
    localStorage.setItem('artVoterToken', token);
    myVotes = [];
    hintEl.innerHTML = 'You are voting as <b>#' + token.slice(0, 6).toUpperCase() + '</b>. Tap an artwork to vote — tap again to change it.';
  }

  // ---------- Load data ----------
  async function load() {
    config = await api.get('/api/config');
    counts = (await api.get('/api/votes')).counts;

    titleEl.textContent = config.eventTitle;
    document.title = 'Vote — ' + config.eventTitle;
    setStatus(config.votingOpen);

    arts = [];
    for (const cat of config.categories) {
      if (cat.start == null || cat.end == null) continue;
      for (let n = cat.start; n <= cat.end; n++) {
        arts.push({ number: n, category: cat, img: config.artImages[String(n)] || null });
      }
    }

    renderTabs();
    renderLegend();
    renderGrid();
  }

  // Shows which number ranges belong to which category (e.g. 2D · #1–44)
  function renderLegend() {
    const el = document.getElementById('catLegend');
    el.innerHTML = '';
    const withRange = config.categories.filter((c) => c.start != null && c.end != null);
    if (withRange.length === 0) return;
    withRange.forEach((cat) => {
      const chip = document.createElement('div');
      chip.className = 'legend-chip';
      chip.style.setProperty('--lc', catColor(cat.id));
      chip.innerHTML =
        '<span class="legend-dot"></span>' +
        '<span class="legend-name">' + esc(cat.name) + '</span>' +
        '<span class="legend-range">#' + cat.start + ' – #' + cat.end + '</span>';
      el.appendChild(chip);
    });
  }

  function setStatus(open) {
    badgeEl.textContent = open ? 'Voting open' : 'Voting closed';
    badgeEl.className = 'badge ' + (open ? 'badge-open' : 'badge-closed');
  }

  // ---------- Tabs ----------
  function renderTabs() {
    tabsEl.innerHTML = '';
    const cats = [...new Set(arts.map((a) => a.category.id))];
    const allCount = arts.length;
    addTab('all', 'All', allCount);
    for (const id of cats) {
      const cat = arts.find((a) => a.category.id === id).category;
      addTab(id, cat.name, arts.filter((a) => a.category.id === id).length);
    }
  }

  function addTab(id, label, count) {
    const b = document.createElement('button');
    b.className = 'tab' + (id === activeCat ? ' active' : '');
    b.innerHTML = esc(label) + ' <span class="tab-count">' + count + '</span>';
    b.onclick = () => {
      activeCat = id;
      document.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
      b.classList.add('active');
      renderGrid();
    };
    tabsEl.appendChild(b);
  }

  // ---------- Grid ----------
  function renderGrid() {
    grid.innerHTML = '';
    const shown = activeCat === 'all' ? arts : arts.filter((a) => a.category.id === activeCat);
    if (shown.length === 0) {
      grid.innerHTML = '<div class="empty-state"><span class="big">🎨</span>No artworks here yet.<br>Add a number range in the admin panel.</div>';
      return;
    }
    shown.forEach((art, i) => {
      const card = document.createElement('button');
      const voted = myVotes.includes(art.number);
      const color = catColor(art.category.id);
      card.className = 'art-card' + (voted ? ' voted' : '');
      card.style.animationDelay = Math.min(i * 14, 400) + 'ms';
      card.style.setProperty('--cat', color);

      const media = art.img
        ? '<div class="art-media"><img src="' + esc(art.img) + '" alt="Artwork ' + art.number + '" loading="lazy"></div>'
        : '<div class="art-media"><div class="art-num">' + art.number + '</div></div>';

      card.innerHTML =
        media +
        '<div class="art-check">✓</div>' +
        '<div class="art-meta">' +
        '<span class="art-cat">' + esc(art.category.name) + '</span>' +
        '<span class="art-votes"><b id="cnt-' + art.number + '">' + (counts[art.number] || 0) + '</b> votes</span>' +
        '</div>';

      card.dataset.n = art.number;
      card.addEventListener('click', () => vote(art.number, card));
      grid.appendChild(card);
    });
  }

  // ---------- Voting ----------
  async function vote(num, card) {
    if (!config.votingOpen) {
      toast('Voting is closed — check the leaderboard!', 'error');
      return;
    }
    card.classList.add('voting'); // quick feedback
    try {
      const r = await api.post('/api/vote', { token, artNumber: num });
      myVotes = r.myVotes;
      counts = r.counts;
      config.votingOpen = r.votingOpen !== undefined ? r.votingOpen : config.votingOpen;
      refreshCounts();
      refreshVotedState();
      toast(r.voted ? 'Vote cast for #' + num + ' 🎉' : 'Vote removed from #' + num, r.voted ? 'success' : '');
    } catch (e) {
      if (e.status === 401) {
        // Token became invalid (e.g. admin reset) — re-register this device
        localStorage.removeItem('artVoterToken');
        await ensureVoter();
        return vote(num, card);
      }
      toast(e.message, 'error');
      if (e.status === 409) shakeVoted();
    } finally {
      card.classList.remove('voting');
    }
  }

  function refreshCounts() {
    document.querySelectorAll('.art-votes b').forEach((b) => {
      const n = parseInt(b.id.replace('cnt-', ''), 10);
      b.textContent = counts[n] || 0;
    });
  }

  function refreshVotedState() {
    document.querySelectorAll('.art-card').forEach((c) => {
      const n = parseInt(c.dataset.n, 10);
      c.classList.toggle('voted', myVotes.includes(n));
    });
  }

  function shakeVoted() {
    document.querySelectorAll('.art-card.voted').forEach((c) => {
      c.animate(
        [{ transform: 'translateX(0)' }, { transform: 'translateX(-5px)' }, { transform: 'translateX(5px)' }, { transform: 'translateX(0)' }],
        { duration: 300 }
      );
    });
  }

  // ---------- Live refresh ----------
  async function tick() {
    try {
      const data = await api.get('/api/votes');
      counts = data.counts;
      refreshCounts();
    } catch (e) { /* ignore */ }
  }

  (async function init() {
    try {
      await ensureVoter();
      await load();
    } catch (e) {
      grid.innerHTML = '<div class="empty-state"><span class="big">⚠️</span>Could not load the voting app.<br>' + esc(e.message) + '</div>';
      return;
    }
    setInterval(tick, 3000);
  })();
})();
