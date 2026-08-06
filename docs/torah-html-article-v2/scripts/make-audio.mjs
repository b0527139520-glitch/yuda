#!/usr/bin/env node
/**
 * make-audio.mjs — מפיק MP3 מוקלט לספר/מאמר ומטמיע בו נגן.
 *
 *   node scripts/make-audio.mjs "ספר.html"
 *   node scripts/make-audio.mjs "ספר.html" --voice he-IL-HilaNeural --rate +10%
 *   node scripts/make-audio.mjs "ספר.html" --single      (קובץ אחד במקום פרק-פרק)
 *   node scripts/make-audio.mjs "ספר.html" --dry-run     (בלי קריאת רשת)
 *
 * ברירת המחדל: קובץ MP3 נפרד לכל פרק (h2), ונגן אחד בראש הקובץ שמדלג ביניהם
 * ועובר לפרק הבא מעצמו.
 *
 * זו החלטת נוחות, לא עקיפה של מגבלה: edge-tts מפצל טקסט ארוך בעצמו לנתחים של
 * 4096 בייט ומזרים אותם דרך אותו WebSocket, ולכן ספר שלם בקובץ אחד עובד גם הוא
 * (מגבלת 10 הדקות שייכת ל-Azure Speech REST, לא לכאן). החלוקה לפרקים נותנת
 * ניווט, המשך מהמקום שבו עצרת, וקבצים בגודל סביר. מי שרוצה קובץ אחד — `--single`.
 *
 * הטקסט נלקח דרך אותה לוגיקה בדיוק של assets/tts.js — אותה רשימת דילוגים
 * (SKIP) ואותה הרחבת ראשי תיבות ו-ה' ← "השם". אין כאן עותק שני של הכללים,
 * ולכן ההקלטה נשמעת זהה להקראה החיה.
 *
 * דרישות: npm install linkedom  |  pip install edge-tts
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

/* ---------- ארגומנטים ---------- */
const argv = process.argv.slice(2);
const htmlPath = argv.find((a) => !a.startsWith('--'));
const flag = (name, def) => {
    const i = argv.indexOf('--' + name);
    return i === -1 ? def : argv[i + 1];
};
const dryRun = argv.includes('--dry-run');
const single = argv.includes('--single');
const voice = flag('voice', 'he-IL-HilaNeural');
const rate = flag('rate', null);

if (!htmlPath) {
    console.error('שימוש: node scripts/make-audio.mjs "<קובץ.html>" [--voice ...] [--rate +10%] [--single] [--dry-run]');
    process.exit(1);
}
if (!fs.existsSync(htmlPath)) {
    console.error('לא נמצא הקובץ: ' + htmlPath);
    process.exit(1);
}

/* ---------- linkedom ---------- */
let parseHTML;
try {
    ({ parseHTML } = await import('linkedom'));
} catch {
    console.error('חסרה החבילה linkedom. הרץ מתוך תיקיית הסקיל:  npm install linkedom');
    process.exit(1);
}

/* ---------- שאיבת הלוגיקה מ-assets/tts.js (לא עותק!) ---------- */
const ttsSrc = fs.readFileSync(path.join(ROOT, 'assets', 'tts.js'), 'utf8');

const skipMatch = ttsSrc.match(/var SKIP\s*=\s*'([^']+)'/);
if (!skipMatch) {
    console.error('לא נמצאה רשימת SKIP ב-assets/tts.js — האם הקובץ שונה?');
    process.exit(1);
}
const SKIP = skipMatch[1];

const slice = ttsSrc.slice(ttsSrc.indexOf("var G = '"), ttsSrc.indexOf('function chunkText'));
if (!slice) {
    console.error('לא הצלחתי לחלץ את forSpeech מ-assets/tts.js — האם הקובץ שונה?');
    process.exit(1);
}
const { forSpeech } = new Function('MAX_CHUNK', slice + '\n return { forSpeech };')(180);

/* ---------- חלוקה לפרקים ---------- */
const rawHtml = fs.readFileSync(htmlPath, 'utf8');
const { document } = parseHTML(rawHtml);

const nodes = [...document.querySelectorAll('h1, h2, h3, h4, p, li')].filter((n) => !n.closest(SKIP));
if (!nodes.length) {
    console.error('לא נמצא טקסט להקראה בקובץ.');
    process.exit(1);
}

const raw = [];
let current = null;
for (const n of nodes) {
    const spoken = (forSpeech(n.textContent || '') || '').trim();
    if (!spoken) continue;
    /* כל h2 פותח פרק חדש. מה שלפני ה-h2 הראשון = פתיחה. */
    if (n.tagName === 'H2' || !current) {
        current = { title: n.tagName === 'H2' ? spoken : 'פתיחה', headTag: n.tagName, head: [], body: [] };
        raw.push(current);
    }
    /* השורה הראשונה בקטע היא הכותרת, כל השאר גוף */
    (current.head.length ? current.body : current.head).push({ el: n, text: spoken });
}

/* קטע שאין בו גוף מעבר לכותרת אינו פרק אמיתי.
   עמוד "תוכן העניינים" בספר הוא כזה: ה-h2 יושב מחוץ ל-div.toc ולכן שרד את
   SKIP, אבל כל מה שמתחתיו סונן. כותרת ראשית (h1) לעומת זאת מתמזגת לפרק
   הראשון, כדי ששם הספר עדיין ייקרא בפתיחת ההקלטה. */
const segments = [];
let carry = [];
for (const s of raw) {
    const lines = [...s.head, ...s.body];
    if (!s.body.length) {
        if (s.headTag === 'H1') carry.push(...lines);   // שם הספר — נשמר לפרק הבא
        continue;                                        // תוכן עניינים וכדומה — נזרק
    }
    segments.push({ title: s.title, lines: [...carry, ...lines] });
    carry = [];
}
if (!segments.length) {
    console.error('לא נמצא תוכן להקלטה — כל הקטעים היו כותרות בלבד.');
    process.exit(1);
}

const parts = single
    ? [{ title: segments.map((s) => s.title).join(' · '), lines: segments.flatMap((s) => s.lines) }]
    : segments;

/* ---------- נתיבים ---------- */
const dir = path.dirname(path.resolve(htmlPath));
const base = path.basename(htmlPath).replace(/\.html?$/i, '');
const audioDir = path.join(dir, 'audio');
fs.mkdirSync(audioDir, { recursive: true });

const pad = (i) => String(i + 1).padStart(2, '0');
const nameOf = (i) => (single ? base : base + '-' + pad(i));

/* ---------- edge-tts ---------- */
let edgeCmd = null;
function resolveEdge() {
    if (edgeCmd) return edgeCmd;
    for (const c of [['edge-tts', []], ['python', ['-m', 'edge_tts']], ['python3', ['-m', 'edge_tts']]]) {
        const r = spawnSync(c[0], [...c[1], '--version'], { stdio: 'ignore' });
        if (!r.error) return (edgeCmd = c);
    }
    return null;
}

function synth(txtFile, mp3File, srtFile) {
    const cmd = resolveEdge();
    if (!cmd) {
        console.error('edge-tts לא נמצא. הרץ:  pip install edge-tts');
        process.exit(1);
    }
    const args = [...cmd[1], '--voice', voice, '--file', txtFile,
                  '--write-media', mp3File, '--write-subtitles', srtFile];
    if (rate) args.push('--rate', rate);
    const r = spawnSync(cmd[0], args, { stdio: ['ignore', 'ignore', 'inherit'] });
    if (r.status !== 0) return false;
    /* כשל רשת אצל edge-tts מסתיים לעיתים בקוד 0 עם קובץ ריק — לכן בודקים גודל */
    return fs.existsSync(mp3File) && fs.statSync(mp3File).size > 0;
}

/* ---------- יישור תזמונים ----------
   edge-tts מפיק cue לכל מילה (WordBoundary). כאן ממפים אותם חזרה לפסקאות:
   לכל פסקה נשמר הזמן שבו נאמרה המילה הראשונה שלה, וזה מה שמניע את ההדגשה. */
const norm = (w) => w.replace(/["'״׳,.;:!?()\[\]־–—]/g, '').trim();

function parseSrt(srt) {
    const cues = [];
    for (const block of srt.split(/\r?\n\r?\n/)) {
        const m = block.match(/(\d{2}):(\d{2}):(\d{2})[,.](\d{3})\s*-->/);
        if (!m) continue;
        const text = block.split(/\r?\n/).slice(2).join(' ').trim();
        if (!text) continue;
        cues.push({ start: +m[1] * 3600 + +m[2] * 60 + +m[3] + +m[4] / 1000, text });
    }
    return cues;
}

function alignCues(srt, lines) {
    const cues = parseSrt(srt);
    if (!cues.length) return null;

    /* מערך מילים שטוח, כל מילה יודעת לאיזו פסקה היא שייכת */
    const flat = [];
    lines.forEach((text, i) => {
        for (const w of text.split(/\s+/)) if (norm(w)) flat.push({ w: norm(w), line: i });
    });

    const starts = new Array(lines.length).fill(undefined);
    let p = 0;
    for (const cue of cues) {
        const words = cue.text.split(/\s+/).map(norm).filter(Boolean);
        if (!words.length) continue;
        /* סנכרון מחדש: מחפשים את מילת ה-cue קדימה בחלון קצר, כדי שסטייה
           קטנה (פיסוק, מילה שאוחדה) לא תגרור את כל השאר */
        for (let q = p; q < Math.min(p + 12, flat.length); q++) {
            if (flat[q].w === words[0]) { p = q; break; }
        }
        if (p < flat.length && starts[flat[p].line] === undefined) {
            starts[flat[p].line] = cue.start;
        }
        p += words.length;
        if (p >= flat.length) break;
    }

    /* פסקה שלא נתפסה יורשת את הזמן שלפניה — ההדגשה נשארת מונוטונית */
    let last = 0;
    for (let i = 0; i < starts.length; i++) {
        if (starts[i] === undefined) starts[i] = last;
        else last = starts[i];
    }
    return starts.map((s) => Math.round(s * 100) / 100);
}

/* ---------- הפקה ---------- */
const made = [];
let totalWords = 0;

const cueMap = {};

for (let i = 0; i < parts.length; i++) {
    const text = parts[i].lines.map((l) => l.text).join('\n');
    const words = text.split(/\s+/).filter(Boolean).length;
    totalWords += words;

    const txtFile = path.join(audioDir, nameOf(i) + '.txt');
    const mp3File = path.join(audioDir, nameOf(i) + '.mp3');
    const srtFile = path.join(audioDir, nameOf(i) + '.srt');
    fs.writeFileSync(txtFile, text, 'utf8');

    /* תיוג הפסקאות — גם ב-dry-run, כדי שהרצה אמיתית אחר כך רק תוסיף תזמונים */
    parts[i].lines.forEach((l, j) => l.el.setAttribute('data-a', pad(i) + '-' + j));

    const mins = (words / 140).toFixed(1);
    process.stdout.write(`[${pad(i)}] ${parts[i].title.slice(0, 40)} — ${words} מילים, ~${mins} דק'`);

    if (dryRun) {
        console.log('  (dry-run)');
    } else if (!synth(txtFile, mp3File, srtFile)) {
        console.log('  ✗ נכשל');
        console.error('\nההפקה נעצרה. אם זו שגיאת רשת — הרץ שוב, הקבצים שכבר נוצרו יישמרו.');
        process.exit(1);
    } else {
        console.log(`  ✓ ${Math.round(fs.statSync(mp3File).size / 1024)} KB`);
    }

    if (fs.existsSync(srtFile)) {
        const starts = alignCues(fs.readFileSync(srtFile, 'utf8'), parts[i].lines.map((l) => l.text));
        if (starts) cueMap[pad(i)] = starts;
    }
    made.push({ title: parts[i].title, file: nameOf(i) + '.mp3' });
}

console.log(`\nסה"כ ${made.length} קטעים, ~${totalWords} מילים, ~${Math.round(totalWords / 140)} דקות.`);

/* ---------- הטמעת הנגן ---------- */
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const options = made
    .map((m, i) => `        <option value="audio/${encodeURIComponent(m.file)}" data-seg="${pad(i)}">${esc(m.title)}</option>`)
    .join('\n');

const block =
    `<div class="audio-player no-tts">\n` +
    `    <div class="audio-player-title">🎧 האזנה להקלטה — קול הילה</div>\n` +
    (made.length > 1
        ? `    <select class="audio-chapter-select" aria-label="בחירת פרק להאזנה">\n${options}\n    </select>\n`
        : `    <select class="audio-chapter-select" aria-label="בחירת פרק להאזנה" hidden>\n${options}\n    </select>\n`) +
    `    <audio controls preload="none"></audio>\n` +
    `</div>`;

const existing = document.querySelector('.audio-player');
if (existing) {
    existing.outerHTML = block;                       // החלפה, לא נגן שני
} else {
    const anchor = document.querySelector('.listen-bar');
    if (anchor) anchor.insertAdjacentHTML('afterend', block);
    else (document.querySelector('.container') || document.body).insertAdjacentHTML('afterbegin', block);
}

/* מפת התזמונים להדגשה. נשמרת בין ריצות: dry-run לא מוחק תזמונים קיימים. */
const cuesTag = document.querySelector('script[data-audio-cues]');
let merged = cueMap;
if (cuesTag) {
    try { merged = Object.assign({}, JSON.parse(cuesTag.textContent || '{}'), cueMap); } catch {}
    cuesTag.remove();
}
if (Object.keys(merged).length) {
    const tag = document.createElement('script');
    tag.setAttribute('type', 'application/json');
    tag.setAttribute('data-audio-cues', '');
    tag.textContent = JSON.stringify(merged);
    document.body.appendChild(tag);
    console.log(`תזמוני הדגשה: ${Object.keys(merged).length} קטעים`);
} else if (!dryRun) {
    console.log('לא נוצרו תזמונים — ההדגשה לא תפעל (האם edge-tts כתב קובץ .srt?)');
}

/* סקריפט הנגן — מוטמע פעם אחת, מ-assets/audio-player.js */
if (!document.querySelector('script[data-audio-player]')) {
    const js = fs.readFileSync(path.join(ROOT, 'assets', 'audio-player.js'), 'utf8');
    const tag = document.createElement('script');
    tag.setAttribute('data-audio-player', '');
    tag.textContent = '\n' + js + '\n';
    document.body.appendChild(tag);
}

fs.writeFileSync(htmlPath, document.toString(), 'utf8');
console.log(`הנגן הוטמע ב-${path.basename(htmlPath)}${existing ? ' (החליף נגן קיים)' : ''}`);
