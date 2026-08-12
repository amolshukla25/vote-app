(function () {
  let pin = localStorage.getItem('artAdminPin') || '';
  let state = null;

  const gateEl = document.getElementById('loginGate');
  const appEl = document.getElementById('adminApp');
  const pinInput = document.getElementById('pinInput');
  const pinErr = document.getElementById('pinErr');

  // ---------- Login ----------
  async function tryLogin() {
    pin = pinInput.value.trim();
    try {
      await api.get('/api/admin/state', { 'X-Admin-Pin': pin });
      localStorage.setItem('artAdminPin', pin);
      openApp();
    } catch (e) {
      pinErr.textContent = e.status === 401 ? 'Wrong PIN. Try again.' : e.message;
    }
  }

  document.getElementById('loginBtn').addEventListener('click', tryLogin);
  pinInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') tryLogin(); });

  async function openApp() {
    gateEl.hidden = true;
    appEl.hidden = false;
    await refreshState();
    document.getElementById('eventTitle').textContent = state.eventTitle;
    document.title = 'Admin — ' + state.eventTitle;
  }

  function headers() { return { 'X-Admin-Pin': pin }; }

  // ---------- State ----------
  async function refreshState() {
    state = await api.get('/api/admin/state', headers());
    document.getElementById('statTotal').textContent = state.totalVotes;
    document.getElementById('statWinner').innerHTML = state.winner
      ? '#' + state.winner.number + ' <span style="font-size:12.5px;color:var(--text-dim)">(' + state.winner.categoryName + ')</span>'
      : '—';
    document.getElementById('statVoters').textContent = state.voterCount;
    document.getElementById('statArts').textContent = state.artCount;

    document.getElementById('eventTitleInput').value = state.eventTitle;
    document.getElementById('votesPerVoter').value = state.votesPerVoter;
    document.getElementById('votingOpenToggle').checked = state.votingOpen;
    renderCategories();
  }

  // ---------- Categories editor ----------
  function renderCategories() {
    const tbody = document.getElementById('catBody');
    tbody.innerHTML = '';
    state.categories.forEach((cat, i) => {
      const tr = document.createElement('tr');
      const count = cat.start != null && cat.end != null ? Math.max(cat.end - cat.start + 1, 0) : 0;
      tr.innerHTML =
        '<td><input class="cat-name" value="' + esc(cat.name) + '" placeholder="Category name"></td>' +
        '<td><input class="num-input cat-start" type="number" value="' + (cat.start ?? '') + '" placeholder="—"></td>' +
        '<td><input class="num-input cat-end" type="number" value="' + (cat.end ?? '') + '" placeholder="—"></td>' +
        '<td class="art-count">' + (cat.start != null && cat.end != null ? count + ' artworks' : '<span class="cat-empty">no range yet</span>') + '</td>' +
        '<td><button class="cat-remove" title="Remove category">✕</button></td>';
      tr.querySelector('.cat-remove').addEventListener('click', () => {
        state.categories.splice(i, 1);
        renderCategories();
      });
      tr.querySelectorAll('input').forEach((input) => {
        input.addEventListener('input', () => {
          const n = parseInt(tr.querySelector('.cat-start').value, 10);
          const e = parseInt(tr.querySelector('.cat-end').value, 10);
          const cell = tr.querySelector('.art-count');
          if (n && e) {
            cell.textContent = Math.max(e - n + 1, 0) + ' artworks';
          } else if (n || e) {
            cell.innerHTML = '<span class="cat-empty">fill both</span>';
          } else {
            cell.innerHTML = '<span class="cat-empty">no range yet</span>';
          }
        });
      });
      tbody.appendChild(tr);
    });
  }

  document.getElementById('addCatBtn').addEventListener('click', () => {
    state.categories.push({ id: 'new', name: 'New Category', start: null, end: null });
    renderCategories();
  });

  document.getElementById('saveCatBtn').addEventListener('click', async () => {
    const rows = [...document.querySelectorAll('#catBody tr')];
    const cats = rows.map((tr, i) => ({
      id: (tr.querySelector('.cat-name').value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'category-' + (i + 1)),
      name: tr.querySelector('.cat-name').value.trim() || 'Category ' + (i + 1),
      start: tr.querySelector('.cat-start').value === '' ? null : parseInt(tr.querySelector('.cat-start').value, 10),
      end: tr.querySelector('.cat-end').value === '' ? null : parseInt(tr.querySelector('.cat-end').value, 10)
    }));
    await api.post('/api/admin/config', { categories: cats }, headers());
    await refreshState();
    setMsg('catMsg', 'Categories saved ✓');
  });

  // ---------- Settings ----------
  document.getElementById('saveSettingsBtn').addEventListener('click', async () => {
    const body = {
      eventTitle: document.getElementById('eventTitleInput').value,
      votingOpen: document.getElementById('votingOpenToggle').checked,
      votesPerVoter: parseInt(document.getElementById('votesPerVoter').value, 10) || 1
    };
    const newPin = document.getElementById('adminPinInput').value.trim();
    if (newPin) body.adminPin = newPin;
    await api.post('/api/admin/config', body, headers());
    if (newPin) { pin = newPin; localStorage.setItem('artAdminPin', pin); }
    await refreshState();
    document.getElementById('adminPinInput').value = '';
    setMsg('settingsMsg', 'Settings saved ✓');
  });

  function setMsg(id, text) {
    const el = document.getElementById(id);
    el.textContent = text;
    setTimeout(() => { el.textContent = ''; }, 3000);
  }

  // ---------- Voter QR tickets ----------
  document.getElementById('genQrBtn').addEventListener('click', async () => {
    const count = parseInt(document.getElementById('qrCount').value, 10) || 1;
    document.getElementById('genQrBtn').disabled = true;
    try {
      const r = await api.post('/api/admin/voters', { count }, headers());
      setMsg('qrMsg', r.created.length + ' QR ticket' + (r.created.length > 1 ? 's' : '') + ' generated ✓');
      renderQrList();
    } finally {
      document.getElementById('genQrBtn').disabled = false;
    }
  });

  async function renderQrList() {
    const wrap = document.getElementById('qrList');
    const r = await api.get('/api/admin/voters', headers());
    wrap.innerHTML = '';
    const printed = r.voters.filter((v) => v.votes.length === 0);
    const voted = r.voters.filter((v) => v.votes.length > 0);
    [...printed, ...voted].forEach((v) => {
      const div = document.createElement('div');
      div.className = 'qr-ticket' + (v.voteCount > 0 ? ' voted' : '');
      div.innerHTML =
        '<div class="t-label">Art Showdown · Vote</div>' +
        '<div class="t-token">#' + v.short + '</div>' +
        '<img src="' + v.qr + '" alt="QR">' +
        '<div class="t-meta">' + (v.voteCount > 0 ? 'Voted: #' + v.votes.join(', #') : 'Not voted yet') + '</div>' +
        '<div class="t-qr">🔒 scan to vote</div>' +
        '<button class="btn small" style="margin-top:6px">Remove</button>';
      div.querySelector('button').addEventListener('click', async () => {
        await api.del('/api/admin/voter/' + v.token, headers());
        renderQrList();
        refreshState();
      });
      wrap.appendChild(div);
    });
    if (r.voters.length === 0) wrap.innerHTML = '<div class="empty-state"><span class="big">🪪</span>No voter tickets yet — generate some above.</div>';
  }

  document.getElementById('printBtn').addEventListener('click', async () => {
    await renderQrList();
    document.body.classList.add('printing');
    const area = document.getElementById('qrList');
    area.classList.add('print-area');
    setTimeout(() => {
      window.print();
      setTimeout(() => {
        document.body.classList.remove('printing');
        area.classList.remove('print-area');
      }, 300);
    }, 120);
  });

  // ---------- Danger zone ----------
  document.getElementById('resetVotesBtn').addEventListener('click', async () => {
    if (!confirm('Reset ALL votes? This cannot be undone.')) return;
    await api.post('/api/admin/reset', { type: 'votes' }, headers());
    await refreshState();
    await renderQrList();
    setMsg('dangerMsg', 'All votes cleared ✓');
  });

  document.getElementById('resetAllBtn').addEventListener('click', async () => {
    if (!confirm('Wipe votes AND all voter tickets? This cannot be undone.')) return;
    await api.post('/api/admin/reset', { type: 'all' }, headers());
    await refreshState();
    await renderQrList();
    setMsg('dangerMsg', 'Everything reset ✓');
  });

  document.getElementById('logoutBtn').addEventListener('click', () => {
    localStorage.removeItem('artAdminPin');
    location.reload();
  });

  // ---------- Boot ----------
  (async function init() {
    if (pin) {
      try {
        await api.get('/api/admin/state', headers());
        openApp();
        return;
      } catch (e) { localStorage.removeItem('artAdminPin'); }
    }
    gateEl.hidden = false;
    appEl.hidden = true;
    pinInput.focus();
  })();
})();
