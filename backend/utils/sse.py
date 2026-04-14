from __future__ import annotations

import json
from typing import Any, Dict, Iterable, Iterator


def encode_sse(data: Dict[str, Any]) -> str:
    return f"data: {json.dumps(data, ensure_ascii=False)}\n\n"


def stream_json(events: Iterable[Dict[str, Any]]) -> Iterator[str]:
    for event in events:
        yield encode_sse(event)
