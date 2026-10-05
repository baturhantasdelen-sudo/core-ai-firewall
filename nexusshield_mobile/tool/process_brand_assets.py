"""Regenerate lockup + launcher emblem PNGs. Run from repo: python tool/process_brand_assets.py"""
from __future__ import annotations

import importlib.util
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))


def _run(module_name: str, filename: str) -> None:
    path = os.path.join(HERE, filename)
    spec = importlib.util.spec_from_file_location(module_name, path)
    assert spec and spec.loader
    mod = importlib.util.module_from_spec(spec)
    sys.modules[module_name] = mod
    spec.loader.exec_module(mod)
    mod.main()


if __name__ == "__main__":
    _run("process_logo", "process_logo.py")
    _run("process_emblem", "process_emblem.py")
    print("Brand assets OK")
