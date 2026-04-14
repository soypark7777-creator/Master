from __future__ import annotations

import importlib
import logging
import os
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any, List

import cv2

LOGGER = logging.getLogger(__name__)


@dataclass
class PoseResult:
    artist_detected: bool
    pose_landmarks: List[dict[str, float]]
    face_box: dict[str, int] | None
    confidence_score: float


class PoseDetector:
    def __init__(self) -> None:
        self._mp_pose = None
        self._mp_vision = None
        self._mp_image = None
        self._mp_image_format = None
        self._base_options = None
        self._use_tasks_api = False
        self._model_path: str | None = None
        self._pose: Any | None = None
        self._active_key: tuple[float, float] | None = None
        self._status_reason = "MediaPipe pose engine has not been initialized yet."

    def process(
        self,
        frame_bgr,
        min_detection_confidence: float,
        min_tracking_confidence: float,
    ) -> PoseResult:
        if not self._ensure_mediapipe_loaded():
            return PoseResult(False, [], None, 0.0)

        key = (round(min_detection_confidence, 2), round(min_tracking_confidence, 2))
        if self._pose is None or self._active_key != key:
            self._reset_pose()
            self._pose = self._create_pose_runner(
                min_detection_confidence, min_tracking_confidence
            )
            self._active_key = key

        rgb_frame = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
        landmarks = self._run_pose(rgb_frame)
        if not landmarks:
            return PoseResult(False, [], None, 0.0)

        visibility_values = [landmark["visibility"] for landmark in landmarks]
        confidence_score = sum(visibility_values) / max(1, len(visibility_values))
        return PoseResult(
            artist_detected=True,
            pose_landmarks=landmarks,
            face_box=self._build_face_box(landmarks, frame_bgr.shape[1], frame_bgr.shape[0]),
            confidence_score=float(confidence_score),
        )

    def get_status(self) -> dict[str, object]:
        ready = self._ensure_mediapipe_loaded()
        return {
            "ready": ready,
            "backend": self._status_backend(),
            "model_path": self._model_path,
            "reason": self._status_reason,
        }

    def _status_backend(self) -> str:
        if self._use_tasks_api:
            return "mediapipe_tasks"
        if self._mp_pose is not None:
            return "mediapipe_solutions"
        return "unknown"

    def _ensure_mediapipe_loaded(self) -> bool:
        if self._mp_pose is not None or self._use_tasks_api:
            self._status_reason = "Pose detector is ready."
            return True

        try:
            bundled_deps = Path(__file__).resolve().parents[1] / ".deps"
            if bundled_deps.exists() and str(bundled_deps) not in sys.path:
                sys.path.insert(0, str(bundled_deps))

            importlib.import_module("numpy")
        except Exception as error:  # pragma: no cover - environment dependent
            self._status_reason = f"NumPy import failed before MediaPipe load: {error}"
            LOGGER.warning("NumPy is unavailable for MediaPipe: %s", error)
            return False

        try:
            self._mp_vision = importlib.import_module("mediapipe.tasks.python.vision")
            image_module = importlib.import_module("mediapipe.tasks.python.vision.core.image")
            base_options_module = importlib.import_module(
                "mediapipe.tasks.python.core.base_options"
            )
            self._mp_image = image_module.Image
            self._mp_image_format = image_module.ImageFormat
        except Exception as tasks_error:  # pragma: no cover - environment dependent
            try:
                mediapipe = importlib.import_module("mediapipe")
                if hasattr(mediapipe, "solutions") and hasattr(mediapipe.solutions, "pose"):
                    self._mp_pose = mediapipe.solutions.pose
                    self._use_tasks_api = False
                    self._status_reason = "MediaPipe solutions pose engine is ready."
                    return True
            except Exception as root_error:  # pragma: no cover - environment dependent
                self._status_reason = f"MediaPipe import failed: {root_error}"
                LOGGER.warning("MediaPipe root import is unavailable: %s", root_error)
                return False

            self._status_reason = f"MediaPipe vision tasks import failed: {tasks_error}"
            LOGGER.warning("MediaPipe vision tasks are unavailable: %s", tasks_error)
            return False

        default_model = (
            Path(__file__).resolve().parents[1] / "models" / "pose_landmarker_heavy.task"
        )
        configured_model = os.getenv("MEDIAPIPE_POSE_MODEL_PATH")
        model_path = Path(configured_model) if configured_model else default_model
        if not model_path.exists():
            self._status_reason = (
                "PoseLandmarker heavy model file is missing. "
                "Set MEDIAPIPE_POSE_MODEL_PATH or add backend/models/pose_landmarker_heavy.task."
            )
            LOGGER.warning(
                "PoseLandmarker model file was not found. Set MEDIAPIPE_POSE_MODEL_PATH or add %s",
                default_model,
            )
            return False

        self._base_options = base_options_module.BaseOptions
        self._use_tasks_api = True
        self._model_path = str(model_path)
        self._status_reason = "MediaPipe Pose Landmarker Heavy model is ready."
        return True

    def _create_pose_runner(
        self,
        min_detection_confidence: float,
        min_tracking_confidence: float,
    ) -> Any:
        if self._use_tasks_api and self._mp_vision and self._base_options and self._model_path:
            options = self._mp_vision.PoseLandmarkerOptions(
                base_options=self._base_options(model_asset_path=self._model_path),
                running_mode=self._mp_vision.RunningMode.IMAGE,
                num_poses=1,
                min_pose_detection_confidence=min_detection_confidence,
                min_pose_presence_confidence=min_detection_confidence,
                min_tracking_confidence=min_tracking_confidence,
            )
            return self._mp_vision.PoseLandmarker.create_from_options(options)

        if not self._mp_pose:
            return None

        return self._mp_pose.Pose(
            static_image_mode=False,
            model_complexity=2,
            enable_segmentation=False,
            smooth_landmarks=True,
            min_detection_confidence=min_detection_confidence,
            min_tracking_confidence=min_tracking_confidence,
        )

    def _run_pose(self, rgb_frame) -> List[dict[str, float]]:
        if self._pose is None:
            return []

        if self._use_tasks_api and self._mp_image is not None and self._mp_image_format is not None:
            image = self._mp_image(
                image_format=self._mp_image_format.SRGB,
                data=rgb_frame,
            )
            result = self._pose.detect(image)
            if not result.pose_landmarks:
                return []
            landmark_group = result.pose_landmarks[0]
            return [
                {
                    "x": float(landmark.x),
                    "y": float(landmark.y),
                    "z": float(landmark.z),
                    "visibility": float(getattr(landmark, "visibility", 0.0)),
                }
                for landmark in landmark_group
            ]

        result = self._pose.process(rgb_frame)
        if not result.pose_landmarks:
            return []
        return [
            {
                "x": float(landmark.x),
                "y": float(landmark.y),
                "z": float(landmark.z),
                "visibility": float(getattr(landmark, "visibility", 0.0)),
            }
            for landmark in result.pose_landmarks.landmark
        ]

    def _reset_pose(self) -> None:
        if self._pose is not None and hasattr(self._pose, "close"):
            self._pose.close()
        self._pose = None

    def _build_face_box(
        self, landmarks: List[dict[str, float]], frame_width: int, frame_height: int
    ) -> dict[str, int] | None:
        face_indices = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
        valid_points = [
            landmarks[index]
            for index in face_indices
            if index < len(landmarks) and landmarks[index].get("visibility", 0.0) > 0.15
        ]

        if len(valid_points) < 3:
            return None

        xs = [point["x"] * frame_width for point in valid_points]
        ys = [point["y"] * frame_height for point in valid_points]
        min_x, max_x = min(xs), max(xs)
        min_y, max_y = min(ys), max(ys)
        width = max(40.0, (max_x - min_x) * 1.8)
        height = max(40.0, (max_y - min_y) * 2.2)
        center_x = (min_x + max_x) / 2.0
        center_y = (min_y + max_y) / 2.0

        return {
            "x": max(0, int(center_x - width / 2.0)),
            "y": max(0, int(center_y - height / 2.0)),
            "w": int(min(frame_width, width)),
            "h": int(min(frame_height, height)),
        }

    def close(self) -> None:
        self._reset_pose()
