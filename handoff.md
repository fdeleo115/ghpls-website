# Handoff — GHPLS Website

_Written: June 2026 · Updated: August 2026 · For whoever (human or AI) picks this up next._

## 0a. Aug 8 2026, third pass — exec profile pages, NOT YET COMMITTED

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
    **Known pre-existing quirk, not fixed:** the 8 current team `.md`
    filenames don't match their contents (e.g. `president.md` contains
    Francesco Deleo, VP of Moot Training — not the President; `mooting-director.md`
    contains Kate Hilton, the President) — an artifact of the old slug
    pattern from before this fix. Their `/team/<slug>/` URLs are correspondingly
    misleading (e.g. `/team/president/` shows Francesco Deleo). The pages
    themselves render the *correct* person and role from front matter — only
    the URL slug is wrong. Renaming the files would fix this but wasn't part
    of this request and risks breaking links if anyone's already shared one;
    flagging it here rather than touching it.
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

## 0b. Aug 8 2026, second pass — hero/carousel/achievement pass, NOT YET COMMITTED

A follow-up pass on top of section 0c below, from a second round of user
feedback. Also uncommitted; all three sessions' work goes out together.

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

## 0c. Previous session (Aug 2026) — design revamp, NOT YET COMMITTED

A full pass through the user's change list from their design brief. All of it is
implemented and verified locally (`npm run build` is clean, pages checked in the
Browser pane at desktop + mobile), but **nothing from this session is committed
or pushed yet** — see "Next step" below.

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

**Files touched this session** (all currently unstaged — `git status` shows
this exact list): `admin/config.yml`, `src/_data/about.json`,
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
  over via GitHub + Netlify logins, no developer required.
- **Free hosting**, high traffic tolerance.
- Branding: navy `#1a2744` + peach `#e8a87c` + cream, Playfair Display serif +
  Inter, Lady Justice / scales motif. Logo at `assets/logo.jpg`.

## 2. Current state — LIVE and working

- **Stack:** Eleventy (11ty) static site generator + Decap CMS (`/admin/`) +
  **GitHub login via Cloudflare Pages Functions** (`functions/api/`).
- **Hosted:** **Cloudflare Pages** (migrated off Netlify June 2026 after the
  Netlify free credits ran out). Old Netlify URL is retired.
- **Repo:** `https://github.com/fdeleo115/ghpls-website` (branch `main`).
  Every push auto-deploys via Cloudflare. CMS edits commit straight to `main`.
- **CMS login:** editors sign in with their **GitHub account** (must be a
  repo collaborator). Requires a GitHub OAuth App whose client id/secret are
  set as Cloudflare Pages env vars `GITHUB_OAUTH_CLIENT_ID` /
  `GITHUB_OAUTH_CLIENT_SECRET`. `admin/config.yml` `backend.base_url` must
  match the live Pages domain.
- **NOTE:** `netlify.toml` is now unused (kept only for reference). Security
  headers live in `_headers`; build settings live in the Cloudflare dashboard.
- **Admin works:** Francesco is invited via Netlify Identity (invite-only).
  Execs have already uploaded real photos/content through `/admin/` (e.g. Kate
  Hilton listed as President, Francesco as VP of Moot Training, an Ireland trip
  photo, a past GH Cup photo). **Note:** the local repo and the live repo can
  drift because execs edit via CMS — always `git pull --rebase` before pushing.

### Pages (all separate, all in nav)
Home · About (mission + team + FAQ) · Achievements · GH Cup (incl. Previous
Winners) · Events (upcoming + past) · Photos (gallery + lightbox) · Materials ·
Contact · Privacy · Terms.

### CMS collections (`admin/config.yml`)
Achievements · Upcoming Events · Past Events · GH Cup Previous Winners · Photo
Gallery · Executive Team · Page Content (Site Settings, About, GH Cup). Every
image field has **photo position** (center/top/bottom/left/right) and most have
**size** controls, per the user's request to resize/reposition photos.

### Security & legal (done this session)
- `netlify.toml`: CSP + security headers for `/*`, with a **separate looser CSP
  scoped to `/admin/*`** so Decap CMS isn't broken (Netlify merges header rules,
  so admin CSP had to be explicitly re-declared, not omitted).
- Honeypot + length/type validation on the contact form.
- `.gitignore` (stopped tracking `node_modules/` + `_site/`).
- `robots.txt`, Privacy Policy (PIPEDA-aware), Terms of Use, footer disclaimer.
- Full writeup in `SECURITY.md`.

## 3. Files actively being edited

The `email: ghpls@uoguelph.ca` addition (site.json + contact mailto link)
mentioned below in the June notes is already committed and pushed — `git log`
confirms it's on `origin/main`. The active uncommitted work now is the combined
file list from sections 0a, 0b, and 0c above.

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
   apply strict CSP to admin; gave it a documented Decap-compatible CSP instead.
   **Not yet verified live** — see next step.

## 5. Next step I'd take

1. **Commit and push the Aug 2026 design revamp (sections 0a + 0b + 0c):**
   ```
   cd ~/Claude/GHPLS/site
   git pull --rebase origin main
   git add -A
   git commit -m "Home hero redesign, exec carousel, achievement detail pages, GH Cup gallery, event RSVP, expanded FAQs"
   git push
   ```
   Do the `git pull --rebase` first — execs may have pushed CMS edits since
   this session started (the local checkout was `fb6e24f`, up to date with
   `origin/main` at session start, but confirm again before pushing).
2. **After it deploys, spot-check the CMS still loads at `/admin/`** and that
   the new fields show up correctly: Team → Biography, Achievements →
   Highlights / More Photos / Description, Events → Allow RSVPs, GH Cup Page →
   Competition Gallery, Photo Gallery → Description.
3. **Hand to the execs (their to-do, not code work):**
   - Each executive writes their own bio in the CMS (Team collection).
   - Add more GH Cup photos to the new Competition Gallery — only one real
     photo was on file.
   - Optionally flesh out achievement detail pages with highlights/extra
     photos beyond the seeded one-paragraph descriptions.
   - When the moot board actually launches, come back for the
     description/timeline section that was deliberately left out this round.
4. **Open question raised but not answered (carried over from June):** make
   the **Privacy/Terms pages CMS-editable** (currently hardcoded in
   `src/pages/privacy.njk` / `terms.njk`). Would move their text into a
   `_data` file + add a CMS "Legal Pages" file collection, mirroring how
   About/GH Cup already work.
5. **Lower priority / carried over from June:** upload material PDFs
   (Materials page download buttons are still `href="#"` placeholders), add
   sponsor logos, fill any remaining GH Cup winner names still marked "TBD".

## Quick reference

- **Local dev:** `cd ~/Claude/GHPLS/site && npx @11ty/eleventy --serve`
- **Build:** `npx @11ty/eleventy` → outputs to `_site/`
- **Admin:** `https://guelphhumberprelawsociety.netlify.app/admin/`
- **Add an exec to CMS:** Netlify dashboard → Identity → Invite users.
- **Handoff to next exec:** add them as a GitHub collaborator + transfer/share
  Netlify access; they invite future execs via Netlify Identity.
