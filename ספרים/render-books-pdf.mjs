/* =============================================================================
   הפיכת ספרי HTML ל-PDF   |   render-books-pdf.mjs
   -----------------------------------------------------------------------------
   בלי להתקין כלום: משתמש ב-Chrome/Chromium/Edge שכבר מותקן, במצב headless,
   בדיוק כמו scripts/render-cover.mjs שבסקיל torah-html-article-v2.
   מריץ --print-to-pdf כדי שכללי ה-@media print שכבר מוטמעים בכל ספר
   (A4, שוליים, הסתרת סרגל ההאזנה, מעבר עמוד לכל פרק) יחולו אוטומטית.

   שימוש:
     node render-books-pdf.mjs [תיקייה]   (ברירת מחדל: התיקייה הנוכחית)
     מפיק PDF לכל קובץ HTML*.html שאינו מתחיל ב-"_" בתיקייה שצוינה.
   ============================================================================= */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const BROWSERS = [
    process.env.PLAYWRIGHT_CHROMIUM_PATH,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    (process.env.LOCALAPPDATA || '') + '/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
];

// סביבת Claude Code בענן: כרום מותקן דרך Playwright, לא בנתיב מערכת רגיל.
function findPlaywrightChromium() {
    const base = process.env.PLAYWRIGHT_BROWSERS_PATH;
    if (!base || !fs.existsSync(base)) return null;
    const dirs = fs.readdirSync(base).filter(d => d.startsWith('chromium-') && !d.includes('headless_shell'));
    for (const d of dirs) {
        const p = path.join(base, d, 'chrome-linux', 'chrome');
        if (fs.existsSync(p)) return p;
    }
    return null;
}

function findBrowser() {
    for (const b of BROWSERS) if (b && fs.existsSync(b)) return b;
    const pw = findPlaywrightChromium();
    if (pw) return pw;
    throw new Error('לא נמצא Chrome/Chromium/Edge. התקן אחד מהם, או קבע PLAYWRIGHT_CHROMIUM_PATH.');
}

const targetDir = path.resolve(process.argv[2] || '.');
const browser = findBrowser();
console.log('דפדפן:', browser);

const files = fs.readdirSync(targetDir)
    .filter(f => f.toLowerCase().endsWith('.html') && !f.startsWith('_'))
    .sort();

if (files.length === 0) {
    console.log('לא נמצאו קובצי HTML בתיקייה:', targetDir);
    process.exit(0);
}

for (const file of files) {
    const abs = path.join(targetDir, file);
    const base = path.basename(file, '.html');

    // עבודה על עותק בתיקייה זמנית עם שם לועזי, כדי להימנע מבעיות שמות עבריים
    // בשורת הפקודה של הדפדפן (כמו ב-render-cover.mjs).
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'book-pdf-'));
    const tmpHtml = path.join(tmp, 'in.html');
    fs.copyFileSync(abs, tmpHtml);
    const fileUrl = 'file:///' + tmpHtml.replace(/\\/g, '/').replace(/ /g, '%20');
    const tmpPdf = path.join(tmp, 'out.pdf');

    try {
        execFileSync(browser, [
            '--headless=new', '--disable-gpu', '--hide-scrollbars',
            '--no-sandbox', '--disable-extensions', '--disable-lcd-text',
            '--virtual-time-budget=4000',
            `--print-to-pdf=${tmpPdf}`, '--no-pdf-header-footer',
            fileUrl,
        ], { stdio: 'pipe', timeout: 90000 });

        if (!fs.existsSync(tmpPdf)) throw new Error('הדפדפן לא יצר קובץ PDF');
        const finalPdf = path.join(targetDir, base + '.pdf');
        fs.copyFileSync(tmpPdf, finalPdf);
        const kb = (fs.statSync(finalPdf).size / 1024).toFixed(0);
        console.log(`✅ ${base}.pdf  (${kb}KB)`);
    } catch (err) {
        console.error(`❌ נכשל: ${file}`, err.message);
    } finally {
        fs.rmSync(tmp, { recursive: true, force: true });
    }
}
