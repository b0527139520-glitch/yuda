# Publishing a story book

Two routes. GitHub Pages gives a real public URL that anyone can open; a Claude Artifact
gives a private page you can view and optionally share. The per-story links work in both.

## GitHub Pages

The book has to be a **standalone document** here — build without `--fragment`.

Name the file `index.html` at the repository root. Then the site URL is the book itself
(`https://USER.github.io/REPO/`) instead of a path ending in a filename, which matters
because Hebrew filenames turn into unreadable percent-encoded URLs when shared.

Add an empty `.nojekyll` file next to it. Without it Pages runs the files through Jekyll,
which ignores anything starting with an underscore and occasionally mangles output.

Then, in the repository: **Settings → Pages → Source: Deploy from a branch → pick the
branch → folder `/ (root)` → Save.** The build takes a minute or two.

Story links are then `https://USER.github.io/REPO/#story-7`.

### The private-repo trap

GitHub Pages on a **private** repository requires a paid plan. On the free tier Pages only
works for public repositories. This surprises people, so raise it *before* they try.

If the repository is private, there are two honest options, and the choice belongs to the
owner rather than to you:

1. **A separate public repository holding only the books.** The original stays private.
   This is usually right — publishing a working repo exposes everything in it, not just
   the book.
2. **Make the existing repository public.** Fast, but every file in it becomes visible,
   including the entire commit history.

Before anyone makes a repository public, scan it for credentials — API keys, tokens,
`.env` files, private keys — and report what else would become visible. Making a repository
public is close to irreversible: content gets forked, indexed, and archived, and turning it
private again does not retract copies that already exist.

### What "public" then means, day to day

Worth stating plainly to whoever owns the repository, because it catches people out:

- Every push is visible within seconds, on **every branch** — not just the one Pages serves.
- A push to the Pages branch is live on the web a minute or two later, with no review step.
- The whole history is public, including draft wording that was later revised.

If they want a review step, keep drafts in a private repository and copy finished books
across. If they would rather move fast, that is a legitimate choice — just make sure it is
an informed one, then respect it and stop re-litigating it.

## Claude Artifact

Build with `--fragment`, then publish the file with the Artifact tool.

Artifacts are private until shared from the page's own share menu — that is the reader's
action, not something that can be done for them.

Google Fonts is the one external host that loads; a strict CSP blocks every other CDN,
stylesheet, remote image, and network call. The bundled template only uses Google Fonts, so
this is a constraint to remember when adding anything, not a problem to solve now.

Publishing again with the **same file path** updates the same artifact and keeps its URL.
Publishing from a different path creates a second artifact with a different link.

## Size

A Pages site is capped at 1 GB, which is the real ceiling — not repository size.

Text is nothing: a 650 KB book means roughly 1,500 books fit. Audio is what fills it —
speech at 128 kbps runs about 1 MB per minute, so an hour of narration costs ~60 MB. If a
book grows past a few hundred megabytes of media, host the media elsewhere and link to it.

Two hard limits worth remembering: GitHub rejects any single file over 100 MB on push, and
**Git LFS files are not served by Pages** — an LFS-backed audio file will arrive at the
browser as a small text pointer instead of sound.
