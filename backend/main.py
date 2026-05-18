import asyncio
import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from backend.config import get_settings
from backend.routers import auth, folders, scan, tags, thumbnails, users, videos

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    if settings.scan_interval_minutes > 0:
        asyncio.create_task(_auto_scan_loop(settings.scan_interval_minutes))
    yield


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
                for folder in folder_list:
                    bt = BackgroundTasks()
                    await scan_folder(folder, db, bt)
                await db.commit()
        except Exception as e:
            logger.error("Auto-scan error: %s", e)


def create_app() -> FastAPI:
    app = FastAPI(title="Incastr", lifespan=lifespan)

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

    @app.get("/api/health")
    async def health():
        return {"status": "ok"}

    static_dir = Path(__file__).parent / "static"
    if static_dir.exists():
        app.mount("/assets", StaticFiles(directory=str(static_dir / "assets")), name="assets")

        @app.get("/{full_path:path}")
        async def spa_fallback(full_path: str):
            return FileResponse(str(static_dir / "index.html"))

    return app


app = create_app()
