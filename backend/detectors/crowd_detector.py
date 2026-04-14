from __future__ import annotations

from dataclasses import dataclass

import cv2
import numpy as np


@dataclass
class CrowdResult:
    glowstick_count: int
    crowd_density: float  # 0.0 – 1.0

    def as_dict(self) -> dict:
        return {
            "glowstick_count": self.glowstick_count,
            "crowd_density": round(self.crowd_density, 3),
        }


class CrowdDetector:
    """
    K-pop 콘서트 관객석의 응원봉(글로우스틱/불빛)을 감지해서 팬 수를 추정한다.

    원리:
    - 콘서트 영상에서 응원봉은 어두운 배경 위의 작고 밝은 컬러 블롭으로 나타남
    - 무대 영역(상단)을 제외하고 관객석 ROI(하단 2/3)에서만 탐지
    - HSV에서 고밝기(Value 채널) + 고채도 픽셀 → 컨투어 분석으로 개수 산출
    - 박효신 팬덤 응원봉은 주로 흰색/연두/파랑 계열
    """

    # 관객석 시작 위치 (전체 프레임 대비 비율, 위에서부터)
    _AUDIENCE_ROI_START = 0.30

    # 응원봉 블롭 크기 필터 (픽셀²)
    _MIN_BLOB_AREA = 3
    _MAX_BLOB_AREA = 1800

    def process(self, frame_bgr: np.ndarray) -> CrowdResult:
        h, w = frame_bgr.shape[:2]

        # 관객석 ROI 추출
        roi_y = int(h * self._AUDIENCE_ROI_START)
        audience = frame_bgr[roi_y:, :]

        mask = self._build_glowstick_mask(audience)

        # Connected-component 분석
        n_labels, _, stats, _ = cv2.connectedComponentsWithStats(mask, connectivity=8)

        count = 0
        for i in range(1, n_labels):  # 0은 배경
            area = int(stats[i, cv2.CC_STAT_AREA])
            if self._MIN_BLOB_AREA <= area <= self._MAX_BLOB_AREA:
                count += 1

        roi_pixels = max(audience.shape[0] * audience.shape[1], 1)
        lit_pixels = int(np.count_nonzero(mask))
        # density: 발광 픽셀 비율을 사람이 보기 좋은 0~1 범위로 정규화
        density = min(lit_pixels / roi_pixels * 30.0, 1.0)

        return CrowdResult(
            glowstick_count=min(count, 9999),
            crowd_density=density,
        )

    # ------------------------------------------------------------------

    def _build_glowstick_mask(self, roi_bgr: np.ndarray) -> np.ndarray:
        hsv = cv2.cvtColor(roi_bgr, cv2.COLOR_BGR2HSV)

        # 1) 흰색/무채색 고밝기 응원봉 (Value 높고 Saturation 낮음)
        white_lights = cv2.inRange(hsv, (0, 0, 215), (180, 60, 255))

        # 2) 컬러 응원봉 (채도 높고 밝음) - 파랑/연두/빨강/노랑 모두 포함
        colored_lights = cv2.inRange(hsv, (0, 110, 170), (180, 255, 255))

        combined = cv2.bitwise_or(white_lights, colored_lights)

        # 노이즈 제거: 작은 점 제거 후 인접 픽셀 합치기
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
        cleaned = cv2.morphologyEx(combined, cv2.MORPH_OPEN, kernel, iterations=1)
        cleaned = cv2.dilate(cleaned, kernel, iterations=1)

        return cleaned
