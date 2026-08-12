// Shared helpers for all pages
window.api = {
  async get(url, headers = {}) {
    const r = await fetch(url, { headers });
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'Request failed');
    return r.json();
  },
  async post(url, body, headers = {}) {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body)
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw Object.assign(new Error(data.error || 'Request failed'), { status: r.status, data });
    return data;
  },
  async del(url, headers = {}) {
    const r = await fetch(url, { method: 'DELETE', headers });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || 'Request failed');
    return data;
  }
};

let toastTimer = null;
function toast(msg, type = '') {
  let el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    el.className = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.className = 'toast show ' + type;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.className = 'toast ' + type; }, 2600);
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Category accent colors
const CAT_COLORS = {
  painting: '#f472b6',
  '2d': '#60a5fa',
  '3d': '#34d399',
  ai: '#a78bfa',
  sketch: '#fbbf24',
  game: '#fb7185'
};
function catColor(id) {
  return CAT_COLORS[id] || '#8b5cf6';
}
