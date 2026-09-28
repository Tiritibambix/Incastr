import asyncio
import html
import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from backend.config import get_settings
from backend.routers import (
    auth,
    category_shares,
    folders,
    og,
    scan,
    tags,
    thumbnails,
    users,
    videos,
)

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    await _bootstrap_admin(settings)
    await _bootstrap_media_dir(settings)
    await _start_watchers()
    if settings.scan_interval_minutes > 0:
        asyncio.create_task(_auto_scan_loop(settings.scan_interval_minutes))
    yield
    from backend.services.watcher import stop_watcher

    stop_watcher()


async def _bootstrap_admin(settings):
    if not (settings.first_admin_username and settings.first_admin_password and settings.first_admin_email):
        return
    import uuid

    from sqlalchemy import select

    from backend.core.auth import hash_password
    from backend.database import AsyncSessionLocal
    from backend.models.user import User

    async with AsyncSessionLocal() as db:
        existing = await db.execute(
            select(User).where(User.username == settings.first_admin_username)
        )
        if existing.scalar_one_or_none():
            return
        admin = User(
            id=str(uuid.uuid4()),
            username=settings.first_admin_username,
            email=settings.first_admin_email,
            hashed_password=hash_password(settings.first_admin_password),
            is_admin=True,
        )
        db.add(admin)
        await db.commit()
        logger.info("Bootstrap admin created: %s", settings.first_admin_username)


async def _bootstrap_media_dir(settings):
    if not settings.media_dir:
        return
    import uuid
    from pathlib import Path as SysPath

    from sqlalchemy import select

    from backend.database import AsyncSessionLocal
    from backend.models.folder import Folder
    from backend.models.user import User

    if not SysPath(settings.media_dir).is_dir():
        logger.warning("MEDIA_DIR %s does not exist or is not a directory", settings.media_dir)
        return

    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User).where(User.is_admin == True))  # noqa: E712
        admins = result.scalars().all()
        for admin in admins:
            existing = await db.execute(
                select(Folder).where(Folder.user_id == admin.id, Folder.path == settings.media_dir)
            )
            if existing.scalar_one_or_none():
                continue
            db.add(Folder(
                id=str(uuid.uuid4()),
                user_id=admin.id,
                path=settings.media_dir,
                label="Videos",
            ))
            logger.info("Auto-configured MEDIA_DIR %s for admin %s", settings.media_dir, admin.username)
        await db.commit()


async def _start_watchers():
    from sqlalchemy import select

    from backend.database import AsyncSessionLocal
    from backend.models.folder import Folder
    from backend.services.watcher import start_watcher

    loop = asyncio.get_running_loop()
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Folder))
        folder_list = result.scalars().all()
        for folder in folder_list:
            start_watcher(folder.user_id, folder.id, folder.path, loop)


def _spa_page_with_meta(
    index_html: str, *, title: str, description: str | None, image_url: str, page_url: str
) -> str:
    """Inject Open Graph / Twitter Card meta tags into the SPA's index.html for social-media crawlers.

    Real browsers get the identical bundle; React Router takes over on load. Crawlers (WhatsApp,
    iMessage, Facebook, etc.) don't execute JS, so this server-rendered pass is what they see.
    """
    safe_title = html.escape(title)
    safe_image = html.escape(image_url)
    safe_page_url = html.escape(page_url)
    description_tags = ""
    if description:
        safe_description = html.escape(description)
        description_tags = (
            f'<meta property="og:description" content="{safe_description}" />\n'
            f'<meta name="twitter:description" content="{safe_description}" />\n'
        )
    meta_tags = (
        f'<meta property="og:title" content="{safe_title}" />\n'
        f"{description_tags}"
        f'<meta property="og:image" content="{safe_image}" />\n'
        f'<meta property="og:image:width" content="1200" />\n'
        f'<meta property="og:image:height" content="630" />\n'
        f'<meta property="og:url" content="{safe_page_url}" />\n'
        f'<meta property="og:type" content="website" />\n'
        f'<meta name="twitter:card" content="summary_large_image" />\n'
        f'<meta name="twitter:title" content="{safe_title}" />\n'
        f'<meta name="twitter:image" content="{safe_image}" />\n'
    )
    return index_html.replace("<title>Incastr</title>", f"<title>{safe_title}</title>\n{meta_tags}")


async def _auto_scan_loop(interval_minutes: int):
    from fastapi import BackgroundTasks
    from sqlalchemy import select

    from backend.database import AsyncSessionLocal
    from backend.models.folder import Folder
    from backend.services.scanner import scan_folder

    while True:
        await asyncio.sleep(interval_minutes * 60)
        try:
            async with AsyncSessionLocal() as db:
                result = await db.execute(select(Folder))
                folder_list = result.scalars().all()
                bt = BackgroundTasks()
                for folder in folder_list:
                    await scan_folder(folder, db, bt)
                await db.commit()
                for task in bt.tasks:
                    await task()
        except Exception as e:
            logger.error("Auto-scan error: %s", e)


def create_app() -> FastAPI:
    app = FastAPI(title="Incastr", lifespan=lifespan, redirect_slashes=False)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(auth.router)
    app.include_router(users.router)
    app.include_router(videos.router)
    app.include_router(folders.router)
    app.include_router(tags.router)
    app.include_router(scan.router)
    app.include_router(thumbnails.router)
    app.include_router(category_shares.router)
    app.include_router(og.router)

    @app.get("/api/health")
    async def health():
        return {"status": "ok"}

    static_dir = Path(__file__).parent / "static"
    if static_dir.exists():
        app.mount("/assets", StaticFiles(directory=str(static_dir / "assets")), name="assets")

        # Serve favicon and other root-level static files
        for static_file in ("favicon.ico", "favicon.svg", "robots.txt"):
            if (static_dir / static_file).exists():
                _path = static_file

                @app.get(f"/{_path}")
                async def _serve_static(p=_path):
                    return FileResponse(str(static_dir / p))

        @app.api_route("/share/{token}", methods=["GET", "HEAD"])
        async def share_page_meta(token: str, request: Request):
            from sqlalchemy import select

            from backend.database import AsyncSessionLocal
            from backend.models.video import Video, Visibility

            async with AsyncSessionLocal() as db:
                result = await db.execute(
                    select(Video).where(Video.share_token == token, Video.visibility == Visibility.unlisted)
                )
                video = result.scalar_one_or_none()

            index_html = (static_dir / "index.html").read_text(encoding="utf-8")
            if not video:
                return HTMLResponse(index_html)

            base = str(request.base_url).rstrip("/")
            page = _spa_page_with_meta(
                index_html,
                title=video.title,
                description=video.description,
                image_url=f"{base}/api/og/video/{token}.jpg",
                page_url=f"{base}/share/{token}",
            )
            return HTMLResponse(page)

        @app.api_route("/c/{token}", methods=["GET", "HEAD"])
        async def category_share_page_meta(token: str, request: Request):
            from sqlalchemy import select

            from backend.database import AsyncSessionLocal
            from backend.models.category_share import CategoryShare

            async with AsyncSessionLocal() as db:
                result = await db.execute(select(CategoryShare).where(CategoryShare.token == token))
                share = result.scalar_one_or_none()

            index_html = (static_dir / "index.html").read_text(encoding="utf-8")
            if not share or not share.is_valid():
                return HTMLResponse(index_html)

            base = str(request.base_url).rstrip("/")
            page = _spa_page_with_meta(
                index_html,
                title=share.name or share.category,
                description=f"A shared video collection: {share.category}",
                image_url=f"{base}/api/og/category/{token}.jpg",
                page_url=f"{base}/c/{token}",
            )
            return HTMLResponse(page)

        @app.exception_handler(404)
        async def spa_fallback(request: Request, exc: Exception):
            # Let API 404s return JSON
            if request.url.path.startswith("/api"):
                return JSONResponse({"detail": "Not found"}, status_code=404)
            return FileResponse(str(static_dir / "index.html"))

    return app


app = create_app()
