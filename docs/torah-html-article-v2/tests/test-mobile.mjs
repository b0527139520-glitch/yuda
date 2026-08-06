// תרחיש נעילת מסך בנייד — הבאג "קופץ לעמוד האחרון".
// מדמה בדיוק מה שדפדפן נייד עושה: מבטל את האמירה הנוכחית כשהמסך נכבה,
// ויורה onerror על כל מה שבתור.
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

import { parseHTML } from 'linkedom';

const html = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'demo.html'), 'utf8');
const SRC = path.join(ROOT, 'assets', 'tts.js');
const ttsSrc = fs.readFileSync(SRC, 'utf8');

const { document } = parseHTML(html);
Object.getPrototypeOf(document.body).scrollIntoView = function () {};
{ const s = document.getElementById('voiceSelect'); let _v = '';
  Object.defineProperty(s, 'value', { get: () => _v, set: v => { _v = v; }, configurable: true }); }

const spoken = [];
let live = null;                       // האמירה שמתנגנת כרגע
const synth = {
  speaking: false, pending: false, paused: false,
  getVoices: () => ([{ name: 'Microsoft Asaf - Hebrew (Israel)', lang: 'he-IL' }]),
  blocked: false,
  speak(u) {
    // iOS חוסם בשקט הקראה שלא נולדה ממגע משתמש: הקריאה מתקבלת ולא קורה כלום.
    if (this.blocked) return;
    spoken.push(u); live = u; this.speaking = true;
  },
  cancel() {
    this.speaking = false;
    // כך דפדפן אמיתי מתנהג: האמירה שבוטלה יורה onerror עם 'canceled'.
    const u = live; live = null;
    if (u && u.onerror) u.onerror({ error: 'canceled' });
  },
  pause() { this.paused = true; }, resume() { this.paused = false; },
};
class SpeechSynthesisUtterance { constructor(t) { this.text = t; } }
const storage = new Map();
const localStorage = { getItem: k => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, String(v)), removeItem: k => storage.delete(k) };

let visHandler = null;
const origAdd = document.addEventListener.bind(document);
document.addEventListener = (type, fn) => { if (type === 'visibilitychange') visHandler = fn; else origAdd(type, fn); };
let hidden = false;
Object.defineProperty(document, 'hidden', { get: () => hidden, configurable: true });

const window = { speechSynthesis: synth, addEventListener() {}, getSelection: () => ({ toString: () => '' }) };
const timers = [];
new Function('window','document','location','localStorage','SpeechSynthesisUtterance','setInterval','clearInterval','setTimeout',
             ttsSrc)(window, document, { pathname: '/d' }, localStorage, SpeechSynthesisUtterance,
                     () => 0, () => {}, (fn) => { timers.push(fn); return 0; });

let ok = true;
const check = (p, m, e = '') => { if (!p) ok = false; console.log(`${p ? '✅' : '❌'} ${m}${e ? '\n     ' + e : ''}`); };

// --- מקריאים 4 פסקאות
window.toggleListen();
for (let i = 0; i < 3; i++) { const u = live; synth.speaking = false; live = null; if (u?.onend) u.onend(); }
const beforeLock = spoken.length;
const lastText = spoken[spoken.length - 1].text;
console.log(`הקראנו ${beforeLock} אמירות. הנוכחית: "${lastText.slice(0, 45)}…"\n`);

// --- המסך נכבה
hidden = true;
visHandler();

check(spoken.length === beforeLock,
      'נעילת המסך לא גררה מרוץ דרך כל המאמר  ← הבאג "קופץ לעמוד האחרון"',
      `אמירות לפני: ${beforeLock}, אחרי: ${spoken.length}` +
      (spoken.length > beforeLock ? `  (רץ קדימה ${spoken.length - beforeLock} פסקאות!)` : ''));

// --- המסך נדלק חזרה
hidden = false;
visHandler();

check(spoken.length === beforeLock + 1, 'ההקראה חודשה בדיוק אמירה אחת', `סה"כ ${spoken.length}`);
check(spoken[spoken.length - 1].text === lastText,
      'ממשיכה מאותה פסקה בדיוק, לא מהסוף ולא מההתחלה',
      `חודש מ: "${spoken[spoken.length - 1].text.slice(0, 45)}…"`);

// --- iOS: אם הדפדפן חסם את ההקראה (אין קול), האם נופלים למצב "המשך" גלוי?
spoken.length = 0; live = null; synth.speaking = false; synth.pending = false;
hidden = true; visHandler();
synth.blocked = true;                // מכאן והלאה הדפדפן מתעלם מ-speak()
timers.length = 0;
hidden = false; visHandler();
timers.forEach(fn => fn());          // מריצים את ה-setTimeout של בדיקת iOS
const btn = document.getElementById('listenBtn');
const status = document.getElementById('listenStatus');
check(btn.textContent.includes('המשך'),
      'באייפון, כשהדפדפן חוסם הקראה אוטומטית — הכפתור עובר ל"▶ המשך" ולא נתקע על "מקריא..."',
      `כפתור: "${btn.textContent}" | סטטוס: "${status.textContent}"`);

console.log(ok ? '\n🎉 כל הבדיקות עברו' : '\n⚠️ יש כשלים');
process.exit(ok ? 0 : 1);
