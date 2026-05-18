import asyncio
import os
from pathlib import Path

from backend.config import get_settings


async def generate_thumbnail(video_path: str, user_id: str, video_id: str) -> str | None:
    settings = get_settings()
    out_dir = Path(settings.thumbs_dir) / user_id
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / f"{video_id}.jpg"

    duration = await _get_duration(video_path)
    if duration is None:
        return None
    offset = max(1, int(duration * 0.1))

    cmd = [
        "ffmpeg", "-y",
        "-ss", str(offset),
        "-i", video_path,
        "-frames:v", "1",
        "-q:v", "2",
        str(out_path),
    ]
    try:
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.DEVNULL,
            stderr=asyncio.subprocess.DEVNULL,
        )
        await proc.wait()
        if proc.returncode == 0 and out_path.exists():
            return str(out_path)
    except Exception:
        pass
    return None


async def _get_duration(video_path: str) -> float | None:
    cmd = [
        "ffprobe", "-v", "error",
        "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1",
        video_path,
    ]
    try:
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.DEVNULL,
        )
        stdout, _ = await proc.communicate()
        return float(stdout.decode().strip())
    except Exception:
        return None


async def get_video_metadata(video_path: str) -> dict:
    cmd = [
        "ffprobe", "-v", "error",
        "-show_entries", "format=duration,size",
        "-of", "default=noprint_wrappers=1",
        video_path,
    ]
    result = {"duration_seconds": None, "file_size_bytes": None}
    try:
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.DEVNULL,
        )
        stdout, _ = await proc.communicate()
        for line in stdout.decode().splitlines():
            if "=" in line:
                k, v = line.split("=", 1)
                if k == "duration":
                    try:
                        result["duration_seconds"] = int(float(v))
                    except ValueError:
                        pass
                elif k == "size":
                    try:
                        result["file_size_bytes"] = int(v)
                    except ValueError:
                        pass
    except Exception:
        pass
    if result["file_size_bytes"] is None:
        try:
            result["file_size_bytes"] = os.path.getsize(video_path)
        except OSError:
            pass
    return result
