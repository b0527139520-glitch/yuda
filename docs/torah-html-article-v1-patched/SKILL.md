---
name: torah-html-article
description: >
  LEGACY (v1) generator of a self-contained Hebrew HTML article for Torah content in the house style
  of Rabbi Yehuda Taub (קול תודה) — gradient headers, colored content boxes (verse/quote/highlight/story),
  interactive table of contents, scroll-to-top button, print-ready A4 CSS, and a closing signature block.
  Superseded by the `torah-html-article-v2` skill, which is a strict superset of this one.
  ONLY use this skill when the user explicitly asks for it by name — "torah-html-article",
  "הסקיל הישן", "גרסה 1" / "v1". Do NOT trigger it from a general request for a "מאמר HTML",
  "דף תורני מעוצב", a raw shiur/transcript to format, or any other Torah-article request where no
  version was named: those all belong to `torah-html-article-v2`. If you are choosing between the two
  and the user did not name a version, choose v2.
---

# Torah HTML Article Generator

House style for producing professional Hebrew Torah articles as a single self-contained HTML file.
Read this whole file before generating — it is the full spec, not a summary.

## Workflow

1. Read `/mnt/skills/user/print-ready-html/SKILL.md` too — its print rules are a subset of this skill's
   print section below, but if there's ever a conflict, the more complete rules in this file win.
2. If given raw/transcript content: organize it into a logical chapter structure first (don't just dump
   it in order). Fix obvious transcription errors silently (per user's known corrections, e.g. "כל תודה"→"קול תודה").
   If a source attribution is uncertain, ask rather than guess — never fabricate a citation.
3. If given only a topic: write a complete, well-sourced article yourself.
4. Build the HTML using the template and component library below.
5. Save to `/mnt/user-data/outputs/מאמר_[נושא]_הרב_יהודה_טאוב.html` (or a similarly clear Hebrew filename).
6. Always present the file with `present_files` and give a one-line summary — no long postamble.

## Non-negotiable technical constraints

- Single HTML file, opens in any browser, nothing external: no CDN links, no external images/fonts.
  Only inline SVG or emoji for graphics.
- `<html lang="he" dir="rtl">`, fonts: `'Segoe UI', 'Assistant', 'Noto Sans Hebrew', Arial, sans-serif`.
- Fully responsive (`@media max-width: 768px`) and fully print-ready (`@media print`, A4).
- Every chapter `<h2>` has a unique `id="sectionN"` matching its TOC anchor.
- Smooth scroll + working scroll-to-top button, vanilla JS only.
- Don't over-decorate to the point of distracting from the text — the design serves the content.

## Standard color palette (use these exact hex values)

| Role | Color | Usage |
|---|---|---|
| h2 (chapter titles) | `#7e22ce` (purple) | main chapter headers, border-right 6px |
| h3 (sub-headers) | `#2563eb` (blue) | sub-sections |
| h4 (positive emphasis) | `#059669` (green) | positive/summary sub-points |
| quotes & special boxes | `#f59e0b` (gold) | quote-box, dividers |
| accent/underline | `#ec4899` (pink) | gradients, emphasis lines |
| body text | `#1f2937` (dark gray) | paragraphs |

Gradients:
- Page background: `linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)`
- verse-box: `linear-gradient(135deg, #e0e7ff 0%, #fce7f3 100%)`
- highlight-box: `linear-gradient(135deg, #dbeafe 0%, #e0e7ff 100%)`
- quote-box: `linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)`
- section-divider: `linear-gradient(135deg, #fbbf24 0%, #f59e0b 50%, #ec4899 100%)`
- main-title text: `linear-gradient(135deg, #7e22ce 0%, #ec4899 50%, #f59e0b 100%)` (background-clip: text)

## Typography & spacing

- h1: 3em, bold, gradient text, centered
- h2: 2.2em, `border-right: 6px solid #7e22ce`, `padding-right: 20px`, margin-top ~50px
- h3: 1.8em, blue
- h4: 1.5em, green
- p, li: 1.15em, `line-height: 1.8`
- Paragraph spacing: 20px between paragraphs, 50px between chapters
- Box padding: 25–30px
- `.container`: `max-width: 900px`, `padding: 60px 80px`, `border-radius: 18px`, white/near-white background
- Shadows: normal box `0 3px 10px rgba(0,0,0,0.1)`; emphasized box `0 5px 15px rgba(126,34,206,0.15)`;
  container `0 10px 40px rgba(0,0,0,0.1)`

## Component library (build these exact classes)

- `.verse-box` — pasuk/quote from Tanach: verse-box gradient, purple border, large centered font, italic optional.
- `.highlight-box` — key point: highlight-box gradient, `border-right: 6px solid #2563eb`.
- `.quote-box` — quote from Chazal/poskim: quote-box gradient, gold border, italic, optional `.source-tag` line.
- `.story-box` — narrative/story beat: green-tinted gradient, `border-right: 6px solid #059669`.
- `.section-divider` — full-width gradient banner with white centered text, used sparingly between major arcs.
- `.two-columns` — CSS grid, 2 columns (1 col on mobile), for comparisons/parallels/opposing views.
  Use `.col-purple` and `.col-gold` variants for the two sides.
- `.qa-box` — explicit question/answer pattern (dashed pink border), useful for מפרשים raising a קושיא.
- `.emphasis` span — purple bold inline term.
- `<em>` — blue italic for secondary emphasis. `<strong>` — normal bold.
- `.toc` — purple-tinted box, linked list, smooth-scrolls to each `#sectionN`.
- `.sources` — light gray box at the end, numbered list of every source cited.

## Structural template

```html
<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>[כותרת המאמר]</title>
<style>/* full CSS per this spec */</style>
</head>
<body>
<div class="container">
  <h1 class="main-title" id="top">[כותרת ראשית]</h1>
  <div class="subtitle">[תת-כותרת מסבירה]</div>
  <div class="author">מאת: הרב יהודה טאוב</div>

  <div class="toc"><h3>📑 תוכן העניינים</h3><ul>...</ul></div>

  <h2 id="section1">...</h2> <p>...</p> ...
  <!-- repeat per chapter, using boxes/dividers where they genuinely add clarity -->

  <div class="sources"><h3>📚 מקורות ומראי מקומות</h3><ol>...</ol></div>

  <div class="footer"><!-- MANDATORY, see below --></div>
</div>
<a href="#top" class="scroll-top" id="scrollTop">▲</a>
<script>/* smooth scroll + scroll-top visibility toggle */</script>
</body>
</html>
```

## Mandatory closing signature (verbatim structure, insert as the final `.footer` block)

```html
<div class="footer">
    <strong>נכתב ונערך על ידי:</strong><br>
    <strong>הרב יהודה טאוב</strong><br>
    קרית אתא<br>
    📞 <strong>ליצירת קשר:</strong> 0527139520<br><br>

    <div style="margin-top: 30px; padding: 25px; background: linear-gradient(135deg, #dbeafe 0%, #e0e7ff 100%); border-radius: 10px;">
        <h4>🎧 שיעורים נוספים של הרב</h4>
        <p><strong>ניתן לשמוע עוד שיעורים נפלאים:</strong></p>
        <p>📻 <strong>קול הלשון - קול תודה:</strong> 03-6171190</p>
        <p>🌐 <strong>באתר:</strong> <a href="https://www.kol-toda.co.il/">www.kol-toda.co.il</a></p>
    </div>
</div>
```

## Print CSS (embed verbatim, adjust selectors only if the article adds new box classes)

```css
@media print {
    @page { size: A4 portrait; margin: 20mm 18mm; }
    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    body { background: #fff !important; padding: 0 !important; font-size: 11pt; }
    .container { max-width: 100% !important; padding: 0 !important; box-shadow: none !important; }
    .scroll-top { display: none !important; }
    h2 { page-break-before: always; break-before: page; }
    h2:first-of-type { page-break-before: avoid; break-before: avoid; }
    h3, h4 { page-break-after: avoid; break-after: avoid; }
    .verse-box, .highlight-box, .quote-box, .story-box, .two-columns, .qa-box {
        page-break-inside: avoid; break-inside: avoid;
    }
    .toc { page-break-after: always; break-after: page; }
    .main-title { font-size: 26pt !important; -webkit-text-fill-color: #4a0080 !important; background: none !important; }
    h2 { font-size: 16pt !important; } h3 { font-size: 13pt !important; } p, li { font-size: 11pt !important; }
    .footer { page-break-before: always; break-before: page; }
    [style*="display: flex"], [style*="display: grid"] { display: block !important; }
}
```

## Content principles

- Never pad with filler — every box should earn its place (a real pasuk, a real machloket, a real story beat).
- When sources genuinely conflict or offer two readings of the same text (e.g. a phrase read as reward by
  one meforash and as punishment/decree by another), surface that tension explicitly — usually via
  `.two-columns` — rather than flattening it into one narrative. This is what makes an article compelling,
  not just decorative.
- Be precise with attribution. If a citation can't be verified, omit or flag it — don't invent it.
- Optional background flourish (e.g. a subtle repeating Star-of-David SVG pattern at ~5–10% opacity) is
  welcome for occasions/holidays but must never reduce text contrast or readability.
- Always end with a `.sources` list matching every citation actually used in the body.
