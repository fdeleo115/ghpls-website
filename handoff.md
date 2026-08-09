# Handoff — GHPLS Website

_Written: June 2026 · Updated: August 8 2026 · For whoever (human or AI) picks this up next._

> **Section order:** newest first. The "seventh pass" below is the most recent
> work; sections after it are earlier the same day or before. Their internal
> cross-references ("see section 0") still point at each other, not at this
> section.

## Seventh pass, Aug 8 2026 — optional header-photo override on exec profiles

Small, focused fix. The 7 static pages (About, Contact, Materials,
Achievements, Events, Photos, GH Cup) each have a dedicated "Header Photo"
CMS field for the page banner, independent of any other photo on the page —
see the "Page Header Photos" file collection, section 0. Exec profile pages
had no equivalent: the banner always reused the circular headshot crop
stretched wide (`.detail-fact-card`'s sibling shape on the `photo` field),
which doesn't always read well as a 1600×380 navy-overlaid strip.

- Added two new optional fields to the `team` collection in
  `admin/config.yml`: `headerPhoto` (image) + `headerPhotoPosition`
  (focal-point, same "Profile page banner" 1600×380 navy-overlay shape used
  everywhere else). Placed right after the headshot's own focal-point field.
- `src/_includes/member.njk`: the banner now resolves
  `bannerPhoto = headerPhoto or photo` and
  `bannerPosition = (headerPhoto and headerPhotoPosition) or photoPosition`.
  Leaving the new fields blank is a no-op — banner behavior for all 8
  existing execs is byte-identical to before. Setting them swaps in the
  separate photo and position.
- **Verified** both branches by temporarily setting `headerPhoto` +
  `headerPhotoPosition` on `president.md`, confirming the rendered
  `background-image`/`background-position` changed to the new photo, then
  reverting the file (`git status` clean afterward) and confirming it fell
  back to the headshot again.
- Committed `d82f3a0` (after rebasing on 3 CMS commits that landed
  mid-session — same "execs push while you work" pattern as always).
  Deployed via the auto-deploy pipeline from the sixth pass below; confirmed
  live by fetching `/admin/config.yml` from the deployed site and finding the
  two new fields.

**Files touched:** `admin/config.yml`, `src/_includes/member.njk`.

## Sixth pass, Aug 8 2026 — auto-deploy pipeline, profile curation/classification fixes

Started from a user bug report ("I add competitions/achievements and it
doesn't update, it just shows the ones you added before") that turned out to
bundle three separate, real defects. All four items below are committed and
pushed (`d74bbc0`, `78978a1`, `dfeec82` and one CMS commit rebased in
between); the live site was checked against each one after deploy.

1. **No deploy pipeline existed — this was the actual cause of the original
   report.** CMS saves commit straight to `main` (confirmed working), but
   nothing rebuilt/redeployed the Cloudflare Worker afterward — publishing
   required someone to run `npx wrangler deploy` by hand. Confirmed by diffing
   a fresh local build against the live site: byte-identical, meaning the live
   site was exactly whatever the last manual deploy happened to be, not
   necessarily the latest commit. **This resolves section 2's old open
   question** ("not independently re-verified... automatic or manual") — it
   was manual, and now it's automatic.
   - Added `.github/workflows/deploy.yml`: on every push to `main`, checks out,
     `npm ci`, builds with Eleventy, then deploys via
     `cloudflare/wrangler-action@v3`.
   - Needs two GitHub repo secrets, both added by the user (never handled by
     Claude — they're credentials): `CLOUDFLARE_API_TOKEN` (an "Edit Cloudflare
     Workers" scoped token) and `CLOUDFLARE_ACCOUNT_ID`.
   - **Verified twice**: pushed the workflow itself, watched the Action run
     green, confirmed the live site matched. Then pushed the fixes below,
     watched it run again, confirmed live output for Francesco's and Ashon's
     profiles matched the new local build exactly.
   - Deploys take **~30–40 seconds** after a push now — not instant.

2. **`memberRecord` (`.eleventy.js`) merged manual entries into the
   auto-pulled list instead of letting them replace it.** An exec who typed 3
   competitions by hand saw 6 — their 3 were deduped against identical
   auto-pulled rows, and the other 3 auto-pulled rows stayed. Input was
   technically honoured, practically invisible. Fixed: filling in a section
   (`competitions` / `teamPlacements` / `individualAchievements`) now
   **replaces** the auto-pulled version of that one section entirely; leaving
   a section empty still auto-fills it. Precedence is per-section, so an exec
   can curate one list without blanking the others. `manualOnly` (unchanged)
   still suppresses auto-pull across all three at once.

3. **Team Placements vs. Individual Achievements was classified by counting
   names in `recipients`, not by what kind of result it was.** "Best Skeleton
   Arguments," shared by two people, was filed as a team placement purely
   because two names were on it — headcount, not category. Fixed: a new
   `PLACEMENT_RE` keyword match (champions/finalists/semi-finalists/runners-up/
   Nth place) decides by default, and a new optional `type` field on each
   result (`"placement"` or `"award"`) lets an editor override it outright.
   Exposed in the CMS as a **"Counts As"** select on each Results row in the
   Achievements collection, defaulting to "Decide automatically."

4. **A name typo silently dropped an award off a profile with zero
   indication anything was wrong.** `uoft-cup-2026.md` had "Ashon **Vas**" in
   `competitors`/`recipients` but "Ashon **Vaz**" in the prose and on his team
   entry — the join is exact-string, so his Oral Advocate Award never reached
   his profile. No error, no warning, no empty state; it just looked like he
   hadn't won anything. Fixed the typo, and added a build-time check
   (`warnOnNearMissNames` in `.eleventy.js`): any achievement name within edit
   distance 2 of an exec's name that *doesn't* exactly match now prints a
   console warning during the build. Verified it actually fires by briefly
   reintroducing the typo and rebuilding, then reverted.

5. **Empty Team Placements / Individual Achievements sections were showing a
   heading anyway** ("Team Placements" / "No team placements recorded yet.")
   on a real exec's profile — flagged by the user as "kinda embarrassing" for
   the several execs with no placements or individual awards yet. Both
   sections in `member.njk` now render nothing at all when empty, headings
   included. **Competitions Attended deliberately keeps its "No competitions
   recorded yet." empty state** — every exec has attended at least one, so in
   practice it never shows, and the user confirmed leaving it as-is.

**Open item, flagged to the user, not resolved:** Francesco's curated
Competitions Attended list (3 entries) no longer matches his auto-filled Team
Placements (6 entries) — his profile currently lists placements at events
(Humber Cup, Gryphons Cup 2025, Highland Cup 2024) it doesn't list him as
having attended. Either add those back to his manual Competitions list, or
curate Team Placements the same way. Left alone deliberately — it's an
editorial choice, not a bug, and it's his call.

**Files touched:** `.eleventy.js`, `admin/config.yml`,
`src/_includes/member.njk`, `src/achievements/uoft-cup-2026.md`, new
`.github/workflows/deploy.yml`.

## Fifth pass, Aug 8 2026 — editable exec records, mobile audit, responsive images

Three pieces of work: making an exec's competitions/achievements editable in the
CMS (they weren't), a full mobile pass over every page after the recent
redesign, and build-time image resizing. **Committed as `815677d`** (was
still uncommitted when this section was first written; see the sixth pass
above for what changed on top of it since).

### 1. Exec competitions/achievements are now CMS-editable

Previously these three sections on an exec's profile page were *only* derived
from the Achievements collection via the `memberRecord` filter — an exec had no
way to add anything themselves. Now `memberRecord` merges **two** sources:

- **Auto-pulled** (unchanged): name cross-referenced against the `achievements`
  collection's `competitors` and `results[].recipients`.
- **Manual** (new): three optional list fields on the team member —
  `competitions`, `teamPlacements`, `individualAchievements` — for outside
  competitions, older awards, or anything the automatic match misses.

Details worth knowing before changing this:

- The two sources are **merged and de-duplicated** on
  `award|competition|year` (lowercased), so entering something by hand that's
  already auto-pulled shows once, not twice.
- A manual entry whose competition name + year matches a real achievement gets
  **linked to that achievement page automatically**; one that doesn't renders as
  a plain `.detail-chip--static` chip or a `<span class="names">` rather than a
  dead link. Both branches are in `member.njk`.
- A new `manualOnly` boolean on the member **suppresses the auto-pulled side
  entirely** — the escape hatch for when the name match is wrong (say, two
  people share a name). The CMS hint tells execs to leave it off.
- The team collection's `description` in `admin/config.yml` explains all of
  this to the execs in plain language.

**Verified** with temporary seed data on a real member: merge, de-duplication,
auto-linking of a hand-typed entry, the no-link fallback, and `manualOnly`
suppression were each confirmed in the browser, then the seed data was removed
(that file is unmodified in git).

### 2. Mobile pass — six real defects found and fixed

Audited 13 pages at 320 / 360 / 375 / 414 / 600 / 768 / 900 / 1024 / 1280 /
1440px. All fixes are in `src/styles.css` unless noted. Result: **zero
horizontal overflow on any page at any of those widths.**

1. **The hamburger was clipped off the right edge of every page on every
   phone.** `nav .logo span` was `white-space: nowrap` with no `min-width: 0`
   on its flex parent, so the long society name couldn't shrink and pushed the
   menu button ~4px past the viewport. Fixed with `min-width: 0` on
   `nav .logo`, `flex-shrink: 0` on the button, and a ≤600px block that lets
   the brand wrap to two lines (it does so only at ≤360px). The button is also
   now a proper 44×44 touch target instead of 32×24.
2. **Award rows broke inconsistently on phones.** `[BADGE] recipients` rows
   (`.win-card .achievement`, `.winner-award`, `.detail-result`) are flex with
   `flex-wrap`, and because badge widths vary enormously ("FINALISTS" vs
   "DISTINGUISHED ORAL ADVOCATE") some rows stayed inline while others wrapped
   with the name landing flush left, reading as a separate item. Below 640px
   every row now stacks the same way: badge on its own line, name beneath.
3. **Long badges overflowed the page at 320px.** Same rows — the badges are
   `white-space: nowrap`, and "2ND DISTINGUISHED ORAL ADVOCATE" is wider than a
   320px phone, which made the whole page scroll sideways. Now that the badge
   is on its own line below 640px it's allowed to wrap inside its pill.
4. **The exec headshot rendered as an oval, not a circle** (on desktop too, not
   just mobile). `.member-headshot` sets `aspect-ratio: 1`, but `.detail-aside`
   is a column flexbox and a flex item's automatic minimum size let the tall
   portrait `img` push the box past its aspect ratio. Fixed with
   `min-height: 0` — **don't remove that line**, the circle depends on it.
5. **A single "More Photos" entry sat orphaned at half width.**
   `.detail-gallery` was a fixed 2-column grid below 640px; it's now
   `repeat(auto-fit, minmax(150px, 1fr))` so one photo fills the column and two
   still sit side by side.
6. **iOS Safari zoomed in whenever a form field was focused.** Contact and RSVP
   inputs were 15.2px; Safari auto-zooms below 16px. Both are 16px on phones now.

Also fixed along the way: the Materials page's "Coming Soon" placeholder was
`.btn-outline` (peach text meant for navy backgrounds) at **1.44:1** contrast on
a white card — effectively invisible. It's now a dedicated `.btn-soon` class at
4.83:1 with a dashed border. Markup change in `src/pages/materials.njk`.

Confirmed the ≤640px rules don't leak upward — award rows are still inline on
desktop — and `/admin/` still loads clean with the new CMS fields.

### 3. Build-time responsive images (biggest real mobile win)

Execs upload straight off a phone or DSLR, and those originals were being served
untouched into 339px-wide boxes: the Events page pulled **6.45 MB** of images,
GH Cup 5.59 MB, an exec profile 3.65 MB. `.eleventy.js` now generates resized
JPEGs at build time and rewrites the HTML to use them.

| Page | Before | After | Saved |
|---|---|---|---|
| Events | 6.45 MB | 0.21 MB | 97% |
| Exec profile | 3.65 MB | 0.18 MB | 95% |
| GH Cup | 5.59 MB | 0.29 MB | 95% |
| Materials | 1.37 MB | 0.11 MB | 92% |
| Photo Gallery | 3.74 MB | 0.40 MB | 89% |
| Achievements | 3.44 MB | 0.47 MB | 86% |

How it works, and the constraints behind each choice:

- `sharp` is now an explicit **devDependency** (it was previously only present
  as a transitive dep of `wrangler`, which was luck, not a guarantee).
- An `eleventy.before` hook resizes everything in `assets/uploads/` to widths
  **480 / 800 / 1280 / 1920**, writing into `_site/assets/uploads/resized/`.
  Upscales are skipped, and output is cached against source mtime.
  Clean build ≈ 4.3s; a rebuild with nothing changed ≈ 0.6s.
- **The originals are never touched.** `assets/uploads/` is unchanged, so the
  CMS media library and every existing `photo:` path still work. Execs keep
  uploading full-size photos and never think about any of this. The resized
  copies live only in `_site/`, which is gitignored.
- A `responsiveImages` transform adds `srcset`/`sizes` to `<img>` tags, points
  `src` at the largest variant, and rewrites both inline
  `background-image:url(...)` (the page-header banners) and the lightbox's
  `data-img` attributes.
- **Deliberately `srcset` on the existing `<img>` rather than `<picture>` +
  WebP.** Wrapping images in `<picture>` inserts a box between the `img` and
  its styled parent, which would break rules like
  `.member-headshot img { height: 100% }` — i.e. it would re-break the circular
  headshot fixed in section 2 above. Resizing alone already removes ~95% of the
  bytes. WebP is the natural next step (~25% more) if someone wants it, but it
  needs the `<picture>` layout risk handled first.
- `.rotate()` runs before the resize so EXIF orientation is baked in — two of
  the DSLR photos are `orientation: 8` and would otherwise come out sideways.
  Verified they don't.

**Verified:** every page at 375px and 1280px — no broken images, no
unresized originals still being served (except `img_7285.jpg`, which is 479px
wide and correctly below the smallest variant), no overflow, lightbox and page
header focal points intact.

### Left undone, on purpose

- **Not committed or pushed.** Remember `git pull --rebase origin main` first —
  execs push CMS commits.
- The `<picture>`/WebP upgrade described above.
- Stale build output: a clean `_site` still emits unstyled pages for
  `/events/<slug>/`, `/photos/<slug>/`, `/past-events/<slug>/` and
  `/ghcup-winners/<slug>/` — collection items with no layout assigned, the same
  class of bug that exec profiles had before section 0a. Harmless (nothing links
  to them) but they're real URLs. Worth either assigning a layout or setting
  `permalink: false` in a directory data file.

## 0. Aug 8 2026, fourth pass — CMS photo editor rebuild + committed the backlog

Two things happened this session, on top of finally shipping everything that
had been piling up uncommitted (see 0a/0b/0c below, now **all pushed**).

- **Committed and pushed sections 0a + 0b + 0c** (commit `bcf7966`) after a
  clean `git pull --rebase` (an exec had pushed a Past Event + 3 photos via
  the CMS mid-session; fast-forwarded with no conflicts).
- **Closed a real "can't edit everything" gap.** Audited every page and found
  7 page-header banner photos (About, Contact, Materials, Achievements,
  Events, Photos, GH Cup) and the Materials page's 3 resource cards were
  hardcoded in `.njk` templates, not CMS-editable at all. Fixed:
  - New `src/_data/pageHeaders.json` + a "Page Header Photos" section in
    `admin/config.yml` (image + drag-to-position focal point per page).
  - New `src/_data/materials.json` + a "Materials Page" CMS entry — the 3
    resource cards (title/description/file) are now editable; a card with no
    file shows "Coming Soon" instead of a dead `href="#"` link.
  - Commit `bcf7966` (bundled with the above), pushed.
  - **Already validated live**: an exec used the new Page Header Photos field
    within the same session — all 7 banners now have real photos with precise
    focal points set (`src/_data/pageHeaders.json` on `origin/main`,
    commits `ad7eaf4` / `f452fbb`).
- **Fixed garbled team member URLs** (commit `7bb026a`, run as a background
  task). The 4 team `.md` files with mangled filenames (see 0a's "known
  pre-existing quirk" note below — that quirk is now fixed) were renamed to
  clean name-based slugs (`angelina-azar-el-hajj.md`, `mia-pietrantonio.md`,
  `ashon-vaz.md`, `ava-gonsalves.md`). Verified no internal links pointed at
  the old slugs before renaming. **Old bookmarked URLs to those 4 profiles are
  now broken** — an accepted, one-time tradeoff; not an ongoing concern.
- **Rebuilt the CMS photo focal-point editor** (commit `7c34382`) — the user
  reported the drag-to-position tool didn't preview accurately, especially for
  the new Page Content photos. Found two real bugs, not just missing polish:
  1. The widget resolved a photo's sibling fields with a flat top-level
     lookup (`entry.getIn(["data", "photo"])`), which only works for
     top-level fields. Every **nested** field — all 7 page headers, the GH
     Cup Competition Gallery — showed an empty box; there was nothing to drag.
  2. Even where a photo did show, the pointer was mapped against the padded
     box instead of the actual letterboxed image content, so the position you
     dragged to rarely matched what got saved.
  - Fix #1 required reverse-engineering how Decap actually locates a nested
    field, since it gives widgets **no path prop at all** (verified against
    decap-cms 3.1.1: full prop list has `path: undefined`, `forID` is passed
    but never applied to the DOM). What works: container fields (`object`/
    `list`) emit a DOM id shaped `<fieldName>-field-<n>`; walking up from a
    widget's own root node and collecting those ids reconstructs its data
    path, with list indices coming from DOM containment.
  - `admin/cms-extras.js`'s focal-point widget is now a two-panel crop tool:
    accurate click-to-image mapping with a real crop-rectangle overlay on the
    left, and a live result preview on the right for **every real shape a
    photo lands in on the site** (e.g. an achievement photo shows its list
    card, its detail-page banner, and its 4:3 gallery thumbnail — all three,
    live). Shape geometry comes from a new `shapes:` config key per field in
    `admin/config.yml`, sourced from real measurements in `src/styles.css`
    (not guesses) — see the long header comment at the top of
    `admin/cms-extras.js` before touching this widget again.
  - Also rebuilt the editor's separate right-hand preview pane
    (`registerPreviewStyle` loads the real site CSS + fonts into the iframe,
    each collection renders real markup/classes) so it can't drift from what
    the site actually renders.
  - **Verified** in a local decap-cms 3.1.1 test-repo harness (GitHub auth
    isn't available for local testing) — confirmed nested-field resolution,
    drag accuracy, sibling-driven shape resizing, and — the case that matters
    most — that two items in the same nested list each resolve their **own**
    photo, not a shared/stale one. Harness files deleted before commit.
  - **Deliberately skipped**: a desktop/mobile preview toggle. The multi-shape
    display already covers the core ask; flagged as a possible follow-up, not
    done.

**Files touched:** `admin/cms-extras.js` (near-total rewrite),
`admin/config.yml` (added `shapes`/`fitField`/`zoomField` to every
focal-point field), plus the `pageHeaders.json`/`materials.json` additions
above.

## 0a. Aug 8 2026, third pass — exec profile pages (committed in 0, see above)

Two small carousel fixes plus the big addition: each exec now has their own
profile page, opened from a "View Profile" link on their carousel card. This
is the most recent work — sections 0b and 0c below are earlier the same day
and the day before, respectively.

- **Carousel discoverability fix.** Widened the exec section past the site's
  usual 1200px container to 1400px (`.exec-section .container`) so desktop
  shows ~4.3 cards at once instead of ~3.2 — same card size, just a bigger
  viewport, per explicit instruction not to shrink cards. Added a text hint
  below the progress bar ("Drag, scroll, or swipe to meet the rest of the
  team") with an animated chevron, plus a one-time ~1s auto-nudge that shifts
  the rail 64px and back on load so anyone who skips the text still sees it
  move. Both disappear the instant someone scrolls/drags/uses arrow keys
  themselves; both are skipped under `prefers-reduced-motion`.
- **Exec profile pages** at `/team/<slug>/`, opened via a new "View Profile →"
  link on each carousel card (`.exec-card-link` in `src/pages/about.njk`).
  These URLs technically already existed and were being built by Eleventy
  every time (`_site/team/...` — visible in the build log even before this
  session), but with no layout assigned they rendered as blank, unstyled
  pages. `src/team/team.json` (directory data, same pattern as
  `achievements.json`) now assigns them a real layout — this doesn't create
  new pages, it makes already-existing ones useful for the first time.
  - New layout `src/_includes/member.njk`, structurally identical to
    `achievement.njk` (reuses its `.achievement-detail` grid, `.detail-fact-card`,
    `.detail-gallery`, and lightbox wholesale — see the CSS comment "EXEC
    PROFILE PAGE" in `styles.css` for the few classes added on top:
    `.detail-chip-list`, `.member-qanda`, `.member-headshot`).
  - Shows: bio, graduating year, previous role (all new optional CMS fields),
    competitions attended, team placements, individual achievements, an
    optional Q&A, the headshot, and any extra photos.
  - **Competitions/placements/individual achievements are NOT new CMS fields
    on the team member** — they're computed at build time by a new
    `memberRecord` Eleventy filter (`.eleventy.js`) that cross-references the
    member's name against the existing `achievements` collection's
    `competitors` list and `results[].recipients`. This means an exec never
    re-enters data that's already on the achievement entry, and it can't drift
    out of sync. A result counts as a **team placement** if `recipients` names
    more than one person, an **individual achievement** if it names one. If a
    member has none, each of the three sections shows an explicit "No … 
    recorded yet." message (reusing `.exec-bio--empty` styling) — never a
    blank or missing section, per the ask that this be obvious.
  - **Fixed a repeat of the black-corner bug** (see 0b below) on this new
    page: the aside originally showed the headshot in the same rectangular
    `.detail-photo` tile used for achievement photos, which re-exposed the
    baked-in black corners on the ~1:1 circular-crop source images. Headshots
    now get their own circular `.member-headshot` treatment; `.detail-photo`
    is reserved for `extraPhotos` (ordinary, non-circular event photos).
  - Fixed the team collection's CMS slug pattern (`slug: "{{slug}}"` →
    `"{{name}}"`) so *new* members get sane URLs going forward.
    **Update (same day, see section 0 above): the pre-existing mismatched
    filenames this note originally flagged were renamed in commit `7bb026a`**
    (e.g. `president.md` → `angelina-azar-el-hajj.md`, matching its actual
    contents). Old URLs to those 4 profiles now 404 — accepted tradeoff.
  - Drag-vs-click: `about.njk`'s pointerdown handler now skips starting a
    drag when the pointer lands on an `a`/`button` inside a card, so clicking
    "View Profile" navigates normally instead of being swallowed by the
    rail's `setPointerCapture`.

**Verified:** clean `npx @11ty/eleventy` build, CMS YAML parses with the new
team fields (`previousRole`, `gradYear`, `qanda`, `extraPhotos`), a filled
profile (Kate Hilton — 4 competitions, 3 team placements, 1 individual award)
and an empty one (Angelina Azar El-Hajj — zero of each, all three "recorded
yet" messages showing) both checked in the browser, no console errors, no
mobile overflow, drag-safety confirmed via direct pointer-event simulation.

**Files touched:** `.eleventy.js`, `admin/config.yml`, `src/pages/about.njk`,
`src/styles.css`, new `src/team/team.json`, new `src/_includes/member.njk`.

## 0b. Aug 8 2026, second pass — hero/carousel/achievement pass (committed in 0, see above)

A follow-up pass on top of section 0c below, from a second round of user
feedback. Committed together with 0a and 0c in commit `bcf7966` (see section 0).

- **Home hero → split layout.** `.home-hero` is now a two-column grid: copy on
  the left, a much larger crest on the right (`clamp(220px, 26vw, 400px)`, up
  from a flat 168px centred). The hard ring around the crest became a soft
  peach halo, and the `.home-portal::before` radial glow was resized to sit
  behind it as a backlight. Also fixed a long-standing double-gap bug — the
  hero CTA row had `gap: 8px` *and* a global `.btn-outline { margin-left: 16px }`,
  giving 24px of asymmetric space. Collapses to one column at ≤968px with the
  crest reordered above the copy.
- **"Photos" → "Photo Gallery"** in the nav, footer, home portal card, page
  title, and the CMS collection description. **The `/photos/` URL is
  unchanged** — only labels moved, so no links break. The longer label meant
  the nav hamburger breakpoint had to go from 1150px → 1230px.
- **Exec carousel → scroll-snap rail, no buttons.** Replaced the
  one-slide-at-a-time transform track and its prev/next buttons + dots with a
  native `overflow-x` rail (`scroll-snap-type: x mandatory`) showing ~3 execs
  with the next peeking in behind a mask-image edge fade. Trackpad and touch
  swipe are native to the scroll container and need no JS. Mouse users get
  pointer **drag-to-scroll**; there's also a slim peach **progress bar that is
  itself draggable**, plus ArrowLeft/Right keyboard paging on a focusable
  `role="region"`. `.exec-nav`/`.exec-dot`/`execGo`/`execMove` are all gone.
  - **Why the photos are circles:** 7 of the 8 exec headshots in
    `assets/uploads/` are ~960×960 circular crops with **pure black corners
    baked into the JPEG**. A rectangular frame exposes them. Masking the photo
    to a circle clips the black away. Don't "fix" this back to a rectangle
    without re-exporting the source images.
  - Cards deliberately have **no `min-height`** — the rail is a flex row, so
    `align-items: stretch` already levels them. They stay compact while bios
    are blank and grow together once execs fill them in.
- **Achievement detail pages rebuilt** as a two-column layout: results, the
  case, who competed, description, highlights, and article links on the left;
  a sticky aside on the right holding a fact card (year/date/location/host)
  above a vertically stacked photo gallery. New CMS fields on the achievements
  collection: `competitors`, `location`, `host`, `caseTitle`, `caseSummary`,
  `articles`. All optional, and **every section renders only when its field is
  present**, so sparse entries never show empty headings.
  - Seeded `competitors` on all 9 files from each file's existing
    `results.recipients`. Seeded `location`/`host` **only** on
    `centre-block-cup-2026.md`, the one file whose body prose actually states
    them. `caseTitle`/`caseSummary`/`articles` are **intentionally left blank
    everywhere** — we had no real data and inventing case names on a law
    society's site isn't acceptable. The execs fill these in via `/admin/`.
  - Fixed the same apostrophe bug already fixed in `photos.njk`: gallery
    captions now pass through `data-*` attributes instead of being
    interpolated into inline `onclick="openLightbox('…')"`.
- **Accessibility:** added a `--peach-ink: #a85f2a` token (4.84:1 on white) for
  small peach text on light backgrounds, and applied it to the exec role and
  `.win-card .year`. Both were previously `--peach` on white at **2.0:1**,
  well under the 4.5:1 floor. `--peach` itself is unchanged — it's correct on
  navy.
- Added a `padding-right` guard on the nav brand: at ≤360px it sat flush
  against the hamburger at exactly 0px and would have collided outright if the
  webfont failed and a wider fallback rendered.

**Verified:** `npx @11ty/eleventy` clean; `admin/config.yml` parses via
`js-yaml` with all new fields present; no console errors on `/`, `/about/`, or
the achievement pages; drag, progress-scrub, and keyboard paging all exercised
in the browser; no horizontal overflow at 1280/768/375/360.

**Open question for the user:** they asked to see the achievement detail page
before deciding whether it should instead be a **pop-out modal** over the
achievements list. The page is built; converting to (or adding) a modal is a
small follow-up that reuses the exact same front-matter fields.

**Files touched this session:** `src/styles.css`, `src/pages/index.njk`,
`src/pages/about.njk`, `src/pages/photos.njk`, `src/_includes/base.njk`,
`src/_includes/achievement.njk`, `admin/config.yml`, all 9
`src/achievements/*.md`, and this file.

## 0c. Previous session (Aug 2026) — design revamp (committed in 0, see above)

A full pass through the user's change list from their design brief. Implemented
and verified locally (`npm run build` clean, pages checked in the Browser pane
at desktop + mobile), and committed together with 0a and 0b in commit `bcf7966`
(see section 0).

What changed:

- **Nav brand**: "GHPLS" → full "Guelph-Humber Pre-Law Society". Nav collapses
  to the hamburger at ≤1150px (new breakpoint) so the longer name never
  collides with the menu items at intermediate widths.
- **Home hero rebuilt**: replaced the old side-by-side `.home-intro` block with
  a centred hero (`.home-hero` in `styles.css`, markup in `src/pages/index.njk`)
  — big crest, tag, serif title, divider, tagline, two CTAs — above the
  existing portal-card grid. Chose this over a full-bleed-photo and a
  split-layout option after showing the user a live side-by-side comparison.
- **Page header photos**: new `.page-header--photo` pattern (inline
  `background-image` + navy gradient overlay for legibility) applied to About
  (moot/counsel-table photo), Achievements, GH Cup (the actual GH Cup banner
  photo), Events, Photos, Materials, and Contact. Each header picks a real
  photo from `assets/uploads/`.
- **Exec team → carousel**: `src/pages/about.njk` + new `.exec-carousel` CSS
  replace the old grid. One exec per slide (large photo + name + role + bio),
  prev/next buttons, dots, all vanilla JS (no library). Added a `bio` field to
  `admin/config.yml` team collection — **left blank on purpose**; each exec
  writes their own (mentioned: time in role, time mooting, passion for law).
- **FAQ expanded**: `src/_data/about.json` now has 12 Guelph-Humber-specific
  Q&As (was 4 generic ones). Bumped `.faq-answer` max-height 300px → 500px so
  the longer answers don't clip.
- **Achievement detail pages**: each achievement is now its own page at
  `/achievements/<slug>/`. New `src/achievements/achievements.json`
  (directory data, sets `layout`/`permalink`) + new
  `src/_includes/achievement.njk` layout (results, description, optional
  highlights list, photo gallery + lightbox). Achievement cards on the index
  are now `<a>` links with a "View details →" affordance. Seeded a short
  factual description on all 9 existing achievement files. CMS gained
  `highlights` (list), `extraPhotos` (list), and `body` (markdown) fields on
  the achievements collection for the team to expand later.
- **GH Cup competition gallery**: new `gallery` array in `src/_data/ghcup.json`
  + matching CMS list field, rendered as a photo grid + lightbox on
  `ghcup.njk`. Only one genuine GH Cup photo was on file (the banner shot,
  `img_5810.jpeg`) — seeded that; team should add more via the CMS.
  Also reordered that page's section backgrounds (alternating white/cream) now
  that a new section was inserted.
- **Photo gallery descriptions**: added a `description` field to the photos
  CMS collection, shown in the lightbox under the title (passed via `data-*`
  attributes so apostrophes/quotes in captions don't break the inline
  `onclick`). Seeded descriptions on both existing photo entries.
- **Event RSVP**: each upcoming event now has a toggleable RSVP form (name,
  email, # attending) — same Netlify-Forms pattern as the contact form
  (honeypot, hidden `event` field so submissions can be told apart). New CMS
  boolean `rsvp` (default true) lets the team hide it per event. This was the
  user's explicit choice over an external form link or a mailto RSVP, so
  responses land in the same place as everything else.
- **Small copy changes**: Photos nav subheading → "View our society's
  gallery"; Achievements page title → "Competitive Achievements"; Photos page
  title → "Guelph-Humber Pre-Law Society Gallery"; contact form dropdown
  placeholder → "How can we help?".
- **Explicitly deferred, per user**: the moot-board description/timeline for
  the Materials page — skip until the moot board is actually running, don't
  build it ahead of time.

**Files touched this session** (now committed in `bcf7966`, see section 0):
`admin/config.yml`, `src/_data/about.json`,
`src/_data/ghcup.json`, `src/_includes/base.njk`, all 9 files in
`src/achievements/*.md`, `src/pages/{about,achievements,contact,events,ghcup,
index,materials,photos}.njk`, `src/photos/{ireland,ireland-trip}.md`,
`src/styles.css`, plus two new files: `src/_includes/achievement.njk` and
`src/achievements/achievements.json`. Also added `.claude/launch.json`
(untracked, for the Browser-pane dev-server preview — fine to commit or
`.gitignore`, doesn't affect the build).

## 1. The goal

Build and maintain a website for the **University of Guelph-Humber Pre-Law
Society (GHPLS)**, featuring the society's flagship moot competition, **The GH
Cup**. Hard requirements that shaped every decision:

- **Separate page per section** (not a one-page scroll).
- **Non-technical execs must be able to edit everything** — mission text,
  achievements, events, photos, team, GH Cup winners — through a forms-based
  admin panel, with **no code knowledge**.
- **Survives handoff**: when the current exec graduates, the next person takes
  over via a GitHub login (repo collaborator), no developer required.
- **Free hosting**, high traffic tolerance.
- Branding: navy `#1a2744` + peach `#e8a87c` + cream, Playfair Display serif +
  Inter, Lady Justice / scales motif. Logo at `assets/logo.jpg`.

## 2. Current state — LIVE and working

**Correction (Aug 8 2026):** the notes below in this section had drifted —
they still described the Netlify-Identity-based setup from an earlier
migration step. Verified against the actual repo config this session
(`wrangler.toml`, `worker.js`, `admin/config.yml`) and corrected:

- **Stack:** Eleventy (11ty) static site generator + Decap CMS (`/admin/`) +
  **GitHub OAuth login via a Cloudflare Worker** — NOT Netlify Identity, and
  NOT Cloudflare Pages Functions. `worker.js` (see `wrangler.toml`, which
  binds `_site/` as static assets) serves the built site directly and also
  imports `functions/api/auth.js` / `functions/api/callback.js` to handle the
  `/api/auth` and `/api/callback` OAuth routes Decap needs. `worker.js` also
  sets CSP/security headers inline in code — **not** via a `_headers` file
  (a `_headers` file does nothing on Workers; a prior session's commit
  message literally notes this: "Move CSP headers into worker.js — `_headers`
  doesn't work with Workers").
- **Hosted:** Cloudflare, at `https://ghpls.fdeleo115.workers.dev` (matches
  `admin/config.yml`'s `backend.base_url`). The repo migrated Netlify →
  Cloudflare Pages → (this) Cloudflare Worker with static assets, across three
  separate commits — Pages was an intermediate step, not the final state.
  `netlify.toml` is legacy/unused, kept only for reference.
- **Repo:** `https://github.com/fdeleo115/ghpls-website` (branch `main`). CMS
  edits commit straight to `main`. **Deploy is now automatic** via
  `.github/workflows/deploy.yml` (added sixth pass, Aug 8 2026) — every push
  to `main` runs `npx wrangler deploy` in GitHub Actions, ~30–40s after push.
  Before that workflow existed, deploy was manual (`npx wrangler deploy` from
  a checkout) and CMS saves could sit un-deployed indefinitely — that gap was
  the root cause of a real user-facing bug, see the sixth pass writeup.
- **CMS login:** editors sign in with their **GitHub account** and must be a
  **GitHub repo collaborator** — there is no separate invite system (no
  Netlify Identity). The GitHub OAuth App's client id/secret must be set as
  Worker secrets/vars in the Cloudflare dashboard (or via `wrangler secret
  put`), not as "Pages env vars".
- **Admin works:** execs have uploaded real photos/content through `/admin/`
  throughout — most recently, an exec filled in all 7 new Page Header Photos
  fields with real photos and focal points the same day they shipped (see
  section 0). **Note:** the local repo and the live repo can drift because
  execs edit via CMS — always `git pull --rebase` before pushing.

### Pages (all separate, all in nav)
Home · About (mission + team + FAQ) · Achievements · GH Cup (incl. Previous
Winners) · Events (upcoming + past) · Photos (gallery + lightbox) · Materials ·
Contact · Privacy · Terms.

### CMS collections (`admin/config.yml`)
Achievements · Upcoming Events · Past Events · GH Cup Previous Winners · Photo
Gallery · Executive Team · Page Content (Site Settings, About Page, GH Cup
Page, **Page Header Photos**, **Materials Page** — the last two added Aug 8
2026, see section 0). Every image field has a **drag-to-position focal point**
(rebuilt into an accurate live crop tool this session, see section 0) and most
have **size**/**fit**/**zoom** controls, per the user's ask to be able to
resize/reposition every photo and see it accurately before saving.

### Security & legal
- CSP + security headers applied for `/*`, with a **separate looser CSP
  scoped to `/admin/*`** so Decap CMS isn't broken. **Now enforced in
  `worker.js`** (see section 2's correction above) — `netlify.toml`'s copy of
  this is legacy/unused.
- Honeypot + length/type validation on the contact form.
- `.gitignore` (stopped tracking `node_modules/` + `_site/`).
- `robots.txt`, Privacy Policy (PIPEDA-aware), Terms of Use, footer disclaimer.
- Full writeup in `SECURITY.md` — **note: that document still describes the
  old Netlify/Netlify-Identity setup** (same drift as section 2 had); it
  wasn't updated this session since it wasn't in scope, but it should be
  before anyone relies on it for the current architecture.

## 3. Files actively being edited

None — working tree is clean and up to date with `origin/main` as of this
session's end (`git status` clean, `git log HEAD..origin/main` empty after a
final pull). Everything through the sixth pass above is committed and pushed,
and the live site has been confirmed to match.

## 4. What was tried that failed (so you don't repeat it)

1. **First build was a single-page scroll site** (one big `index.html`). Scrapped
   after the user asked for separate tabs + CMS — a static one-pager can't give
   non-technical editing. Rebuilt on Eleventy + Decap.
2. **`npx serve` on port 3000 for local preview** → port already in use. Fixed
   with `autoPort: true` in `.claude/launch.json`, later switched to
   `@11ty/eleventy --serve`.
3. **Admin panel was a blank page after login.** Two causes, fixed in order:
   (a) the Netlify Identity widget wasn't loaded on the **main site**, so the
   password-recovery token redirect had nothing to handle it — added the widget
   `<script>` + a login→`/admin/` redirect to `base.njk`;
   (b) `decap-cms@^3` from unpkg rendered blank — **switched to
   `netlify-cms@2.10.192`** in `admin/index.html`, which fixed it.
4. **Password reset link landed on a blank page.** The recovery token comes back
   as `/#recovery_token=…` on the root; the fix was loading the Identity widget
   site-wide (see 3a). Logging in then works; user navigates to `/admin/`
   manually.
5. **`git push` rejected (non-fast-forward)** several times — because execs edit
   via CMS and push commits we don't have locally. **Always
   `git pull --rebase origin main` before pushing.**
6. **CSP risk on `/admin/`:** a strict global CSP would break Decap. Did NOT
   apply strict CSP to admin; gave it a documented Decap-compatible CSP instead
   (now enforced in `worker.js` — see section 2).
7. **(Aug 8 2026) Decap CMS gives custom widgets no data-path prop.** If you
   ever need a custom widget to read a *sibling* field's value and that field
   might be nested inside an `object` or `list` widget, `entry.getIn(["data",
   "fieldName"])` silently returns `undefined` for anything nested — verified
   empirically, decap-cms 3.1.1's widget props have no `path`, an empty
   `parentIds`, and a `forID` never applied to the DOM. The working technique
   (container fields emit a DOM id `<fieldName>-field-<n>`; walk up from the
   widget's own root node to reconstruct the path) is implemented and
   commented at length in `admin/cms-extras.js` — read that before
   reinventing it.
8. **(Aug 8 2026) Testing the CMS locally without GitHub auth:** set
   `window.CMS_MANUAL_INIT = true` in a `<script>` *before* the decap-cms
   `<script>` tag, then `CMS.init({config: {backend: {name: "test-repo"}, ...}})`
   with a plain JS config object. Two gotchas: (a) `window.repoFiles` — the
   old `netlify-cms-backend-test` way of pre-seeding fake files — does
   **not** work in decap-cms 3.1.1, and clearing `localStorage`/
   `sessionStorage` before reload didn't make it work either; the reliable way
   to get real data into a test entry is a **folder collection's field-level
   `default:`** (confirmed working, including `default:` on a `list` field
   populating multiple items with real image paths) — file-collection
   (singleton) entries did *not* reliably apply nested `default:` values in
   testing. (b) Decap auto-boots against the real `/admin/config.yml` the
   instant its script loads unless `CMS_MANUAL_INIT` is set first — without
   it, a later `CMS.init` throws `removeChild` errors fighting the auto-boot.

## 5. Next step I'd take

1. **Spot-check the live CMS** after this session's changes deploy: confirm
   `/admin/` still loads, and try the new Page Header Photos / Materials Page
   fields plus the rebuilt focal-point crop tool on a nested field (e.g. GH
   Cup → Competition Gallery) — the exec who already used Page Header Photos
   this session is a good sign it's working, but hasn't been checked against
   the *new* crop-tool UI specifically (they may have used the old widget,
   depending on deploy timing).
2. **Fix `SECURITY.md`** — it still describes the old Netlify/Netlify-Identity
   architecture (see section 2's correction). Low urgency but will actively
   mislead anyone who reads it as current.
3. **Hand to the execs (their to-do, not code work):**
   - Each executive writes their own bio in the CMS (Team collection).
   - Add more GH Cup photos to the Competition Gallery.
   - Optionally flesh out achievement detail pages with highlights/extra
     photos beyond the seeded one-paragraph descriptions.
   - When the moot board actually launches, come back for the
     description/timeline section that was deliberately left out.
4. **Open question, carried over:** make the **Privacy/Terms pages
   CMS-editable** (currently hardcoded in `src/pages/privacy.njk` /
   `terms.njk`). Would move their text into a `_data` file + add a CMS "Legal
   Pages" file collection, mirroring how About/GH Cup already work.
5. **Lower priority, carried over:** upload the actual material PDFs (the
   Materials page cards are CMS-editable now, per section 0, but still have no
   real files attached — each shows "Coming Soon"); add sponsor logos; fill
   any remaining GH Cup winner names still marked "TBD".
6. **Possible follow-up, not started:** a desktop/mobile toggle on the CMS's
   photo crop-tool result panels (deliberately skipped this session — see
   section 0).

## Quick reference

- **Local dev:** `cd ~/Claude/GHPLS/site && npx @11ty/eleventy --serve`
- **Build:** `npx @11ty/eleventy` → outputs to `_site/`
- **Admin:** `https://ghpls.fdeleo115.workers.dev/admin/` (GitHub login, must
  be a repo collaborator — see section 2's correction; the old
  `guelphhumberprelawsociety.netlify.app` URL is stale, do not use it).
- **Add an exec to CMS:** add them as a collaborator on the GitHub repo
  (`https://github.com/fdeleo115/ghpls-website`) — no separate CMS invite step.
- **Handoff to next exec:** add them as a GitHub collaborator; that's the only
  access they need to use `/admin/`.
- **Test CMS changes locally without GitHub auth:** see failure-log item 8
  above.
