from __future__ import annotations

import logging
import time
from typing import TYPE_CHECKING, Dict, Iterator, Optional

from backend.config import ConfigStore, RuntimeConfig
from backend.detectors.crowd_detector import CrowdDetector
from backend.detectors.fx_detector import FxDetector
from backend.detectors.pose_detector import PoseDetector
from backend.detectors.singing_detector import SingingDetector
from backend.stream_source import OpenCVFrameReader, StreamSourceError
from backend.utils.image_preprocess import ImagePreprocessor
from backend.utils.timecode import format_timestamp

if TYPE_CHECKING:
    from backend.utils.frame_buffer import MjpegFrameBuffer

LOGGER = logging.getLogger(__name__)


class VisionEngine:
    def __init__(
        self,
        config_store: ConfigStore,
        frame_reader: OpenCVFrameReader | None = None,
        pose_detector: PoseDetector | None = None,
        singing_detector: SingingDetector | None = None,
        fx_detector: FxDetector | None = None,
        crowd_detector: CrowdDetector | None = None,
        preprocessor: ImagePreprocessor | None = None,
        frame_buffer: "MjpegFrameBuffer | None" = None,
    ) -> None:
        self._config_store = config_store
        self._frame_reader = frame_reader or OpenCVFrameReader()
        self._pose_detector = pose_detector or PoseDetector()
        self._singing_detector = singing_detector or SingingDetector()
        self._fx_detector = fx_detector or FxDetector()
        self._crowd_detector = crowd_detector or CrowdDetector()
        self._preprocessor = preprocessor or ImagePreprocessor()
        self._frame_buffer = frame_buffer

    def diagnostics(self) -> Dict[str, object]:
        return {
            "pose_engine": self._pose_detector.get_status(),
            "config": self._config_store.get().__dict__,
        }

    def stream(
        self,
        source_url: Optional[str] = None,
        confidence: Optional[float] = None,
        tracking_confidence: Optional[float] = None,
    ) -> Iterator[Dict[str, object]]:
        runtime_config = self._build_runtime_config(confidence, tracking_confidence)
        if not source_url:
            yield from self._idle_stream(runtime_config)
            return

        try:
            frame_emitted = False
            for captured_frame in self._frame_reader.frames(source_url):
                frame_emitted = True
                started_at = time.perf_counter()
                try:
                    processed_frame, metrics = self._preprocessor.process(
                        captured_frame.frame_bgr
                    )
                    pose_result = self._pose_detector.process(
                        processed_frame,
                        runtime_config.min_detection_confidence,
                        runtime_config.min_tracking_confidence,
                    )
                    singing_result = self._singing_detector.process(
                        pose_result.pose_landmarks
                    )
                    fx_result = self._fx_detector.process(
                        processed_frame, metrics, runtime_config
                    )
                    crowd_result = self._crowd_detector.process(processed_frame)

                    # 분석된 프레임을 MJPEG 버퍼에 넣어 /api/video-feed 에서 서빙
                    if self._frame_buffer is not None:
                        self._frame_buffer.put(captured_frame.frame_bgr)

                    processing_seconds = max(time.perf_counter() - started_at, 0.001)
                    payload = {
                        "artist_detected": pose_result.artist_detected,
                        "pose_landmarks": pose_result.pose_landmarks,
                        "face_box": pose_result.face_box,
                        "frame_size": {
                            "width": int(captured_frame.frame_bgr.shape[1]),
                            "height": int(captured_frame.frame_bgr.shape[0]),
                        },
                        "is_singing": singing_result.is_singing,
                        "singing_confidence": singing_result.confidence,
                        "fx_events": fx_result.as_dict(),
                        "frame_metrics": metrics.as_dict(),
                        "fan_count": crowd_result.glowstick_count,
                        "crowd_density": crowd_result.crowd_density,
                        "confidence_score": round(pose_result.confidence_score, 3),
                        "processing_fps": round(1.0 / processing_seconds, 2),
                        "timestamp": format_timestamp(captured_frame.elapsed_seconds),
                    }
                    yield payload
                except Exception as error:  # pragma: no cover - resilience path
                    LOGGER.exception("Frame analysis failed: %s", error)
                    yield {
                        **self._idle_payload(
                            runtime_config,
                            format_timestamp(captured_frame.elapsed_seconds),
                            stream_error=f"Frame analysis failed: {error}",
                        ),
                        "processing_fps": round(captured_frame.fps, 2),
                    }
            if not frame_emitted:
                LOGGER.warning("Stream ended before any frames were emitted: %s", source_url)
                yield from self._idle_stream(
                    runtime_config,
                    stream_error="No frames were received from the stream source.",
                )
            else:
                LOGGER.warning("Stream ended or disconnected: %s", source_url)
                yield from self._idle_stream(
                    runtime_config,
                    stream_error="The stream ended or disconnected. Check the YouTube URL or stream availability.",
                )
        except StreamSourceError as error:
            LOGGER.warning("Stream source error: %s", error)
            yield from self._idle_stream(runtime_config, stream_error=str(error))
        except Exception as error:  # pragma: no cover - resilience path
            LOGGER.exception("Unexpected stream failure: %s", error)
            yield from self._idle_stream(
                runtime_config,
                stream_error=f"Unexpected stream failure: {error}",
            )

    def _build_runtime_config(
        self, confidence: Optional[float], tracking_confidence: Optional[float]
    ) -> RuntimeConfig:
        config = self._config_store.get()
        if confidence is not None:
            config.min_detection_confidence = float(confidence)
        if tracking_confidence is not None:
            config.min_tracking_confidence = float(tracking_confidence)
        return config.clamped()

    def _idle_payload(
        self, runtime_config: RuntimeConfig, timestamp: str, stream_error: str | None = None
    ) -> Dict[str, object]:
        return {
            "artist_detected": False,
            "pose_landmarks": [],
            "face_box": None,
            "frame_size": None,
            "is_singing": False,
            "singing_confidence": 0.0,
            "fx_events": {
                "laser": False,
                "pyro": False,
                "flash": False,
            },
            "frame_metrics": {
                "brightness": 0.0,
                "contrast": 0.0,
                "red_ratio": 0.0,
                "green_ratio": 0.0,
                "blue_ratio": 0.0,
            },
            "fan_count": 0,
            "crowd_density": 0.0,
            "confidence_score": 0.0,
            "processing_fps": 0.0,
            "timestamp": timestamp,
            "stream_error": stream_error,
        }

    def _idle_stream(
        self, runtime_config: RuntimeConfig, stream_error: str | None = None
    ) -> Iterator[Dict[str, object]]:
        while True:
            yield self._idle_payload(runtime_config, "00:00.0", stream_error=stream_error)
            time.sleep(1.0)
