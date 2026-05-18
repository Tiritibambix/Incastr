# Incastr — CLAUDE.md

## Project overview

Incastr is a self-hosted, YouTube-like personal video library.
Each user manages their own video collection: they configure folders to scan on the server, and Incastr indexes those videos, generates thumbnails, and presents them in a searchable, tagged interface.

This document is the authoritative reference for any AI session working on this codebase.

---

## Stack

### Backend
- **Python 3.12+**
- **FastAPI** — async, typed, JWT auth built-in
- **SQLite** via **SQLAlchemy 2.x** (async) — single file, no external DB
- **Alembic** — database migrations
- **FFmpeg** (via `ffmpeg-python` or direct subprocess) — thumbnail generation
- **Watchdog** — filesystem watcher for auto-scan
- **Passlib + python-jose** — password hashing and JWT tokens
- **Pydantic v2** — request/response validation

### Frontend
- **React 18 + Vite**
- **TypeScript**
- **Tailwind CSS**
- Video playback via native HTML5 `<video>` tag — no external player library

### Infrastructure
- **Single Docker container** — backend serves both API and built frontend static files
- **Docker Compose** — with bind mounts for video folders and config
- **Nginx Proxy Manager** — reverse proxy, TLS termination (external, not included in this repo)
- Deployed on **Transporter (192.168.1.104)**, Debian, Docker/Portainer
- Exposed via subdomain on `steph.click`

---

## Repository structure

```
incastr/
├── backend/
│   ├── main.py                  # FastAPI app entrypoint
│   ├── config.py                # Settings (env vars, paths)
│   ├── database.py              # SQLAlchemy async engine + session
│   ├── models/
│   │   ├── user.py
│   │   ├── video.py
│   │   ├── tag.py
│   │   └── folder.py
│   ├── schemas/
│   │   ├── user.py
│   │   ├── video.py
│   │   ├── tag.py
│   │   └── folder.py
│   ├── routers/
│   │   ├── auth.py              # Login, register, JWT
│   │   ├── users.py             # User management (admin)
│   │   ├── videos.py            # CRUD, search, visibility
│   │   ├── folders.py           # Folder config per user
│   │   ├── tags.py              # Tag management
│   │   ├── scan.py              # Manual + auto scan endpoints
│   │   └── thumbnails.py        # Thumbnail serving
│   ├── services/
│   │   ├── scanner.py           # Folder scan logic
│   │   ├── thumbnail.py         # FFmpeg thumbnail generation
│   │   ├── search.py            # Full-text search logic
│   │   └── watcher.py           # Watchdog filesystem watcher
│   ├── core/
│   │   ├── auth.py              # JWT creation/verification, password hashing
│   │   ├── dependencies.py      # FastAPI dependency injection (current_user, etc.)
│   │   └── exceptions.py        # Custom HTTP exceptions
│   └── alembic/
│       ├── env.py
│       └── versions/
├── frontend/
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── api/                 # Axios API client functions
│   │   ├── components/
│   │   │   ├── VideoCard.tsx
│   │   │   ├── VideoPlayer.tsx
│   │   │   ├── TagBadge.tsx
│   │   │   ├── SearchBar.tsx
│   │   │   └── ...
│   │   ├── pages/
│   │   │   ├── Login.tsx
│   │   │   ├── Home.tsx         # Video grid / search results
│   │   │   ├── VideoDetail.tsx  # Player + metadata + tags
│   │   │   ├── Settings.tsx     # Folder config, scan trigger
│   │   │   └── Admin.tsx        # User management (admin only)
│   │   ├── store/               # Zustand or React Context state
│   │   └── types/               # TypeScript types mirroring backend schemas
│   ├── index.html
│   ├── vite.config.ts
│   └── tailwind.config.ts
├── Dockerfile
├── docker-compose.yml
├── docker-compose.override.yml  # Local bind mount overrides
├── .env.example
└── CLAUDE.md                    # This file
```

---

## Data model

### User
| Field | Type | Notes |
|---|---|---|
| id | UUID | primary key |
| username | str | unique |
| email | str | unique |
| hashed_password | str | bcrypt |
| is_admin | bool | default false |
| created_at | datetime | |

### Folder
| Field | Type | Notes |
|---|---|---|
| id | UUID | primary key |
| user_id | UUID | FK → User |
| path | str | absolute path on server |
| label | str | display name |
| created_at | datetime | |

### Video
| Field | Type | Notes |
|---|---|---|
| id | UUID | primary key |
| user_id | UUID | FK → User |
| folder_id | UUID | FK → Folder |
| filepath | str | absolute path on server |
| filename | str | |
| title | str | defaults to filename without extension |
| description | str | nullable |
| category | str | derived from relative folder path within the scanned folder |
| visibility | enum | `private`, `public`, `unlisted` |
| share_token | str | unique random token for unlisted links |
| thumbnail_path | str | path to generated thumbnail |
| duration_seconds | int | extracted by ffmpeg |
| file_size_bytes | int | |
| mime_type | str | |
| created_at | datetime | |
| updated_at | datetime | |
| last_scanned_at | datetime | |

### Tag
| Field | Type | Notes |
|---|---|---|
| id | UUID | primary key |
| name | str | unique per user |
| user_id | UUID | FK → User |

### VideoTag (association)
| Field | Type | Notes |
|---|---|---|
| video_id | UUID | FK → Video |
| tag_id | UUID | FK → Tag |

---

## Authentication and authorization

- JWT Bearer tokens, stored in localStorage on the frontend
- Token expiry: configurable via `ACCESS_TOKEN_EXPIRE_MINUTES` env var (default: 60)
- All `/api/*` routes require a valid JWT except:
  - `POST /api/auth/login`
  - `POST /api/auth/register` (if registration is open)
  - `GET /api/videos/share/{share_token}` (unlisted anonymous access)
- Users only access their own videos, folders, and tags — enforced at query level, not just route level
- Admin users can access `/api/admin/*` routes for user management

---

## Video visibility

Three visibility states per video:

- **private** — visible only to the owner when logged in
- **public** — visible to all authenticated users of the instance
- **unlisted** — not listed anywhere, but accessible via a unique share URL: `/share/{share_token}`. This URL works without authentication (anonymous access).

Share tokens are generated as `secrets.token_urlsafe(32)` at video creation and never change.

---

## Folder scan logic

1. User configures one or more absolute server paths via the UI (Settings page)
2. Scan (manual or auto) walks the configured folders recursively
3. For each video file found (`.mp4`, `.mkv`, `.avi`, `.mov`, `.webm`):
   - If not in DB: insert new Video record
   - If already in DB: update `last_scanned_at`, check if file still exists
   - If in DB but file no longer exists: mark as missing (do not delete)
4. Category is derived from the relative path of the file within the scanned folder root (e.g. `tutorials/docker/compose` → category `tutorials/docker/compose`)
5. Thumbnail is generated async after insert if not already present
6. Auto-scan uses Watchdog to watch configured folders for `created`/`deleted`/`moved` events

---

## Thumbnail generation

- Generated by FFmpeg, frame extracted at 10% of video duration
- Stored in a dedicated thumbs directory: `THUMBS_DIR/{user_id}/{video_id}.jpg`
- `THUMBS_DIR` is configurable via env var, defaults to `/data/thumbs` inside the container
- Served by FastAPI at `/api/thumbnails/{user_id}/{video_id}.jpg`
- Generation runs in a background task (FastAPI `BackgroundTasks`) to avoid blocking the scan response

---

## Search

Full-text search across: `title`, `description`, `category`, `tags` (joined).

- Implemented in SQLite using `LIKE` queries (no FTS5 extension required, but FTS5 can be added later)
- Optional filters via query params: `?q=docker&field=tags` where `field` can be `title`, `description`, `category`, `tags`, or omitted for full-text across all fields
- Search is always scoped to the authenticated user's own videos

---

## Video serving

- Videos are served as static files via FastAPI `FileResponse` with range request support (required for browser video seeking)
- Route: `GET /api/videos/{video_id}/stream`
- Only the owner can stream their own videos (except unlisted via share token)
- No transcoding — direct file serving only. H.264/mp4 is the primary supported format. MKV and other containers will play if the browser supports the codec natively.

---

## Docker

### Dockerfile
- Multi-stage build: Node (frontend build) + Python (backend)
- Final image: Python slim, includes ffmpeg installed via apt
- Frontend build artifacts copied into `backend/static/`
- FastAPI serves static files from `/static` and mounts the React app at `/`
- Entrypoint runs Alembic migrations then starts Uvicorn

### docker-compose.yml
```yaml
services:
  incastr:
    image: tiritibambix/incastr:latest
    container_name: incastr
    restart: unless-stopped
    ports:
      - "8420:8000"
    volumes:
      - /srv/dev-disk-by-uuid-XXXX/Incastr/config:/data
      - /srv/dev-disk-by-uuid-XXXX/Incastr/thumbs:/data/thumbs
      # video folders mounted read-only — users configure paths via UI
      # add as many as needed:
      # - /srv/dev-disk-by-uuid-XXXX/Videos:/media/videos:ro
    environment:
      - SECRET_KEY=changeme
      - DATABASE_URL=sqlite+aiosqlite:////data/incastr.db
      - THUMBS_DIR=/data/thumbs
      - ACCESS_TOKEN_EXPIRE_MINUTES=60
      - ALLOW_REGISTRATION=true
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
```

### docker-compose.override.yml
Used for local bind mount customization. Never commit secrets here.

---

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `SECRET_KEY` | required | JWT signing key — set a strong random value |
| `DATABASE_URL` | `sqlite+aiosqlite:////data/incastr.db` | SQLite DB path |
| `THUMBS_DIR` | `/data/thumbs` | Thumbnail storage directory |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `60` | JWT expiry |
| `ALLOW_REGISTRATION` | `true` | Set to `false` to disable new user registration |
| `MAX_SCAN_DEPTH` | `10` | Maximum folder recursion depth during scan |
| `SCAN_INTERVAL_MINUTES` | `60` | Auto-scan interval (0 = disabled) |

---

## Conventions

- All code comments, commit messages, UI text, and README content in **English**
- No accents in code or scripts
- Commit format: short title (imperative) + blank line + description
- Only modified files delivered per session — no full zips unless explicitly requested
- Pydantic v2 syntax throughout (no v1 compat shims)
- SQLAlchemy 2.x style (`select()`, `session.execute()`, async) — no legacy `Query` API
- UUIDs as primary keys everywhere (use `uuid.uuid4`)
- All routes prefixed with `/api/`
- Frontend API calls via a centralized Axios instance in `src/api/client.ts` with JWT interceptor
- No inline styles in React — Tailwind classes only
- TypeScript strict mode enabled

---

## Security notes

- Passwords hashed with bcrypt (passlib)
- JWT secret must be set via env var — no hardcoded default in production
- Video stream and thumbnail routes enforce ownership at the query level
- Share tokens are cryptographically random (`secrets.token_urlsafe(32)`)
- Folder paths configured by users are validated to ensure they exist and are readable before saving
- Admin-only routes protected by `is_admin` check in dependency, not just by obscurity
- CORS configured to allow only the frontend origin in production

---

## Known constraints

- No transcoding — serves files as-is. H.264/mp4 works in all modern browsers. MKV/HEVC may not play on all clients.
- SQLite is single-writer — fine for personal/small multi-user use, not for high concurrency
- Watchdog filesystem watcher runs inside the container — video folders must be mounted into the container to be watched
- Thumbnail generation requires ffmpeg in the container image

---

## GitHub Actions

CI/CD publishes Docker image to Docker Hub as `tiritibambix/incastr`.

Workflow:
- Trigger: push to `main`
- Steps: lint (ruff + eslint) → test → Docker build → push to Docker Hub
- Permissions: `contents: read` only
- Pinned action SHAs (no floating tags)
