// ספר מתחלף: שההקראה קוראת רק את העמוד המוצג, ושהיא מדפדפת לבד לעמוד הבא.
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
import { parseHTML } from 'linkedom';

const css  = fs.readFileSync(path.join(ROOT, 'assets', 'base.css'), 'utf8');
const pcss = fs.readFileSync(path.join(ROOT, 'assets', 'paginated.css'), 'utf8');
const pjs  = fs.readFileSync(path.join(ROOT, 'assets', 'paginated.js'), 'utf8');
const tjs  = fs.readFileSync(path.join(ROOT, 'assets', 'tts.js'), 'utf8');
let html   = fs.readFileSync(path.join(ROOT, 'assets', 'template-paginated.html'), 'utf8');

// --- הרכבת ספר לדוגמה
html = html
  .replace('/* ===== 1. כל התוכן של assets/base.css ===== */\n/* ===== 2. אחריו, כל התוכן של assets/paginated.css ===== */\n/* ===== 3. ורק אז כללים ייחודיים לספר הזה, אם יש ===== */', css + '\n' + pcss)
  .replace(/\{\{שם הספר\}\}/g, 'ספר ההודאה')
  .replace('{{תת-כותרת}}', 'עיון בשערי ההודאה')
  .replace(/\{\{כותרת פרק א\}\}/g, 'פרק א – שורש החיוב')
  .replace(/\{\{כותרת פרק ב\}\}/g, 'פרק ב – מחלוקת הראשונים')
  .replace(/\{\{תת-נושא\}\}/g, 'ההכרה הפשוטה')
  .replace('{{שם הסיפור}}', 'המכתב שאיחר')
  .replace('{{מקור}}', 'רמב"ם הלכות ברכות')
  .replace('<p>{{...}}</p>\n    </div>\n\n    <div class="page" data-title="פרק ב – מחלוקת הראשונים">',
           '<p>תוכן ראשון של פרק אלף. כאן מדובר על שורש החיוב.</p>\n    </div>\n\n    <div class="page" data-title="פרק ב – מחלוקת הראשונים">')
  .replace('<p>{{...}}</p>\n    </div>\n\n    <!-- עמוד מקורות -->',
           '<p>תוכן שני של פרק בית. כאן מדובר על המחלוקת.</p>\n    </div>\n\n    <!-- עמוד מקורות -->');

// הזרקת ה-JS לקובץ שנשמר לדפדפן. בלי זה נוצר קובץ עם <script> ריקים
// שנראה תקין לגמרי ופשוט לא עושה כלום — בדיוק התקלה שקרתה פעם אחת.
const browserHtml = html
  .replace('/* ===== הדבק כאן את כל התוכן של assets/paginated.js — לפני tts.js ===== */', pjs)
  .replace('/* ===== ואחריו את כל התוכן של assets/tts.js, מילה במילה ===== */', tjs);
for (const [name, needle] of [['paginated.js', 'window.bookNext'], ['tts.js', 'window.toggleListen']]) {
  if (!browserHtml.includes(needle)) { console.error(`❌ ${name} לא הוזרק לקובץ`); process.exit(1); }
}
if (/<script>\s*<\/script>/.test(browserHtml)) { console.error('❌ נשאר בלוק <script> ריק'); process.exit(1); }
fs.writeFileSync(path.join(HERE, 'demo-book.html'), browserHtml, 'utf8');

const { document } = parseHTML(html);
Object.getPrototypeOf(document.body).scrollIntoView = function () {};
Object.getPrototypeOf(document.body).getBoundingClientRect = function () { return { top: 100, bottom: 300 }; };
{ const s = document.getElementById('voiceSelect'); let _v = '';
  Object.defineProperty(s, 'value', { get: () => _v, set: v => { _v = v; }, configurable: true }); }

const spoken = [];
let live = null;
const synth = {
  speaking: false, pending: false, paused: false,
  getVoices: () => ([{ name: 'Microsoft Asaf - Hebrew (Israel)', lang: 'he-IL' }]),
  speak(u) { spoken.push(u); live = u; this.speaking = true; },
  cancel() { this.speaking = false; const u = live; live = null; if (u && u.onerror) u.onerror({ error: 'canceled' }); },
  pause() { this.paused = true; }, resume() { this.paused = false; },
};
class SpeechSynthesisUtterance { constructor(t) { this.text = t; } }
const storage = new Map();
const localStorage = { getItem: k => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, String(v)), removeItem: k => storage.delete(k) };
const window = { speechSynthesis: synth, addEventListener() {}, innerHeight: 800, getSelection: () => ({ toString: () => '' }) };

const run = src => new Function('window','document','location','localStorage','SpeechSynthesisUtterance','setInterval','clearInterval','setTimeout',
  src)(window, document, { pathname: '/b' }, localStorage, SpeechSynthesisUtterance, () => 0, () => {}, () => 0);
run(pjs);   // paginated.js קודם
run(tjs);   // ואז tts.js

let ok = true;
const check = (p, m, e = '') => { if (!p) ok = false; console.log(`${p ? '✅' : '❌'} ${m}${e ? '\n     ' + e : ''}`); };

const pages = [...document.querySelectorAll('#book .page')];
const activeTitle = () => document.querySelector('#book .page.active')?.getAttribute('data-title');

check(pages.length === 7, 'כל העמודים זוהו', `${pages.length} עמודים`);
check(activeTitle() === 'כריכה', 'העמוד הפעיל בטעינה הוא הכריכה', `בפועל: ${activeTitle()}`);
check(document.querySelectorAll('.book-dot').length === pages.length, 'נוצרה נקודת ניווט לכל עמוד');
check(document.getElementById('bookCounter').textContent === 'עמוד 1 מתוך 7', 'מונה העמודים נכון',
      document.getElementById('bookCounter').textContent);
check(document.getElementById('bookPrev').disabled === true, 'חץ "הקודם" מושבת בעמוד הראשון');

// --- דילוג לעמוד פרק א והתחלת הקראה
window.bookGo(3);   // 0=כריכה 1=מבט-על 2=תוכן עניינים 3=פרק א
check(activeTitle() === 'פרק א – שורש החיוב', 'קישור ממפתח העניינים מדפדף לעמוד הנכון', `בפועל: ${activeTitle()}`);

window.toggleListen();
let guard = 0;
while (live && guard++ < 60) { const u = live; synth.speaking = false; live = null; if (u.onend) u.onend(); }

const all = spoken.map(u => u.text).join(' | ');
console.log('\n--- מה הוקרא ---');
spoken.forEach((u, i) => console.log(`  [${i + 1}] ${u.text.slice(0, 60)}`));
console.log('');

check(/שורש החיוב/.test(all), 'העמוד הפעיל הוקרא');
check(/פרק אלף/.test(all), 'תוכן פרק א הוקרא');
check(/פרק בית/.test(all), 'ההקראה עברה לבד לעמוד הבא  ← bookNext');
check(activeTitle() === 'חתימה' || /מקורות/.test(activeTitle() || ''),
      'הספר התקדם בפועל עד הסוף', `העמוד הפעיל בסיום: ${activeTitle()}`);
check(!/תוכן העניינים|כותרת פרק/.test(all), 'מפתח העניינים לא הוקרא');
check(!/0527139520|קול הלשון/.test(all), 'עמוד החתימה לא הוקרא');
check(!/ההכרה הפשוטה.*ההכרה הפשוטה/s.test(all), 'מסגרת "בפרק זה" לא גרמה לכפילות');
check(spoken.every(u => u.text.length <= 180), 'כל האמירות מתחת ל-180 תווים');
check(storage.has('koltoda.book.page.ספר ההודאה'), 'העמוד הנוכחי נשמר ל-localStorage',
      [...storage.keys()].join(', '));
check(![...storage.keys()].some(k => k.startsWith('koltoda.tts.pos.')),
      'אין סימניית פסקה מיותרת במצב ספר (העמוד הוא הסימנייה)');

console.log(ok ? '\n🎉 כל הבדיקות עברו' : '\n⚠️ יש כשלים');
process.exit(ok ? 0 : 1);
