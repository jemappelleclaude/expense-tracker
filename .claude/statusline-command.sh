#!/usr/bin/env bash
# Claude Code status line: model name + context window usage progress bar

cat | python3 - <<'PYEOF'
import sys, json

try:
    data = json.load(sys.stdin)
except Exception:
    print("Claude [--------------------] --%", end="")
    sys.exit(0)

model = (data.get("model") or {}).get("display_name") or "Claude"
cw = data.get("context_window") or {}
used_pct = cw.get("used_percentage")

if used_pct is not None:
    pct = round(used_pct)
    filled = pct * 20 // 100
    empty = 20 - filled
    bar = "#" * filled + "-" * empty
    if pct >= 90:
        color = "\033[0;31m"
    elif pct >= 70:
        color = "\033[0;33m"
    else:
        color = "\033[0;32m"
    reset = "\033[0m"
    print(f"{color}{model} [{bar}] {pct}%{reset}", end="")
else:
    print(f"{model} [--------------------] --%", end="")
PYEOF
