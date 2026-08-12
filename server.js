const express = require('express');
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const QRCode = require('qrcode');

const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, 'data');
const PUBLIC_DIR = path.join(ROOT, 'public');
const ART_DIR = path.join(PUBLIC_DIR, 'art');
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');
const VOTES_FILE = path.join(DATA_DIR, 'votes.json');
const VOTERS_FILE = path.join(DATA_DIR, 'voters.json');

const PORT = process.env.PORT || 3000;

// ---------------------------------------------------------------------------
// Default configuration — edit ranges here OR in the browser admin panel.
// ---------------------------------------------------------------------------
const DEFAULT_CONFIG = {
  eventTitle: 'Art Showdown 2026',
  adminPin: '1234',
  votingOpen: true,
  votesPerVoter: 1,
  categories: [
    { id: '2d', name: '2D', start: 1, end: 44 },
    { id: '3d', name: '3D', start: 53, end: 78 },
    { id: 'painting', name: 'Painting', start: 84, end: 119 },
    { id: 'sketch', name: 'Sketch', start: 120, end: 148 },
    { id: 'ai', name: 'AI', start: null, end: null },
    { id: 'game', name: 'Game / Event', start: null, end: null }
  ]
};

// ---------------------------------------------------------------------------
// Storage helpers
// ---------------------------------------------------------------------------
function ensureData() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(ART_DIR, { recursive: true });
  if (!fs.existsSync(CONFIG_FILE)) fs.writeFileSync(CONFIG_FILE, JSON.stringify(DEFAULT_CONFIG, null, 2));
  if (!fs.existsSync(VOTES_FILE)) fs.writeFileSync(VOTES_FILE, '{}');
  if (!fs.existsSync(VOTERS_FILE)) fs.writeFileSync(VOTERS_FILE, '{}');
}

function readJSON(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    return fallback;
  }
}

function writeJSON(file, data) {
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, file);
}

const getConfig = () => readJSON(CONFIG_FILE, DEFAULT_CONFIG);
const getVotes = () => readJSON(VOTES_FILE, {});
const getVoters = () => readJSON(VOTERS_FILE, {});
const saveVotes = (v) => writeJSON(VOTES_FILE, v);
const saveVoters = (v) => writeJSON(VOTERS_FILE, v);
const saveConfig = (c) => writeJSON(CONFIG_FILE, c);

// ---------------------------------------------------------------------------
// Domain helpers
// ---------------------------------------------------------------------------
function categoryOf(config, n) {
  return config.categories.find(
    (c) => c.start != null && c.end != null && n >= c.start && n <= c.end
  ) || null;
}

function artList(config) {
  const out = [];
  for (const cat of config.categories) {
    if (cat.start == null || cat.end == null) continue;
    for (let n = cat.start; n <= cat.end; n++) {
      out.push({ number: n, category: cat.id, categoryName: cat.name });
    }
  }
  return out;
}

// Maps art number -> public image URL. Drop files named <number>.jpg/.png/.webp
// into public/art/ and they will show up on the voting cards automatically.
function artImages() {
  const map = {};
  if (fs.existsSync(ART_DIR)) {
    for (const f of fs.readdirSync(ART_DIR)) {
      const m = f.match(/^(\d+)\.(png|jpe?g|webp|gif)$/i);
      if (m) map[m[1]] = '/art/' + f;
    }
  }
  return map;
}

function countsFromVotes(votes) {
  const counts = {};
  let total = 0;
  for (const [num, entry] of Object.entries(votes)) {
    counts[num] = (entry.voters || []).length;
    total += counts[num];
  }
  return { counts, totalVotes: total };
}

const app = express();
app.use(express.json());

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

// Registers a new voter and returns a unique token (voter check-in).
app.post('/api/voter', (req, res) => {
  const token = crypto.randomBytes(12).toString('hex');
  const voters = getVoters();
  voters[token] = { votes: [], createdAt: Date.now() };
  saveVoters(voters);
  res.json({ token });
});

// Returns which artworks the current voter has voted for.
app.get('/api/me', (req, res) => {
  const voters = getVoters();
  const token = String(req.query.token || '');
  if (!token || !voters[token]) return res.status(404).json({ error: 'unknown voter' });
  res.json({ votes: voters[token].votes });
});

app.get('/api/config', (req, res) => {
  const config = getConfig();
  res.json({
    eventTitle: config.eventTitle,
    votingOpen: config.votingOpen,
    votesPerVoter: config.votesPerVoter,
    categories: config.categories,
    artImages: artImages()
  });
});

app.get('/api/votes', (req, res) => {
  res.json(countsFromVotes(getVotes()));
});

// Cast / toggle a vote for one artwork.
app.post('/api/vote', (req, res) => {
  const { token, artNumber } = req.body || {};
  const config = getConfig();

  if (!config.votingOpen) {
    return res.status(403).json({ error: 'Voting is closed. Thank you for participating!' });
  }

  const num = parseInt(artNumber, 10);
  if (!Number.isInteger(num)) return res.status(400).json({ error: 'Invalid artwork number' });
  if (!categoryOf(config, num)) return res.status(404).json({ error: 'No artwork with that number' });

  const voters = getVoters();
  if (!token || !voters[token]) {
    return res.status(401).json({ error: 'unknown voter', needRegister: true });
  }

  const votes = getVotes();
  const voter = voters[token];
  const idx = voter.votes.indexOf(num);

  if (idx >= 0) {
    // Toggle OFF — remove the vote
    voter.votes.splice(idx, 1);
    const entry = votes[num];
    if (entry) entry.voters = (entry.voters || []).filter((t) => t !== token);
  } else {
    if (voter.votes.length >= config.votesPerVoter) {
      const word = config.votesPerVoter === 1 ? 'one artwork only' : `${config.votesPerVoter} artworks`;
      return res.status(409).json({ error: `You already used your votes — you can vote for ${word}. Tap your voted artwork to change it.` });
    }
    voter.votes.push(num);
    if (!votes[num]) votes[num] = { voters: [] };
    votes[num].voters.push(token);
  }

  saveVoters(voters);
  saveVotes(votes);

  const { counts } = countsFromVotes(votes);
  res.json({ voted: idx < 0, myVotes: voter.votes, counts });
});

// QR image for any URL (used by the kiosk "scan to vote" box).
app.get('/api/qr', async (req, res) => {
  const url = String(req.query.url || '');
  if (!url || !/^https?:\/\//i.test(url)) {
    return res.status(400).json({ error: 'A valid http(s) url is required' });
  }
  try {
    const dataUrl = await QRCode.toDataURL(url, { width: 320, margin: 1 });
    res.json({ dataUrl });
  } catch (e) {
    res.status(400).json({ error: 'Could not generate QR' });
  }
});

// ---------------------------------------------------------------------------
// Admin API (protected by admin PIN sent as X-Admin-Pin header)
// ---------------------------------------------------------------------------
function isAdmin(req) {
  const pin = String(req.get('x-admin-pin') || '');
  return pin && pin === String(getConfig().adminPin);
}

app.use('/api/admin', (req, res, next) => {
  if (!isAdmin(req)) return res.status(401).json({ error: 'Invalid admin PIN' });
  next();
});

app.get('/api/admin/state', (req, res) => {
  const config = getConfig();
  const { counts, totalVotes } = countsFromVotes(getVotes());
  const arts = artList(config);
  const winner = arts
    .map((a) => ({ ...a, votes: counts[a.number] || 0 }))
    .sort((a, b) => b.votes - a.votes)[0] || null;
  res.json({
    eventTitle: config.eventTitle,
    adminPin: config.adminPin,
    votingOpen: config.votingOpen,
    votesPerVoter: config.votesPerVoter,
    categories: config.categories,
    totalVotes,
    winner: winner && winner.votes > 0 ? winner : null,
    voterCount: Object.keys(getVoters()).length,
    artCount: arts.length
  });
});

// Update settings and/or categories.
app.post('/api/admin/config', (req, res) => {
  const body = req.body || {};
  const config = getConfig();

  if (typeof body.eventTitle === 'string' && body.eventTitle.trim()) {
    config.eventTitle = body.eventTitle.trim().slice(0, 80);
  }
  if (typeof body.adminPin === 'string' && body.adminPin.trim()) {
    config.adminPin = body.adminPin.trim().slice(0, 20);
  }
  if (typeof body.votingOpen === 'boolean') config.votingOpen = body.votingOpen;
  if (Number.isInteger(body.votesPerVoter) && body.votesPerVoter >= 1 && body.votesPerVoter <= 50) {
    config.votesPerVoter = body.votesPerVoter;
  }
  if (Array.isArray(body.categories)) {
    config.categories = body.categories
      .filter((c) => c && typeof c.id === 'string' && typeof c.name === 'string' && c.name.trim())
      .map((c) => ({
        id: c.id.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        name: c.name.trim().slice(0, 40),
        start: c.start == null ? null : parseInt(c.start, 10),
        end: c.end == null ? null : parseInt(c.end, 10)
      }));
  }

  saveConfig(config);

  // Drop votes for artworks that no longer exist in any category range
  const valid = new Set(artList(config).map((a) => a.number));
  const votes = getVotes();
  let changed = false;
  for (const num of Object.keys(votes)) {
    if (!valid.has(parseInt(num, 10))) {
      delete votes[num];
      changed = true;
    }
  }
  if (changed) saveVotes(votes);

  res.json({ ok: true, config: getConfig() });
});

// Generate N printable voter QR codes.
app.post('/api/admin/voters', async (req, res) => {
  const count = Math.min(Math.max(parseInt((req.body || {}).count, 10) || 1, 1), 500);
  const voters = getVoters();
  const base = `${req.protocol}://${req.get('host')}`;
  const created = [];

  for (let i = 0; i < count; i++) {
    const token = crypto.randomBytes(10).toString('hex');
    voters[token] = { votes: [], createdAt: Date.now(), printed: true };
    const url = `${base}/?t=${token}`;
    created.push({
      token,
      url,
      short: token.slice(0, 8),
      qr: await QRCode.toDataURL(url, { width: 200, margin: 1 })
    });
  }

  saveVoters(voters);
  res.json({ created });
});

// List all registered voters (with their vote count) for the admin panel.
app.get('/api/admin/voters', async (req, res) => {
  const voters = getVoters();
  const base = `${req.protocol}://${req.get('host')}`;
  const list = [];
  for (const [token, v] of Object.entries(voters)) {
    const url = `${base}/?t=${token}`;
    list.push({
      token,
      short: token.slice(0, 8),
      url,
      votes: v.votes,
      voteCount: (v.votes || []).length,
      qr: await QRCode.toDataURL(url, { width: 160, margin: 1 })
    });
  }
  list.sort((a, b) => b.voteCount - a.voteCount);
  res.json({ voters: list });
});

app.delete('/api/admin/voter/:token', (req, res) => {
  const voters = getVoters();
  const token = req.params.token;
  if (!voters[token]) return res.status(404).json({ error: 'voter not found' });
  // Remove their votes from the counts too
  const votes = getVotes();
  for (const num of voters[token].votes || []) {
    if (votes[num]) votes[num].voters = votes[num].voters.filter((t) => t !== token);
  }
  delete voters[token];
  saveVoters(voters);
  saveVotes(votes);
  res.json({ ok: true });
});

app.post('/api/admin/reset', (req, res) => {
  const type = (req.body || {}).type;
  if (type === 'votes') {
    saveVotes({});
    const voters = getVoters();
    for (const t of Object.keys(voters)) voters[t].votes = [];
    saveVoters(voters);
  } else if (type === 'all') {
    saveVotes({});
    saveVoters({});
  } else {
    return res.status(400).json({ error: 'type must be "votes" or "all"' });
  }
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Static files + server start
// ---------------------------------------------------------------------------
ensureData();
app.use(express.static(PUBLIC_DIR));

app.listen(PORT, '0.0.0.0', () => {
  const nets = os.networkInterfaces();
  const addrs = [];
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === 'IPv4' && !net.internal) addrs.push(net.address);
    }
  }
  console.log('\n  🎨 Art Showdown is running!\n');
  console.log(`  Local:    http://localhost:${PORT}`);
  for (const a of addrs) console.log(`  Network:  http://${a}:${PORT}   <- scan this on phones`);
  console.log('  Admin:    http://localhost:' + PORT + '/admin.html   (default PIN: 1234)\n');
});
