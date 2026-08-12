# Art Showdown 🎨

A serverless art voting game with QR voter check-in and a live leaderboard.

- **Voting page** `/` — tap artworks to cast/toggle votes (one QR ticket per voter)
- **Leaderboard** `/leaderboard` — live podium, ranked bars, and a scan-to-vote QR
- **Admin** `/admin` — event settings, categories, printable QR tickets, danger zone (PIN: `1234` by default)

Built with **Next.js (App Router)** on the edge/serverless (deploy to Vercel) and **MongoDB Atlas** for storage.

## Getting started

### 1. MongoDB Atlas

1. Create a free cluster at <https://www.mongodb.com/atlas>.
2. Create a database user and allow access from your IP (or `0.0.0.0/0` for a public event).
3. Copy the **connection string** (Node.js driver) — it looks like `mongodb+srv://user:pass@cluster.mongodb.net/?retryWrites=true&w=majority`.

### 2. Configure the app

```bash
cp .env.example .env.local
```

Edit `.env.local` and paste your connection string:

```env
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/?retryWrites=true&w=majority
MONGODB_DB=art-showdown   # optional
```

### 3. Add artwork images

Drop one image per artwork into `public/art/`, named by its number:

```
public/art/5.jpg
public/art/120.webp
```

The manifest rebuilds automatically on `npm run dev` / `npm run build` (or run `npm run scan:art`).

### 4. Run it

```bash
npm install
npm run dev
```

Open http://localhost:3000 — voting, the leaderboard, and `/admin` all work against your Atlas cluster.

## Deploy to Vercel

1. Push this repo to GitHub.
2. Import it on <https://vercel.com>.
3. Add the `MONGODB_URI` (and optional `MONGODB_DB`) environment variable.
4. Deploy. Artwork images in `public/art/` ship with the build automatically.

## API

| Route                       | Description                                  |
| --------------------------- | -------------------------------------------- |
| `POST /api/voter`           | Register a voter, returns a token            |
| `GET  /api/me?token=`       | A voter's current votes                      |
| `GET  /api/config`          | Public event config + artwork images         |
| `GET  /api/votes`           | Live vote counts                             |
| `POST /api/vote`            | Cast/toggle a vote (`{ token, artNumber }`)  |
| `GET  /api/qr?url=`         | QR data-URL for any URL                      |
| `GET  /api/admin/state`     | Admin dashboard state (needs `X-Admin-Pin`)  |
| `POST /api/admin/config`    | Update settings/categories                   |
| `POST /api/admin/voters`    | Generate N QR voter tickets                  |
| `GET  /api/admin/voters`    | List voters with QR codes                    |
| `DELETE /api/admin/voter/:token` | Remove one voter ticket                  |
| `POST /api/admin/reset`     | Reset votes / wipe everything                |

The legacy Express implementation is preserved in [`legacy-express/`](legacy-express/).

## Troubleshooting

**“Artworks are not showing / the page says No artworks here yet”**

- If the API returns `500` with an SSL error (`tlsv1 alert internal error`), the serverless host can't reach Atlas — see below.
- Otherwise, artwork images are separate from the database: cards show big numbers until you drop `<number>.jpg/.png` files into `public/art/` and push them (the manifest rebuilds on deploy).

**Database connection fails on Vercel with `SSL routines:ssl3_read_bytes:tlsv1 alert internal error`**

Vercel functions connect from dynamic cloud IPs. MongoDB Atlas blocks any IP that isn't on the cluster's access list, and the block shows up as a TLS handshake failure.

1. In **MongoDB Atlas → Security → Network Access → Add IP Address**, choose **Allow access from anywhere** (`0.0.0.0/0`) and save.
2. In **Vercel → Project → Settings → Environment Variables**, confirm `MONGODB_URI` is set for the **Production** environment (special characters in the password must be URL-encoded, e.g. `@` → `%40`).
3. Redeploy from the Vercel Deployments tab if you changed environment variables.

Verify with `curl https://<your-app>.vercel.app/api/config` — it should return JSON (event title, categories, …) instead of an error.
