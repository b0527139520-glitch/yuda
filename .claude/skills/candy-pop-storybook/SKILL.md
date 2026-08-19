---
name: candy-pop-storybook
description: >
  Build a colorful Hebrew HTML **story book** (ספר סיפורים) — an anthology of many short
  stories in one self-contained page, in the bright "Candy Pop" style for children: a
  sticky sidebar table of contents, live search, and a permanent shareable link to every
  single story (#story-N) with a copy-link button, so a teacher or parent can send someone
  straight to one story. Also publishes it to GitHub Pages or as a Claude Artifact.
  Use this whenever someone wants a story book, סיפורי צדיקים, סיפורי חז"ל, a children's
  Hebrew reader, an anthology or collection of stories, "ספר סיפורים", a colorful HTML book
  for kids, a sidebar/bookmark table of contents, a direct link or permalink per chapter or
  per story, a "copy link" button, or wants an existing HTML book uploaded to GitHub Pages —
  even when they don't name this skill. This is NOT the same as `torah-html-article-v2`,
  which builds a Torah *study* book (ספר לימוד תורני) — shiurim, parasha, halacha — in a
  rabbinic house style with text-to-speech and page-turning. Study material goes there;
  narrative stories for children come here.
---

# Candy Pop story book

A story book is not a study book. It is read aloud, one story at a time, and the reader
almost never starts at the beginning — someone hands them a link to *one* story. That is
the whole design: the sidebar tells you what is inside, and every story has a permanent
address you can paste into a message.

Build these with `scripts/build_book.py` rather than by hand. Not because writing HTML is
hard, but because a book has five things that must agree with each other — the story ids,
the table of contents, the copy-link buttons, the prev/next chain, and the search index —
and hand-editing is where they silently drift apart.

## How to build one

**1. Turn the source material into story bodies.** Each story needs a title and an HTML
body: `<p>` for paragraphs, `<h3 class="section-heading">` for scene headings,
`<ul class="story-list">` for lists, `<p class="bold-para">` for a line that should land
hard. If the source is Markdown, `scripts/md_to_html.py` converts it and repairs the
mangled-letter artifacts that AI-exported Hebrew often carries.

**2. Write a spec** — one JSON file describing the whole book:

```json
{
  "title": "🍭 12 סיפורים חדשים",
  "subtitle": "סיפורי חינוך והשראה",
  "start_id": 1,
  "chapters": [
    {
      "name": "רבי עקיבא",
      "icon": "🌿",
      "stories": [
        {"title": "ההתחלה בגיל ארבעים", "body_html": "<p>מַיִם שָׁחֲקוּ אֲבָנִים.</p>"}
      ]
    }
  ]
}
```

A chapter is usually one sage or one theme, and holds one or more stories. `icon` should
suit the story — 🐑 for sheep, ✉️ for a secret letter, 🏠 for hospitality — because in a
long sidebar the icon is what readers actually navigate by. Colors are assigned from the
house palette automatically; pass `"color": ["#ff6b9d", "#c62b6b"]` to choose.

**3. Build and validate:**

```bash
python scripts/build_book.py spec.json book.html          # standalone document
python scripts/validate_book.py book.html
```

Never hand over a book that has not passed the validator. Every check in it corresponds to
a failure that actually shipped once, and most of them are invisible on a casual look — a
story that reached the search index but never the page looks perfect until a reader clicks
a result and lands nowhere.

**4. Adding stories later** — add them to the spec and rebuild. Keep `start_id` and the
existing order fixed so that links already sent to people keep working. A story id is a
promise: someone has it in a WhatsApp message. Renumbering breaks it.

## Story ids are numeric on purpose

Use `story-1`, `story-2`. Never derive an id from the title — titles get reworded, and
every link anyone shared then breaks silently. Chapter anchors may use the readable name,
since those are for in-page navigation rather than for pasting around.

## Two targets, two shapes

The same book has to be emitted differently depending on where it lands, and getting this
backwards fails quietly:

- **Claude Artifact** — `--fragment`. Page content only, no `<!DOCTYPE>`/`<html>`/`<head>`/
  `<body>`; the publisher supplies those, and a whole document nested inside another one is
  malformed. Direction moves into CSS plus a two-line script.
- **Anywhere else** (GitHub Pages, Drive, a normal web host) — the default: a complete
  document.

In both, `<meta charset="UTF-8">` must stay at the top. Drop it and a host that sends no
encoding header will decode the Hebrew as latin-1: the page fills with mojibake *and*
search stops matching, because the query and the index no longer agree on what a letter is.

For publishing steps — enabling GitHub Pages, the private-repo trap, what goes public and
when — read `references/publishing.md`.

## Things that look fine and are not

These cost real debugging time. The bundled `assets/book.js` already handles all of them;
this is here so you recognise the symptoms if you ever write the JavaScript yourself.

**A copied link that nobody else can open.** Inside a viewer's iframe, `location.href` is
the iframe's internal address, not the page the reader sees. Copying that produces a link
that works for no one. Prefer `document.referrer` when the page is framed.

**Copy silently doing nothing.** `navigator.clipboard` is denied in sandboxed viewers and
rejects without a visible error, so the button appears dead. Fall back to a hidden textarea
with `execCommand('copy')`, and finally to a prompt the reader can copy from by hand.

**Landing hundreds of pixels from the story.** `scroll-behavior: smooth` makes the browser
run its *own* animation toward the anchor when a shared link opens. Scrolling again
mid-flight fights it and lands far off — a long book overshot by thousands of pixels. Turn
scroll-behavior off *before* that animation can start when the page opens with a hash, then
restore it so in-page clicks stay smooth.

**Search that finds nothing in a vocalized book.** The stories carry nikud; nobody types it.
Comparing raw strings means `אבנים` never matches `אֲבָנִים`. Match on text with the points
stripped, keeping a map back to the original so the highlight still covers the vowels. And
never build a `RegExp` from what the reader typed — a single `(` throws and takes the whole
search down.

## Files

- `assets/template.html` — page shell with `{{PLACEHOLDERS}}`
- `assets/book.css` — the Candy Pop styling
- `assets/book.js` — search, copy-link, anchor landing, TOC toggle
- `scripts/build_book.py` — spec → book
- `scripts/validate_book.py` — pre-publish checks
- `scripts/md_to_html.py` — Markdown → story body, with Hebrew repair
- `references/publishing.md` — GitHub Pages and Artifact publishing
