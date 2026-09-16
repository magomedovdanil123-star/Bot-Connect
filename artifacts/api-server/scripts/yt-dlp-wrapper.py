"""Run yt-dlp with small compatibility fixes for provider response changes."""

from __future__ import annotations

import inspect
import runpy
import textwrap


def patch_vk_subtitle_title() -> None:
    from yt_dlp.extractor import vk

    original = vk.VKIE._real_extract
    source = inspect.getsource(original)
    old = "sub.get('title', '.srt').split('.')[-1]"
    new = "(sub.get('title') or '.srt').split('.')[-1]"
    if old not in source:
        return

    namespace: dict[str, object] = {}
    patched_source = textwrap.dedent(source).replace(old, new)
    exec(compile(patched_source, inspect.getsourcefile(original) or "vk.py", "exec"), original.__globals__, namespace)
    vk.VKIE._real_extract = namespace["_real_extract"]  # type: ignore[assignment]


patch_vk_subtitle_title()
runpy.run_module("yt_dlp", run_name="__main__")