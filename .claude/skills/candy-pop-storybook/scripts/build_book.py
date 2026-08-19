#!/usr/bin/env python3
"""Assemble a Candy Pop storybook from a JSON spec.

The point of this script is that the fiddly, error-prone parts of the book -- the
per-story ids, the table of contents, the copy-link buttons, the prev/next chain
and the search index -- are all derived from one list of stories. Deriving them
by hand is where books drift out of sync: a story ends up in the search index but
not the page, or a "next" link points at a story that was renumbered.

Usage:
    python build_book.py spec.json out.html [--fragment]

--fragment emits page content only, for publishing as a Claude Artifact, which
supplies its own doctype/head/body. Without it you get a complete standalone
document, which is what GitHub Pages and every other host needs.

Spec format:

{
  "title":    "🍭 12 סיפורים חדשים",
  "subtitle": "סיפורי חינוך והשראה",
  "start_id": 1,
  "chapters": [
    {
      "name":   "רבי יהודה בר אלעאי",
      "icon":   "🌿",
      "color":  ["#00b894", "#006b56"],
      "stories": [
        {"title": "הלחמנייה שבבוץ", "body_html": "<p>...</p>"}
      ]
    }
  ]
}

body_html is the story's inner HTML. Produce it with md_to_html.py, or write it
directly; either way it lands inside <div class="story-body">.
"""

import argparse
import json
import re
import sys
from pathlib import Path

ASSETS = Path(__file__).resolve().parent.parent / "assets"

# Reused across chapters on purpose -- the palette is small and a long book is
# more legible when colours repeat than when they drift into muddy in-betweens.
PALETTE = [
    ("#ff6b9d", "#c62b6b"), ("#4ec9f0", "#1a6fa0"), ("#ffd93d", "#e08e00"),
    ("#a29bfe", "#6c5ce7"), ("#7bed9f", "#2e7d50"), ("#ff4757", "#8b0000"),
    ("#00b894", "#006b56"),
]


def slug(name):
    """Chapter anchors are readable, unlike story ids, because they are not the
    thing people paste around -- and a chapter renamed mid-book is cheap to fix."""
    return "chapter-" + re.sub(r"\s+", "-", name.strip())


def esc_js(s):
    return (s.replace("\\", "\\\\").replace("'", "\\'")
             .replace("\n", " ").replace("\r", "").replace("\t", " "))


def plain_text(html):
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", html)).strip()


def build(spec):
    stories = []          # flat list, in document order, for the prev/next chain
    next_num = spec.get("start_id", 1)

    for chapter in spec["chapters"]:
        for story in chapter["stories"]:
            stories.append({
                "id": f"story-{next_num}",
                "num": next_num,
                "title": story["title"],
                "body": story["body_html"],
                "chapter": chapter,
            })
            next_num += 1

    ids = [s["id"] for s in stories]
    chapter_sections, toc_blocks, search_rows = [], [], []

    for ci, chapter in enumerate(spec["chapters"]):
        c1, c2 = chapter.get("color") or PALETTE[ci % len(PALETTE)]
        icon = chapter.get("icon", "📖")
        mine = [s for s in stories if s["chapter"] is chapter]

        articles = []
        for s in mine:
            i = ids.index(s["id"])
            nav = ['<div class="story-navigation">']
            if i > 0:
                nav.append(f'<a href="#{ids[i-1]}">→ הסיפור הקודם</a>')
            nav.append('<a class="back-to-toc-nav" href="#toc">📚 חזרה לתוכן העניינים</a>')
            if i < len(ids) - 1:
                nav.append(f'<a href="#{ids[i+1]}">הסיפור הבא ←</a>')
            nav.append("</div>")

            articles.append(f'''<article class="story-card" id="{s['id']}" style="border-top: 6px solid {c1}">
<div class="story-header" style="background:#f4f4ff">
<span class="story-num" style="background:{c1}">#{s['num']}</span>
<h3 class="story-title">{s['title']}</h3>
<button class="copy-story-link" onclick="copyStoryLink('{s['id']}', this)">🔗 העתק קישור</button>
</div>
<div class="story-body">
{s['body']}
</div>
{chr(10).join(nav)}
</article>''')

            search_rows.append(
                "  {id:'%s',title:'%s',body:'%s'}"
                % (s["id"], esc_js(s["title"]), esc_js(plain_text(s["body"])))
            )

        chapter_sections.append(f'''<section class="chapter-section" id="{slug(chapter['name'])}">
<div class="chapter-header" style="background: linear-gradient(135deg, {c1}, {c2})">
<div class="chapter-icon">{icon}</div>
<h2 class="chapter-title">{chapter['name']}</h2>
<div class="chapter-subtitle">{len(mine)} סיפורים</div>
</div>
{chr(10).join(articles)}
</section>''')

        li = "\n".join(
            f'<li><a href="#{s["id"]}">{s["title"]}</a>'
            f'<button class="toc-copy-link" onclick="event.preventDefault(); '
            f'copyStoryLink(\'{s["id"]}\', this)" title="העתק קישור">🔗</button></li>'
            for s in mine
        )
        open_cls = " open" if ci == 0 else ""
        toc_blocks.append(f'''<div class="toc-chapter{open_cls}" style="border-color:{c1}">
<div class="toc-chapter-title" style="background:{c1}" onclick="toggleTocChapter(this)"><span class="toc-icon">{icon}</span><a href="#{slug(chapter['name'])}" class="toc-sage-link">{chapter['name']}</a><span class="toc-count">{len(mine)} סיפורים</span><span class="toc-arrow">▼</span></div>
<ul class="toc-stories">
{li}
</ul>
</div>''')

    html = (ASSETS / "template.html").read_text(encoding="utf-8")
    for key, val in {
        "{{BOOK_TITLE}}": spec["title"],
        "{{HERO_TITLE}}": spec["title"],
        "{{HERO_SUBTITLE}}": spec.get("subtitle", ""),
        "{{STORY_COUNT}}": str(len(stories)),
        "{{CHAPTER_COUNT}}": str(len(spec["chapters"])),
        "{{BOOK_CSS}}": (ASSETS / "book.css").read_text(encoding="utf-8"),
        "{{BOOK_JS}}": (ASSETS / "book.js").read_text(encoding="utf-8"),
        "{{TOC_BLOCKS}}": "\n".join(toc_blocks),
        "{{CHAPTER_SECTIONS}}": "\n".join(chapter_sections),
        "{{SEARCH_DATA}}": ",\n".join(search_rows),
    }.items():
        html = html.replace(key, val)
    return html


def to_fragment(doc):
    """Strip the document shell for Artifact publishing.

    The charset declaration has to survive: without it the host may decode the
    page as latin-1, which turns every Hebrew letter into mojibake and silently
    breaks search, because the query and the index no longer share an encoding.
    Direction moves to CSS and a small script since there is no root element of
    ours left to carry dir="rtl".
    """
    body = doc[doc.index("<body>") + len("<body>"):doc.rindex("</body>")]
    title = re.search(r"<title>(.*?)</title>", doc, re.S).group(1)
    link = re.search(r'<link href="https://fonts\.googleapis[^>]*>', doc).group(0)
    style = re.search(r"<style>(.*?)</style>", doc, re.S).group(1)
    return (f'<meta charset="UTF-8">\n<title>{title}</title>\n{link}\n'
            f"<style>\nhtml {{ direction: rtl; }}\n{style}</style>\n"
            "<script>\ndocument.documentElement.lang = 'he';\n"
            "document.documentElement.dir = 'rtl';\n</script>\n"
            f"{body.strip()}\n")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("spec")
    ap.add_argument("out")
    ap.add_argument("--fragment", action="store_true",
                    help="emit page content only, for a Claude Artifact")
    a = ap.parse_args()

    spec = json.loads(Path(a.spec).read_text(encoding="utf-8"))
    doc = build(spec)
    if a.fragment:
        doc = to_fragment(doc)
    Path(a.out).write_text(doc, encoding="utf-8")

    n = len(re.findall(r'id="story-\d+"', doc))
    print(f"wrote {a.out}: {n} stories, {len(spec['chapters'])} chapters, "
          f"{'fragment' if a.fragment else 'standalone document'}")
    print("now run: python validate_book.py", a.out)


if __name__ == "__main__":
    sys.exit(main())
