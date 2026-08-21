#!/usr/bin/env node
// Checks the invariants that make a story reachable in the Tzadikim catalog.
//
// A story lives in five places at once: the section in the body, the entry in
// the contents sidebar, the row in searchData, the counters, and the previous
// story's "next" link. Miss one and the story is still in the file but the
// reader cannot get to it -- which is exactly how thirteen of them went
// missing from search and ten from the contents list.
//
// No dependencies: run `node scripts/validate_catalog.js <file.html>`.
// Exit code 1 means a check failed; warnings alone still exit 0.

const fs = require('fs');

const file = process.argv[2];
if (!file) { console.error('usage: node scripts/validate_catalog.js <file.html>'); process.exit(2); }
const html = fs.readFileSync(file, 'utf8');

let failed = 0, warned = 0;
const pass = (name, detail) => console.log('  PASS  ' + name + (detail ? '  |  ' + detail : ''));
const fail = (name, detail) => { failed++; console.log('  FAIL  ' + name + (detail ? '  |  ' + detail : '')); };
const warn = (name, detail) => { warned++; console.log('  WARN  ' + name + (detail ? '  |  ' + detail : '')); };
const check = (name, ok, detail) => ok ? pass(name, detail) : fail(name, detail);
const list = (a, n = 8) => a.slice(0, n).join(', ') + (a.length > n ? ` … (+${a.length - n})` : '');

// ── the sidebar and the body, as raw slices ────────────────────────────────
const sidebar = (html.match(/<aside class="sidebar"[\s\S]*?<\/aside>/) || [''])[0];
const main = (html.match(/<main[\s\S]*?<\/main>/) || [''])[0];
check('sidebar found', !!sidebar);
check('main found', !!main);

// ── tag balance, the one that catches an unclosed chapter div ──────────────
for (const tag of ['div', 'section', 'article', 'ul']) {
  const open = (html.match(new RegExp('<' + tag + '[\\s>]', 'g')) || []).length;
  const close = (html.match(new RegExp('</' + tag + '>', 'g')) || []).length;
  check(`<${tag}> balanced`, open === close, `${open} open / ${close} close`);
}

// ── a chapter must never contain another chapter ───────────────────────────
// Walk the sidebar keeping a stack of open divs, flagging any toc-chapter
// opened while another is still on the stack.
function nestedChapters(slice) {
  const stack = [];
  const nested = [];
  const re = /<(\/?)(div)\b([^>]*)>/g;
  let m;
  while ((m = re.exec(slice))) {
    if (m[1] === '/') { stack.pop(); continue; }
    const isChapter = /class="toc-chapter"/.test(m[3]);
    if (isChapter && stack.some(Boolean)) nested.push(slice.slice(m.index, m.index + 60));
    stack.push(isChapter);
  }
  return { nested, unclosed: stack.length };
}
const nest = nestedChapters(sidebar);
check('no chapter nested inside another', nest.nested.length === 0,
  nest.nested.length ? list(nest.nested, 3) : '');
check('every sidebar div closed', nest.unclosed === 0,
  nest.unclosed ? nest.unclosed + ' left open' : '');

// ── the three lists of stories that must agree ─────────────────────────────
const bodyIds = [...main.matchAll(/<article class="story-card[^"]*" id="(story-\d+)"/g)].map(m => m[1]);
const tocIds = [...sidebar.matchAll(/<li><a href="#(story-\d+)"/g)].map(m => m[1]);
const sdRaw = html.match(/const searchData = (\[[\s\S]*?\]);/);

check('story ids unique', new Set(bodyIds).size === bodyIds.length,
  bodyIds.length + ' stories');

let sd = [];
if (!sdRaw) fail('searchData found');
else {
  try {
    sd = JSON.parse(sdRaw[1]);
    pass('searchData parses as JSON', sd.length + ' entries');
    const shape = sd.filter(d => !d || typeof d.id !== 'string' || typeof d.title !== 'string' || typeof d.body !== 'string');
    check('every searchData row has id, title and body', shape.length === 0, list(shape.map(d => JSON.stringify(d).slice(0, 40))));
  } catch (e) {
    fail('searchData parses as JSON', e.message.slice(0, 120) + ' -- a missing comma here silently kills every script on the page');
  }
}
const sdIds = sd.map(d => d.id);

const missingToc = bodyIds.filter(id => !tocIds.includes(id));
const missingSd = bodyIds.filter(id => !sdIds.includes(id));
const phantomToc = tocIds.filter(id => !bodyIds.includes(id));
const phantomSd = sdIds.filter(id => !bodyIds.includes(id));
check('every story is listed in the contents', missingToc.length === 0, list(missingToc));
check('every story is in the search index', missingSd.length === 0, list(missingSd));
check('no contents entry points at a missing story', phantomToc.length === 0, list(phantomToc));
check('no search entry points at a missing story', phantomSd.length === 0, list(phantomSd));
check('contents lists each story once', new Set(tocIds).size === tocIds.length);
check('search index lists each story once', new Set(sdIds).size === sdIds.length);

// ── titles and numbers must match the card they belong to ──────────────────
const cards = [...main.matchAll(/<article class="story-card[^"]*" id="(story-\d+)"[\s\S]*?<\/article>/g)];
const numBad = [], titleBad = [];
for (const c of cards) {
  const id = c[1], block = c[0];
  const num = (block.match(/<span class="story-num"[^>]*>#(\d+)</) || [])[1];
  if (num !== id.split('-')[1]) numBad.push(id + ' shows #' + num);
  const title = (block.match(/<h3 class="story-title">([\s\S]*?)<\/h3>/) || [])[1];
  const row = sd.find(d => d.id === id);
  if (row && title && row.title !== title.replace(/<[^>]*>/g, '').trim()) titleBad.push(id);
}
check('story number matches the story id', numBad.length === 0, list(numBad));
check('search title matches the card title', titleBad.length === 0, list(titleBad));

// ── chapters: order, era, counters ─────────────────────────────────────────
const bodyChapters = [...main.matchAll(/<section class="chapter-section" id="([^"]+)"/g)].map(m => m[1]);
const tocChapters = [...sidebar.matchAll(/class="toc-sage-link">/g)].length
  ? [...sidebar.matchAll(/<a href="#([^"]+)" class="toc-sage-link">/g)].map(m => m[1])
  : [];
check('every chapter is listed in the contents', bodyChapters.length === tocChapters.length,
  bodyChapters.length + ' in the body / ' + tocChapters.length + ' listed');
const orderDiff = tocChapters.findIndex((id, i) => bodyChapters[i] !== id);
check('contents order follows the body', orderDiff === -1,
  orderDiff === -1 ? '' : 'first mismatch at #' + orderDiff + ': ' + tocChapters[orderDiff] + ' vs ' + bodyChapters[orderDiff]);

// a chapter outside every era block renders after the last era banner
const eraBlocks = [...main.matchAll(/<section class="era-block" id="([^"]+)">/g)];
const orphanChapters = [];
for (const m of main.matchAll(/<section class="chapter-section" id="([^"]+)"/g)) {
  const before = eraBlocks.filter(e => e.index < m.index).pop();
  if (!before) { orphanChapters.push(m[1]); continue; }
  const closeIdx = main.indexOf('\n</section>\n<section class="era-block"', before.index);
  if (closeIdx !== -1 && m.index > closeIdx) orphanChapters.push(m[1]);
}
check('every chapter sits inside an era block', orphanChapters.length === 0, list(orphanChapters));

// counters
const wantCount = n => n === 1 ? 'סיפור אחד' : n + ' סיפורים';
const countBad = [];
for (const m of sidebar.matchAll(/<div class="toc-chapter" [\s\S]*?<a href="#([^"]+)" class="toc-sage-link">[\s\S]*?<span class="toc-count">([^<]*)<\/span>[\s\S]*?<ul class="toc-stories">([\s\S]*?)<\/ul>/g)) {
  const [, chapterId, label, ul] = m;
  const listed = (ul.match(/<li>/g) || []).length;
  const section = main.match(new RegExp('<section class="chapter-section" id="' + chapterId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '"[\\s\\S]*?(?=<section class="chapter-section"|<section class="era-block"|</main>)'));
  const real = section ? (section[0].match(/<article class="story-card[^"]*"/g) || []).length : 0;
  if (listed !== real) countBad.push(chapterId + ': lists ' + listed + ', has ' + real);
  else if (label.trim() !== wantCount(listed)) countBad.push(chapterId + ': labelled "' + label.trim() + '", has ' + listed);
}
check('chapter counters match the stories under them', countBad.length === 0, list(countBad, 5));

const eraCounts = [...sidebar.matchAll(/<div class="toc-era" id="toc-([^"]+)">[\s\S]*?<span class="toc-era-count">(\d+)<\/span>/g)];
const eraBad = [];
for (const [, era, label] of eraCounts) {
  const block = main.match(new RegExp('<section class="era-block" id="' + era + '">[\\s\\S]*?(?=<section class="era-block"|</main>)'));
  const real = block ? (block[0].match(/<article class="story-card[^"]*"/g) || []).length : -1;
  if (String(real) !== label) eraBad.push(era + ': labelled ' + label + ', has ' + real);
}
check('era counters match their blocks', eraBad.length === 0, list(eraBad));

// the banner at the top of each era repeats the same totals in prose
const eraBlockList = [...main.matchAll(/<section class="era-block" id="([^"]+)">/g)];
const bannerBad = [];
eraBlockList.forEach((b, i) => {
  const slice = main.slice(b.index, i + 1 < eraBlockList.length ? eraBlockList[i + 1].index : main.length);
  const sub = (slice.match(/<div class="era-banner-sub">([^<]*)<\/div>/) || [])[1] || '';
  const stories = (slice.match(/<article class="story-card[^"]*"/g) || []).length;
  const chapters = (slice.match(/<section class="chapter-section"/g) || []).length;
  const saidStories = (sub.match(/(\d+) סיפורים/) || [])[1];
  const saidPeople = (sub.match(/(\d+) דמויות/) || [])[1];
  if (saidStories !== String(stories) || saidPeople !== String(chapters))
    bannerBad.push(b[1] + ': banner says ' + saidStories + '/' + saidPeople + ', block has ' + stories + '/' + chapters);
});
check('era banners match their blocks', bannerBad.length === 0, list(bannerBad));

const heroStories = (html.match(/stat-bubble">📚 (\d+) סיפורים/) || [])[1];
const heroPeople = (html.match(/stat-bubble">👑 (\d+) דמויות/) || [])[1];
check('hero story count', heroStories === String(bodyIds.length), heroStories + ' vs ' + bodyIds.length + ' stories');
check('hero chapter count', heroPeople === String(bodyChapters.length), heroPeople + ' vs ' + bodyChapters.length + ' chapters');

// ── links ──────────────────────────────────────────────────────────────────
const markup = html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<style[\s\S]*?<\/style>/g, '');
const allIds = new Set([...html.matchAll(/ id="([^"]+)"/g)].map(m => m[1]));
const deadLinks = [...new Set([...markup.matchAll(/href="#([^"]+)"/g)].map(m => m[1]))]
  .filter(h => h && h !== 'toc' && !allIds.has(h) && !allIds.has(decodeURIComponent(h)));
check('every internal link resolves', deadLinks.length === 0, list(deadLinks));

// ── the reading chain ─────────────────────────────────────────────────────
// A link that is simply absent counts the same as one aiming at the wrong
// card. Only checking the links that exist is how ten missing ones piled up
// here unnoticed while the report spoke of fourteen wrong ones: a story added
// without updating its neighbour's "next" left no trace at all.
const navBad = [];
cards.forEach((c, i) => {
  const nav = (c[0].match(/<div class="story-navigation">([\s\S]*?)<\/div>/) || [])[1] || '';
  const prev = (nav.match(/href="#(story-\d+)"[^>]*>→ הקודם/) || [])[1] || null;
  const next = (nav.match(/href="#(story-\d+)"[^>]*>הבא ←/) || [])[1] || null;
  const wantPrev = i > 0 ? bodyIds[i - 1] : null;
  const wantNext = i < bodyIds.length - 1 ? bodyIds[i + 1] : null;
  if (prev !== wantPrev) navBad.push(c[1] + ' prev → ' + (prev || 'missing') + ' (should be ' + (wantPrev || 'absent') + ')');
  if (next !== wantNext) navBad.push(c[1] + ' next → ' + (next || 'missing') + ' (should be ' + (wantNext || 'absent') + ')');
});
check('previous/next links follow the reading order', navBad.length === 0, list(navBad, 6));

// ── the pointing ──────────────────────────────────────────────────────────
// Every title and sage line carries nikud, so one that arrives without it is
// a card written to the old style. This asks only whether marks are there --
// whether they are the right marks is for a person and docs/ניקוד-לבדיקה.md.
const NIKUD = /[֑-ׇ]/;
const unpointed = [];
for (const c of cards) {
  const title = (c[0].match(/<h3 class="story-title">([\s\S]*?)<\/h3>/) || [])[1] || '';
  const who = (c[0].match(/<span class="who">([\s\S]*?)<\/span>/) || [])[1] || '';
  if (!NIKUD.test(title)) unpointed.push(c[1] + ' title');
  if (!NIKUD.test(who)) unpointed.push(c[1] + ' who');
}
check('titles and sage lines are pointed', unpointed.length === 0, list(unpointed));

const firstNoPrev = cards.length && !/→ הקודם/.test(cards[0][0]);
const lastNoNext = cards.length && !/הבא ←/.test(cards[cards.length - 1][0]);
check('first story has no previous link', firstNoPrev);
check('last story has no next link', lastNoNext);

console.log('');
if (failed) console.log(failed + ' check(s) failed' + (warned ? ', ' + warned + ' warning(s)' : ''));
else console.log('all checks passed' + (warned ? ', ' + warned + ' warning(s)' : ''));
process.exit(failed ? 1 : 0);
