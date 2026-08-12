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
