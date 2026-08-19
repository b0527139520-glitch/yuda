# הוראות לבוט: הוספת סיפורים ל"ספר הקטן" (5-new-stories.html)

מסמך זה מיועד לבוט/עוזר AI בצ'אט אחר, שממשיך את אותה עבודה: הוספת סיפורי חינוך יהודיים חדשים בעברית מנוקדת אל תוך קובץ HTML קיים בעיצוב **"Candy Pop"**.

**קובץ היעד היחיד לעדכון: `5-new-stories.html`** (לא לגעת בקובץ הגדול של 142 הסיפורים — המשתמש ממשיך רק עם הספר הקטן).

נכון לרגע כתיבת מסמך זה, הקובץ מכיל **10 סיפורים**, מזוהים `story-133` עד `story-142`, ב-10 פרקים (כל פרק = חכם אחד). **הסיפור הבא שתוסיפו צריך להתחיל ב-`story-143`.**

לפני שמתחילים: קראו את `docs/candy-pop-story-page-מפרט.md` (אם זמין) להבנת מלוא מפרט העיצוב. מסמך זה מתמקד בתהליך הטכני של ההוספה עצמה.

---

## 0. קלט מהמשתמש

המשתמש ייתן לכם קובצי Markdown (אחד לכל סיפור), בפורמט "מדריך למורה" קבוע:
- `### בֵּרוּר מַקְדִּים` או `### 🕰️ כַּרְטִיס זִהוּי לַתַּלְמִיד` — גיבור, קונפליקט, שיא, מוסר השכל, ולעיתים "דור/תקופה" ו"שנים בערך" (**חשוב לסדר כרונולוגי — ראו סעיף 2**).
- `## הַסִּפּוּר הַמָּלֵא: <כותרת>` — הסיפור עצמו, עם תת-פרקים `#### א.`, `#### ב.` וכו', ולעיתים הערות בימוי מודגשות כמו `**שורה X:** *"..."*.
- `### 💎 חִבּוּר עֶרְכִּי: ME - WE - YOU` (או "אני-אנחנו-אתה")
- `### 👨‍🏫 מַדְרִיךְ לַמּוֹרֶה / לַמְּסַפֵּר` — עם תתי-סעיפים ורשימות
- `### 📚 מְקוֹרוֹת` — רשימת מקורות

**שימו לב:** רמת ה-# משתנה בין קבצים (`##` או `###`) — הטיפול בהמרה למטה תומך בשניהם.

**באג ידוע במקורות מסוימים:** בחלק מהקבצים, בגלל תקלת קידוד במקור, אותיות לטיניות בודדות (`m`, `b`, לפעמים גם `\"` ו-`\n` כפשוטם) מופיעות בתוך מילים עבריות במקום האות המקורית (למשל `הַmָּלֵא` במקום `הַמָּלֵא`, `שֶׁbָּהֶן` במקום `שֶׁבָּהֶן`). הסקריפט בסעיף 1 מתקן את זה אוטומטית — **חובה להריץ אותו על כל קובץ, גם אם נראה "נקי"**, ואז לבדוק ידנית שלא נשארו שאריות (ראו סעיף 5, בדיקת תקינות).

---

## 1. המרת Markdown ל-HTML של גוף הסיפור

השתמשו בסקריפט הפייתון הבא בדיוק כפי שהוא (הוא כבר כולל את כל התיקונים הנדרשים: הסרת ציטוטי מקור בסוגריים מרובעים `[...]`, המרת `**bold**`/`*italic*`, רשימות, ציטוטים מוזחים, תיקון אותיות `m`/`b` לטיניות שהתחלפו בטעות, וניקוי ארטיפקטים של `\"` ו-`\n`):

```python
import re

def fix_mem(text):
    text = re.sub(r'(?<![A-Za-z])m(?![A-Za-z])', 'מ', text)
    text = re.sub(r'(?<![A-Za-z])b(?![A-Za-z])', 'ב', text)
    return text

def strip_refs(text):
    return re.sub(r'\s*\[[^\]\[]{1,200}?\]', '', text)

def inline(text):
    text = fix_mem(text)
    text = strip_refs(text)
    text = re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', text)
    text = re.sub(r'(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)', r'<em>\1</em>', text)
    text = text.strip()
    return text

def render_bullets(lines):
    items = []
    for ln in lines:
        ln = ln.strip()
        ln = re.sub(r'^[-\d.]+\s*', '', ln) if re.match(r'^\d+\.\s', ln) else re.sub(r'^-\s*', '', ln)
        if ln:
            items.append('<li>' + inline(ln) + '</li>')
    return '<ul class="story-list">\n' + '\n'.join(items) + '\n</ul>'

def render_block(md):
    lines = md.split('\n')
    html = []
    buf_para = []
    buf_bullets = []

    def flush_para():
        if buf_para:
            txt = ' '.join(x.strip() for x in buf_para if x.strip())
            if txt:
                html.append('<p>' + inline(txt) + '</p>')
            buf_para.clear()

    def flush_bullets():
        if buf_bullets:
            html.append(render_bullets(buf_bullets))
            buf_bullets.clear()

    for raw in lines:
        line = raw.rstrip()
        stripped = line.strip()
        if not stripped:
            flush_para(); flush_bullets()
            continue
        if re.match(r'^-{3,}$', stripped):
            continue
        if stripped.startswith('#### '):
            flush_para(); flush_bullets()
            title = inline(stripped[5:])
            html.append(f'<p class="bold-para">{title}</p>')
        elif stripped.startswith('- ') or re.match(r'^\d+\.\s', stripped):
            flush_para()
            buf_bullets.append(stripped)
        elif stripped.startswith('>'):
            flush_para(); flush_bullets()
            quote = stripped.lstrip('>').strip()
            html.append(f'<p class="bold-para">{inline(quote)}</p>')
        else:
            if buf_bullets:
                flush_bullets()
            buf_para.append(stripped)
    flush_para(); flush_bullets()
    return '\n\n'.join(html)

def clean_artifacts(text):
    text = text.replace('\\"', '"')
    text = re.sub(r'\\[א-תA-Za-z]', ' ', text)
    return text

def convert_story(md_text):
    md_text = clean_artifacts(md_text.strip())
    md_text = re.sub(r'^#{1}\s+.*?\n', '', md_text, count=1)  # drop stray leading H1 if present
    parts = re.split(r'\n(?=#{2,3} )', md_text.strip())
    sections = []
    for part in parts:
        part = part.strip()
        if not part:
            continue
        m = re.match(r'^#{2,3}\s*(.+)', part)
        if m:
            header = m.group(1).strip()
            body = part[m.end():].strip()
            sections.append((header, body))
        else:
            sections.append((None, part))

    out = []
    for header, body in sections:
        if header:
            icon = '' if re.match(r'^[^\w\sא-ת]', header) else '🔹 '
            out.append(f'<h3 class="section-heading">{icon}{inline(header)}</h3>')
        rendered = render_block(body)
        if rendered.strip():
            out.append(rendered)
        out.append('<hr class="story-sep">')
    html = '\n\n'.join(x for x in out if x.strip())
    html = re.sub(r'\n*<hr class="story-sep">\s*$', '', html.strip())
    return html
```

הרצה לכל קובץ סיפור חדש:
```python
with open('path/to/new-story-guide.md', encoding='utf-8') as f:
    md = f.read()
body_html = convert_story(md)
```

**בדיקת איכות חובה אחרי ההמרה** — חפשו אותיות לטיניות בודדות שנשארו (סימן שהתיקון לא כיסה הכול):
```python
import re
leftover = re.findall(r'(?<![<a-zA-Z/])[hpbiInm](?![a-zA-Z>])', body_html)
print(leftover)  # צריך להיות ריק; אם לא — יש עוד אותיות שהתחלפו בטעות שצריך לתקן ידנית
```

---

## 2. קביעת סדר כרונולוגי וסדר ה-ID

המשתמש ביקש שהסיפורים יופיעו **לפי סדר הדורות** (לא לפי סדר ההעלאה). לכל סיפור חדש:
1. חפשו בקובץ המקור את השדה "דּוֹר / תְּקֻופָה" ו/או "שָׁנִים בְּעֵרֶךְ" (מופיע בד"כ בתחילת ה"בירור מקדים" או "כרטיס זיהוי").
2. אם אין תאריך מפורש — שאלו את המשתמש, או השתמשו בידע כללי על תקופת החכם (תנאים/אמוראים/זוגות וכו').
3. סדרו את **הסיפורים החדשים שאתם מוסיפים בסבב הזה** ביניהם לפי התאריך (מהמוקדם למאוחר), בדיוק כמו שנעשה בסבב הקודם:
   - אנטיגנוס איש סוכו (~250 לפנה"ס) → יוסי בן יוחנן (~170) → נתאי הארבלי (~140) → יהושע בן פרחיה (~110) → אלעזר בן ערך (~70 לספירה).
4. **אין צורך לסדר מחדש את כל הפרקים הקיימים בקובץ** — רק הוסיפו את הפרקים החדשים בסוף, בסדר הכרונולוגי הפנימי שלהם. הדבר תואם למוסכמה שכבר קיימת בקובץ (כל סבב הוספה מתווסף בסופו, מסודר פנימית).
5. מספרי ה-`story-ID` תמיד עולים לפי סדר ההוספה (לא לפי התאריך ההיסטורי) — כלומר גם אם הסיפור הראשון בסבב החדש הוא ההיסטורי-מוקדם ביותר, הוא עדיין מקבל את המספר הרץ הבא (למשל אם הקובץ מסתיים ב-`story-142`, הסיפור ההיסטורי-מוקדם ביותר בסבב הבא מקבל `story-143`, הבא אחריו `story-144`, וכו', כשהם מסודרים בקובץ לפי סדר התאריך).

---

## 3. בניית ה-HTML הנוסף לכל סיפור

לכל סיפור, בנו שני קטעי HTML: **קטע פרק** (chapter section, נכנס ל-`<main>`) ו**רשומת תפריט צד** (TOC block, נכנס ל-`<aside>`).

### 3א. תבנית קטע הפרק (להכניס לפני `</main>`)

```html
<section class="chapter-section" id="chapter-<slug-של-שם-החכם>">
<div class="chapter-header" style="background: linear-gradient(135deg, <צבע1>, <צבע2>)">
<div class="chapter-icon"><אימוג'י מתאים></div>
<h2 class="chapter-title"><שם החכם></h2>
<div class="chapter-subtitle">1 סיפורים</div>
</div>
<article class="story-card" id="story-<מספר>" style="border-top: 6px solid <צבע1>">
<div class="story-header" style="background:#f4f4ff">
<span class="story-num" style="background:<צבע1>">#<מספר></span>
<h3 class="story-title"><כותרת הסיפור></h3>
<span class="teacher-badge" style="background:<צבע1>">👨‍🏫 כולל מדריך למורה</span>
</div>
<div class="story-body">
<כאן ה-HTML שהתקבל מ-convert_story()>
</div>
</article>
</section>
```

**הערות:**
- `id="chapter-..."` — שם החכם עם רווחים מוחלפים במקפים (בדיוק כמו הכותרת בעברית, למשל `chapter-רבי-אלעזר-בן-ערך`).
- **צבעים:** בחרו זוג גרדיאנט מתוך הפלטה הקיימת (`#ff6b9d`/`#c62b6b`, `#4ec9f0`/`#1a6fa0`, `#ffd93d`/`#e08e00`, `#a29bfe`/`#6c5ce7`, `#7bed9f`/`#2e7d50`, `#ff4757`/`#8b0000`) — אפשר לחזור על צבעים, הספר כבר עושה זאת.
- **אימוג'י:** בחרו לפי תוכן הסיפור (למשל 🏠 לסיפור על הכנסת אורחים, 🐑 לסיפור עם כבשים, ✉️ למכתב סודי).
- מספר הסיפורים ב"chapter-subtitle" ובתפריט הצד הוא **1** אלא אם אתם מוסיפים עוד סיפור לאותו חכם שכבר קיים בקובץ (במקרה כזה — ראו הערה בסוף סעיף 3ב).

### 3ב. תבנית רשומת התפריט (להכניס לפני `</aside>`)

```html
<div class="toc-chapter" style="border-color:<צבע1>">
<div class="toc-chapter-title" style="background:<צבע1>" onclick="toggleTocChapter(this)"><span class="toc-icon"><אימוג'י></span><a href="#chapter-<slug>" class="toc-sage-link"><שם החכם></a><span class="toc-count">1 סיפורים</span><span class="toc-arrow">▼</span></div>
<ul class="toc-stories">
<li><a href="#story-<מספר>"><כותרת הסיפור></a></li>
</ul>
</div>
```

**אם מוסיפים סיפור נוסף לחכם שכבר קיים בקובץ** (למשל עוד סיפור על רבי יהודה בר אלעאי): אל תיצרו chapter חדש — הוסיפו `<article>` נוסף בתוך ה-`<section>` הקיים (לפני ה-`</section>` שלו), הוסיפו `<li>` נוסף בתוך ה-`<ul class="toc-stories">` הקיים, ועדכנו את שני המונים ("X סיפורים") ב-chapter-subtitle וב-toc-count מ-X ל-X+1.

---

## 4. עדכון searchData (חובה — בלי זה הסיפור לא יימצא בחיפוש)

בתחתית הקובץ יש `<script>` עם מערך JS (לא JSON תקני — מפתחות בלי מרכאות, מחרוזות במרכאות בודדות):
```js
const searchData = [
  {id:'story-133',title:'...',body:'...'},
  ...
];
```

לכל סיפור חדש, הוסיפו רשומה **לפני** ה-`];` הסוגר, עם:
- `id` — אותו מזהה כמו ב-`<article id="...">`.
- `title` — כותרת הסיפור (טקסט רגיל).
- `body` — **טקסט רגיל בלבד** (בלי תגי HTML!): קחו את ה-HTML מ-`convert_story()`, הסירו את כל התגים (`re.sub(r'<[^>]+>', ' ', html)`), כווצו רווחים כפולים, ואז ברחו (escape) לפי הכללים של JS single-quoted string.

```python
import re

def escape_js_string(s):
    s = s.replace("\\", "\\\\")
    s = s.replace("'", "\\'")
    s = s.replace("\n", " ")
    s = s.replace("\r", "")
    s = s.replace("\t", " ")
    return s

def strip_html(html_snippet):
    return re.sub(r'<[^>]+>', ' ', html_snippet)

body_text = re.sub(r'\s+', ' ', strip_html(body_html)).strip()
entry = f"  {{id:'story-143',title:'{escape_js_string(title)}',body:'{escape_js_string(body_text)}'}}"
```

הוסיפו פסיק אחרי הרשומה הקודמת האחרונה, ואז את הרשומות החדשות, לפני `\n];`.

---

## 5. עדכון מונים בראש הדף (Hero stats)

בקטע ה-`<header class="hero">` יש:
```html
<div class="stat-bubble">📚 10 סיפורים</div>
<div class="stat-bubble">👑 10 גדולי ישראל</div>
```
עדכנו את שני המספרים: **"סיפורים"** = מספר ה-`<article class="story-card">` הכולל בקובץ; **"גדולי ישראל"** = מספר ה-`<section class="chapter-section">` הכולל (כלומר מספר החכמים השונים, לא מספר הסיפורים — חכם עם שני סיפורים נספר פעם אחת).

גם ה-`<title>` וה-`<h1 class="hero-title">` בראש הקובץ כוללים מספר ("N סיפורים חדשים") — עדכנו גם אותם לאותו מספר.

---

## 6. בדיקת תקינות — חובה להריץ לפני מסירת הקובץ

```python
# 1. בדיקת HTML תקין
from html.parser import HTMLParser
class P(HTMLParser):
    def error(self, message): print('ERROR:', message)
html = open('5-new-stories.html', encoding='utf-8').read()
P().feed(html)

# 2. איזון תגים
for tag in ['section','article','aside','main']:
    o, c = html.count(f'<{tag}'), html.count(f'</{tag}>')
    assert o == c, f'{tag} mismatch: {o} open vs {c} close'

# 3. תקינות JS
import re, subprocess
script = re.search(r'<script>(.*?)</script>', html, re.DOTALL).group(1)
open('/tmp/check.js', 'w', encoding='utf-8').write(script)
subprocess.run(['node', '--check', '/tmp/check.js'], check=True)

# 4. כל סיפור חדש חייב להופיע פעמיים: פעם ב-<article id="..."> (נראה בעמוד) ופעם ב-searchData (id:'...')
for sid in ['story-143']:  # עדכנו לרשימת המזהים החדשים בפועל
    assert html.count(f'id="{sid}"') == 1, f'{sid} missing from visible body!'
    assert f"id:'{sid}'" in html, f'{sid} missing from searchData!'
```

**זו הטעות הכי קריטית שקרתה בעבר:** להוסיף סיפור רק ל-`searchData` (כך שהוא "נמצא" בחיפוש) בלי להוסיף גם `<section>`/`<article>` נראה בגוף העמוד. התוצאה: הסיפור בלתי נראה בגלילה רגילה, ולחיצה על תוצאת חיפוש לא מובילה לשום מקום. **תמיד להוסיף את שניהם יחד ולוודא עם הבדיקה בסעיף 4 לעיל.**

---

## 7. סיכום זרימת העבודה

1. קבלו קובץ/י Markdown חדשים מהמשתמש.
2. הריצו את `convert_story()` על כל אחד, בדקו שאריות תיקון (סעיף 1).
3. קבעו סדר כרונולוגי בין הסיפורים החדשים (סעיף 2), והמשיכו את מספור ה-`story-ID` מהמספר הרץ הבא.
4. בנו chapter-section + article לכל סיפור (סעיף 3א), הכניסו לפני `</main>`.
5. בנו toc-chapter block לכל סיפור (סעיף 3ב), הכניסו לפני `</aside>`.
6. עדכנו את `searchData` (סעיף 4).
7. עדכנו את מוני ה-hero, הכותרת וה-h1 (סעיף 5).
8. הריצו את כל בדיקות התקינות (סעיף 6) — **אל תמסרו קובץ שלא עבר את כולן**.
9. שלחו את הקובץ המעודכן למשתמש.
