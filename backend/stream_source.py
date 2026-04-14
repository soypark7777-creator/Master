from __future__ import annotations

import os
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, Iterator

import cv2

try:
    from yt_dlp import YoutubeDL
    from yt_dlp.utils import DownloadError
except ImportError:  # pragma: no cover
    YoutubeDL = None
    DownloadError = Exception


@dataclass
class CapturedFrame:
    frame_bgr: Any
    frame_index: int
    elapsed_seconds: float
    fps: float


class StreamSourceError(RuntimeError):
    pass


@dataclass
class _ResolvedInfo:
    """Result of yt-dlp URL resolution."""
    url: str
    width: int
    height: int
    fps: float
    http_headers: Dict[str, str]


class YouTubeStreamResolver:
    _BASE_OPTS = {
        "quiet": True,
        "no_warnings": True,
        # Prefer a single progressive MP4 stream so OpenCV can seek normally.
        # Falls back to best available if no single-stream mp4 exists.
        "format": "best[ext=mp4][height<=1080]/best[ext=mp4]/best[height<=1080]/best",
    }

    def resolve(self, source_url: str) -> str:
        """Return just the resolved playback URL (backward-compatible)."""
        return self._resolve_info(source_url).url

    def resolve_full(self, source_url: str) -> _ResolvedInfo:
        """Return resolved URL together with dimensions, fps, and HTTP headers."""
        return self._resolve_info(source_url)

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _resolve_info(self, source_url: str) -> _ResolvedInfo:
        if not source_url:
            raise StreamSourceError("A stream URL is required.")

        # Webcam index
        if source_url.isdigit():
            return _ResolvedInfo(url=source_url, width=0, height=0, fps=0.0, http_headers={})

        # Local file
        path = Path(source_url)
        if path.exists():
            return _ResolvedInfo(url=str(path), width=0, height=0, fps=0.0, http_headers={})

        # Non-YouTube HTTP stream — pass through as-is
        if "youtube.com" not in source_url and "youtu.be" not in source_url:
            return _ResolvedInfo(url=source_url, width=0, height=0, fps=0.0, http_headers={})

        # --- YouTube ---
        if YoutubeDL is None:
            raise StreamSourceError("yt-dlp is not installed.")

        return self._extract_youtube(source_url)

    def _extract_youtube(self, source_url: str) -> _ResolvedInfo:
        # Attempt 1: default (short timeout, honours any legitimate system proxy).
        # Attempt 2: bypass system proxy (fixes WinError 10061 / dead local proxy).
        short = {**self._BASE_OPTS, "socket_timeout": 10, "retries": 1, "extractor_retries": 1}
        long = {**self._BASE_OPTS, "socket_timeout": 30, "retries": 3, "extractor_retries": 3}
        attempts = [short, {**long, "proxy": ""}]

        last_error: Exception | None = None
        for opts in attempts:
            try:
                with YoutubeDL(opts) as ydl:
                    info = ydl.extract_info(source_url, download=False)
                stream_url = info.get("url") or ""
                if not stream_url:
                    raise StreamSourceError("yt-dlp could not find a playable stream URL.")
                return _ResolvedInfo(
                    url=stream_url,
                    width=int(info.get("width") or 0),
                    height=int(info.get("height") or 0),
                    fps=float(info.get("fps") or 30.0),
                    http_headers=dict(info.get("http_headers") or {}),
                )
            except DownloadError as error:
                last_error = error
                # WinError 10061 = connection refused by a dead local proxy → retry without proxy
                if "10061" in str(error) or "connection refused" in str(error).lower():
                    continue
                raise StreamSourceError(
                    f"yt-dlp could not resolve the YouTube stream: {error}"
                ) from error
            except StreamSourceError:
                raise
            except Exception as error:
                raise StreamSourceError(f"Unexpected yt-dlp error: {error}") from error

        raise StreamSourceError(
            f"yt-dlp could not resolve the YouTube stream (tried with/without proxy): {last_error}"
        ) from last_error


class OpenCVFrameReader:
    def __init__(self, resolver: YouTubeStreamResolver | None = None) -> None:
        self._resolver = resolver or YouTubeStreamResolver()

    def frames(self, source_url: str) -> Iterator[CapturedFrame]:
        is_youtube = "youtube.com" in source_url or "youtu.be" in source_url

        if is_youtube:
            info = self._resolver.resolve_full(source_url)
            yield from self._open_youtube_stream(info, source_url)
        else:
            resolved = self._resolver.resolve(source_url)
            target = int(resolved) if resolved.isdigit() else resolved
            cap = cv2.VideoCapture(target)
            if not cap.isOpened():
                raise StreamSourceError(f"Could not open stream source: {source_url}")
            yield from self._read_frames(cap)

    # ------------------------------------------------------------------
    # YouTube-specific opening with FFmpeg backend + HTTP headers
    # ------------------------------------------------------------------

    def _open_youtube_stream(
        self, info: _ResolvedInfo, original_url: str
    ) -> Iterator[CapturedFrame]:
        """
        Open a googlevideo.com URL with OpenCV's FFmpeg backend.

        Two issues prevented the default VideoCapture from working:
        1. The default backend treats the URL as an image-sequence pattern
           (because of query-string characters like '?', '=', '&').
           Forcing cv2.CAP_FFMPEG fixes this.
        2. YouTube's stream URLs work best when the same HTTP headers
           yt-dlp used are forwarded to FFmpeg (User-Agent, Accept, …).
           We pass them via the OPENCV_FFMPEG_CAPTURE_OPTIONS env variable.
        """
        stream_url = info.url

        # Build the FFmpeg headers string: "Key: Value\r\n" per header
        header_str = "".join(
            f"{k}: {v}\r\n" for k, v in info.http_headers.items()
        )

        prev_opts = os.environ.get("OPENCV_FFMPEG_CAPTURE_OPTIONS")
        try:
            if header_str:
                os.environ["OPENCV_FFMPEG_CAPTURE_OPTIONS"] = f"headers;{header_str}"

            # cv2.CAP_FFMPEG forces the FFmpeg backend — avoids the image-pattern parser
            cap = cv2.VideoCapture(stream_url, cv2.CAP_FFMPEG)
        finally:
            # Restore / remove the env var so other captures aren't affected
            if prev_opts is None:
                os.environ.pop("OPENCV_FFMPEG_CAPTURE_OPTIONS", None)
            else:
                os.environ["OPENCV_FFMPEG_CAPTURE_OPTIONS"] = prev_opts

        if not cap.isOpened():
            raise StreamSourceError(
                f"Could not open YouTube stream (OpenCV/FFmpeg backend failed). "
                f"Original URL: {original_url}"
            )

        yield from self._read_frames(cap)

    # ------------------------------------------------------------------
    # Frame-reading loop (shared between YouTube and local/generic sources)
    # ------------------------------------------------------------------

    def _read_frames(self, capture: cv2.VideoCapture) -> Iterator[CapturedFrame]:
        started_at = time.perf_counter()
        frame_index = 0

        try:
            fps = float(capture.get(cv2.CAP_PROP_FPS) or 0.0)
            while True:
                ok, frame_bgr = capture.read()
                if not ok or frame_bgr is None:
                    break

                frame_index += 1
                position_ms = capture.get(cv2.CAP_PROP_POS_MSEC)
                elapsed_seconds = (
                    position_ms / 1000.0
                    if position_ms > 0
                    else time.perf_counter() - started_at
                )
                if fps <= 0:
                    runtime = max(time.perf_counter() - started_at, 0.001)
                    fps = frame_index / runtime

                yield CapturedFrame(
                    frame_bgr=frame_bgr,
                    frame_index=frame_index,
                    elapsed_seconds=elapsed_seconds,
                    fps=fps,
                )
        finally:
            capture.release()
