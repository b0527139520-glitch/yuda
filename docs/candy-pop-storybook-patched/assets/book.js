
// ── TOC toggle ──────────────────────────────────────────────────────────
function toggleTocChapter(el) {
  el.closest('.toc-chapter').classList.toggle('open');
}
// open first chapter by default
document.querySelectorAll('.toc-chapter')[0]?.classList.add('open');

// ── Back to top ─────────────────────────────────────────────────────────
const btn = document.getElementById('backTop');
window.addEventListener('scroll', () => {
  btn.style.display = window.scrollY > 400 ? 'flex' : 'none';
});

// ── Search ──────────────────────────────────────────────────────────────

// searchData is injected by build_book.py, above this block.
// The stories are vocalized but nobody types nikud into a search box, so
// comparing the two directly finds nothing. Match on text with the points
// stripped, keeping a map back into the original string so the highlight still
// lands on the right characters -- including their vowels.
const NIKUD = /[֑-ׇ]/;

// Stripping the points is only half of it. Pointed Hebrew is written
// defectively -- סיפור is pointed סִפּוּר, the yod gone once the hiriq carries
// the vowel -- so a reader typing the everyday spelling still does not match
// a pointed title letter for letter, and the title stops finding itself. When
// the direct comparison fails, run it again with vav and yod dropped from
// both sides, which brings the two spellings together.
const MATRES = /[וי]/;

function fold(text, loose) {
  let plain = '';
  const map = [];
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (NIKUD.test(ch)) continue;
    if (loose && MATRES.test(ch)) continue;
    plain += ch; map.push(i);
  }
  map.push(text.length);
  return { plain, map };
}

function findFolded(text, query, loose) {
  const f = fold(text, loose);
  const i = f.plain.indexOf(query);
  if (i < 0) return null;
  return { start: f.map[i], end: f.map[i + query.length] };
}

// The loose spelling of the query, used only as a second chance: on its own it
// is too blunt a key to search by.
function looseQuery(query) {
  const bare = query.replace(/[וי]/g, '');
  return bare.length >= 3 ? bare : null;
}
function matchIn(text, query, loose) {
  return findFolded(text, query) || (loose ? findFolded(text, loose, true) : null);
}

function escapeHtml(s) {
  return s.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
}

// Marking by slice rather than by regex keeps a query like "(" from blowing up
// the whole search, which building a RegExp out of raw input would do.
function markSlice(text, hit) {
  if (!hit) return escapeHtml(text);
  return escapeHtml(text.slice(0, hit.start))
       + '<mark>' + escapeHtml(text.slice(hit.start, hit.end)) + '</mark>'
       + escapeHtml(text.slice(hit.end));
}

function doSearch(raw) {
  const box = document.getElementById('searchResults');
  const query = raw.trim().replace(new RegExp(NIKUD.source, 'g'), '');
  if (query.length < 2) { box.style.display = 'none'; return; }

  const loose = looseQuery(query);
  const hits = [];
  for (const d of searchData) {
    const inTitle = matchIn(d.title, query, loose);
    const inBody = matchIn(d.body, query, loose);
    if (inTitle || inBody) hits.push({ d, inTitle, inBody });
    if (hits.length >= 20) break;
  }

  if (!hits.length) {
    box.innerHTML = '<div class="sr-item">לא נמצאו תוצאות</div>';
    box.style.display = 'block';
    return;
  }

  box.innerHTML = hits.map(h => `<div class="sr-item" onclick="jumpTo('${h.d.id}')">
      <strong>${markSlice(h.d.title, h.inTitle)}</strong><br>
      <small>${getSnippet(h.d.body, h.inBody)}</small>
    </div>`).join('');
  box.style.display = 'block';
}

function getSnippet(text, hit) {
  if (!hit) return escapeHtml(text.slice(0, 80)) + '...';
  const start = Math.max(0, hit.start - 30);
  const end = Math.min(text.length, hit.end + 50);
  return (start > 0 ? '...' : '')
       + escapeHtml(text.slice(start, hit.start))
       + '<mark>' + escapeHtml(text.slice(hit.start, hit.end)) + '</mark>'
       + escapeHtml(text.slice(hit.end, end))
       + (end < text.length ? '...' : '');
}

function jumpTo(id) {
  document.getElementById('searchResults').style.display = 'none';
  document.getElementById('searchBox').value = '';
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({behavior:'smooth', block:'start'});
  el.classList.add('highlight-story');
  setTimeout(() => el.classList.remove('highlight-story'), 2200);
}

// close search when clicking outside
document.addEventListener('click', e => {
  if (!e.target.closest('.search-wrap'))
    document.getElementById('searchResults').style.display = 'none';
});

// copy a direct, shareable link to one story ("...#story-133") to the clipboard
// The page may be rendered inside a viewer's iframe, where location.href is the
// iframe's internal address rather than the address the reader sees and can share.
// In that case document.referrer holds the containing page's URL, which is the one
// worth copying.
function shareableBaseUrl() {
  let base = window.location.href;
  if (window.self !== window.top && document.referrer && /^https?:/i.test(document.referrer)) {
    base = document.referrer;
  }
  return base.split('#')[0];
}

function copyStoryLink(storyId, button) {
  const storyUrl = shareableBaseUrl() + '#' + storyId;

  function showCopied() {
    const oldText = button.innerHTML;
    button.innerHTML = button.classList.contains('toc-copy-link') ? '✅' : '✅ הקישור הועתק';
    setTimeout(() => { button.innerHTML = oldText; }, 1800);
  }

  function fallbackCopy() {
    // navigator.clipboard is blocked in some embedded/sandboxed viewers —
    // fall back to a hidden textarea + execCommand, and finally to a prompt
    // the user can copy from by hand.
    try {
      const ta = document.createElement('textarea');
      ta.value = storyUrl;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      if (ok) { showCopied(); return; }
    } catch (err) { /* fall through */ }
    window.prompt('העתק את הקישור:', storyUrl);
  }

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(storyUrl).then(showCopied, fallbackCopy);
  } else {
    fallbackCopy();
  }
}

// jump straight to the story named in the URL hash (e.g. #story-134) and highlight it,
// even if it arrives inside an artifact viewer that renders the page after initial load
// Arriving on a shared link, the browser starts its own smooth scroll toward the
// anchor — across a book this long that animation runs for seconds, and anything
// we do mid-flight just fights it. So when the page opens with a hash, switch
// scroll-behavior off before that animation can start; it goes back to smooth
// once we have landed, in time for in-page clicks.
const arrivedOnStory = !!window.location.hash;
if (arrivedOnStory) document.documentElement.style.scrollBehavior = 'auto';

function storyFromHash() {
  const id = window.location.hash.replace('#', '');
  return id ? document.getElementById(id) : null;
}

function scrollToHashStory() {
  const story = storyFromHash();
  if (story) story.scrollIntoView({block: 'start'});
}

function highlightCurrentStory(jump) {
  const story = storyFromHash();
  if (!story) return;
  if (jump) scrollToHashStory();
  story.classList.add('highlight-story');
  setTimeout(() => story.classList.remove('highlight-story'), 3000);
}

window.addEventListener('load', () => {
  if (!arrivedOnStory) return;
  setTimeout(() => {
    highlightCurrentStory(true);
    // Re-assert once the last images and late layout have settled, then hand
    // smooth scrolling back for ordinary in-page navigation.
    setTimeout(scrollToHashStory, 200);
    setTimeout(() => {
      scrollToHashStory();
      document.documentElement.style.scrollBehavior = '';
    }, 500);
  }, 300);
});

// An in-page click: the browser scrolls smoothly on its own, the highlight is ours.
window.addEventListener('hashchange', () => highlightCurrentStory(false));
