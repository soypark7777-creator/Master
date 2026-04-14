from __future__ import annotations

import threading
import time

import cv2
import numpy as np


class MjpegFrameBuffer:
    """
    분석 스레드와 MJPEG 스트리밍 스레드 사이의 스레드 안전 단일 슬롯 버퍼.

    - 분석 스레드: put(frame_bgr) 호출
    - MJPEG 엔드포인트 스레드: get_jpeg() / last_updated() 호출
    """

    def __init__(self, jpeg_quality: int = 72) -> None:
        self._lock = threading.Lock()
        self._jpeg: bytes | None = None
        self._quality = jpeg_quality
        self._updated_at: float = 0.0

    def put(self, frame_bgr: np.ndarray) -> None:
        """JPEG으로 인코딩해서 버퍼에 저장한다."""
        ok, encoded = cv2.imencode(
            ".jpg", frame_bgr, [cv2.IMWRITE_JPEG_QUALITY, self._quality]
        )
        if not ok:
            return
        with self._lock:
            self._jpeg = encoded.tobytes()
            self._updated_at = time.monotonic()

    def get_jpeg(self) -> bytes | None:
        """가장 최근 JPEG 바이트를 반환한다. 없으면 None."""
        with self._lock:
            return self._jpeg

    def last_updated(self) -> float:
        """마지막 put() 호출 시각 (time.monotonic() 기준)."""
        with self._lock:
            return self._updated_at
