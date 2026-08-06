/* =============================================================================
   audio-player.js — נגן ההקלטה (MP3 שהופק מראש ב-edge-tts)
   הדבק מילה במילה. נפרד לגמרי מ-tts.js (ההקראה החיה של הדפדפן).
   ============================================================================= */
(function () {
    var box = document.querySelector('.audio-player');
    if (!box) return;

    var audio  = box.querySelector('audio');
    var select = box.querySelector('.audio-chapter-select');
    if (!audio || !select) return;

    var KEY = 'koltoda.audio.ch.' + (document.title || '');

    /* מפת תזמונים: { "01": [0, 3.2, 9.7, ...] } — זמן תחילת כל פסקה בקטע.
       נוצרת ב-make-audio.mjs מקובצי ה-SRT של edge-tts. */
    var CUES = {};
    var tag = document.querySelector('script[data-audio-cues]');
    if (tag) { try { CUES = JSON.parse(tag.textContent || '{}'); } catch (e) {} }

    var seg = null;      // מזהה הקטע הפעיל, למשל "01"
    var line = -1;       // אינדקס הפסקה המודגשת

    /* ---------- הדגשה ---------- */
    function clearHighlight() {
        var prev = document.querySelector('.reading-highlight');
        if (prev) prev.classList.remove('reading-highlight');
        line = -1;
    }

    function highlight(el) {
        var prev = document.querySelector('.reading-highlight');
        if (prev === el) return;
        if (prev) prev.classList.remove('reading-highlight');
        if (!el) return;
        el.classList.add('reading-highlight');

        /* בספר מתחלף — מדפדפים לעמוד של הפסקה, כמו בהקראה החיה */
        var pg = el.closest ? el.closest('.page') : null;
        if (pg && !pg.classList.contains('active') && window.bookGo) {
            var pages = [].slice.call(document.querySelectorAll('#book .page'));
            var i = pages.indexOf(pg);
            if (i > -1) { window.bookGo(i); return; }
        }

        /* גוללים רק אם הפסקה מחוץ למסך, כדי לא לחטוף את הדף מהקורא */
        var r = el.getBoundingClientRect ? el.getBoundingClientRect() : null;
        var h = window.innerHeight || 800;
        if (!r || r.top < 60 || r.bottom > h - 60) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }

    /* איזו פסקה נאמרת עכשיו — האחרונה שזמן ההתחלה שלה כבר עבר */
    function lineAt(starts, t) {
        var lo = 0, hi = starts.length - 1, ans = 0;
        while (lo <= hi) {
            var mid = (lo + hi) >> 1;
            if (starts[mid] <= t) { ans = mid; lo = mid + 1; } else { hi = mid - 1; }
        }
        return ans;
    }

    audio.addEventListener('timeupdate', function () {
        var starts = CUES[seg];
        if (!starts || !starts.length) return;
        var i = lineAt(starts, audio.currentTime);
        if (i === line) return;
        line = i;
        var el = document.querySelector('[data-a="' + seg + '-' + i + '"]');
        if (el) highlight(el);
    });

    /* ---------- קבצים שנבחרו מהמחשב ----------
       דפדפן לא יכול לקרוא נתיב מקומי מעצמו (תיקיית ההורדות חסומה לו), אבל
       קובץ שהמשתמש בוחר בעצמו מותר. ממפים לפי שם הקובץ, כך שאפשר לבחור את
       כל פרקי הספר בבת אחת. ההדגשה עובדת גם ככה — התזמונים כבר בדף. */
    var picked = {};
    var note   = box.querySelector('.audio-note');
    var input  = box.querySelector('.audio-pick-input');
    var pickBtn = box.querySelector('.audio-pick-btn');

    function say(msg) { if (note) note.textContent = msg || ''; }

    /* קישור הורדה שלא מולא עדיין מוסתר מהקורא — אין טעם ב"לחץ כאן" מת.
       הבדיקה היא על ה-href עצמו, כך שברגע שמדביקים כתובת הוא מופיע לבד. */
    var dl = box.querySelector('.audio-download');
    if (dl && (dl.getAttribute('href') || '#') === '#') dl.style.display = 'none';

    function baseName(u) {
        try { u = decodeURIComponent(u); } catch (e) {}
        return u.split('/').pop();
    }

    function srcFor(opt) {
        return picked[baseName(opt.value)] || opt.value;
    }

    if (pickBtn && input) {
        pickBtn.addEventListener('click', function () { input.click(); });
        input.addEventListener('change', function () {
            var files = [].slice.call(input.files || []);
            if (!files.length) return;
            var names = {};
            for (var i = 0; i < select.options.length; i++) names[baseName(select.options[i].value)] = true;

            var matched = 0, spare = [];
            files.forEach(function (f) {
                if (names[f.name]) { picked[f.name] = URL.createObjectURL(f); matched++; }
                else spare.push(f);
            });
            /* קובץ יחיד בשם אחר — מניחים שהוא של הפרק המוצג */
            if (!matched && spare.length === 1) {
                picked[baseName(select.options[select.selectedIndex].value)] = URL.createObjectURL(spare[0]);
                matched = 1;
            }
            say(matched ? 'נטענו ' + matched + ' קבצים מהמחשב.' : 'שמות הקבצים לא תואמים לפרקים.');
            if (matched) load(select.selectedIndex, true);
        });
    }

    /* הקובץ לא נמצא בנתיב היחסי — מכוונים להורדה ולבחירה ידנית */
    audio.addEventListener('error', function () {
        if (!audio.getAttribute('src')) return;
        say('קובץ השמע לא נמצא לצד הדף. הורד אותו ואז בחר אותו כאן.');
    });

    /* ---------- ניווט בין פרקים ---------- */
    function load(i, autoplay) {
        var opt = select.options[i];
        if (!opt) return;
        select.selectedIndex = i;
        seg = opt.getAttribute('data-seg');
        clearHighlight();
        audio.src = srcFor(opt);
        try { localStorage.setItem(KEY, String(i)); } catch (e) {}
        if (autoplay) {
            var p = audio.play();
            /* דפדפן שחוסם ניגון אוטומטי זורק — לא נשאיר Promise תלוי */
            if (p && p.catch) p.catch(function () {});
        }
    }

    select.addEventListener('change', function () { load(select.selectedIndex, true); });

    /* סיום פרק — מנקה הדגשה וממשיך לבא אחריו מעצמו, כמו בהקראה החיה.
       (השהיה לעומת זאת משאירה את ההדגשה — היא מסמנת איפה עצרנו.) */
    audio.addEventListener('ended', function () {
        clearHighlight();
        if (select.selectedIndex < select.options.length - 1) {
            load(select.selectedIndex + 1, true);
        } else {
            try { localStorage.removeItem(KEY); } catch (e) {}
        }
    });

    /* חוזרים לפרק שבו עצרנו — בלי לנגן מעצמו */
    var saved = 0;
    try { saved = parseInt(localStorage.getItem(KEY), 10) || 0; } catch (e) {}
    if (saved < 0 || saved >= select.options.length) saved = 0;
    load(saved, false);
})();
