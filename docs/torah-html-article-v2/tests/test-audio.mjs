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

/* ---------- הדגשה נעה: יישור תזמונים מקובץ SRT ----------
   edge-tts לא זמין כאן (הפרוקסי לא מעביר WebSocket), אז מייצרים SRT מלאכותי
   בפורמט שלו — cue לכל מילה — ובודקים שהיישור חזרה לפסקאות נכון. */
const stamp = (s) => {
    const ms = Math.round(s * 1000);
    const p = (n, w = 2) => String(n).padStart(w, '0');
    return `${p(Math.floor(ms / 3600000))}:${p(Math.floor(ms / 60000) % 60)}:${p(Math.floor(ms / 1000) % 60)},${p(ms % 1000, 3)}`;
};

console.log('\n--- הדגשה נעה ---');
const hi = path.join(tmp, 'hi.html');
fs.copyFileSync(path.join(TESTS, 'demo.html'), hi);
run(hi);                                        // מריץ פעם אחת כדי לקבל את קבצי ה-txt

const audioDir = path.join(tmp, 'audio');
const txts = fs.readdirSync(audioDir).filter((f) => f.startsWith('hi-') && f.endsWith('.txt'));
let t = 0;
for (const f of txts) {
    const words = fs.readFileSync(path.join(audioDir, f), 'utf8').split(/\s+/).filter(Boolean);
    let srt = '', i = 1;
    t = 0;
    for (const w of words) {
        srt += `${i++}\n${stamp(t)} --> ${stamp(t + 0.4)}\n${w}\n\n`;
        t += 0.4;
    }
    fs.writeFileSync(path.join(audioDir, f.replace('.txt', '.srt')), srt, 'utf8');
}
check(txts.length > 0, 'נוצרו קובצי SRT מלאכותיים לבדיקה', `${txts.length}`);

run(hi);                                        // ריצה שנייה — עכשיו היישור רץ
const hiHtml = fs.readFileSync(hi, 'utf8');

// סדר התכונות נקבע על ידי linkedom — לא להניח ש-type בא ראשון
const cuesTag = hiHtml.match(/<script[^>]*\bdata-audio-cues\b[^>]*>([\s\S]*?)<\/script>/);
check(!!cuesTag, 'מפת התזמונים הוטמעה בקובץ');
if (cuesTag) {
    let cues = null;
    try { cues = JSON.parse(cuesTag[1]); } catch (e) {}
    check(!!cues, 'ה-JSON של התזמונים תקין');
    if (cues) {
        const segs = Object.keys(cues);
        check(segs.length === txts.length, 'יש תזמונים לכל קטע', `${segs.length}/${txts.length}`);
        for (const s of segs) {
            const arr = cues[s];
            const tagged = (hiHtml.match(new RegExp(`data-a="${s}-\\d+"`, 'g')) || []).length;
            check(arr.length === tagged, `קטע ${s}: תזמון לכל פסקה מתויגת`, `${arr.length} תזמונים, ${tagged} פסקאות`);
            check(arr.every((v, i) => i === 0 || v >= arr[i - 1]), `קטע ${s}: התזמונים עולים מונוטונית`);
            check(arr[0] < 1, `קטע ${s}: הפסקה הראשונה מתחילה בתחילת ההקלטה`, `${arr[0]}s`);
            check(new Set(arr).size > 1, `קטע ${s}: הפסקאות לא קרסו לזמן אחד`);
        }
    }
}
check(/data-seg="\d+"/.test(hiHtml), 'לכל אפשרות בבורר יש data-seg שמקשר לתזמונים');

/* ---------- שורת ההורדה ובחירת קובץ מהמחשב ---------- */
console.log('\n--- הורדה ובחירה ידנית ---');
const dl1 = path.join(tmp, 'dl1.html');
fs.copyFileSync(path.join(TESTS, 'demo.html'), dl1);
run(dl1);
const h1 = fs.readFileSync(dl1, 'utf8');
check(/class="audio-download"[^>]*href="#"[^>]*data-download-placeholder/.test(h1),
      'בלי --download-url נשתל מציין מקום שאפשר לחפש ולערוך');
check(/class="audio-pick-input"[^>]*accept="audio\/\*"/.test(h1), 'קיים בורר קובץ מקומי');
check(/📥 להורדת קובץ השמיעה לחץ כאן/.test(h1), 'שורת ההורדה קיימת תמיד');

const dl2 = path.join(tmp, 'dl2.html');
fs.copyFileSync(path.join(TESTS, 'demo.html'), dl2);
const URL_ = 'https://drive.google.com/file/d/ABC123/view';
run(dl2, '--download-url', URL_);
const h2 = fs.readFileSync(dl2, 'utf8');
check(h2.includes(`href="${URL_}"`), 'הקישור שניתן נכנס ל-href');
check(!/data-download-placeholder/.test(h2), 'מציין המקום נעלם כשיש קישור אמיתי');

/* ---------- קוד הנגן עצמו ---------- */
console.log('\n--- audio-player.js ---');
const playerSrc = fs.readFileSync(path.join(ROOT, 'assets', 'audio-player.js'), 'utf8');
try { new Function(playerSrc); check(true, 'הקובץ תקין תחבירית'); }
catch (e) { check(false, 'הקובץ תקין תחבירית', e.message); }

check(/window\.bookGo\b/.test(playerSrc) && !/bookGoTo/.test(playerSrc),
      'הדפדוף בספר קורא ל-window.bookGo — הגלובל שקיים ב-paginated.js');

// lineAt: איתור הפסקה הנוכחית לפי הזמן
const lineAt = new Function('return ' + playerSrc.match(/function lineAt[\s\S]*?\n    \}/)[0])();
const starts = [0, 2, 5, 9];
const expect = [[0, 0], [1.9, 0], [2, 1], [4.9, 1], [5, 2], [100, 3]];
check(expect.every(([t, want]) => lineAt(starts, t) === want),
      'lineAt מחזיר את הפסקה הנכונה בכל נקודת זמן',
      expect.map(([t]) => `${t}s→${lineAt(starts, t)}`).join('  '));

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
