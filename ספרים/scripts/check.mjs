#!/usr/bin/env node
// בדיקה אוטומטית לפני מסירת ספר תורני שנבנה לפי סקיל torah-html-article-v2.
// הסקיל עצמו לא מגדיר scripts/check.mjs (יש רק references/checklist.md ידני +
// חבילת בדיקות ל-tts.js ב-tests/) — הסקריפט הזה מממש את הסעיפים הניתנים
// לאוטומציה מתוך checklist.md, כדי שיהיה "node scripts/check.mjs <קובץ>" אמיתי.
//
// שימוש: node scripts/check.mjs "ספר1.html" "ספר2.html" ...

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SKILL = '/root/.claude/skills/torah-html-article-v2';
const baseCss = fs.readFileSync(path.join(SKILL, 'assets/base.css'), 'utf8').trim();
const ttsJs   = fs.readFileSync(path.join(SKILL, 'assets/tts.js'), 'utf8').trim();

const files = process.argv.slice(2);
if (files.length === 0) {
    console.error('שימוש: node scripts/check.mjs <קובץ.html> ...');
    process.exit(1);
}

let anyFail = false;

for (const file of files) {
    console.log(`\n=== ${file} ===`);
    const html = fs.readFileSync(file, 'utf8');
    let ok = true;
    const check = (pass, msg) => {
        console.log(`${pass ? '✅' : '❌'} ${msg}`);
        if (!pass) ok = false;
        return pass;
    };

    check(/<html[^>]*\blang="he"[^>]*\bdir="rtl"/.test(html) || /<html[^>]*\bdir="rtl"[^>]*\blang="he"/.test(html),
        'html lang="he" dir="rtl"');
    check(/<meta charset="UTF-8">/i.test(html), 'meta charset UTF-8');

    // אין הפניה חיצונית פרט לקישור לאתר בחתימה
    const httpLinks = [...html.matchAll(/https?:\/\/[^\s"')]+/g)].map(m => m[0]);
    const stray = httpLinks.filter(u => !u.includes('kol-toda.co.il'));
    check(stray.length === 0, 'אין הפניה חיצונית (CDN/פונט/תמונה) פרט לאתר בחתימה' +
        (stray.length ? `  ← נמצא: ${stray.join(', ')}` : ''));

    check(html.includes(baseCss), 'assets/base.css הודבק מילה במילה');
    check(html.includes(ttsJs), 'assets/tts.js הודבק מילה במילה');

    check(!/<script>\s*<\/script>/.test(html), 'אין בלוק <script> ריק');
    check(html.includes('window.toggleListen') || /function\s+toggleListen/.test(html), 'toggleListen מוגדר');

    // כל h2 עם id ייחודי, וכל עוגן בתוכן העניינים מצביע ל-id קיים
    const h2Ids = [...html.matchAll(/<h2[^>]*\bid="([^"]+)"/g)].map(m => m[1]);
    const dupIds = h2Ids.filter((id, i) => h2Ids.indexOf(id) !== i);
    check(h2Ids.length > 0, `יש לפחות h2 אחד עם id (${h2Ids.length} נמצאו)`);
    check(dupIds.length === 0, 'אין id כפול בין ה-h2' + (dupIds.length ? `  ← ${dupIds.join(', ')}` : ''));

    const tocHrefs = [...html.matchAll(/class="toc-chapter"[^>]*href="#([^"]+)"|<div class="toc">[\s\S]*?<\/div>/g)];
    const anchorTargets = [...html.matchAll(/href="#(section\w+|intro)"/g)].map(m => m[1]);
    const allIds = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]));
    const badAnchors = [...new Set(anchorTargets)].filter(id => !allIds.has(id));
    check(badAnchors.length === 0, 'כל עוגן (href="#...") מצביע ל-id קיים בקובץ' +
        (badAnchors.length ? `  ← חסרים: ${badAnchors.join(', ')}` : ''));

    check(html.includes('הרב יהודה טאוב') && html.includes('0527139520') && html.includes('kol-toda.co.il'),
        'חתימת הרב (שם, טלפון, אתר) קיימת');
    check(/class="sources"/.test(html), 'קיימת רשימת מקורות (.sources)');
    check(/class="toc"/.test(html), 'קיים תוכן עניינים (.toc)');
    check(/class="chapter-grid"/.test(html), 'קיימת רשת מבט-על (.chapter-grid)');
    check(/class="footer"/.test(html), 'קיים בלוק חתימה (.footer)');
    check(/class="listen-bar"/.test(html), 'קיים סרגל האזנה (.listen-bar)');

    console.log(ok ? '✅ תקין' : '❌ נמצאו בעיות');
    if (!ok) anyFail = true;
}

process.exit(anyFail ? 1 : 0);
