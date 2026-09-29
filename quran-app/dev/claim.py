#!/usr/bin/env python3
"""Claim downloaded Drive files from the harness tool-results pool.

The Drive MCP returns file content as base64; oversized tool results are saved
by the harness as JSON files in the session's tool-results directory. Download
agents call this script after each batch of download calls:

    python3 dev/claim.py 12:412345 13:398heightsize ...

For each page:size pair it finds an unclaimed download result whose base64
length matches the expected size exactly, claims it atomically (rename), decodes
and size-verifies it, and installs work/drive/hafs-pages/<page>.svg.
Prints one line per page: "<page> OK" or "<page> MISS" (agent retries MISSes).
"""
import sys, os, json, math, glob

OUT = "/home/user/toastr/quran-app/work/drive/hafs-pages"
os.makedirs(OUT, exist_ok=True)

pools = glob.glob("/root/.claude/projects/-home-user-toastr/*/tool-results")
if not pools:
    print("NO-POOL"); sys.exit(1)

def candidates():
    files = []
    for pool in pools:
        files += glob.glob(os.path.join(pool, "*download_file_content*.txt"))
    files.sort(key=os.path.getmtime, reverse=True)
    return files

import base64
for pair in sys.argv[1:]:
    page, size = pair.split(":")
    size = int(size)
    b64len = 4 * math.ceil(size / 3)
    dest = os.path.join(OUT, f"{int(page)}.svg")
    if os.path.exists(dest) and os.path.getsize(dest) == size:
        print(f"{page} OK (already)"); continue
    got = False
    for f in candidates():
        try:
            data = json.load(open(f))
        except Exception:
            continue
        content = data.get("content", "")
        if len(content) != b64len:
            continue
        claimdir = os.path.join(os.path.dirname(f), "claimed")
        os.makedirs(claimdir, exist_ok=True)
        target = os.path.join(claimdir, f"{page}-" + os.path.basename(f))
        try:
            os.rename(f, target)          # atomic claim — losers skip
        except OSError:
            continue
        raw = base64.b64decode(content)
        if len(raw) == size:
            open(dest, "wb").write(raw)
            print(f"{page} OK")
            got = True
        else:
            print(f"{page} BADSIZE {len(raw)}")
        break
    if not got and not os.path.exists(dest):
        print(f"{page} MISS")
