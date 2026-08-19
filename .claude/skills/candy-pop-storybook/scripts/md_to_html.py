#!/usr/bin/env python3
"""Convert a Markdown story into the HTML body a story card expects.

Hebrew exported from AI chat tools regularly arrives damaged: a stray latin `m`
or `b` sitting inside a Hebrew word where the original letter should be
(`הַmָּלֵא` for `הַמָּלֵא`), literal `\\"` and `\\n` sequences, and bracketed
source citations mid-sentence. Those are repaired here, because catching them
after the book is built means hunting through 600 KB of vocalized text.

Usage:
    python md_to_html.py story.md              # print the body HTML
    python md_to_html.py story.md -o body.html

Then put the result in a spec entry's "body_html" and build with build_book.py.
"""

import argparse
import re
import sys
from pathlib import Path


def fix_swapped_letters(text):
    """A lone latin m/b between Hebrew characters is a mangled מ/ב.

    Guarding on both sides keeps real latin words ("ME - WE - YOU", "HTML")
    intact -- only a letter standing alone among Hebrew is treated as damage.
    """
    text = re.sub(r'(?<![A-Za-z])m(?![A-Za-z])', 'מ', text)
    text = re.sub(r'(?<![A-Za-z])b(?![A-Za-z])', 'ב', text)
    return text


def strip_citations(text):
    """Drop [bracketed source refs]; they belong in the sources section."""
    return re.sub(r'\s*\[[^\]\[]{1,200}?\]', '', text)


def clean_artifacts(text):
    return re.sub(r'\\[א-תA-Za-z]', ' ', text.replace('\\"', '"'))


def inline(text):
    text = strip_citations(fix_swapped_letters(text))
    text = re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', text)
    text = re.sub(r'(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)', r'<em>\1</em>', text)
    return text.strip()


def render(md):
    lines = md.split('\n')
    out, para, bullets = [], [], []

    def flush_para():
        if para:
            joined = ' '.join(x.strip() for x in para if x.strip())
            if joined:
                out.append('<p>' + inline(joined) + '</p>')
            para.clear()

    def flush_bullets():
        if bullets:
            items = []
            for b in bullets:
                b = re.sub(r'^\d+\.\s*', '', b) if re.match(r'^\d+\.\s', b) else re.sub(r'^-\s*', '', b)
                if b.strip():
                    items.append('<li>' + inline(b.strip()) + '</li>')
            out.append('<ul class="story-list">\n' + '\n'.join(items) + '\n</ul>')
            bullets.clear()

    for raw in lines:
        line = raw.strip()
        if not line or re.match(r'^-{3,}$', line):
            flush_para(); flush_bullets()
            continue
        if line.startswith('#### ') or line.startswith('### ') or line.startswith('## '):
            flush_para(); flush_bullets()
            title = inline(re.sub(r'^#+\s*', '', line))
            # A heading that already opens with an emoji keeps it; otherwise a
            # small marker makes scene breaks visible when read aloud.
            icon = '' if re.match(r'^[^\w\sא-ת]', title) else '🔹 '
            out.append(f'<h3 class="section-heading">{icon}{title}</h3>')
        elif line.startswith('- ') or re.match(r'^\d+\.\s', line):
            flush_para()
            bullets.append(line)
        elif line.startswith('>'):
            flush_para(); flush_bullets()
            out.append(f'<p class="bold-para">{inline(line.lstrip(">").strip())}</p>')
        else:
            flush_bullets()
            para.append(line)

    flush_para(); flush_bullets()
    return '\n\n'.join(out)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('src')
    ap.add_argument('-o', '--out')
    a = ap.parse_args()

    html = render(clean_artifacts(Path(a.src).read_text(encoding='utf-8').strip()))

    # Any lone latin letter still sitting among Hebrew is damage the rules above
    # did not cover -- worth seeing now rather than finding it in the book.
    leftovers = re.findall(r'(?<![<a-zA-Z/="])[a-zA-Z](?![a-zA-Z>="])', re.sub(r'<[^>]+>', '', html))
    if leftovers:
        print(f'warning: {len(leftovers)} lone latin letter(s) left in the Hebrew: '
              f'{sorted(set(leftovers))} — check them by hand', file=sys.stderr)

    if a.out:
        Path(a.out).write_text(html, encoding='utf-8')
        print(f'wrote {a.out}')
    else:
        print(html)


if __name__ == '__main__':
    sys.exit(main())
