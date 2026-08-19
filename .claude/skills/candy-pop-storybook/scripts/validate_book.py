#!/usr/bin/env python3
"""Check a storybook before it is published.

Every check here exists because the corresponding failure actually shipped at
some point. The expensive ones are silent: a story that reached the search index
but never the page looks fine until a reader clicks a result and lands nowhere,
and a missing charset declaration looks fine until the Hebrew arrives as
mojibake on a host that does not send its own encoding header.

Usage:
    python validate_book.py book.html [--fragment]
"""

import argparse
import re
import subprocess
import sys
from collections import Counter
from html.parser import HTMLParser
from pathlib import Path

FAILURES = []


def check(name, ok, detail=""):
    print(("  PASS  " if ok else "  FAIL  ") + name + (f"  |  {detail}" if detail else ""))
    if not ok:
        FAILURES.append(name)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("path")
    ap.add_argument("--fragment", action="store_true",
                    help="the file is Artifact page content, not a whole document")
    a = ap.parse_args()
    html = Path(a.path).read_text(encoding="utf-8")

    class P(HTMLParser):
        def error(self, msg):
            check("html parses", False, msg)
    P().feed(html)
    check("html parses", True)

    for tag in ["section", "article", "aside", "main", "div", "ul", "button", "style"]:
        o = len(re.findall(rf"<{tag}[\s>]", html))
        c = html.count(f"</{tag}>")
        check(f"<{tag}> balanced", o == c, f"{o} open / {c} close")

    # The document shell is the one thing that differs between the two targets,
    # and getting it backwards is silent: an Artifact nests a whole document
    # inside the host's body, while a bare fragment on a web host has no shell.
    shell = ["<!DOCTYPE", "<html", "<head>", "<body"]
    if a.fragment:
        for t in shell:
            check(f"no {t} (fragment)", t not in html)
    else:
        for t in shell:
            check(f"has {t} (standalone)", t in html)

    check("declares UTF-8", re.search(r'charset=["\']?utf-8', html, re.I) is not None,
          "without it Hebrew decodes as latin-1 and search stops matching")
    check("right-to-left", 'dir="rtl"' in html or "direction: rtl" in html)

    ids = re.findall(r'id="(story-\d+)"', html)
    check("has stories", len(ids) > 0, f"{len(ids)} found")
    dupes = [k for k, v in Counter(ids).items() if v > 1]
    check("story ids unique", not dupes, ", ".join(dupes))

    targets = set(re.findall(r'href="#(story-\d+)"', html))
    dead = sorted(t for t in targets if f'id="{t}"' not in html)
    check("every story link resolves", not dead, ", ".join(dead))

    # Both directions matter. A story missing from the page is invisible to a
    # reader scrolling; one missing from the index is invisible to search.
    indexed = set(re.findall(r"id:'(story-\d+)'", html))
    check("every story is in the search index", set(ids) <= indexed,
          ", ".join(sorted(set(ids) - indexed)))
    check("no phantom stories in the index", indexed <= set(ids),
          ", ".join(sorted(indexed - set(ids))))

    check("table of contents anchor", 'id="toc"' in html)
    check("back-to-contents on every story", html.count('href="#toc"') == len(ids),
          f'{html.count(chr(34)+"#toc"+chr(34))} links / {len(ids)} stories')

    copies = Counter(re.findall(r"copyStoryLink\('(story-\d+)'", html))
    missing = [i for i in ids if copies[i] < 2]
    check("copy button in header and contents", not missing, ", ".join(missing))

    check("shareable link works inside a viewer frame", "document.referrer" in html,
          "location.href is the iframe's own URL there, which nobody can open")
    check("copy survives a blocked clipboard", "execCommand" in html,
          "navigator.clipboard is denied in sandboxed viewers")
    check("arrival does not fight the browser's smooth scroll",
          "scrollBehavior" in html,
          "re-scrolling mid-animation lands hundreds of pixels off")

    scripts = re.findall(r"<script>(.*?)</script>", html, re.S)
    check("has script", bool(scripts))
    if scripts:
        Path("/tmp/_book_check.js").write_text(scripts[-1], encoding="utf-8")
        r = subprocess.run(["node", "--check", "/tmp/_book_check.js"],
                           capture_output=True, text=True)
        check("javascript parses", r.returncode == 0, r.stderr.strip()[:200])

    mb = len(html.encode()) / 1048576
    check("size within GitHub Pages budget", mb < 1000, f"{mb:.2f} MB")

    print()
    if FAILURES:
        print(f"{len(FAILURES)} check(s) failed: " + "; ".join(FAILURES))
        return 1
    print(f"all checks passed — {len(ids)} stories")
    return 0


if __name__ == "__main__":
    sys.exit(main())
