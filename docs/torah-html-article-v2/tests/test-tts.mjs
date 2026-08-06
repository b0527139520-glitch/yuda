// בדיקת מנוע ההקראה: פרסינג + עיבוד טקסט + פיצול לאמירות
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');


const SRC = path.join(ROOT, 'assets', 'tts.js');
const src = fs.readFileSync(SRC, 'utf8');

// --- 1. האם הקובץ בכלל מתפרסר?
try { new Function(src); console.log('✅ פרסינג: הקובץ תקין תחבירית'); }
catch (e) { console.log('❌ פרסינג נכשל:', e.message); process.exit(1); }

// --- 2. חילוץ הפונקציות מהמקור עצמו (כולל ab/G/R — לא עותק מקומי!)
const MAX_CHUNK = 180;
const body = src.slice(src.indexOf("var G = '"), src.indexOf('function chunkText'));
const fn = new Function('MAX_CHUNK', body + '\n return {forSpeech, splitSentences, splitLong};');
const { forSpeech, splitSentences, splitLong } = fn(MAX_CHUNK);

const chunkSrc = src.slice(src.indexOf('function chunkText'), src.indexOf('/* ========================================================================='  , src.indexOf('function chunkText')));
const chunkText = new Function('splitSentences', 'splitLong', 'MAX_CHUNK', chunkSrc + '\n return chunkText;')(splitSentences, splitLong, MAX_CHUNK);

// --- 3. מבחני ראשי תיבות
const cases = [
  ['כתב הרמב"ם ז"ל בהלכות ברכות', ['רמבם', 'זכרונו לברכה']],
  ['ועיין בשו"ע או"ח סי\' רי"ט ובמשנ"ב ס"ק א\'', ['שולחן ערוך', 'אורח חיים', 'סימן', 'משנה ברורה', 'סעיף קטן']],
  ['ברכות נד ע"א', ['עמוד א']],
  ['הפוסקים שליט"א נקטו וכו\'', ['שליטא', 'וכולי']],
  ['אמר הקב"ה ע"פ דברי ר\' יוחנן', ['הקדוש ברוך הוא', 'על פי', 'רבי']],
  ['📚 מקורות ומראי מקומות', []],
  ['"הודו לה\' כי טוב" (תהלים קלו, א)', []],
];
console.log('\n--- עיבוד טקסט להקראה ---');
let ok = true;
for (const [input, must] of cases) {
  const out = forSpeech(input);
  const missing = must.filter(m => !out.includes(m));
  const hasEmoji = /[\uD800-\uDBFF][\uDC00-\uDFFF]/.test(out);
  const pass = missing.length === 0 && !hasEmoji;
  if (!pass) ok = false;
  console.log(`${pass ? '✅' : '❌'} ${JSON.stringify(input)}\n     → ${JSON.stringify(out)}${missing.length ? '\n     חסר: ' + missing.join(', ') : ''}`);
}

// --- 3b. שם השם: "ה'" חייב להישמע "השם", חוץ מהקשר מספרי
console.log('\n--- החלפת "ה\'" ל"השם" ---');
const hashemCases = [
  ['"הודו לה\' כי טוב"', true], ['ברוך ה\' אשר לא עזב', true],
  ['וזו עבודת ה\' אמיתית.', true], ['את ה\' אלוקיך תירא', true],
  ['מאת ה\' היתה זאת', true], ['וה\' פקד את שרה', true],
  ['בה\' בטחתי', true], ['יראת ה׳ היא אוצרו.', true],
  ['עיין פרק ה\' הלכה ב', false], ['ביום ה\' בשבת', false],
  ['שולחן ערוך סימן ה\'', false], ['עמוד ה\' שם', false],
  ['ועיין בשו"ע סי\' ה\'', false],
];
for (const [input, shouldReplace] of hashemCases) {
  const out = forSpeech(input);
  const pass = out.includes('השם') === shouldReplace;
  if (!pass) ok = false;
  console.log(`${pass ? '✅' : '❌'} ${shouldReplace ? '[שם]  ' : '[מספר]'} ${JSON.stringify(input)}\n     → ${JSON.stringify(out)}`);
}

// --- 4. מבחן הפיצול (הבאג המרכזי)
console.log('\n--- פיצול לאמירות (סף Chrome) ---');
const longPara = 'כתב הרמב"ם ז"ל בהלכות ברכות, שחיוב ההודאה נובע מן ההכרה הפשוטה שכל הטוב שאדם מקבל אינו מובן מאליו, ומתוך כך ראוי לו לאדם להתבונן בכל יום מחדש בחסדים הרבים שעושה עמו הקדוש ברוך הוא בכל עת ובכל שעה, ומתוך התבוננות זו יבוא לידי הודאה שלמה ואמיתית שאינה רק מן השפה ולחוץ אלא נובעת מעומק הלב פנימה, וכפי שהאריכו בזה רבותינו הראשונים ז"ל במקומות רבים. ועוד יש להוסיף בזה דבר נפלא. שהרי מצינו בכמה מקומות שההודאה היא יסוד כל העבודה כולה.';
const spoken = forSpeech(longPara);
const parts = chunkText(spoken);
const over = parts.filter(p => p.length > MAX_CHUNK);
console.log(`אורך הפסקה המקורית: ${longPara.length} תווים  (≈${(longPara.length/11).toFixed(0)} שניות — הרבה מעל סף הקטיעה של 15 שניות)`);
console.log(`פוצלה ל-${parts.length} אמירות, הארוכה ביותר: ${Math.max(...parts.map(p=>p.length))} תווים`);
console.log(over.length === 0 ? '✅ אף אמירה לא חורגת מ-180 תווים' : `❌ ${over.length} אמירות חורגות`);
if (over.length) ok = false;

// אין אובדן טקסט
const rejoined = parts.join(' ').replace(/\s+/g, ' ').trim();
const original = spoken.replace(/\s+/g, ' ').trim();
const lossless = rejoined.replace(/\s/g,'') === original.replace(/\s/g,'');
console.log(lossless ? '✅ הפיצול לא איבד ולא שכפל אף תו' : '❌ הפיצול שינה את הטקסט');
if (!lossless) ok = false;

parts.forEach((p, i) => console.log(`   [${i+1}] (${p.length}) ${p.slice(0, 55)}…`));

// --- 5. מקרי קצה
console.log('\n--- מקרי קצה ---');
const edge = [['', 0], ['שלום.', 1], ['א'.repeat(500), Math.ceil(500/180)]];
for (const [inp, minParts] of edge) {
  const r = chunkText(forSpeech(inp));
  const pass = inp === '' ? r.length === 0 : r.length >= minParts && r.every(p => p.length <= MAX_CHUNK);
  if (!pass) ok = false;
  console.log(`${pass ? '✅' : '❌'} קלט באורך ${inp.length} → ${r.length} אמירות`);
}

console.log(ok ? '\n🎉 כל הבדיקות עברו' : '\n⚠️ יש כשלים');
process.exit(ok ? 0 : 1);
