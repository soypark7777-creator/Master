from __future__ import annotations

from dataclasses import dataclass

import cv2
import numpy as np

from backend.config import RuntimeConfig
from backend.utils.image_preprocess import PreprocessMetrics


@dataclass
class FXResult:
    laser: bool
    pyro: bool
    flash: bool

    def as_dict(self) -> dict[str, bool]:
        return {
            "laser": self.laser,
            "pyro": self.pyro,
            "flash": self.flash,
        }


class FxDetector:
    def __init__(self) -> None:
        self._previous_brightness: float | None = None

    def process(
        self,
        frame_bgr: np.ndarray,
        metrics: PreprocessMetrics,
        config: RuntimeConfig,
    ) -> FXResult:
        hsv = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2HSV)

        green_mask = cv2.inRange(hsv, (35, 90, 70), (95, 255, 255))
        red_mask_1 = cv2.inRange(hsv, (0, 120, 120), (25, 255, 255))
        red_mask_2 = cv2.inRange(hsv, (160, 120, 120), (179, 255, 255))
        red_mask = cv2.bitwise_or(red_mask_1, red_mask_2)

        green_ratio = float(np.count_nonzero(green_mask)) / green_mask.size
        hot_ratio = float(np.count_nonzero(red_mask)) / red_mask.size
        brightness_jump = 0.0
        if self._previous_brightness is not None:
            brightness_jump = metrics.brightness - self._previous_brightness
        self._previous_brightness = metrics.brightness

        laser = green_ratio > (0.015 + (1.0 - config.laser_sensitivity) * 0.03)
        pyro = (
            hot_ratio > (0.035 + (1.0 - config.pyro_sensitivity) * 0.05)
            and metrics.brightness > 90.0
        )
        flash = brightness_jump > 28.0 and metrics.contrast > 35.0

        return FXResult(laser=laser, pyro=pyro, flash=flash)
