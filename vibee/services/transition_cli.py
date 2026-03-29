from __future__ import annotations

import json
import sys
import traceback

from .pipeline import TransitionPipeline


def main() -> int:
    try:
        payload = json.load(sys.stdin)
        source = payload.get("source")
        target = payload.get("target")

        if not isinstance(source, str) or not source.strip():
            raise ValueError("source must be a non-empty string")
        if not isinstance(target, str) or not target.strip():
            raise ValueError("target must be a non-empty string")

        pipeline = TransitionPipeline()
        result = pipeline.build_transition_set(source, target)
        candidate = result["candidates"][0] if result.get("candidates") else None

        json.dump(
            {
                "ok": True,
                "result": result,
                "candidate": candidate,
            },
            sys.stdout,
        )
        return 0
    except Exception as exc:  # pragma: no cover - surfaced to Node caller
        json.dump(
            {
                "ok": False,
                "error": str(exc),
                "traceback": traceback.format_exc(),
            },
            sys.stdout,
        )
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
