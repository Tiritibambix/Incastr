# Incastr

A lightweight, self-hosted video library you actually want to use.

Incastr lets you point it at a folder on your server, and it turns your videos into a clean, searchable library — with thumbnails, tags, and shareable links. No cloud, no subscription, no nonsense.

---

## The idea

You've got videos scattered across your drives. Maybe they're family recordings, a personal film collection, tutorials you've saved, or anything else that doesn't belong on YouTube. You want to browse them from a nice interface, share a folder with a friend, and not think about it too much.

Incastr is that tool. It's not trying to be Plex. It's just a tidy shelf for your videos.

---

## How folders become categories

This is the core idea: **your folder structure is your organisation**.

```
/media/videos/
├── WatchLater/
│   ├── some-documentary.mp4
│   └── interesting-talk.mkv
├── Music/
│   ├── concert-2023.mp4
│   └── session.mkv
└── Family/
    └── summer-trip.mp4
```

Mount that folder into the container, point Incastr at `/media/videos`, run a scan — and your library appears with three categories: **WatchLater**, **Music**, **Family**. That's it. No configuration, no metadata to fill in, no tagging required. Just drop your videos into subfolders.

Deeper nesting is fine: Incastr always uses the **first-level subfolder** as the category name. A video at `Music/Rock/track.mp4` gets the category `Music`.

---

## Features

- **Auto-scan** — watches your folders and indexes new videos automatically
- **Thumbnails** — extracted by ffmpeg, no manual work needed
- **Categories** — derived from your folder structure, zero setup
- **Tags** — add your own tags to individual videos for finer-grained search
- **Search** — full-text across title, description, category, and tags
- **Sharing** — share a single video or an entire category as an unlisted link (no login required for recipients)
- **Pagination** — 16 videos per page, no infinite scroll madness
- **Multi-user** — each user has their own library and folders
- **Public landing page** — optionally expose public videos to anyone who visits your instance

---

## Quick start

**1. Clone and configure**

```bash
git clone https://github.com/tiritibambix/incastr.git
cd incastr
cp .env.example .env
# Edit .env and set a strong SECRET_KEY
```

**2. Edit `docker-compose.yml`**

Mount your video folder and set the path:

```yaml
volumes:
  - /path/to/your/videos:/media/videos   # remove :ro if you want Incastr to delete files from disk

environment:
  - SECRET_KEY=your-strong-secret-here
  - MEDIA_DIR=/media/videos              # auto-configures this folder on startup
```

**3. Start**

```bash
docker compose up -d
```

Open `http://localhost:8420`, create your account (the first registered user is automatically an admin), and click **Scan all** in Settings.

---

## Configuration

All settings are environment variables:

| Variable | Default | Description |
|---|---|---|
| `SECRET_KEY` | **required** | JWT signing key — use a long random string |
| `DATABASE_URL` | `sqlite:////data/incastr.db` | SQLite database path |
| `THUMBS_DIR` | `/data/thumbs` | Where thumbnails are stored |
| `MEDIA_DIR` | — | Auto-configure this path as a video folder for all admins on startup |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `60` | Login session duration |
| `ALLOW_REGISTRATION` | `true` | Set to `false` to prevent new sign-ups |
| `SCAN_INTERVAL_MINUTES` | `60` | Auto-scan frequency (`0` to disable) |
| `MAX_SCAN_DEPTH` | `10` | How deep to recurse into subfolders |
| `FIRST_ADMIN_USERNAME` | — | Bootstrap an admin account on first startup |
| `FIRST_ADMIN_PASSWORD` | — | (used with the above) |
| `FIRST_ADMIN_EMAIL` | — | (used with the above) |

---

## Supported formats

Incastr serves files as-is — no transcoding. It supports:

`.mp4` `.mkv` `.avi` `.mov` `.webm` `.m4v` `.ts` `.flv` `.wmv` `.mpg` `.mpeg` `.m2ts` `.mts`

**H.264/MP4 plays natively in all browsers.** MKV and HEVC will play if your browser supports the codec. If a video doesn't play, consider re-encoding it to H.264/AAC in an MP4 container.

---

## Sharing

### Share a single video

Set a video's visibility to **Unlisted** and copy the share link. Anyone with the link can watch it — no account required.

### Share an entire category

In your library, hover over any category name in the left sidebar and click the link icon. Incastr generates a private share link for that whole category. You can:
- Copy the link to share it
- Disable it temporarily without deleting it
- Set an expiry date so it stops working automatically
- Delete it permanently

Recipients see a clean grid of all the videos in that category and can watch them without logging in.

---

## Tech stack

- **Backend** — Python 3.12, FastAPI, SQLAlchemy (async), SQLite, Alembic, ffmpeg
- **Frontend** — React 18, TypeScript, Vite, Tailwind CSS
- **Deployment** — Single Docker container, Docker Compose

---

## Development

```bash
# Backend
cd backend
pip install -r requirements.txt
uvicorn backend.main:app --reload

# Frontend
cd frontend
npm install
npm run dev
```

The frontend dev server proxies `/api` requests to `localhost:8000`.

---

## Deployment behind a reverse proxy

Incastr runs on port `8420` by default. Point Nginx Proxy Manager (or any reverse proxy) at that port and enable HTTPS. No special configuration needed — Incastr handles its own routing.

---

## License

MIT
