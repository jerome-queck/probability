#!/usr/bin/env python3
"""Downscale screenshots so no image over MAX px per side reaches the model.

  shrink-images.py --watch <pid> <since-epoch> <dir>...   loop every 0.5s until <pid> exits
  shrink-images.py --once <since-epoch> <dir>...          one pass

Touches only .png/.jpg/.jpeg/.webp files modified after <since-epoch> under the given dirs, and
rewrites them in place with the aspect ratio kept. Needs Pillow; without it, prints a warning and
exits 0 (agent-run.sh then also tells the model the limit in its prompt).
"""
import os, sys, time

MAX = int(os.environ.get("AGENT_IMAGE_MAX", "2000"))
EXT = (".png", ".jpg", ".jpeg", ".webp")

def one_pass(since, dirs, Image):
    for d in dirs:
        for root, _, files in os.walk(d):
            for f in files:
                if not f.lower().endswith(EXT):
                    continue
                p = os.path.join(root, f)
                try:
                    if os.path.getmtime(p) < since:
                        continue
                    with Image.open(p) as im:
                        if max(im.size) <= MAX:
                            continue
                        im.load()
                        im.thumbnail((MAX, MAX))
                        im.save(p)
                    print(f"shrink-images: {p} -> <= {MAX}px", file=sys.stderr)
                except Exception:
                    pass  # half-written or unreadable; the next pass retries

def main():
    try:
        from PIL import Image
    except ImportError:
        print("shrink-images: Pillow not installed; screenshots are not downscaled", file=sys.stderr)
        return
    a = sys.argv[1:]
    if a and a[0] == "--watch":
        pid, since, dirs = int(a[1]), float(a[2]), a[3:]
        while True:
            one_pass(since, dirs, Image)
            try:
                os.kill(pid, 0)
            except OSError:
                one_pass(since, dirs, Image)
                return
            time.sleep(0.5)
    elif a and a[0] == "--once":
        one_pass(float(a[1]), a[2:], Image)

main()
