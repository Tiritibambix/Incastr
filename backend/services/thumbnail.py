import asyncio
import logging
import os
from pathlib import Path

from backend.config import get_settings

logger = logging.getLogger(__name__)

FFMPEG_TIMEOUT = 30  # seconds — kill ffmpeg if it hasn't finished
SCRUB_FRAME_COUNT = 10  # hover-scrub preview frames, spread across 10%-90% of duration


async def generate_thumbnail(video_path: str, user_id: str, video_id: str, duration: float | None = None) -> str | None:
    settings = get_settings()
    out_dir = Path(settings.thumbs_dir) / user_id
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / f"{video_id}.jpg"

    if duration is None:
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


async def generate_scrub_frames(video_path: str, user_id: str, video_id: str, duration: float | None) -> int:
    """Extract SCRUB_FRAME_COUNT evenly-spaced frames (10%-90% of duration) for hover-scrub previews.

    Returns the number of frames successfully generated.
    """
    if not duration or duration <= 0:
        return 0

    settings = get_settings()
    out_dir = Path(settings.thumbs_dir) / user_id / video_id
    out_dir.mkdir(parents=True, exist_ok=True)

    generated = 0
    for i in range(SCRUB_FRAME_COUNT):
        fraction = 0.1 + (i / (SCRUB_FRAME_COUNT - 1)) * 0.8
        offset = max(0, duration * fraction)
        out_path = out_dir / f"scrub_{i}.jpg"
        cmd = [
            "ffmpeg", "-y",
            "-ss", str(offset),
            "-i", video_path,
            "-frames:v", "1",
            "-q:v", "4",
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
                generated += 1
        except asyncio.TimeoutError:
            logger.warning("ffmpeg scrub-frame timed out for %s (frame=%s)", video_path, i)
            try:
                proc.kill()
                await proc.wait()
            except Exception:
                pass
        except Exception as exc:
            logger.debug("ffmpeg scrub-frame error for %s (frame=%s): %s", video_path, i, exc)

    return generated


async def generate_thumbnail_and_scrub(video_path: str, user_id: str, video_id: str) -> tuple[str | None, int]:
    """Generate the primary thumbnail plus hover-scrub preview frames in one pass.

    Shares a single ffprobe duration lookup between both to avoid probing twice.
    """
    duration = await _get_duration(video_path)
    thumb_path = await generate_thumbnail(video_path, user_id, video_id, duration=duration)
    scrub_count = await generate_scrub_frames(video_path, user_id, video_id, duration)
    return thumb_path, scrub_count


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
