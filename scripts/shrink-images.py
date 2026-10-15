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
# A file must be unchanged this long before it is rewritten, so a smoke run can compare its fresh
# screenshot first; and nothing under a directory where control-probability is running is touched.
SETTLE = float(os.environ.get("AGENT_IMAGE_SETTLE", "10"))
EXT = (".png", ".jpg", ".jpeg", ".webp")

def smoke_cwds():
    out = []
    for pid in os.listdir("/proc"):
        if not pid.isdigit():
            continue
        try:
            argv = open(f"/proc/{pid}/cmdline", "rb").read().decode(errors="replace").split("\0")
            # The driver itself (an argv element naming the script), not any text that mentions it.
            if any(a.endswith("control-probability.mjs") for a in argv) and "smoke" in argv:
                out.append(os.path.realpath(os.readlink(f"/proc/{pid}/cwd")))
        except OSError:
            pass
    return out

def one_pass(since, dirs, Image):
    busy = smoke_cwds()
    now = time.time()
    for d in dirs:
        rd = os.path.realpath(d)
        if any(b == rd or b.startswith(rd + "/") or rd.startswith(b + "/") for b in busy):
            continue  # a smoke run is comparing screenshots here
        for root, _, files in os.walk(d):
            for f in files:
                if not f.lower().endswith(EXT):
                    continue
                if "/baselines/" in root + "/":
                    continue  # visual baselines are compared at full size
                p = os.path.join(root, f)
                try:
                    m = os.path.getmtime(p)
                    if m < since or now - m < SETTLE:
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
                return
            time.sleep(0.5)
    elif a and a[0] == "--once":
        one_pass(float(a[1]), a[2:], Image)

main()
