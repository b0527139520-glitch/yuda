/* =============================================================================
   קול תודה — מנוע הספר המתחלף   |   paginated.js   v2.0
   הדבק *לפני* tts.js. עובד רק כשקיים #book עם .page ילדים.
   חושף ל-tts.js: window.bookNext() ו-window.bookJump().
   ============================================================================= */
(function () {
    'use strict';

    var book = document.getElementById('book');
    if (!book) return;

    var pages = Array.prototype.slice.call(book.querySelectorAll('.page'));
    if (!pages.length) return;

    var KEY = 'koltoda.book.page.' + (document.title || location.pathname);
    var cur = 0;

    var $dots    = document.getElementById('bookDots');
    var $counter = document.getElementById('bookCounter');
    var $prev    = document.getElementById('bookPrev');
    var $next    = document.getElementById('bookNext');

    /* ---------- נקודות ניווט ---------- */
    pages.forEach(function (p, i) {
        if (!$dots) return;
        var b = document.createElement('button');
        b.className = 'book-dot';
        b.type = 'button';
        var label = (p.getAttribute('data-title') || ('עמוד ' + (i + 1)));
        b.setAttribute('aria-label', label);
        b.title = label;
        b.addEventListener('click', function () { go(i); });
        $dots.appendChild(b);
    });

    function render() {
        pages.forEach(function (p, i) { p.classList.toggle('active', i === cur); });
        if ($dots) {
            Array.prototype.forEach.call($dots.children, function (d, i) {
                d.classList.toggle('active', i === cur);
                d.setAttribute('aria-current', i === cur ? 'true' : 'false');
            });
        }
        if ($counter) $counter.textContent = 'עמוד ' + (cur + 1) + ' מתוך ' + pages.length;
        if ($prev) $prev.disabled = (cur === 0);
        if ($next) $next.disabled = (cur === pages.length - 1);
        pages[cur].scrollTop = 0;
        try { localStorage.setItem(KEY, String(cur)); } catch (e) {}
    }

    function go(i, fromTts) {
        i = Math.max(0, Math.min(i, pages.length - 1));
        if (i === cur) return false;
        cur = i;
        render();
        // מודיעים למנוע ההקראה שהתוכן הגלוי התחלף. כשההקראה עצמה הפכה את
        // העמוד היא כבר מטפלת בעצמה — ואז אסור לקרוא לו, אחרת תיווצר לולאה.
        if (!fromTts && typeof window.ttsRebuild === 'function') window.ttsRebuild();
        return true;
    }

    /* ---------- גובה הסרגלים ----------
       הגובה נמדד בפועל ולא מקובע: הוא משתנה כששם הקול ארוך ("הילה Online
       (Natural)"), כשהסרגל נשבר לשתי שורות בנייד, וכשמקפלים אותו. מספר קשיח
       כאן פירושו סרגל שמכסה את סוף הטקסט. */
    var $bar = document.querySelector('.book-listen-bar');
    var $nav = document.querySelector('.book-nav');

    function measureChrome() {
        var navH = $nav ? $nav.offsetHeight : 0;
        var collapsed = $bar && $bar.classList.contains('collapsed');
        // מקופל הוא גלולה צפה בפינה ולא רצועה — ולכן אינו גוזל גובה מהטקסט.
        if ($bar) $bar.style.bottom = collapsed ? '' : navH + 'px';
        var total = navH + (!collapsed && $bar ? $bar.offsetHeight : 0);
        document.documentElement.style.setProperty('--chrome-h', (total + 26) + 'px');
    }

    window.toggleListenBar = function () {
        if (!$bar) return;
        var collapsed = $bar.classList.toggle('collapsed');
        try { localStorage.setItem('koltoda.book.barCollapsed', collapsed ? '1' : '0'); } catch (e) {}
        var b = document.getElementById('listenCollapse');
        if (b) {
            b.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
            b.title = collapsed ? 'הצג את כל פקדי ההאזנה' : 'קפל את סרגל ההאזנה';
        }
        measureChrome();
    };

    try { if (localStorage.getItem('koltoda.book.barCollapsed') === '1') window.toggleListenBar(); } catch (e) {}

    measureChrome();
    window.addEventListener('resize', measureChrome);
    window.addEventListener('orientationchange', measureChrome);
    // רשימת הקולות נטענת באיחור ויכולה להרחיב את הסרגל אחרי הטעינה.
    if (window.ResizeObserver && $bar) new ResizeObserver(measureChrome).observe($bar);

    /* ---------- API ל-tts.js ---------- */
    window.bookNext = function () { return go(cur + 1, true); };   // מחזיר false בעמוד האחרון
    window.bookJump = function (dir) { go(cur + dir); };
    window.bookGo   = function (i) { go(i); };
    window.bookPage = function () { return cur; };

    /* ---------- מקלדת ----------
       בספר עברי מדפדפים ימין-לשמאל: חץ שמאלה = הבא, ימינה = הקודם. */
    document.addEventListener('keydown', function (e) {
        var t = e.target;
        if (t && /^(INPUT|SELECT|TEXTAREA)$/.test(t.tagName)) return;
        if (e.key === 'ArrowLeft')       { e.preventDefault(); go(cur + 1); }
        else if (e.key === 'ArrowRight') { e.preventDefault(); go(cur - 1); }
        else if (e.key === 'Home')       { e.preventDefault(); go(0); }
        else if (e.key === 'End')        { e.preventDefault(); go(pages.length - 1); }
        else if (e.key === 'PageDown')   { e.preventDefault(); go(cur + 1); }
        else if (e.key === 'PageUp')     { e.preventDefault(); go(cur - 1); }
    });

    /* ---------- החלקת אצבע ---------- */
    var sx = 0, sy = 0, tracking = false;
    book.addEventListener('touchstart', function (e) {
        if (e.touches.length !== 1) return;
        sx = e.touches[0].clientX; sy = e.touches[0].clientY; tracking = true;
    }, { passive: true });
    book.addEventListener('touchend', function (e) {
        if (!tracking) return;
        tracking = false;
        var t = e.changedTouches[0];
        var dx = t.clientX - sx, dy = t.clientY - sy;
        // רק תנועה אופקית מובהקת — אחרת גלילה אנכית בתוך עמוד ארוך הייתה
        // מדפדפת עמודים בטעות.
        if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.8) return;
        go(dx < 0 ? cur + 1 : cur - 1);
    }, { passive: true });

    /* ---------- קישורים לעמודים (מפתח העניינים) ---------- */
    document.addEventListener('click', function (e) {
        var a = e.target.closest ? e.target.closest('[data-page]') : null;
        if (!a) return;
        e.preventDefault();
        var target = a.getAttribute('data-page');
        var i = /^\d+$/.test(target) ? parseInt(target, 10) - 1
                                     : pages.indexOf(document.getElementById(target));
        if (i >= 0) go(i);
    });

    /* ---------- מיקום אחרון ---------- */
    var saved = parseInt(localStorage.getItem(KEY) || '0', 10);
    cur = (saved > 0 && saved < pages.length) ? saved : 0;
    render();
})();
