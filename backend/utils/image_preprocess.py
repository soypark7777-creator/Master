from __future__ import annotations

from dataclasses import dataclass

import cv2
import numpy as np


@dataclass
class PreprocessMetrics:
    brightness: float
    contrast: float
    red_ratio: float
    green_ratio: float
    blue_ratio: float

    def as_dict(self) -> dict[str, float]:
        return {
            "brightness": round(self.brightness, 3),
            "contrast": round(self.contrast, 3),
            "red_ratio": round(self.red_ratio, 4),
            "green_ratio": round(self.green_ratio, 4),
            "blue_ratio": round(self.blue_ratio, 4),
        }


class ImagePreprocessor:
    def __init__(self, gamma: float = 1.15) -> None:
        self.gamma = gamma
        self._clahe = cv2.createCLAHE(clipLimit=2.4, tileGridSize=(8, 8))

    def process(self, frame_bgr: np.ndarray) -> tuple[np.ndarray, PreprocessMetrics]:
        metrics = self._collect_metrics(frame_bgr)

        lab = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2LAB)
        l_channel, a_channel, b_channel = cv2.split(lab)
        enhanced_l = self._clahe.apply(l_channel)
        enhanced = cv2.merge((enhanced_l, a_channel, b_channel))
        enhanced_bgr = cv2.cvtColor(enhanced, cv2.COLOR_LAB2BGR)

        corrected = self._apply_gamma(enhanced_bgr)
        denoised = cv2.bilateralFilter(corrected, 5, 35, 35)
        return denoised, metrics

    def _collect_metrics(self, frame_bgr: np.ndarray) -> PreprocessMetrics:
        mean_channels = frame_bgr.mean(axis=(0, 1))
        channel_sum = float(mean_channels.sum()) or 1.0
        gray = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2GRAY)
        return PreprocessMetrics(
            brightness=float(gray.mean()),
            contrast=float(gray.std()),
            blue_ratio=float(mean_channels[0] / channel_sum),
            green_ratio=float(mean_channels[1] / channel_sum),
            red_ratio=float(mean_channels[2] / channel_sum),
        )

    def _apply_gamma(self, frame_bgr: np.ndarray) -> np.ndarray:
        inv_gamma = 1.0 / self.gamma
        table = np.array(
            [((index / 255.0) ** inv_gamma) * 255 for index in range(256)],
            dtype="uint8",
        )
        return cv2.LUT(frame_bgr, table)
