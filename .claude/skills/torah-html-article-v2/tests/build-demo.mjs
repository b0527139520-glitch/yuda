import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
// נתיבים יחסיים בלבד. נתיב מוחלט כאן כבר גרם פעם אחת לכך שהדמו נכתב למקום אחר,
// והבדיקות רצו בשקט על קובץ ישן.
const HERE = path.dirname(fileURLToPath(import.meta.url));
const A = path.join(HERE, '..', 'assets') + path.sep;

const css = fs.readFileSync(A + 'base.css', 'utf8');
const js  = fs.readFileSync(A + 'tts.js', 'utf8');
let html  = fs.readFileSync(A + 'template.html', 'utf8');

html = html
  .replace('/* ===== הדבק כאן את כל התוכן של assets/base.css, מילה במילה ===== */\n/* ===== ואחריו בלבד — כללים ייחודיים למאמר הזה, אם יש ===== */', css)
  .replace('/* ===== הדבק כאן את כל התוכן של assets/tts.js, מילה במילה ===== */', js)
// split/join ולא replace — כמה מהשמות מופיעים גם ברשת הפרקים וגם במפתח
// העניינים, ו-String.replace עם מחרוזת מחליף רק את המופע הראשון.
for (const [k, v] of Object.entries({
  '{{כותרת המאמר}}': 'מעלת ההודאה — הרב יהודה טאוב',
  '{{כותרת ראשית}}': 'מעלת ההודאה',
  '{{תת-כותרת מסבירה}}': 'עיון בשורש חיוב ההודאה ובמחלוקת הראשונים',
  '{{פרק א}}': 'פרק א – שורש חיוב ההודאה',
  '{{פרק ב}}': 'פרק ב – מחלוקת הראשונים',
  '{{כותרת פרק א}}': 'פרק א – שורש חיוב ההודאה',
  '{{כותרת פרק ב}}': 'פרק ב – מחלוקת הראשונים',
  '{{מקור}}': 'רמב"ם הלכות ברכות פרק י\'',
})) html = html.split(k).join(v);

const p1 = `<p>כתב הרמב"ם ז"ל בהלכות ברכות, שחיוב ההודאה נובע מן ההכרה הפשוטה שכל הטוב שאדם מקבל אינו מובן מאליו. ומתוך כך ראוי לו לאדם להתבונן בכל יום מחדש בחסדים הרבים שעושה עמו הקב"ה בכל עת ובכל שעה. ומתוך התבוננות זו יבוא לידי הודאה שלמה ואמיתית, שאינה רק מן השפה ולחוץ, אלא נובעת מעומק הלב פנימה.</p>
    <div class="verse-box"><p>"הודו לה' כי טוב, כי לעולם חסדו" (תהלים קלו, א)</p></div>
    <p>ועיין עוד בשו"ע או"ח סי' רי"ט, ובמשנ"ב שם ס"ק א' וכו'. ועיי"ש שהאריך בזה טובא.</p>`;
const p2 = `<p>נחלקו הראשונים ז"ל בגדר החיוב, ויש בזה שתי דרכים.</p>
    <div class="two-columns">
      <div class="col-purple"><h4>דרך ראשונה</h4><p>ההודאה היא חובה שכלית, א"כ אין צורך במקור מפורש.</p></div>
      <div class="col-gold"><h4>דרך שנייה</h4><p>ההודאה היא גזירת הכתוב, ומ"מ יש בה טעם.</p></div>
    </div>
    <div class="quote-box"><p>"חייב אדם לברך על הרעה כשם שמברך על הטובה"</p><span class="source-tag">ברכות נד ע"א</span></div>
    <p>ולמעשה נקטו הפוסקים שליט"א להקל בזה, וכמו שכתב בשו"ת אגרות משה.</p>`;

html = html.replace('<p>{{...}}</p>\n\n    <h2 id="section2">', p1 + '\n\n    <h2 id="section2">')
           .replace('<p>{{...}}</p>\n\n    <div class="sources">', p2 + '\n\n    <div class="sources">');

const out = path.join(HERE, 'demo.html');
fs.writeFileSync(out, html, 'utf8');

console.log('נבנה:', out);
console.log('גודל:', (html.length/1024).toFixed(1), 'KB');
console.log('placeholders שנשארו:', (html.match(/\{\{[^}]+\}\}/g) || []).join(', ') || 'אין');
console.log('סימני הדבקה שנשארו:', (html.match(/הדבק כאן/g) || []).length);

// שלוש בדיקות שמונעות "קובץ שנראה תקין ולא עושה כלום":
if (/<script>\s*<\/script>/.test(html)) { console.error('❌ נשאר בלוק <script> ריק'); process.exit(1); }
if (!html.includes('window.toggleListen')) { console.error('❌ tts.js לא הוזרק'); process.exit(1); }
if (!html.includes(js.trim())) { console.error('❌ ה-JS שהוטמע אינו זהה ל-assets/tts.js'); process.exit(1); }
if (!html.includes(css.trim())) { console.error('❌ ה-CSS שהוטמע אינו זהה ל-assets/base.css'); process.exit(1); }
console.log('✅ הקוד שהוטמע זהה בדיוק לקבצי assets/');
