#!/usr/bin/env python3
"""Export demo_terminal_sim.py output as an asciinema v2 cast (PTY capture)."""

from __future__ import annotations

import argparse
import json
import os
import pty
import select
import sys
import time
from pathlib import Path


def record(command: str, *, cols: int = 120, rows: int = 40) -> dict:
    master, slave = pty.openpty()
    pid = os.fork()
    if pid == 0:
        os.setsid()
        os.close(master)
        os.environ["COLUMNS"] = str(cols)
        os.environ["LINES"] = str(rows)
        os.dup2(slave, 0)
        os.dup2(slave, 1)
        os.dup2(slave, 2)
        if slave > 2:
            os.close(slave)
        os.execvp("sh", ["sh", "-c", command])

    os.close(slave)
    stdout: list[list[float | str]] = []
    start = time.time()
    buffer = b""

    while True:
        ready, _, _ = select.select([master], [], [], 0.05)
        if master in ready:
            try:
                chunk = os.read(master, 4096)
            except OSError:
                break
            if not chunk:
                break
            buffer += chunk
            text = buffer.decode("utf-8", errors="replace")
            stdout.append([round(time.time() - start, 3), text])
            buffer = b""

        pid_done, status = os.waitpid(pid, os.WNOHANG)
        if pid_done != 0:
            if buffer:
                stdout.append([round(time.time() - start, 3), buffer.decode("utf-8", errors="replace")])
            break

    os.close(master)
    header = {
        "version": 3,
        "term": {"cols": cols, "rows": rows, "type": "xterm-256color"},
        "timestamp": int(start),
        "command": command,
        "env": {"SHELL": "/bin/bash", "TERM": "xterm-256color"},
    }
    return header, stdout


def main() -> int:
    parser = argparse.ArgumentParser(description="Export terminal demo as asciinema cast")
    parser.add_argument(
        "--output",
        default="docs/assets/demo.cast",
        help="Output cast path",
    )
    parser.add_argument(
        "--speed",
        default="fast",
        choices=["slow", "normal", "fast"],
        help="Demo playback speed",
    )
    args = parser.parse_args()

    root = Path(__file__).resolve().parents[1]
    output = (root / args.output).resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    command = f"cd {root} && python3 scripts/demo_terminal_sim.py --speed {args.speed}"

    header, events = record(command)
    lines = [json.dumps(header)]
    lines.extend(json.dumps([ts, "o", text]) for ts, text in events)
    output.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"Wrote {output} ({len(events)} events)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
