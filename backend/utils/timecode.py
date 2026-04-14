from __future__ import annotations


def format_timestamp(seconds: float) -> str:
    safe_seconds = max(0.0, float(seconds))
    minutes = int(safe_seconds // 60)
    remainder = safe_seconds - (minutes * 60)
    return f"{minutes:02d}:{remainder:04.1f}"
