from __future__ import annotations

import logging
import os
import time

from dotenv import load_dotenv
from flask import Flask, Response, jsonify, request, stream_with_context
from flask_cors import CORS

from backend.config import ConfigStore
from backend.utils.frame_buffer import MjpegFrameBuffer
from backend.utils.sse import stream_json
from backend.vision_engine import VisionEngine

load_dotenv()
logging.basicConfig(level=logging.INFO)
LOGGER = logging.getLogger(__name__)

app = Flask(__name__)
CORS(
    app,
    resources={r"/api/*": {"origins": ["http://localhost:3000", "http://127.0.0.1:3000"]}},
)

config_store = ConfigStore()
frame_buffer = MjpegFrameBuffer(jpeg_quality=72)
vision_engine = VisionEngine(config_store=config_store, frame_buffer=frame_buffer)


# ---------------------------------------------------------------------------
# Health / Config
# ---------------------------------------------------------------------------

@app.get("/api/health")
def health() -> Response:
    diagnostics = vision_engine.diagnostics()
    pose_engine = diagnostics["pose_engine"]
    return jsonify(
        {
            "status": "ok",
            "pose_engine": pose_engine,
            "config": diagnostics["config"],
        }
    )


@app.get("/api/config")
def get_config() -> Response:
    config = config_store.get()
    return jsonify(config.__dict__)


@app.post("/api/config")
def update_config() -> Response:
    payload = request.get_json(silent=True) or {}
    config = config_store.update(payload)
    return jsonify(config.__dict__)


# ---------------------------------------------------------------------------
# SSE analysis stream
# ---------------------------------------------------------------------------

@app.get("/api/stream")
def stream() -> Response:
    source_url = request.args.get("url") or os.getenv("DEFAULT_STREAM_URL")
    confidence = request.args.get("confidence", type=float)
    tracking_confidence = request.args.get("tracking_confidence", type=float)
    LOGGER.info(
        "Opening SSE stream url=%s detection=%.2f tracking=%.2f",
        source_url or "<idle>",
        confidence if confidence is not None else config_store.get().min_detection_confidence,
        tracking_confidence
        if tracking_confidence is not None
        else config_store.get().min_tracking_confidence,
    )

    generator = vision_engine.stream(
        source_url=source_url,
        confidence=confidence,
        tracking_confidence=tracking_confidence,
    )

    return Response(
        stream_with_context(stream_json(generator)),
        mimetype="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


# ---------------------------------------------------------------------------
# MJPEG video feed – 분석 중인 영상을 브라우저에 직접 보여주는 엔드포인트
# ---------------------------------------------------------------------------

@app.get("/api/video-feed")
def video_feed() -> Response:
    """
    분석 스레드가 frame_buffer 에 넣은 JPEG 프레임을
    multipart/x-mixed-replace 포맷으로 연속 전송한다.

    프런트엔드에서 <img src="/api/video-feed"> 로 사용하면
    추가 JS 없이 실시간 영상이 표시된다.
    """

    def _generate():
        last_served: float = 0.0
        while True:
            updated = frame_buffer.last_updated()
            if updated <= last_served:
                time.sleep(0.025)  # ~40 fps 상한
                continue

            jpeg = frame_buffer.get_jpeg()
            if jpeg is None:
                time.sleep(0.025)
                continue

            last_served = updated
            yield (
                b"--frame\r\n"
                b"Content-Type: image/jpeg\r\n\r\n"
                + jpeg
                + b"\r\n"
            )

    return Response(
        stream_with_context(_generate()),
        mimetype="multipart/x-mixed-replace; boundary=frame",
        headers={
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",
            "Expires": "0",
        },
    )


if __name__ == "__main__":
    port = int(os.getenv("PORT", "5000"))
    debug = os.getenv("FLASK_ENV", "development") == "development"
    app.run(host="0.0.0.0", port=port, debug=debug, threaded=True)
