import asyncio
import logging
from pathlib import Path

from watchdog.events import FileSystemEventHandler
from watchdog.observers import Observer

logger = logging.getLogger(__name__)

VIDEO_EXTENSIONS = {".mp4", ".mkv", ".avi", ".mov", ".webm"}
_observer: Observer | None = None


class VideoEventHandler(FileSystemEventHandler):
    def __init__(self, user_id: str, folder_id: str, loop: asyncio.AbstractEventLoop):
        self.user_id = user_id
        self.folder_id = folder_id
        self.loop = loop

    def on_created(self, event):
        if not event.is_directory:
            path = Path(event.src_path)
            if path.suffix.lower() in VIDEO_EXTENSIONS:
                asyncio.run_coroutine_threadsafe(
                    self._handle_new_file(str(path)), self.loop
                )

    def on_moved(self, event):
        if not event.is_directory:
            path = Path(event.dest_path)
            if path.suffix.lower() in VIDEO_EXTENSIONS:
                asyncio.run_coroutine_threadsafe(
                    self._handle_new_file(str(path)), self.loop
                )

    async def _handle_new_file(self, filepath: str):
        from fastapi import BackgroundTasks
        from sqlalchemy import select

        from backend.database import AsyncSessionLocal
        from backend.models.folder import Folder
        from backend.services.scanner import scan_folder

        async with AsyncSessionLocal() as db:
            result = await db.execute(select(Folder).where(Folder.id == self.folder_id))
            folder = result.scalar_one_or_none()
            if folder:
                bt = BackgroundTasks()
                await scan_folder(folder, db, bt)
                await db.commit()
                for task in bt.tasks:
                    await task()


def start_watcher(user_id: str, folder_id: str, path: str, loop: asyncio.AbstractEventLoop):
    global _observer
    if _observer is None:
        _observer = Observer()
        _observer.start()
    handler = VideoEventHandler(user_id, folder_id, loop)
    _observer.schedule(handler, path, recursive=True)
    logger.info("Watching %s for user %s", path, user_id)


def stop_watcher():
    global _observer
    if _observer:
        _observer.stop()
        _observer.join()
        _observer = None
