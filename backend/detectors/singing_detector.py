from __future__ import annotations

from collections import deque
from dataclasses import dataclass
from typing import Deque, List


@dataclass
class SingingResult:
    is_singing: bool
    confidence: float


class SingingDetector:
    def __init__(self, history_size: int = 8) -> None:
        self._mouth_open_history: Deque[float] = deque(maxlen=history_size)
        self._jaw_motion_history: Deque[float] = deque(maxlen=history_size)

    def process(self, landmarks: List[dict[str, float]]) -> SingingResult:
        if len(landmarks) < 11:
            return SingingResult(False, 0.0)

        try:
            nose = landmarks[0]
            mouth_left = landmarks[9]
            mouth_right = landmarks[10]
            left_shoulder = landmarks[11] if len(landmarks) > 11 else None
            right_shoulder = landmarks[12] if len(landmarks) > 12 else None
        except (KeyError, IndexError, TypeError):
            return SingingResult(False, 0.0)

        shoulder_mid_y = None
        if left_shoulder and right_shoulder:
            shoulder_mid_y = (left_shoulder["y"] + right_shoulder["y"]) / 2.0

        mouth_center_y = (mouth_left["y"] + mouth_right["y"]) / 2.0
        mouth_width = abs(mouth_right["x"] - mouth_left["x"])
        mouth_raise = max(0.0, mouth_center_y - nose["y"])
        jaw_proxy = mouth_raise if shoulder_mid_y is None else max(0.0, shoulder_mid_y - mouth_center_y)

        self._mouth_open_history.append(mouth_width)
        self._jaw_motion_history.append(jaw_proxy)

        mouth_variation = (
            max(self._mouth_open_history) - min(self._mouth_open_history)
            if len(self._mouth_open_history) > 1
            else 0.0
        )
        jaw_variation = (
            max(self._jaw_motion_history) - min(self._jaw_motion_history)
            if len(self._jaw_motion_history) > 1
            else 0.0
        )

        confidence = min(
            1.0,
            (mouth_width * 7.5) + (mouth_variation * 10.0) + (jaw_variation * 6.5),
        )
        is_singing = confidence >= 0.45
        return SingingResult(is_singing=is_singing, confidence=round(confidence, 3))
