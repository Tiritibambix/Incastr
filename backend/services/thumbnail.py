import asyncio
import logging
import os
from pathlib import Path

from backend.config import get_settings

logger = logging.getLogger(__name__)

FFMPEG_TIMEOUT = 30  # seconds — kill ffmpeg if it hasn't finished


async def generate_thumbnail(video_path: str, user_id: str, video_id: str) -> str | None:
    settings = get_settings()
    out_dir = Path(settings.thumbs_dir) / user_id
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / f"{video_id}.jpg"

    duration = await _get_duration(video_path)
    smart_offset = max(1, int(duration * 0.1)) if duration and duration > 0 else None

    # Try several offsets — stop at the first that produces a file
    for offset in filter(None, [smart_offset, 10, 5, 1, 0]):
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
            await asyncio.wait_for(proc.wait(), timeout=FFMPEG_TIMEOUT)
            if proc.returncode == 0 and out_path.exists():
                return str(out_path)
        except asyncio.TimeoutError:
            logger.warning("ffmpeg timed out for %s (offset=%s), killing", video_path, offset)
            try:
                proc.kill()
                await proc.wait()
            except Exception:
                pass
        except Exception as exc:
            logger.debug("ffmpeg error for %s: %s", video_path, exc)

    return None


async def _get_duration(video_path: str) -> float | None:
    """Return video duration in seconds, or None if not determinable."""
    cmd = [
        "ffprobe", "-v", "error",
        # Ask for duration from both the container format AND individual streams
        "-show_entries", "format=duration:stream=duration",
        "-of", "default=noprint_wrappers=1:nokey=1",
        video_path,
    ]
    try:
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.DEVNULL,
        )
        stdout, _ = await asyncio.wait_for(
            proc.communicate(), timeout=FFMPEG_TIMEOUT
        )
        for line in stdout.decode().splitlines():
            line = line.strip()
            if not line or line.lower() == "n/a":
                continue
            try:
                val = float(line)
                if val > 0:
                    return val
            except ValueError:
                continue
    except asyncio.TimeoutError:
        logger.warning("ffprobe timed out for %s", video_path)
        try:
            proc.kill()
            await proc.wait()
        except Exception:
            pass
    except Exception as exc:
        logger.debug("ffprobe error for %s: %s", video_path, exc)
    return None


async def get_video_metadata(video_path: str) -> dict:
    cmd = [
        "ffprobe", "-v", "error",
        "-show_entries", "format=duration,size:stream=duration",
        "-of", "default=noprint_wrappers=1",
        video_path,
    ]
    result: dict = {"duration_seconds": None, "file_size_bytes": None}
    try:
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.DEVNULL,
        )
        stdout, _ = await asyncio.wait_for(proc.communicate(), timeout=FFMPEG_TIMEOUT)
        for line in stdout.decode().splitlines():
            if "=" not in line:
                continue
            k, v = line.split("=", 1)
            v = v.strip()
            if k == "duration" and result["duration_seconds"] is None:
                if v and v.lower() != "n/a":
                    try:
                        result["duration_seconds"] = int(float(v))
                    except ValueError:
                        pass
            elif k == "size":
                try:
                    result["file_size_bytes"] = int(v)
                except ValueError:
                    pass
    except asyncio.TimeoutError:
        logger.warning("ffprobe metadata timed out for %s", video_path)
    except Exception as exc:
        logger.debug("ffprobe metadata error for %s: %s", video_path, exc)

    if result["file_size_bytes"] is None:
        try:
            result["file_size_bytes"] = os.path.getsize(video_path)
        except OSError:
            pass
    return result
