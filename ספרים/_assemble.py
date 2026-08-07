#!/usr/bin/env python3
"""Assemble final book HTML files by injecting base.css and tts.js verbatim
from the torah-html-article-v2 skill assets into draft files that contain
the placeholders {{BASE_CSS}} and {{TTS_JS}}. This avoids manual copy errors
for the long, unmodifiable tts.js file.
"""
import sys
from pathlib import Path

SKILL_DIR = Path("/root/.claude/skills/torah-html-article-v2/assets")
BASE_CSS = (SKILL_DIR / "base.css").read_text(encoding="utf-8")
TTS_JS = (SKILL_DIR / "tts.js").read_text(encoding="utf-8")

OUT_DIR = Path(__file__).parent

drafts = [
    ("_draft_01_נשמת_כל_חי.html", "נשמת_כל_חי.html"),
    ("_draft_02_שני_ספרי_התורה_של_המלך.html", "שני_ספרי_התורה_של_המלך.html"),
    ("_draft_03_מצות_השמחה_וההודיה_בקנית_בית.html", "מצוות_השמחה_וההודיה_בקניית_בית.html"),
]

for draft_name, out_name in drafts:
    draft_path = OUT_DIR / draft_name
    text = draft_path.read_text(encoding="utf-8")
    if "{{BASE_CSS}}" not in text:
        sys.exit(f"ERROR: {draft_name} missing {{BASE_CSS}} placeholder")
    if "{{TTS_JS}}" not in text:
        sys.exit(f"ERROR: {draft_name} missing {{TTS_JS}} placeholder")
    text = text.replace("/* {{BASE_CSS}} */", BASE_CSS)
    text = text.replace("/* {{TTS_JS}} */", TTS_JS)
    out_path = OUT_DIR / out_name
    out_path.write_text(text, encoding="utf-8")
    print(f"Wrote {out_path} ({len(text)} chars)")
