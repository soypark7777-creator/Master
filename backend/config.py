from __future__ import annotations

import os
from dataclasses import asdict, dataclass
from threading import Lock
from typing import Any, Dict


def _float_env(name: str, default: float) -> float:
    raw = os.getenv(name)
    if raw is None:
        return default
    try:
        return float(raw)
    except ValueError:
        return default


@dataclass
class RuntimeConfig:
    min_detection_confidence: float = _float_env(
        "DEFAULT_MIN_DETECTION_CONFIDENCE", 0.6
    )
    min_tracking_confidence: float = _float_env(
        "DEFAULT_MIN_TRACKING_CONFIDENCE", 0.5
    )
    laser_sensitivity: float = _float_env("DEFAULT_LASER_SENSITIVITY", 0.7)
    pyro_sensitivity: float = _float_env("DEFAULT_PYRO_SENSITIVITY", 0.8)

    def clamped(self) -> "RuntimeConfig":
        return RuntimeConfig(
            min_detection_confidence=max(0.0, min(1.0, self.min_detection_confidence)),
            min_tracking_confidence=max(0.0, min(1.0, self.min_tracking_confidence)),
            laser_sensitivity=max(0.0, min(1.0, self.laser_sensitivity)),
            pyro_sensitivity=max(0.0, min(1.0, self.pyro_sensitivity)),
        )


class ConfigStore:
    def __init__(self) -> None:
        self._lock = Lock()
        self._config = RuntimeConfig().clamped()

    def get(self) -> RuntimeConfig:
        with self._lock:
            return RuntimeConfig(**asdict(self._config))

    def update(self, payload: Dict[str, Any]) -> RuntimeConfig:
        with self._lock:
            current = asdict(self._config)
            for key in (
                "min_detection_confidence",
                "min_tracking_confidence",
                "laser_sensitivity",
                "pyro_sensitivity",
            ):
                if key in payload:
                    current[key] = float(payload[key])
            self._config = RuntimeConfig(**current).clamped()
            return RuntimeConfig(**asdict(self._config))
