// בדיקת make-audio.mjs: חלוקה לפרקים, טקסט מנורמל, והטמעת הנגן.
// רץ ב---dry-run בלבד — בלי קריאת רשת ובלי edge-tts.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const TESTS = path.join(ROOT, 'tests');
let ok = true;
const check = (cond, label, extra) => {
    console.log((cond ? '✅ ' : '❌ ') + label + (extra ? '\n     ' + extra : ''));
    if (!cond) ok = false;
};

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'audio-'));
const run = (file, ...args) => spawnSync('node', [path.join(ROOT, 'scripts', 'make-audio.mjs'), file, '--dry-run', ...args], { encoding: 'utf8' });

for (const [demo, label] of [['demo.html', 'מאמר בגלילה'], ['demo-book.html', 'ספר מתחלף']]) {
    const src = path.join(TESTS, demo);
    if (!fs.existsSync(src)) { check(false, `${label}: ${demo} לא קיים — הרץ build-demo.mjs ו-test-paginated.mjs`); continue; }

    const file = path.join(tmp, demo);
    fs.copyFileSync(src, file);
    const r = run(file);
    console.log(`\n--- ${label} ---`);
    check(r.status === 0, 'הסקריפט הסתיים בהצלחה', r.status !== 0 ? (r.stderr || '').trim() : '');
    if (r.status !== 0) continue;

    const html = fs.readFileSync(file, 'utf8');
    const txts = fs.readdirSync(path.join(tmp, 'audio')).filter((f) => f.startsWith(demo.replace('.html', '')) && f.endsWith('.txt'));
    const all = txts.map((f) => fs.readFileSync(path.join(tmp, 'audio', f), 'utf8')).join('\n');

    check(txts.length >= 2, `נוצר קטע לכל פרק`, `${txts.length} קטעים`);
    check(!/תוכן העניינים/.test(all), 'תוכן העניינים לא נכנס להקלטה  ← ה-h2 יושב מחוץ ל-div.toc');
    check(!/מקורות ומראי/.test(all), 'רשימת המקורות לא נכנסה');
    check(!/כל הזכויות/.test(all), 'החתימה לא נכנסה');
    // האינווריאנט האמיתי: שום ראשי תיבות לא נשארו בטקסט המוקלט.
    // (בדיקה חיובית אפשרית רק ב-demo.html — demo-book.html הוא פלייסהולדר,
    //  וראשי התיבות היחידים בו יושבים ברשימת המקורות שממילא מדולגת.)
    check(!/[א-ת]["״][א-ת]/.test(all), 'לא נשארו ראשי תיבות לא-מורחבים בהקלטה');
    if (demo === 'demo.html') {
        check(/רמבם|הקדוש ברוך הוא|שולחן ערוך/.test(all), 'ראשי תיבות הורחבו, כמו בהקראה החיה');
    }
    check(!/\sלה'|\sבה'\s/.test(all), "ה' הוחלף ב\"השם\"");
    check(!/[\uD800-\uDBFF][\uDC00-\uDFFF]/.test(all), 'אין אימוג\'י בטקסט המוקלט');

    const players = (html.match(/class="audio-player no-tts"/g) || []).length;
    const scripts = (html.match(/data-audio-player/g) || []).length;
    check(players === 1, 'נגן אחד בדיוק', `${players}`);
    check(scripts === 1, 'סקריפט הנגן הוטמע פעם אחת', `${scripts}`);
    check((html.match(/<option value="audio\//g) || []).length === txts.length, 'לכל קטע יש אפשרות בבורר הפרקים');

    // ריצה חוזרת לא מכפילה
    run(file);
    const again = fs.readFileSync(file, 'utf8');
    check((again.match(/class="audio-player no-tts"/g) || []).length === 1, 'ריצה חוזרת מחליפה ולא מוסיפה נגן שני');
    check((again.match(/data-audio-player/g) || []).length === 1, 'ריצה חוזרת לא מכפילה את הסקריפט');
}

// --single מייצר קובץ אחד
const one = path.join(tmp, 'single.html');
fs.copyFileSync(path.join(TESTS, 'demo.html'), one);
if (run(one, '--single').status === 0) {
    const txts = fs.readdirSync(path.join(tmp, 'audio')).filter((f) => f === 'single.txt');
    console.log('\n--- ‎--single ---');
    check(txts.length === 1, 'קובץ אחד בלבד במצב --single');
}

fs.rmSync(tmp, { recursive: true, force: true });
console.log(ok ? '\n🎉 כל הבדיקות עברו' : '\n❌ יש כשלים');
process.exit(ok ? 0 : 1);
