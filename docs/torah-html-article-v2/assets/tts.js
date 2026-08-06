/* =============================================================================
   קול תודה — מנוע הקראה למאמרים תורניים   |   tts.js   v2.0
   -----------------------------------------------------------------------------
   העתק את הקובץ הזה כמות שהוא לתוך תגית <script> בסוף ה-HTML.
   אין לכתוב אותו מחדש, לקצר או "לשפר" תוך כדי יצירת מאמר — הוא נבדק כך.
   Web Speech API בלבד: בלי API חיצוני, בלי מפתח, בלי רשת, בלי עלות.
   ============================================================================= */
(function () {
    'use strict';

    var bar = document.querySelector('.listen-bar');
    if (!('speechSynthesis' in window)) {
        if (bar) bar.innerHTML = '<span class="listen-status">הדפדפן שלך אינו תומך בהקראה קולית. נסה Chrome, Edge או Safari.</span>';
        return;
    }
    var synth = window.speechSynthesis;

    /* ---------- הגדרות ---------- */
    var NS       = 'koltoda.tts.';                 // מרחב שמות ב-localStorage, משותף לכל המאמרים
    var POS_KEY  = NS + 'pos.' + (document.title || location.pathname);
    var MAX_CHUNK = 180;                           // תווים לכל אמירה — מתחת לסף הקטיעה של Chrome
    // כל אלה הם ניווט או מטא-מידע, לא גוף המאמר. מי שמאזין לא רוצה לשמוע
    // את מפתח העניינים, את רשימת המקורות או את "בפרק זה" לפני כל פרק.
    var SKIP     = '.footer, .toc, .sources, .listen-bar, .book-nav, .in-this-chapter, .chapter-card, .chapter-grid, .no-tts';

    /* ---------- מצב ---------- */
    var chunks = [], elCount = 0, idx = 0, built = false, selfAdvancing = false;
    var isOn = false, paused = false, autoPaused = false;
    var token = 0, watchdog = null;
    var rate = 1, voices = [], voice = null, userPickedVoice = false;
    var clickToRead = true;          // נטען מ-localStorage ב-init

    /* ---------- אלמנטים ---------- */
    var $btn    = document.getElementById('listenBtn');
    var $status = document.getElementById('listenStatus');
    var $rate   = document.getElementById('rateRange');
    var $rateVal= document.getElementById('rateValue');
    var $voice  = document.getElementById('voiceSelect');
    var $prog   = document.getElementById('listenProgress');
    // התווית ההתחלתית נלקחת מה-HTML ולא מקובעת בקוד, כדי שתבניות שונות
    // (למשל "האזן" בספר מול "האזן למאמר" במאמר) יחזרו לטקסט הנכון שלהן.
    var BTN_LABEL = ($btn && $btn.textContent.trim()) || '🔊 האזן למאמר';

    function store(k, v) { try { if (v === undefined) return localStorage.getItem(NS + k); localStorage.setItem(NS + k, v); } catch (e) { return null; } }

    /* =========================================================================
       1. עיבוד הטקסט להקראה
       ========================================================================= */

    var G = '["\\u05f4\\u201d\\u2033]';        // גרשיים על כל וריאציותיהם
    var R = "['\\u05f3\\u2019]";               // גרש

    // מילון ראשי תיבות. חל *רק* על הטקסט שנשלח למנוע הדיבור —
    // הטקסט שעל המסך נשאר בדיוק כפי שנכתב.
    // ה-([ובלכמשהד]{0,2}) הוא קריטי בעברית: ראשי תיבות כמעט תמיד מופיעים עם
    // אות שימוש דבוקה — "בשו״ע", "ובמשנ״ב", "כשו״ת". בלי זה הכלל פשוט לא נורה
    // ברוב המופעים האמיתיים. האות נשמרת ומוצמדת חזרה למילה המלאה.
    function ab(pattern, replacement) {
        return [new RegExp('(^|[^\\u05d0-\\u05ea])([ובלכמשהד]{0,2})' + pattern + '(?![\\u05d0-\\u05ea])', 'g'),
                '$1$2' + replacement];
    }
    var ABBREV = [
        ab('זצוק' + G + 'ל', 'זכר צדיק וקדוש לברכה'),
        ab('זצ' + G + 'ל', 'זכר צדיק לברכה'),
        ab('ז' + G + 'ל', 'זכרונו לברכה'),
        ab('ע' + G + 'ה', 'עליו השלום'),
        ab('שליט' + G + 'א', 'שליטא'),
        ab('הקב' + G + 'ה', 'הקדוש ברוך הוא'),
        ab('בס' + G + 'ד', 'בסייעתא דשמיא'),
        ab('בעז' + G + 'ה', 'בעזרת השם'),
        ab('ב' + G + 'ה', 'ברוך השם'),
        ab('אע' + G + 'פ', 'אף על פי'),
        ab('אע' + G + 'ג', 'אף על גב'),
        ab('עפ' + G + 'י', 'על פי'),
        ab('ע' + G + 'פ', 'על פי'),
        ab('ע' + G + 'י', 'על ידי'),
        ab('עפ' + G + 'ר', 'על פי רוב'),
        ab('כמו' + G + 'כ', 'כמו כן'),
        ab('א' + G + 'כ', 'אם כן'),
        ab('מ' + G + 'מ', 'מכל מקום'),
        ab('כ' + G + 'ש', 'כל שכן'),
        ab('ק' + G + 'ו', 'קל וחומר'),
        ab('י' + G + 'ל', 'יש לומר'),
        ab('צ' + G + 'ל', 'צריך לומר'),
        ab('צ' + G + 'ע', 'צריך עיון'),
        ab('עיי' + G + 'ש', 'עיין שם'),
        ab('וע' + G + 'ע', 'ועיין עוד'),
        ab('ד' + G + 'ה', 'דיבור המתחיל'),
        ab('ס' + G + 'ק', 'סעיף קטן'),
        ab('שו' + G + 'ע', 'שולחן ערוך'),
        ab('שו' + G + 'ת', 'שאלות ותשובות'),
        ab('או' + G + 'ח', 'אורח חיים'),
        ab('יו' + G + 'ד', 'יורה דעה'),
        ab('אה' + G + 'ע', 'אבן העזר'),
        ab('חו' + G + 'מ', 'חושן משפט'),
        ab('משנ' + G + 'ב', 'משנה ברורה'),
        ab('ע' + G + 'א', 'עמוד א'),
        ab('ע' + G + 'ב', 'עמוד ב'),
        ab('וכו' + R, 'וכולי'),
        ab('וכד' + R, 'וכדומה'),
        ab('וגו' + R, 'וגומר'),
        ab('עמ' + R, 'עמוד'),
        ab('סי' + R, 'סימן'),
        ab('סע' + R, 'סעיף'),
        ab('הל' + R, 'הלכות'),
        ab('ר' + R, 'רבי')
    ];

    // מנועי TTS עבריים נתקעים על גרשיים בתוך מילה — לפעמים מאייתים אות-אות.
    // הסרתם הופכת את המילה לקריאה רציפה (רמב"ם → רמבם) וזה נשמע נכון בהרבה.
    var INWORD_G = /([א-ת])["״”″]([א-ת])/g;

    // "ה'" — מנוע ההקראה מבטא את זה כאות בודדת ("הא"), ולא כשמו של הקב"ה.
    // מחליפים ל"השם". על המסך זה נשאר "ה'" כמובן — ההחלפה היא רק במה שנשלח
    // למנוע הדיבור.
    // המלכודת: אותו "ה'" הוא גם מספר — "פרק ה'", "יום ה'", "סימן ה'" — ושם
    // דווקא נכון לקרוא "ה". לכן ההקשרים המספריים מוחרגים.
    var NUM_CTX = /(?:פרק|פרקים|יום|בימי|סימן|סעיף|עמוד|דף|אות|שנת|שנה|כרך|חלק|שער|מזמור|פסוק|הלכה|משנה|מספר|סי|עמ)\s*$/;
    var HASHEM = /(^|[^א-ת])([ובלכמש]?)ה['׳’](?![א-ת])/g;

    function hashem(t) {
        return t.replace(HASHEM, function (m, pre, prefix, off, str) {
            if (NUM_CTX.test(str.slice(0, off + pre.length))) return m;
            return pre + prefix + 'השם';
        }).replace(/יקוו?ק/g, 'השם');
    }

    function forSpeech(text) {
        var t = text;
        for (var i = 0; i < ABBREV.length; i++) t = t.replace(ABBREV[i][0], ABBREV[i][1]);
        t = hashem(t);
        t = t.replace(INWORD_G, '$1$2').replace(INWORD_G, '$1$2');   // פעמיים, לרצפים כמו תשע"ג-תשע"ד
        t = t.replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, ' ');       // אימוג'י (זוגות surrogate)
        t = t.replace(/[←-⇿⌀-➿⬀-⯿️‍⃣]/g, ' '); // סמלים ודינגבטים
        t = t.replace(/־/g, ' ');                               // מקף עברי → רווח
        t = t.replace(/\s*[–—]\s*/g, ', ');                // מקף ארוך → פסיק (הפוגה טבעית)
        t = t.replace(/([.,!?:;])(?=\S)/g, '$1 ');                   // רווח אחרי סימן פיסוק
        return t.replace(/\s+/g, ' ').trim();
    }

    /* ---------- פיצול לאמירות קצרות ----------
       זה הלב של התיקון: Chrome/Edge קוטעים אמירה שנמשכת יותר מ~15 שניות,
       ולעיתים אף לא יורים onend — ההקראה פשוט מתה באמצע פסקה. פסקה תורנית
       רגילה היא 400-800 תווים, הרבה מעל הסף. פיצול למשפטים של עד 180 תווים
       מבטיח שאף אמירה לא מתקרבת לגבול.                                       */

    function splitSentences(text) {
        var out = [], re = /[^.!?…׃]*[.!?…׃]+\s*|[^.!?…׃]+$/g, m;
        while ((m = re.exec(text)) !== null) {
            if (m[0] === '') { re.lastIndex++; continue; }
            out.push(m[0]);
        }
        return out.length ? out : [text];
    }

    function splitLong(s) {
        var out = [], cur = '';
        function pushWord(w) {
            // מילה בודדת ארוכה מהמכסה (כתובת אינטרנט, מחרוזת בלי רווחים) —
            // חיתוך קשיח, אחרת הייתה חוזרת אמירה ענקית והבאג היה חוזר מהדלת האחורית.
            while (w.length > MAX_CHUNK) {
                if (cur) { out.push(cur); cur = ''; }
                out.push(w.slice(0, MAX_CHUNK));
                w = w.slice(MAX_CHUNK);
            }
            if (cur && (cur + ' ' + w).length > MAX_CHUNK) { out.push(cur); cur = ''; }
            cur += (cur ? ' ' : '') + w;
        }
        s.split(/([,;])/).forEach(function (b) {
            if (b.length > MAX_CHUNK) b.split(' ').forEach(pushWord);
            else {
                if (cur && (cur + b).length > MAX_CHUNK) { out.push(cur); cur = ''; }
                cur += b;
            }
        });
        if (cur) out.push(cur);
        return out;
    }

    function chunkText(text) {
        var out = [], cur = '';
        splitSentences(text).forEach(function (s) {
            if (s.length > MAX_CHUNK) {
                if (cur) { out.push(cur); cur = ''; }
                splitLong(s).forEach(function (p) { out.push(p); });
            } else if (cur && (cur + s).length > MAX_CHUNK) { out.push(cur); cur = s; }
            else cur += s;
        });
        if (cur) out.push(cur);
        return out.map(function (s) { return s.trim(); }).filter(function (s) { return s.length > 0; });
    }

    /* =========================================================================
       2. בניית תור ההקראה
       ========================================================================= */

    // בספר מתחלף מקריאים רק את העמוד המוצג. בגלילה רציפה — את כל המאמר.
    function isBook() { return !!document.getElementById('book'); }
    function scopeRoot() {
        return document.querySelector('#book .page.active') || document.querySelector('.container') || document.body;
    }
    function invalidate() { built = false; }
    window.ttsRebuild = function () {
        invalidate();
        // המשתמש הפך עמוד ידנית תוך כדי האזנה — עוברים להקריא את העמוד החדש.
        if (selfAdvancing) return;
        if (isOn && !paused) { build(); if (chunks.length) startFrom(0); else stopListen(); }
    };

    function build() {
        if (built) return;
        var nodes = scopeRoot().querySelectorAll('h1, h2, h3, h4, p, li');
        chunks = []; elCount = 0; built = true;
        Array.prototype.forEach.call(nodes, function (n) {
            // תוכן העניינים, רשימת המקורות, סרגל ההאזנה והחתימה אינם חלק מהמאמר המדובר.
            if (n.closest(SKIP)) return;
            // רשימה מקוננת כבר נקראת כחלק מה-li שמעליה — לא לקרוא פעמיים.
            if (n.tagName === 'LI' && n.parentElement && n.parentElement.closest('li')) return;
            var raw = n.textContent.replace(/\s+/g, ' ').trim();
            if (!raw) return;
            var spoken = forSpeech(raw);
            if (!spoken) return;
            var e = elCount++;
            chunkText(spoken).forEach(function (t) { chunks.push({ el: n, e: e, text: t }); });
        });
    }

    function firstChunkOfEl(e) {
        for (var i = 0; i < chunks.length; i++) if (chunks[i].e === e) return i;
        return -1;
    }

    /* =========================================================================
       3. ממשק
       ========================================================================= */

    function hint() {
        return clickToRead
            ? 'לחץ כדי להתחיל האזנה, או לחץ על כל פסקה כדי להתחיל להקריא ממנה'
            : 'לחץ כדי להתחיל האזנה. לחיצה על הטקסט לא תפעיל הקראה.';
    }

    function say(msg) { if ($status) $status.textContent = msg; }

    function setBtn(label, pressed) {
        if (!$btn) return;
        $btn.textContent = label;
        $btn.setAttribute('aria-pressed', pressed ? 'true' : 'false');
    }

    function progress() {
        if (!$prog) return;
        if (!isOn || !chunks.length) { $prog.textContent = ''; return; }
        var cur = chunks[Math.min(idx, chunks.length - 1)];
        $prog.textContent = 'פסקה ' + (cur.e + 1) + ' מתוך ' + elCount;
    }

    function highlight(el) {
        var prev = document.querySelector('.reading-highlight');
        if (prev === el) return;
        if (prev) prev.classList.remove('reading-highlight');
        if (!el) return;
        el.classList.add('reading-highlight');
        // גוללים רק אם הפסקה באמת מחוץ למסך. אחרת ההקראה "חוטפת" את הדף
        // מתחת לידיים של מי שקורא קצת קדימה בעצמו.
        var r = el.getBoundingClientRect ? el.getBoundingClientRect() : null;
        var h = window.innerHeight || 800;
        if (!r || r.top < 60 || r.bottom > h - 60) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }

    function clearHighlight() {
        var prev = document.querySelector('.reading-highlight');
        if (prev) prev.classList.remove('reading-highlight');
    }

    function reset(keepBookmark) {
        stopWatchdog();
        isOn = false; paused = false; autoPaused = false; idx = 0;
        setBtn(BTN_LABEL, false);
        clearHighlight();
        if (!keepBookmark) { try { localStorage.removeItem(POS_KEY); } catch (e) {} }
        say(hint());
        if ($prog) $prog.textContent = '';
    }

    // בספר מתחלף העמוד עצמו הוא הסימנייה (paginated.js שומר אותו), אין טעם
    // לשמור אינדקס פסקה שמתאפס בכל הפיכת עמוד.
    function savePos() { if (isBook()) return; try { localStorage.setItem(POS_KEY, String(idx)); } catch (e) {} }

    /* =========================================================================
       4. הקראה
       ========================================================================= */

    function speak() {
        stopWatchdog();
        if (idx >= chunks.length) {
            // סוף העמוד בספר מתחלף — הופכים לעמוד הבא וממשיכים ברצף.
            // עמודים בלי תוכן להקראה (מקורות, חתימה) מדולגים במקום לעצור עליהם.
            if (isOn && typeof window.bookNext === 'function') {
                selfAdvancing = true;
                var found = false, tries = 0;
                while (tries++ < 200 && window.bookNext()) {
                    invalidate(); build();
                    if (chunks.length) { found = true; break; }
                }
                selfAdvancing = false;
                if (found) { idx = 0; speak(); return; }
            }
            reset(false); say('ההקראה הסתיימה. 🎉'); return;
        }
        var item = chunks[idx], my = token, advanced = false;
        highlight(item.el);
        progress();

        var u = new SpeechSynthesisUtterance(item.text);
        u.lang = 'he-IL';
        if (voice) u.voice = voice;
        u.rate = rate;

        function advance() {
            if (my !== token || advanced) return;
            advanced = true;
            stopWatchdog();
            idx++; savePos();
            if (!paused) speak();
        }
        u.onend = advance;
        u.onerror = function (ev) {
            if (my !== token) return;
            // 'canceled'/'interrupted' = אנחנו עצרנו בכוונה (מעבר לשונית, נעילת מסך,
            // לחיצה על פסקה אחרת). אסור להתקדם — זה בדיוק מה שגרם ל"קפיצה לעמוד האחרון":
            // כל הפסקאות הנותרות נכשלות ברצף תוך שברירי שנייה בזמן שהמסך כבוי.
            if (ev && (ev.error === 'canceled' || ev.error === 'interrupted')) return;
            advance();
        };

        synth.speak(u);
        startWatchdog(my);
    }

    /* ---------- שומר ראש ----------
       גם עם פיצול לאמירות קצרות, Chrome מסוגל "למות" בשקט: לא מדבר, לא ממתין,
       ו-onend לא נורה לעולם. הכפתור נשאר על "מקריא..." ואין קול. הבדיקה הזו
       מזהה שתי שניות של שקט אמיתי ומקדמת הלאה במקום להיתקע.                  */
    function startWatchdog(my) {
        stopWatchdog();
        var silent = 0;
        watchdog = setInterval(function () {
            if (my !== token) { stopWatchdog(); return; }
            if (!isOn || paused) return;
            if (synth.speaking || synth.pending || synth.paused) { silent = 0; return; }
            if (++silent >= 2) { stopWatchdog(); idx++; savePos(); speak(); }
        }, 1000);
    }
    function stopWatchdog() { if (watchdog) { clearInterval(watchdog); watchdog = null; } }

    function startFrom(i) {
        token++;
        stopWatchdog();
        synth.cancel();
        build();
        idx = Math.max(0, Math.min(i, chunks.length - 1));
        isOn = true; paused = false; autoPaused = false;
        setBtn('⏸ השהה', true);
        say('מקריא...');
        savePos();
        speak();
    }

    /* =========================================================================
       5. פקדים
       ========================================================================= */

    window.toggleListen = function () {
        if (!isOn && !synth.speaking && !synth.paused) {
            build();
            var saved = parseInt(localStorage.getItem(POS_KEY) || '0', 10);
            startFrom(saved > 0 && saved < chunks.length ? saved : 0);
            return;
        }
        // בדיקת המצב האמיתי של המנוע (ולא רק הדגלים הפנימיים) היא מה שמונע
        // כפתור "מת" אחרי מעבר לשונית וחזרה.
        if (paused || synth.paused) {
            paused = false; isOn = true;
            setBtn('⏸ השהה', true);
            say('מקריא...');
            if (synth.paused) {
                synth.resume();
                // באג ידוע: resume() נכשל לפעמים בשקט אחרי השהיה ארוכה.
                setTimeout(function () { if (isOn && !paused && !synth.speaking && !synth.pending) { token++; speak(); } }, 350);
            } else {
                // אין אמירה מושהית להחיות (למשל אחרי נעילת מסך שביטלה אותה).
                // מדברים כאן ועכשיו, בתוך אירוע הלחיצה — ב-iOS הקראה שנדחית
                // ל-setTimeout כבר לא נחשבת "מתוך מגע משתמש" ונחסמת בשקט.
                token++; speak();
            }
        } else {
            paused = true;
            synth.pause();
            setBtn('▶ המשך', false);
            say('בהשהיה');
        }
    };

    window.stopListen = function () { token++; stopWatchdog(); synth.cancel(); reset(false); };

    window.skipListen = function (dir) {
        build();
        if (!chunks.length) return;
        var cur = chunks[Math.min(idx, chunks.length - 1)];
        var target = cur.e + dir;
        // לחיצה ראשונה על "אחורה" מחזירה לתחילת הפסקה הנוכחית, כמו בכל נגן.
        if (dir < 0 && idx > firstChunkOfEl(cur.e)) target = cur.e;
        target = Math.max(0, Math.min(elCount - 1, target));
        startFrom(firstChunkOfEl(target));
    };

    // דילוג לפרק הבא/הקודם — ב-h2 בלבד. בספר של מאות פסקאות, ⏮/⏭ לבד לא מספיקים.
    window.skipChapter = function (dir) {
        build();
        if (!chunks.length) return;
        var cur = chunks[Math.min(idx, chunks.length - 1)];
        var best = -1;
        for (var i = 0; i < chunks.length; i++) {
            if (chunks[i].el.tagName !== 'H2') continue;
            if (dir > 0 && chunks[i].e > cur.e) { best = i; break; }
            if (dir < 0 && chunks[i].e < cur.e) best = i;   // האחרון שלפנינו
        }
        if (best < 0) { if (typeof window.bookJump === 'function') window.bookJump(dir); return; }
        startFrom(best);
    };

    // שינוי המחוון יורה עשרות אירועי input בזמן גרירה. הערך מתעדכן מיד,
    // אבל ההקראה מופעלת מחדש רק כשמשחררים (onchange) — אחרת זה גמגום רצוף.
    window.setListenRate = function (val) {
        rate = parseFloat(val);
        store('rate', String(rate));
        if ($rateVal) $rateVal.textContent = rate.toFixed(1) + '×';
        if ($rate) $rate.setAttribute('aria-valuetext', 'מהירות ' + rate.toFixed(1));
    };
    window.applyListenRate = function (val) {
        window.setListenRate(val);
        if (isOn && !paused) { token++; synth.cancel(); speak(); }
    };

    window.setListenVoice = function (name) {
        var found = voices.filter(function (v) { return v.name === name; })[0];
        if (!found) return;
        voice = found; userPickedVoice = true;
        store('voice', name);
        if (isOn && !paused) { token++; synth.cancel(); speak(); }
    };

    /* =========================================================================
       6. קולות
       ========================================================================= */

    var FEMALE = ['female', 'hila', 'naayah', 'carmit', 'zira', 'noa', 'sharon', 'ivy', 'nicole'];
    function isHe(v) { return v.lang && v.lang.toLowerCase().indexOf('he') === 0; }
    function isFemale(v) {
        var n = v.name.toLowerCase();
        return FEMALE.some(function (h) { return n.indexOf(h) !== -1; });
    }

    function populate() {
        if (!$voice) return;
        $voice.innerHTML = '';
        var he = voices.filter(isHe), other = voices.filter(function (v) { return !isHe(v); });
        function group(label, list) {
            if (!list.length) return;
            var g = document.createElement('optgroup');
            g.setAttribute('label', label);
            list.forEach(function (v) {
                var o = document.createElement('option');
                o.value = v.name;
                o.textContent = v.name.replace(/^Microsoft\s+/, '').replace(/\s*-\s*Hebrew.*$/i, '');
                g.appendChild(o);
            });
            $voice.appendChild(g);
        }
        group('עברית', he);
        group('שפות אחרות', other);   // נשמרות בכוונה — קול רב-לשוני לפעמים נשמע טוב יותר
        if (voice) $voice.value = voice.name;
    }

    function loadVoices() {
        var all = synth.getVoices();
        if (!all.length) return;
        var he = all.filter(isHe);
        voices = he.concat(all.filter(function (v) { return !isHe(v); }));
        // onvoiceschanged יורה יותר מפעם אחת (במיוחד ב-Edge, כשקולות הענן נטענים
        // באיחור). בלי הדגל הזה כל ירייה כזו הייתה דורסת את בחירת המשתמש.
        if (!userPickedVoice) {
            var saved = store('voice');
            voice = (saved && voices.filter(function (v) { return v.name === saved; })[0])
                 || he.filter(isFemale)[0] || he[0] || all[0] || null;
        }
        populate();
    }
    synth.onvoiceschanged = loadVoices;
    loadVoices();

    /* =========================================================================
       7. לחיצה על פסקה = התחל להקריא מכאן
       ========================================================================= */

    function readableNodes() {
        var nodes = document.querySelectorAll(
            '.container h1, .container h2, .container h3, .container h4, .container p, .container li');
        return Array.prototype.filter.call(nodes, function (el) { return !el.closest(SKIP); });
    }

    // מי שקורא בשקט לא רוצה שנגיעה מקרית תתחיל פתאום לדבר. המתג נשמר
    // ב-localStorage המשותף, כך שכיבוי אחד תופס לכל המאמרים והספרים.
    function applyClickMode() {
        readableNodes().forEach(function (el) { el.classList.toggle('tts-clickable', clickToRead); });
        var b = document.getElementById('clickReadBtn');
        if (!b) return;
        b.textContent = clickToRead ? '👆 לחיצה: פעילה' : '👆 לחיצה: כבויה';
        b.setAttribute('aria-pressed', clickToRead ? 'true' : 'false');
        b.title = clickToRead
            ? 'לחיצה על פסקה מתחילה להקריא ממנה. לחץ כאן כדי לכבות.'
            : 'לחיצה על פסקה לא תפעיל הקראה. לחץ כאן כדי להפעיל.';
    }

    window.toggleClickRead = function () {
        clickToRead = !clickToRead;
        store('clickRead', clickToRead ? '1' : '0');
        applyClickMode();
        if (!isOn) say(hint());
    };

    function attachClicks() {
        readableNodes().forEach(function (el) {
            el.addEventListener('click', function (e) {
                if (!clickToRead) return;                                             // המתג כבוי
                if (e.target.closest('a')) return;                                    // קישורים עובדים כרגיל
                if (window.getSelection && String(window.getSelection()).length) return; // סימון להעתקה עובד כרגיל
                build();
                var i = -1;
                for (var k = 0; k < chunks.length; k++) if (chunks[k].el === el) { i = k; break; }
                if (i >= 0) startFrom(i);
            });
        });
        applyClickMode();
    }

    /* =========================================================================
       8. מעבר לשונית / נעילת מסך
       ========================================================================= */

    document.addEventListener('visibilitychange', function () {
        if (document.hidden) {
            if (isOn && !paused) {
                autoPaused = true; token++; stopWatchdog(); synth.cancel();
            }
        } else if (autoPaused) {
            autoPaused = false; token++;
            setBtn('⏸ השהה', true);
            say('מקריא...');
            speak();
            // iOS חוסם הקראה שלא נולדה מתוך מגע של המשתמש. אם אחרי כשנייה עדיין
            // אין קול — נעבור למצב מושהה גלוי, כדי שהקורא יקיש פעם אחת במקום
            // לבהות בכפתור שכתוב עליו "מקריא..." בזמן שקט מוחלט.
            setTimeout(function () {
                if (isOn && !paused && !synth.speaking && !synth.pending && !synth.paused) {
                    token++; stopWatchdog(); synth.cancel();
                    paused = true;
                    setBtn('▶ המשך', false);
                    say('ההקראה הופסקה כשהמסך ננעל — הקש ▶ המשך');
                }
            }, 1000);
        } else if (isOn && !paused && !synth.speaking && !synth.pending && !synth.paused) {
            token++; speak();
        }
    });

    // חזרה מ-bfcache: מאפסים לגמרי (כולל autoPaused — אחרת ה-visibilitychange
    // שמגיע מיד אחרי היה מתחיל להקריא את המאמר מההתחלה מעצמו).
    window.addEventListener('pageshow', function (e) {
        if (e.persisted) { token++; stopWatchdog(); synth.cancel(); reset(true); }
    });
    // pagehide ולא beforeunload — beforeunload מבטל את ה-bfcache ודווקא מחמיר
    // את הבעיה של חזרה ללשונית.
    window.addEventListener('pagehide', function () { token++; stopWatchdog(); synth.cancel(); });

    /* =========================================================================
       9. אתחול
       ========================================================================= */

    function init() {
        clickToRead = store('clickRead') !== '0';   // ברירת מחדל: פעילה
        attachClicks();
        var savedRate = parseFloat(store('rate') || '1');
        if (savedRate >= 0.5 && savedRate <= 2) rate = savedRate;
        if ($rate) { $rate.value = rate; $rate.setAttribute('aria-valuetext', 'מהירות ' + rate.toFixed(1)); }
        if ($rateVal) $rateVal.textContent = rate.toFixed(1) + '×';
        var saved = parseInt(localStorage.getItem(POS_KEY) || '0', 10);
        if (saved > 0) say('יש סימנייה שמורה — לחיצה על "האזן" תמשיך מהמקום שבו הפסקת');
        else say(hint());
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
