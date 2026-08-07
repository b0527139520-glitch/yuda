#!/usr/bin/env node
// מזריק את assets/base.css ו-assets/tts.js של הסקיל, מילה במילה, לתוך קובץ ספר
// שנכתב לפי מבנה assets/template.html (עם שני מקטעי placeholder כמות שהם).
// שימוש: node scripts/inject.mjs "ספר1.html" "ספר2.html" ...

import fs from 'node:fs';

const SKILL = '/root/.claude/skills/torah-html-article-v2';
const css = fs.readFileSync(SKILL + '/assets/base.css', 'utf8');
const js  = fs.readFileSync(SKILL + '/assets/tts.js', 'utf8');

const cssPlaceholder =
  '/* ===== הדבק כאן את כל התוכן של assets/base.css, מילה במילה ===== */\n' +
  '/* ===== ואחריו בלבד — כללים ייחודיים למאמר הזה, אם יש ===== */';
const jsPlaceholder =
  '/* ===== הדבק כאן את כל התוכן של assets/tts.js, מילה במילה ===== */';

const files = process.argv.slice(2);
if (files.length === 0) {
    console.error('שימוש: node scripts/inject.mjs <קובץ.html> ...');
    process.exit(1);
}

for (const file of files) {
    let html = fs.readFileSync(file, 'utf8');
    if (!html.includes(cssPlaceholder)) {
        console.error(`❌ ${file}: לא נמצא placeholder של base.css (או שכבר הוזרק)`);
        continue;
    }
    if (!html.includes(jsPlaceholder)) {
        console.error(`❌ ${file}: לא נמצא placeholder של tts.js (או שכבר הוזרק)`);
        continue;
    }
    html = html.replace(cssPlaceholder, css.trim());
    html = html.replace(jsPlaceholder, js.trim());
    fs.writeFileSync(file, html, 'utf8');
    console.log(`✅ ${file}: base.css + tts.js הוזרקו`);
}
