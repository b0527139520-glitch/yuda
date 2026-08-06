/* =============================================================================
   audio-player.js — נגן ההקלטה (MP3 שהופק מראש ב-edge-tts)
   הדבק מילה במילה. נפרד לגמרי מ-tts.js (ההקראה החיה של הדפדפן).
   ============================================================================= */
(function () {
    var box = document.querySelector('.audio-player');
    if (!box) return;

    var audio  = box.querySelector('audio');
    var select = box.querySelector('.audio-chapter-select');
    var label  = box.querySelector('.audio-now');
    if (!audio || !select) return;

    var KEY = 'koltoda.audio.ch.' + (document.title || '');

    function load(i, autoplay) {
        var opt = select.options[i];
        if (!opt) return;
        select.selectedIndex = i;
        audio.src = opt.value;
        if (label) label.textContent = opt.textContent;
        try { localStorage.setItem(KEY, String(i)); } catch (e) {}
        if (autoplay) {
            var p = audio.play();
            /* דפדפן שחוסם ניגון אוטומטי זורק — לא נשאיר Promise תלוי */
            if (p && p.catch) p.catch(function () {});
        }
    }

    select.addEventListener('change', function () { load(select.selectedIndex, true); });

    /* סיום פרק — ממשיך לבא אחריו מעצמו, כמו בהקראה החיה */
    audio.addEventListener('ended', function () {
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
