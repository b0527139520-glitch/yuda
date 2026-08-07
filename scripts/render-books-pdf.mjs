/* =============================================================================
   הפקת PDF מספרי HTML (torah-html-article-v2)   |   render-books-pdf.mjs
   -----------------------------------------------------------------------------
   בלי להתקין כלום: משתמש ב-Chrome / Edge / Chromium שכבר מותקן במחשב,
   במצב headless, בדיוק כמו scripts/render-cover.mjs שבסקיל torah-html-article-v2.

   כל ספר שנבנה מהתבנית כבר מכיל כללי @media print מלאים (A4, שוליים, הסתרת
   סרגל ההאזנה וכרטיסי המעבר, שבירת עמוד לכל פרק) — הסקריפט הזה רק מפעיל
   את מנוע ההדפסה של הדפדפן על אותם כללים. אין כאן שום מנגנון הדפסה חדש.

   שימוש:
     node render-books-pdf.mjs [תיקייה] [--out תיקיית-פלט]

   דוגמה:
     node render-books-pdf.mjs "ספרים"
     → מפיק PDF לצד כל קובץ HTML בתיקיית "ספרים", עם אותו שם קובץ.
   ============================================================================= */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const BROWSERS = [
    process.env.PLAYWRIGHT_CHROMIUM_PATH,
    '/opt/pw-browsers/chromium',                                   // סביבת claude code on the web
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    (process.env.LOCALAPPDATA || '') + '/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
];

function findBrowser() {
    for (const b of BROWSERS) if (b && fs.existsSync(b)) return b;
    throw new Error('לא נמצא Chrome, Edge או Chromium. התקן אחד מהם, או קבע PLAYWRIGHT_CHROMIUM_PATH.');
}

const args = process.argv.slice(2);
const flag = (name, def) => { const i = args.indexOf('--' + name); return i >= 0 ? args[i + 1] : def; };
const inputDir = args.find(a => !a.startsWith('--')) || 'ספרים';
const outDir = flag('out', inputDir);

if (!fs.existsSync(inputDir) || !fs.statSync(inputDir).isDirectory()) {
    console.error('תיקייה לא נמצאה: ' + inputDir);
    process.exit(1);
}
fs.mkdirSync(outDir, { recursive: true });

const browser = findBrowser();
console.log('דפדפן:', browser);

const htmlFiles = fs.readdirSync(inputDir).filter(f => f.toLowerCase().endsWith('.html'));
if (!htmlFiles.length) {
    console.error('לא נמצאו קובצי HTML בתיקייה: ' + inputDir);
    process.exit(1);
}

// Chrome לפעמים לא מעכל היטב שמות קבצים בעברית בשורת הפקודה (בעיה ידועה
// בגרסת Windows, ראה scripts/render-cover.mjs). לכן, כמו שם, כל ההדפסה
// נעשית דרך שם זמני לועזי בתיקייה זמנית, והשם העברי מוחזר רק בסוף.
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'books-pdf-'));

let ok = 0, failed = [];
for (const file of htmlFiles) {
    const srcAbs = path.resolve(inputDir, file);
    const base = path.basename(file, '.html');
    const tmpHtml = path.join(tmp, 'in.html');
    const tmpPdf = path.join(tmp, 'out.pdf');
    fs.copyFileSync(srcAbs, tmpHtml);
    const fileUrl = 'file://' + tmpHtml.replace(/ /g, '%20');
    try {
        execFileSync(browser, [
            '--headless=new', '--disable-gpu', '--hide-scrollbars',
            '--no-sandbox', '--disable-extensions', '--disable-lcd-text',
            '--virtual-time-budget=4000',        // זמן לגופנים ולגרדיאנטים להיטען
            `--print-to-pdf=${tmpPdf}`, '--no-pdf-header-footer',
            fileUrl,
        ], { stdio: 'pipe', timeout: 90000 });
        if (!fs.existsSync(tmpPdf)) throw new Error('הדפדפן לא יצר קובץ PDF');
        const finalPdf = path.join(outDir, base + '.pdf');
        fs.copyFileSync(tmpPdf, finalPdf);
        const kb = (fs.statSync(finalPdf).size / 1024).toFixed(0);
        console.log(`✅ ${base}.pdf  (${kb}KB)`);
        fs.rmSync(tmpPdf, { force: true });
        ok++;
    } catch (e) {
        console.error(`❌ ${file}: ${e.message}`);
        failed.push(file);
    }
}

fs.rmSync(tmp, { recursive: true, force: true });
console.log(`\nהופקו ${ok} מתוך ${htmlFiles.length} קבצים.`);
if (failed.length) { console.error('נכשלו:', failed.join(', ')); process.exit(1); }
