// בדיקת קצה-לקצה: טוען את demo.html, מריץ את tts.js על DOM אמיתי,
// ומדמה מנוע דיבור כדי לראות מה בדיוק היה מוקרא ובאיזה סדר.
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

import { parseHTML } from 'linkedom';

const html = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'demo.html'), 'utf8');
const SRC = path.join(ROOT, 'assets', 'tts.js');
const ttsSrc = fs.readFileSync(SRC, 'utf8');

// הבדיקה חייבת לרוץ על הקוד הנוכחי. אם demo.html ישן מ-tts.js — עוצרים מיד,
// אחרת כל הבדיקות "עוברות" בשקט מול גרסה שכבר לא קיימת. זה כבר קרה פעם אחת.
if (!html.includes(ttsSrc.trim())) {
  console.error('❌ demo.html אינו תואם ל-assets/tts.js. הרץ קודם: node build-demo.mjs');
  process.exit(1);
}

const { document } = parseHTML(html);
Object.getPrototypeOf(document.body).scrollIntoView = function () {};
// linkedom מגדיר select.value כ-getter בלבד; בדפדפן אמיתי הוא ניתן לכתיבה.
{
  const sel = document.getElementById('voiceSelect');
  let _v = '';
  Object.defineProperty(sel, 'value', { get: () => _v, set: v => { _v = v; }, configurable: true });
}

// ---- מנוע דיבור מדומה
const spoken = [];
let onendQueue = [];
const synth = {
  speaking: false, pending: false, paused: false,
  getVoices: () => ([
    { name: 'Microsoft Asaf - Hebrew (Israel)', lang: 'he-IL' },
    { name: 'Microsoft Hila Online (Natural) - Hebrew (Israel)', lang: 'he-IL' },
    { name: 'Microsoft David - English (United States)', lang: 'en-US' },
  ]),
  speak(u) { spoken.push(u); this.speaking = true; onendQueue.push(u); },
  cancel() { this.speaking = false; onendQueue = []; },
  pause() { this.paused = true; }, resume() { this.paused = false; },
};
class SpeechSynthesisUtterance { constructor(t) { this.text = t; } }

const storage = new Map();
const localStorage = {
  getItem: k => (storage.has(k) ? storage.get(k) : null),
  setItem: (k, v) => storage.set(k, String(v)),
  removeItem: k => storage.delete(k),
};

const window = {
  speechSynthesis: synth,
  addEventListener() {},
  getSelection: () => ({ toString: () => '' }),
};
const location = { pathname: '/demo.html' };

new Function('window', 'document', 'location', 'localStorage', 'SpeechSynthesisUtterance',
            'setInterval', 'clearInterval', 'setTimeout',
            ttsSrc)(window, document, location, localStorage, SpeechSynthesisUtterance,
                    () => 0, () => {}, () => 0);

let ok = true;
const check = (pass, msg, extra = '') => { if (!pass) ok = false; console.log(`${pass ? '✅' : '❌'} ${msg}${extra ? '\n     ' + extra : ''}`); };

// ---- הפעלה + הרצה של כל התור
window.toggleListen();
// לדחוף את התור קדימה ידנית (onend)
let guard = 0, midBookmark = null;
while (onendQueue.length && guard++ < 500) {
  const u = onendQueue.shift();
  synth.speaking = false;
  if (u.onend) u.onend();
  if (guard === 5) midBookmark = [...storage.entries()].find(([k]) => k.startsWith('koltoda.tts.pos.'));
}

console.log('--- מה הוקרא, לפי הסדר ---');
spoken.forEach((u, i) => console.log(`  [${i + 1}] (${u.text.length}) ${u.text.slice(0, 62)}${u.text.length > 62 ? '…' : ''}`));
console.log('');

const all = spoken.map(u => u.text).join(' | ');

check(spoken.length > 0, 'ההקראה בכלל התחילה', `${spoken.length} אמירות`);
check(!/תוכן העניינים/.test(all), 'תוכן העניינים לא מוקרא  ← הבאג המרכזי שתוקן');
check(!/מקורות ומראי מקומות/.test(all), 'רשימת המקורות לא מוקראת');
check(!/0527139520|קול הלשון|קרית אתא/.test(all), 'החתימה לא מוקראת');
check(!/מהירות|האזן למאמר|בחירת קול/.test(all), 'סרגל ההאזנה עצמו לא מוקרא');
check(/^מעלת ההודאה/.test(spoken[0]?.text || ''), 'ההקראה מתחילה מכותרת המאמר', `בפועל: "${spoken[0]?.text.slice(0,40)}"`);

const over = spoken.filter(u => u.text.length > 180);
check(over.length === 0, 'אף אמירה לא חורגת מ-180 תווים (סף הקטיעה של Chrome)',
      over.length ? `חריגות: ${over.map(u=>u.text.length).join(', ')}` : `הארוכה ביותר: ${Math.max(...spoken.map(u=>u.text.length))}`);

check(/שולחן ערוך/.test(all) && /משנה ברורה/.test(all) && /הקדוש ברוך הוא/.test(all),
      'ראשי תיבות מורחבים בתוכן אמיתי');
check(!/["״]/.test(all.replace(/"[^"]{0,80}"/g, '')), 'אין גרשיים תקועים בתוך מילים');
check(!/[\uD800-\uDBFF]/.test(all), 'אין אימוג\'י בטקסט המוקרא');
check(/כשם שמברך על הטובה/.test(all), 'תוכן הקופסאות (ציטוט מחז"ל) כן מוקרא');
check(/דרך ראשונה/.test(all) && /דרך שנייה/.test(all), 'תוכן two-columns כן מוקרא');

// ---- בחירת קול
const sel = document.getElementById('voiceSelect');
const groups = [...sel.querySelectorAll('optgroup')].map(g => g.getAttribute('label'));
const opts = [...sel.querySelectorAll('option')].map(o => o.getAttribute('value'));
check(groups.includes('עברית') && groups.includes('שפות אחרות'), 'ה-dropdown מציג גם קולות לא-עבריים', `קבוצות: ${groups.join(', ')}`);
check(opts.length === 3, 'כל הקולות המותקנים מופיעים', `${opts.length} קולות`);

// ---- סימנייה
check(!!midBookmark, 'מיקום הקריאה נשמר ל-localStorage תוך כדי האזנה',
      midBookmark ? `${midBookmark[0]} = ${midBookmark[1]}` : 'לא נשמר כלום');
check([...storage.keys()].every(k => !k.startsWith('koltoda.tts.pos.')),
      'הסימנייה נמחקת כשהמאמר מסתיים (לא ממשיכים מהסוף בפעם הבאה)');

// ---- ניקוי אחרי סיום
check(document.querySelectorAll('.reading-highlight').length === 0, 'ההדגשה מוסרת בסיום ההקראה');
check(document.querySelectorAll('.tts-clickable').length > 0 &&
      [...document.querySelectorAll('.tts-clickable')].every(e => !e.closest('.toc, .footer, .sources')),
      'לחיצה-להקראה מחוברת רק לגוף המאמר',
      `${document.querySelectorAll('.tts-clickable').length} אלמנטים`);

// ---- מתג "לחיצה על פסקה מפעילה הקראה"
console.log('\n--- מתג לחיצה-להקראה ---');
const para = document.querySelector('.container h2#section1').nextElementSibling;
const toggleBtn = document.getElementById('clickReadBtn');

window.stopListen(); spoken.length = 0; onendQueue = [];
para.click();
check(spoken.length > 0, 'ברירת מחדל: לחיצה על פסקה מתחילה הקראה', `${spoken.length} אמירות`);
check(para.classList.contains('tts-clickable'), 'הפסקה מסומנת כלחיצה (סמן יד + הדגשת ריחוף)');

window.stopListen(); spoken.length = 0; onendQueue = [];
window.toggleClickRead();
check(toggleBtn.textContent.includes('כבויה'), 'הכפתור מציג "כבויה"', toggleBtn.textContent);
check(toggleBtn.getAttribute('aria-pressed') === 'false', 'aria-pressed מתעדכן');
check(!para.classList.contains('tts-clickable'), 'הפסקה כבר לא מסומנת כלחיצה');
check(document.getElementById('listenStatus').textContent.includes('לא תפעיל'), 'הסטטוס מסביר את המצב החדש');

para.click();
check(spoken.length === 0, 'כבוי: לחיצה על פסקה לא מפעילה כלום  ← מה שביקשנו',
      spoken.length ? `דיבר בכל זאת: "${spoken[0].text.slice(0,30)}"` : '');
check(storage.get('koltoda.tts.clickRead') === '0', 'הבחירה נשמרה ותקפה גם למאמרים אחרים');

// והכפתור עצמו עדיין עובד גם כשהמתג כבוי
window.toggleListen();
check(spoken.length > 0, 'כפתור ההאזנה ממשיך לעבוד כרגיל גם כשהמתג כבוי');

window.toggleClickRead();
check(toggleBtn.textContent.includes('פעילה') && para.classList.contains('tts-clickable'),
      'הדלקה חוזרת מחזירה את ההתנהגות');

console.log(ok ? '\n🎉 כל הבדיקות עברו' : '\n⚠️ יש כשלים');
process.exit(ok ? 0 : 1);
