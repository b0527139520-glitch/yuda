/* =============================================================================
   הפיכת כריכת HTML לתמונה (ול-PDF)   |   render-cover.mjs
   -----------------------------------------------------------------------------
   בלי להתקין כלום: משתמש ב-Chrome או Edge שכבר מותקנים במחשב, במצב headless.

   שימוש:
     node render-cover.mjs <כריכה.html> [--dpi 300] [--pdf] [--out תיקייה]

   דוגמה:
     node render-cover.mjs "כריכה_ספר_ההודאה.html" --dpi 300 --pdf
   ============================================================================= */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const A4_W = 794, A4_H = 1123;          // A4 ב-96dpi, כמו הקנבס שבתבנית הכריכה

const BROWSERS = [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    (process.env.LOCALAPPDATA || '') + '/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    '/usr/bin/google-chrome', '/usr/bin/chromium',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
];

function findBrowser() {
    for (const b of BROWSERS) if (b && fs.existsSync(b)) return b;
    throw new Error('לא נמצא Chrome או Edge. התקן אחד מהם, או ציין נתיב ידנית בקוד.');
}

const args = process.argv.slice(2);
const input = args.find(a => !a.startsWith('--'));
if (!input) { console.error('שימוש: node render-cover.mjs <כריכה.html> [--dpi 300] [--pdf]'); process.exit(1); }

const flag = (name, def) => { const i = args.indexOf('--' + name); return i >= 0 ? args[i + 1] : def; };
const dpi = parseInt(flag('dpi', '300'), 10);
const wantPdf = args.includes('--pdf');
const outDir = flag('out', path.dirname(path.resolve(input)));

const scale = +(dpi / 96).toFixed(4);           // 300dpi → 3.125
const browser = findBrowser();
const abs = path.resolve(input);
const base = path.basename(abs, path.extname(abs));

// Chrome ב-Windows לא מעכל שמות קבצים בעברית בשורת הפקודה — הוא רץ, לא מתלונן,
// ופשוט לא כותב את הקובץ. לכן כל העבודה נעשית בשמות לועזיים בתיקייה זמנית,
// והשמות העבריים מוחזרים רק בסוף.
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cover-'));
const tmpHtml = path.join(tmp, 'in.html');
fs.copyFileSync(abs, tmpHtml);
const fileUrl = 'file:///' + tmpHtml.replace(/\\/g, '/').replace(/ /g, '%20');

function run(extra) {
    execFileSync(browser, [
        '--headless=new', '--disable-gpu', '--hide-scrollbars',
        '--no-sandbox', '--disable-extensions', '--disable-lcd-text',
        '--virtual-time-budget=4000',        // זמן לגופנים ולגרדיאנטים להיטען
        ...extra, fileUrl,
    ], { stdio: 'pipe', timeout: 90000 });
}

function emit(tmpName, finalPath) {
    if (!fs.existsSync(tmpName)) throw new Error('הדפדפן לא יצר את הקובץ: ' + path.basename(finalPath));
    fs.copyFileSync(tmpName, finalPath);
    return (fs.statSync(finalPath).size / 1024).toFixed(0);
}

console.log('דפדפן:', path.basename(browser));

const tmpPng = path.join(tmp, 'out.png');
const png = path.join(outDir, base + '.png');
run([`--screenshot=${tmpPng}`, `--window-size=${A4_W},${A4_H}`, `--force-device-scale-factor=${scale}`]);
console.log(`✅ תמונה: ${png}  (${Math.round(A4_W * scale)}×${Math.round(A4_H * scale)} px, ${dpi}dpi, ${emit(tmpPng, png)}KB)`);

if (wantPdf) {
    const tmpPdf = path.join(tmp, 'out.pdf');
    const pdf = path.join(outDir, base + '.pdf');
    run([`--print-to-pdf=${tmpPdf}`, '--no-pdf-header-footer']);
    console.log(`✅ PDF:   ${pdf}  (${emit(tmpPdf, pdf)}KB)`);
}

fs.rmSync(tmp, { recursive: true, force: true });
