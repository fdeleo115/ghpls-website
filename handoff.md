# Handoff — GHPLS Website

_Written: June 2026 · Updated: September 16 2026 · For whoever (human or AI) picks this up next._

> **Section order:** newest first. The "sixteenth pass" below is the most
> recent work; every section after it is older. Their internal
> cross-references ("see section 0") point within their own pass, not at
> this one.

## Nineteenth pass, Sept 22 2026 — the site moved to https://ghpls.ca

**The site's address is now `https://ghpls.ca`.** The old
`ghpls.fdeleo115.workers.dev` still works, but only as a 301 redirect, and so
does `www.ghpls.ca`. Anything in this document that says `workers.dev` for a
live URL is historical.

### How the domain is set up — read before touching any of it
- **Registered with Cloudflare Registrar** in the `Fdeleo115@gmail.com`
  Cloudflare account (the same account the Worker runs in — a Worker custom
  domain must be in the same account as its zone). Paid for by the program
  lead; registrant organisation is "University of Guelph Humber". Auto-renew
  is ON. **Expires Sep 21 2027** — the card on file must stay valid.
- **Custom domains are attached in the dashboard, NOT in `wrangler.toml`:**
  Workers & Pages → ghpls → Settings → Domains & Routes → `ghpls.ca` and
  `www.ghpls.ca`. A `wrangler deploy` with no `routes` in config leaves them
  alone. They were deliberately kept out of `wrangler.toml` because declaring
  them makes every deploy need zone permissions the CI API token may not have
  — if it doesn't, every CMS publish would silently stop going live.
- **Handover risk:** the account is personal. Add `ghpls@uoguelph.ca` as a
  Super Administrator (Manage Account → Members) before the owner graduates.

### What changed in code
- `src/_data/site.json` `url` → `https://ghpls.ca` (sitemap, robots.txt,
  canonical and OG tags all follow from this one field).
- `admin/config.yml` `backend.base_url` → `https://ghpls.ca`.
- `worker.js`: `CANONICAL_ORIGIN` + `LEGACY_HOSTS`. Only those exact hosts are
  redirected, so localhost, `wrangler dev` and per-version preview URLs still
  serve normally. An old host AND an old path (the `REDIRECTS` map) are fixed
  in one hop, e.g. `workers.dev/team/president/` → `ghpls.ca/team/francesco-deleo/`.
  Query strings are kept.
- **The GitHub OAuth App's callback URL must be `https://ghpls.ca/api/callback`.**
  GitHub accepts exactly one callback host, which is the real reason the old
  address has to redirect rather than serve a second copy: `/admin/` on any
  other host would start a login GitHub refuses to finish. `auth.js` and
  `callback.js` derive their origin from the request, so they needed no change.

### Verified
Unit-tested the Worker's fetch handler against 9 hosts/paths (old host, www,
old host + old path, query strings, localhost, preview URL). Built output:
canonical, `og:url`, sitemap and robots.txt all say `ghpls.ca`, and nothing in
`_site/` mentions `workers.dev`.

### Still to do
- Tell Student Life the new link (the draft reply in `../reply-to-student-life.md`
  still says the old address — it will redirect, but give them the real one).
- Update the Instagram and LinkedIn bio links.

## Eighteenth pass, Sept 18 2026 — the exec carousel needed arrows for mouse users

Reported: the rail works well with a trackpad but not with a mouse. Correct —
a trackpad and a touchscreen can both scroll a horizontal overflow container
natively; a **mouse wheel cannot**. Drag-to-scroll existed but is not
discoverable, so a mouse user effectively had no way across.

- Two overlaid arrow buttons (`#execPrev` / `#execNext` in `about.njk`), each
  scrolling by one card + gap. Hidden via the `hidden` attribute when the rail
  has nothing to scroll (so they leave the accessibility tree too), and each
  disabled at its end of the rail. `updateNav()` runs off the same scroll
  handler as the progress fill, so drag, swipe, keyboard and arrows all keep
  the states honest.
- Hidden under `@media (hover: none) and (pointer: coarse)` — on a phone the
  swipe is natural and the buttons would just cover a card.
- **Deliberately NOT done: hijacking the vertical wheel** to scroll the rail
  sideways. It reads as a clever fix and behaves badly — a visitor scrolling
  down the page with the cursor over the carousel gets trapped until the rail
  hits its end. Shift+wheel already does this natively for anyone who wants it.
- The hint text now reads "Use the arrows, drag, or swipe".
- Verified at 1024px: arrows appear, left disabled at rest, right disabled at
  the end, one card per click, no console errors.

## Seventeenth pass, Sept 16 2026 — final videos live inside their year's winner card

The owner asked for the GH Cup and Mini Moot final videos to sit under the
competition they belong to (e.g. inside "The GH Cup 2026"), not in a separate
"Final Videos" section. That section is gone from both pages.

- **The CMS did not change shape.** "GH Cup Final Videos" and "Mini Moot Final
  Videos" are still their own collections (an exec had just added the 2026 GH
  Cup final through one), and their descriptions now say the Year must match
  the winners entry. The join happens at build time in the `withFinalVideos`
  filter in `.eleventy.js`, keyed on `year`.
- **A video with no winners entry for its year does not disappear.** It gets a
  card of its own ("Mini Moot 2024" + the video). Tested with a throwaway 2024
  entry, then removed. So a Year typo shows up as a stray extra card, not as a
  missing video.
- Card hover-lift is switched off for cards that hold a video (`:has()`), so the
  player doesn't move under the pointer. The old `.video-grid` / `.video-card`
  CSS was deleted; `.video-embed` is kept and reused.
- Verified locally at 1024px and 375px (no horizontal overflow, player 275px
  wide on a phone), no console errors.

## Sixteenth pass, Sept 16 2026 — gallery photos can be framed from the CMS; exec card links line up

Two things: the "View Profile" links on the About page carousel now sit on one
line regardless of how long a role is, and **every photo in a profile or
competition gallery can now be framed from the CMS** — focal point, crop mode,
and zoom — which it could not be before.

### 1. Levelling the exec cards: why the ROLE grows, and nothing else

Two rounds of this, and the second one matters.

**First attempt — `margin-top: auto` on `.exec-card-link`.** It bottom-pinned
the link, which lined the links up. But it only fixed the links: the bios were
still ragged, because a one-line role ("President") starts its bio a line higher
than a two-line one ("Vice President of Communications"). Measured: bios at
305px in two cards and 326px in the other six.

**The obvious second attempt — `min-height: 2 lines` on `.role` — is wrong, and
this was measured rather than guessed.** At a 320px viewport the card is 237px
wide and the two longest titles ("Vice President of Marketing and Social Media",
"Vice President of General Member Experience") genuinely wrap to **three** lines.
Any hardcoded line count is a number that holds at the widths you happened to
check and quietly fails at the ones you did not.

**What is there now: `.exec-card .role { flex-grow: 1 }`.** The role box absorbs
whatever vertical slack the card has. Everything below it — the bio, clamped to
exactly three lines, and the link — is pushed to the bottom of a card whose
height the rail has already equalised. Constant height below the role means a
constant starting point for the bio, **at any width, for a role of any number of
lines.** The slack appears as space between the role and the bio, which is a
reasonable place for it.

**The two mechanisms cannot coexist, which is the trap.** In flexbox an auto
margin swallows free space *before* flex-grow gets any. Leaving
`margin-top: auto` on the link while adding `flex-grow` to the role means the
link eats the slack, the role never grows, and the bios stay exactly as ragged
as before — with both rules in the file looking like they should work. The
`margin-top: auto` was removed for this reason; there is a comment on each of
the two rules pointing at the other.

Verified at both extremes. 1280px: bio tops all 326, link tops all 415, card
heights all 469. 320px, where roles reach three lines: bio tops all **345**,
link tops all **434**, no horizontal overflow. One distinct value each, which is
the whole point.

### 2. Gallery photos are framed from the CMS now

`.detail-photo` is a fixed 4:3 frame with `object-fit: cover`. Any photo that
isn't roughly landscape got centre-cropped with no way to say what mattered in
it — which became obvious the moment the exec profile galleries filled up with
portrait phone photos.

Three fields were added to **both** `extraPhotos` lists — the exec one under
Executive Team and the competition one under Achievements. They are the same
`.detail-photo` component on the page, so they behave the same way rather than
one of them mysteriously having controls the other lacks:

| field | what it does |
|---|---|
| `photoPosition` | focal point, the same drag-the-dot widget used everywhere else |
| `photoSize` | `cover` (crop to fill, the default) or `contain` (fit the whole photo in) |
| `photoZoom` | 1–3, zooming towards the focal point |

The focal-point widget's `fitField` / `zoomField` options are wired up so the
editor preview reflects the other two settings, the way the Achievements one
does. Without them the preview draws a cropped, unzoomed frame and quietly
disagrees with the page.

**The widget works inside a `list` already** — that was solved in the seventh
pass and is documented at the top of `admin/cms-extras.js`. Nothing new was
needed for the nesting; `image_field: "image"` resolves against the sibling
field in the same list item.

### 3. The zoom is a custom property, and that is not a style preference

A first attempt at this writes `transform: scale(1.5)` into the inline style,
matching what `achievements.njk` does for its card photos. **Here that is a
bug.** `.detail-photo:hover img` scales to 1.05, and an inline transform beats
any stylesheet rule — so the photos an editor bothered to zoom would be exactly
the ones that silently stopped responding to hover.

So the number arrives as `--photo-zoom` and the transform itself stays in CSS:

```css
.detail-photo img       { transform: scale(var(--photo-zoom, 1)); }
.detail-photo:hover img { transform: scale(calc(var(--photo-zoom, 1) * 1.05)); }
```

`--photo-origin` is set to the same focal point as `object-position`, so zooming
pushes the image away from the edges rather than the centre — otherwise a photo
framed on a face near the top drifts out of frame as soon as anyone zooms it.

**The reduced-motion block needed the same care.** `.detail-photo:hover img` was
in a shared `transform: none` rule, which would have thrown away the editor's
framing on hover, not just the flourish — the photo would jump to a different
crop. It now gets its own rule holding the base zoom.

Verified in a browser: base `matrix(1.6)`, hover `matrix(1.68)`, reduced-motion
`matrix(1.6)`, `contain` honoured, and a photo with nothing set renders
`object-fit: cover; object-position: center` — byte-for-byte the old behaviour,
so none of the 28 photos already on the site moved.

### 4. A testing trap worth knowing about

Checking `img.naturalWidth` right after setting a transform reads back the
*mid-transition* value, because `.detail-photo img` has `transition: transform
0.3s`. A control case with no variables at all (`scale(calc(1.6 * 1.05))`) also
reported 1.6, which is what exposed it. Wait longer than the transition before
reading, or you will conclude a perfectly good `calc()` is broken.

Related: in the automated browser pane, `loading="lazy"` images below the fold
are **never requested at all**, even after scrolling — the network log shows no
request. `broken: 5` there means "not in view", not "404". Flip `img.loading =
'eager'` before measuring. Both of these cost real time this pass.

## Fifteenth pass, Sept 15 2026 — exec profiles filled from Instagram, and the privacy policy that had to change with them

Every exec's profile page now carries a biography and a short Q&A, taken from
the "Meet our ..." introduction posts on the Society's own Instagram, plus the
photos from those posts. Commits `e54ade5` (text) and `52df19c` (photos and
policy), both deployed and verified against the live URL.

**Read §3 before adding any photo to this site again.** It is the only part of
this pass with a consequence that outlives the pass.

### 1. Where the content came from, and how to get it again

Each exec has one post, published Aug 28 2026, and each post is a carousel with
the same shape:

| slide | content | goes to |
|---|---|---|
| 1 | designed headshot card | nothing — the site already had headshots |
| 2 | "GET TO KNOW <name>" card | `qanda` |
| 3+ | personal photos | `extraPhotos` |
| caption | the exec's own introduction | `bio` |

**The captions and the carousels are readable without logging in**, which is
worth knowing because it is not obvious: the profile grid hits a signup wall,
but an individual `/ghpls/p/<shortcode>/` page renders the full caption in the
DOM, and the carousel's Next button works. The route that worked was: open the
profile, dismiss the signup modal, scroll to force the grid to lazy-load (it
only ships six posts until you do), then read `a[href*="/p/"]` for the
shortcodes.

Two traps, both of which cost time:

- **The carousel virtualises.** Clicking Next four times and *then* reading
  `ul li img` gives you the last two slides and silently drops the rest. Extract
  after every click, not at the end.
- **Slide 2 is an image, not text.** The Q&A answers are baked into the graphic,
  so they can only be read by screenshotting the slide. There is no DOM text to
  scrape.

The post shortcodes are in the git history of this pass; the images are already
in `assets/uploads/` as `<slug>-1.jpg` … `<slug>-5.jpg`.

### 2. What was deliberately NOT touched

The owner's instruction was specific and a future pass should not "tidy" it:

- **Francesco's and Tala's photos are untouched.** Francesco keeps his four
  existing ones; Tala has none and that is intentional, not an oversight.
- **Angelina's four Instagram photos were APPENDED**, not substituted, because
  she already had four curated competition photos. She shows eight.
- **No headshot, header photo, competition, team placement or individual
  achievement was modified for anyone.** The only field written was
  `extraPhotos`. `git show 52df19c` is 32 insertions and 1 deletion across 31
  files — deliberately that boring.

### 3. The privacy policy had to change, and this is the part to remember

Section 2 said, in the site's own words:

> We only publish photos taken at Society events or given to us for that purpose.

**Most of these photos are not that.** They are personal photos the execs picked
for their own introductions — a selfie, a trip, a night out, a family ballgame —
and several show friends, partners and family **who are not members of the
Society**. Those people agreed, at most, to appear in a club Instagram post.
They did not agree to a university-linked website.

Publishing them while that sentence stood would have made the privacy policy
false, on a page Student Life had just reviewed and is about to link to from the
University's own site. That is a worse outcome than any photo.

So the policy was rewritten rather than quietly contradicted:

- **Section 2** now describes both kinds of photo, says the personal ones appear
  only on that person's own profile and only at their choosing, and says the
  exec supplying one is asked to confirm anyone else in it is content to be
  published here.
- **Section 6** now states that the takedown promise reaches people who are
  **not** members — the friends and family in those photos — and that an exec
  can withdraw their personal photos at any time, including after they leave the
  team.

**The standing rule this leaves behind:** before adding a photo to this site,
check it against what section 2 currently claims. If the photo does not fit the
claim, one of the two has to change, and the honest move is to change whichever
you are actually willing to stand behind. Do not add the photo and leave the
sentence.

And the thing that makes this sharper here than on most sites: **every photo
also lands in a PUBLIC GitHub repository and stays in its history.** Section 6
promised history removal on request long before this pass; that promise now has
a great many more people it could apply to.

### 4. A template bug this surfaced

`member.njk` rendered the biography inside a single hard-coded `<p>`. That was
invisible while every bio was one sentence. These captions run to three, four
and five paragraphs, and in one `<p>` the blank lines collapse — the whole
introduction rendered as an unbroken wall of text.

It now goes through the `paragraphs` filter (escapes first, adds tags after, so
the field stays safe to edit in the CMS), which also gives bios the same
`[label](/path/)` link syntax the FAQ answers got in the fourteenth pass. Same
root cause as the invisible-links bug in that pass: **a template built when the
content was small, meeting content that got bigger.** When you add a new kind of
content to an existing field, look at how the template renders it before
assuming it just works.

### 4a. The same bug again, one screen over: the About page carousel

The biographies landed on the exec cards in the About page carousel too, at
full length — and `.exec-rail` is a flex row with the default
`align-items: stretch`. So **the single longest bio was setting the height of
all eight cards.** One exec writing five paragraphs gave every other card that
height, with a column of dead whitespace under the short ones.

The carousel bio is now a three-line teaser that trails off, with the existing
"View Profile" link below it as the way to read the rest — `.exec-card
.exec-bio`, clamped in CSS.

**Clamped in CSS, not cut in the template, and that is the point.** A
`truncate` filter would throw the rest of the sentence away for everyone,
including screen readers and search engines. `-webkit-line-clamp` is a purely
visual cut: the whole bio is still in the markup, still read aloud, still
indexed. It also re-clamps itself at any width, so the phone layout needed no
separate rule.

Two things not to "tidy" later: the three declarations (`display:-webkit-box`,
`-webkit-box-orient:vertical`, `-webkit-line-clamp`) only work together —
removing the prefixed pair silently disables the clamp — and the `min-height`
below them is deliberate, so a short bio still occupies three lines instead of
reintroducing the height variance the clamp just removed.

Worth noting what this does NOT fix: a role that wraps to two lines ("Vice
President of Moot Operations") still pushes its card's bio down a line, so the
"View Profile" links are not all at the same y. That variance lives in `.role`
and was there before this pass.

### 5. Verified against the live site, not the build

Per the twelfth pass's rule. After deploying: all eight profiles return a bio
block and four Q&A items; photo counts are Kate 5, Muhammad 4, Ashon 3, Ava 4,
Mia 4, Angelina 8, Francesco 4 (unchanged), Tala 0 (unchanged); **158 gallery
image URLs fetched from the live site, all 200**; the new privacy wording is
live and the old "only publish photos taken at Society events" sentence returns
zero occurrences.

## Fourteenth pass, Sept 15 2026 — Student Life's pre-publication review, all items actioned

**The site passed its approval review.** Student Life read the live site and
came back with a list of changes plus one sentence that matters more than the
list: once these are in, the site can be published and Student Life will link
to it from the GHPLS subpage on the main Guelph-Humber website. That is the
gate this whole project has been building toward. Everything below is that list,
worked through in full.

Read §1 before touching the GH Cup page, and §2 before touching the FAQ — both
contain a constraint that is not obvious from the code and that a future pass
would otherwise undo in good faith.

### 1. The Sponsors & Partners section is commented out, NOT deleted — and it must stay that way until someone gets approval

Student Life asked for the Sponsors & Partners section to come off the GH Cup
page. The reason is **approval, not design**, and this is the part worth
understanding before you touch it:

> A sponsorship package for a Guelph-Humber event has to be approved by Student
> Life **and** by the Guelph-Humber Marketing, Communications, and Public Affairs
> department before the Society solicits or announces sponsors.

The section carried an "Interested in sponsoring? Get in touch" invitation.
That is soliciting. So it is off the live site.

**It is preserved as a Nunjucks comment in `src/pages/ghcup.njk`, with the
restoration steps written above it**, because the section will come back once a
package is approved and rebuilding it from scratch is wasted work. The
`.sponsors-row` / `.sponsor-slot` rules are still in `styles.css` with a comment
saying why they look unused.

**A comment, deliberately — not an `{% if showSponsors %}` flag.** A flag is one
mis-click in the CMS away from publishing an unapproved solicitation on a page
the University links to, and nobody would notice until the wrong person saw it.
Uncommenting is a code change that goes through a commit; a toggle is not. If a
future pass is tempted to "tidy this up" into a CMS switch: don't. The awkwardness
is the safety feature.

### 2. FAQ answers can now contain real links — via a filter, NOT `| safe`

Student Life's feedback, twice over: *"I encourage you to hyperlink to The GH Cup
page instead of providing written instruction. This feedback goes for all
questions that are directed to other subpages"*, and separately, hyperlink the
Instagram and LinkedIn in the "how do I stay up to date" answer.

The problem: an FAQ answer is a CMS textarea, and marking a CMS field `| safe` is
exactly what the `paragraphs` filter was written to avoid (see the eleventh
pass). So links could not simply be pasted in as HTML.

**The fix — `inlineLinks`, a new filter in `.eleventy.js`.** It escapes the whole
string first, then turns exactly one pattern back into markup:

```
[The GH Cup page](/ghcup/)
```

Nothing else is markup. An editor who types `<b>` sees the characters `<b>` on
the page. Link targets are allow-listed to three shapes — a site-relative
`/path/`, an `https://` URL (which gets `target="_blank" rel="noopener"` and a
visually-hidden "opens in a new tab", matching the rest of the site), and
`mailto:`. **`javascript:`, protocol-relative `//host`, and plain `http://` all
render as the literal text the editor typed**, so a bad link is a visible typo
rather than a live hazard. Verified against each of those cases plus
`[<img onerror=alert(1)>](/ghcup/)` before shipping.

`paragraphs` was refactored onto the same two helpers, so GH Cup / Mini Moot
body text gained the same link syntax for free. Checked first that no existing
CMS text contained a `[x](y)` pattern that would suddenly become a link.

The CMS hint on the Answer field explains the syntax in plain language and names
the five internal paths, so an exec does not need to know what markdown is.

**One thing that nearly shipped broken, and is worth remembering:** the links
rendered as *completely invisible* text on first build. `styles.css` sets
`a { text-decoration: none; color: inherit }` globally, which has always been
fine because every other link on this site is a button, a card, or a nav item
that reads as clickable from its surroundings. An anchor dropped into body copy
inherits `--text-light` and no underline — identical to the prose around it.
`.faq-answer a` / `.content-block a` now style it (peach-ink, 600, underlined).
**Keep the underline**: WCAG 1.4.1 forbids colour as the only marker of a link
inside a block of text, and peach-ink against text-light is a slight difference
anyway. If you add prose links anywhere new, check them against this — the
global reset will bite again.

### 3. Achievements are grouped by SCHOOL year, with a filter that degrades gracefully

*"If possible, you may want to categorize by year because I could see this page
getting quite robust otherwise."* Already true — five seasons, nine competitions.

**School year, not calendar year, is the only grouping that holds together.** A
season runs Western Cup in October through HSFK Cup the following June;
splitting at December 31st would file one team's season under two headings. The
cutoff is **September 1st** (`SCHOOL_YEAR_START_MONTH` in `.eleventy.js`), which
also puts the Humber Cup in late July at the *end* of the season it was actually
competed in — where the people who were there expect to find it. Current result:
2025/2026 has 6, 2024/2025 has 3.

The `achievementYears` collection does the grouping because Nunjucks has no
`groupby` and the page needs the list twice (once for the buttons, once for the
sections). An entry with no readable date falls back to `year - 1`; an entry
with neither gets its own "Date not set" group at the end rather than being
silently filed under a wrong year or dropped.

**The filter is progressive enhancement and the order matters.** The page is
*built* as one section per year, each with its own heading — so with JavaScript
off, a visitor still gets the categorised page Student Life asked for. The chips
only hide and show groups that are already in the HTML. The toolbar itself is
`hidden` in the markup and unhidden by script, because a row of filter buttons
that do nothing is worse than no filter; the script also bails when there is
only one year, since a single-option filter is clutter.

Two details that would be easy to lose in a later edit:

- `.year-group[hidden] { display: none !important }` is load-bearing. `.year-group`
  carries its own `display`, and an author `display:` beats the browser's
  built-in rule for the `hidden` attribute. Without that line the buttons appear
  to do nothing at all.
- The eager-load hint moved from `loop.index == 1` to `loop.first and isFirstGroup`.
  Inside the new inner loop the old condition would eagerly load the top card of
  *every* year. Nunjucks has no `loop.parent` (that is Jinja2), so the outer
  loop's position is carried down in a `{% set %}`. Verified: exactly one
  `data-eager` in the built page.

### 4. The rest of the list

- **"Do not mention a specific program and instead state that all programs can
  join."** The answer used to list Justice Studies, Business, Media, Psychology,
  and FCSS. It now says every program can join and no degree is required, and
  names none. Note the neighbouring question ("Do I need to be in a law-related
  program to join?") covers adjacent ground — the two are angled differently on
  purpose, but if a future pass trims the FAQ, these are the pair to look at.
- **Typos in the Pre-Law / Moot Team question.** "diffrence" → "difference",
  "Pre Law" → "Pre-Law", the full stop at the end of a question → a question
  mark, "Guelph Humber" → "Guelph-Humber", and the doubled spaces removed.
- **"Recognized not recognised."** Fixed in the FAQ, and — since the point is
  consistency — in `terms.njk` and `privacy.njk`, which had the same spelling.
  Site-wide scan found no other `-ise` / `-isation` spellings.
- **Law School Tours.** Already gone: an exec deleted it through the CMS
  (`df4ea8a`) before this pass started. It came down in the `git pull --rebase`
  at the top of the session — which is the fifth time that rule in §4 of the
  original handoff has paid for itself. Student Life also asked, in passing,
  whether the Society is contacting law schools on Guelph-Humber's behalf; that
  is a question for the owner to answer directly, not a site change.
- **pre-law vs pre law.** One hyphenation throughout: **pre-law**. The only
  offender outside the FAQ was the Orientation Marketplace event description
  ("Guelph Humber Pre Law Society"), fixed in `src/events/orientation-marketplace.md`.
  A scan of the built HTML now finds zero unhyphenated "pre law" or
  "Guelph Humber" anywhere.

### 5. Left alone on purpose

The Contact page says people can get in touch about *"partnering with us"*, and
its `pageDescription` says the same. Student Life did not flag it, and it is a
general invitation rather than an event sponsorship package — but it is adjacent
enough to §1 that the owner should decide rather than have it quietly reworded.
**Flagged to the owner, not changed.**

### 6. Verified, not assumed

Following the twelfth pass's rule. Built clean, then checked in a real browser at
1280px and at 375px:

- Every FAQ link renders as an anchor; no literal `[x](y)` survives anywhere in
  the built page; the hostile inputs above all render inert.
- Achievements: chips switch groups, `aria-pressed` tracks the active chip, the
  `role="status"` line announces the change for screen readers, exactly one
  `data-eager`, no horizontal overflow at 375px.
- GH Cup page: zero occurrences of "sponsor" in the rendered HTML; sections now
  end at Previous Winners; no console errors.
- Events page: no Law School Tours.
- The only "sponsor" left in the whole built site is in `terms.njk`, in the
  disclaimer about what to do *if* the Society ever takes sponsorship money.
  That one is correct where it is.

**Not yet deployed at the time of writing** — committed locally, and the owner
is replying to Student Life to confirm the changes are done.

## Thirteenth pass, Sept 1 2026 — full pre-ship audit (security, legal, accessibility, performance), then everything in it fixed and deployed

Ran a from-scratch pre-launch audit of the whole site and the live Worker, then
fixed every finding that lives in this repository. 14 findings; 13 fixed and
deployed in commit `e7c1ed4`, one handed to the owner. **Nothing here was
believed until it was checked against the production URL** — see the verification
note at the end, which follows the twelfth pass's rule.

The headline result is boring in a good way: no critical findings. The security
work from the eleventh and twelfth passes is holding — CSP and every security
header present on all 12 public pages, no secrets anywhere in the full
168-commit history, `npm audit` clean, no source files reachable, the OAuth token fix genuinely closed,
zero third-party requests on a normal page load. What follows is the delta.

### 0. The one worth reading: a CMS collection whose folder had never existed was invisible to every sweep

**"GH Cup Final Videos" would have published a blank page at a live URL the
first time an exec used it.**

Everything was wired: the collection in `admin/config.yml`, the Eleventy
collection in `.eleventy.js`, the Final Videos section in `src/pages/ghcup.njk`.
The only missing piece was `src/ghcup-videos/` itself — the directory did not
exist, so neither did the `ghcup-videos.json` directory data file that sets
`permalink: false`, the way `src/minimoot-videos/minimoot-videos.json` does for
its twin.

Consequence: the moment an exec added the first video through `/admin/`, Decap
would write `src/ghcup-videos/ghcup-final-2025.md`, and the next build would
emit `/ghcup-videos/ghcup-final-2025/` as a **0-byte page with no layout and no
nav** — a real, crawlable URL serving an empty document. Reproduced with a
throwaway fixture entry to confirm it, then fixed and re-confirmed.

**Why this matters beyond the one file.** The fifth pass swept exactly this
defect class ("collection items with no layout assigned") and fixed it for four
collections. It missed this one, and the reason is worth internalising: that
sweep looked at the directories that existed. This collection's directory did
not exist, because nobody had ever created an entry in it. **Grep finds what
exists; the CMS config declares what is *permitted* to exist, and the gap
between those two lists is not empty space — it is a code path that will run for
the first time in production, in front of a user, with nobody having ever
watched it.**

If you add a collection to `admin/config.yml`, create its folder and its
`<name>.json` in the same commit. To audit the whole set at once, read the
`folder:` keys out of the config and diff them against the filesystem rather
than listing `src/`:

```
grep -E '^\s+folder:' admin/config.yml
```

Every folder collection must end up in one of two correct states: it generates
pages (a `layout` + `permalink` in its directory data file, like
`src/achievements` and `src/team`), or it does not (`{"permalink": false}`, like
every other one). A collection in neither state is this bug.

**Bonus that fell out of the fixture:** while a real video existed on the page,
`/ghcup/` was loaded in a browser and the `youtube-nocookie.com` iframe rendered
with **zero `securitypolicyviolation` events**. The `frame-src` directive the
eleventh pass §2 added had never once been exercised against real content,
because no video had ever been added. It works.

### 1. The contrast bug survived two sweeps; the rule now lives in the CSS

`--peach` (`#e8a87c`) is a **navy-ground token**. On white it measures 2.03:1,
against a 4.5:1 floor. The eleventh pass §6 found this and fixed five
instances. Six more survived, including the worst one: **every link in the body
of `/privacy/`, `/terms/` and `/accessibility/`** — on the very page that claims
in text that the colours were measured against the WCAG minimums.

All six now use `--peach-ink` (`#a85f2a`, 4.84:1). But the durable part of this
fix is the comment block above the token definition in `src/styles.css`, which
carries the rule *and* the command that enumerates it:

```
grep -nE '(^|[;{[:space:]])color: ?var\(--peach\)' src/styles.css
```

That leading character class is not decoration: a bare `color:` also matches
`outline-color:` and `border-color:`, which are not text and are held to 3:1
rather than 4.5:1. This pattern returns text colour only — **14 lines** as of
this pass, every one of them on navy (nav, both heroes, `.portal-icon`,
`.btn-outline:hover`, `.ghcup-hero`, `.schedule-date` which sets
`background: var(--navy)`, `.exec-card-avatar`, `.detail-back` which sits
inside `.page-header`, and the footer).

Classify **every** hit by the background it actually lands on. Anything new in
that list sitting on white or `--cream` is a regression.

**The general lesson, which is why this is section 1 and not a footnote:** when
a defect is one mistake repeated N times, it gets *reported* as N findings but
must be *fixed* as one sweep. "I fixed the ones I found" and "I checked every
place this could occur" produce an identical diff when the search was complete,
and silently different ones when it wasn't. Demand the enumeration, not the fix
list.

Also worth knowing: measuring contrast by reading the stylesheet does not work
on this site, because the effective background usually comes from an ancestor's
gradient or photo rather than the element's own `background-color`. A first
attempt at an automated sweep reported 24 failures on the home page, every one
of them a false positive — white text on a navy gradient, scored as white on
white. Resolve `background-image` before `background-color` when walking
ancestors, average gradient colour stops, and put text over raster photos in a
separate "cannot assess" bucket instead of guessing.

### 2. The old Netlify site was not a stale copy — it was a live, auto-deploying mirror (now deleted)

The eighth pass's to-do described `guelphhumberprelawsociety.netlify.app` as
"serving a stale copy". That was wrong in the direction that mattered. It was
serving `/minimoot/`, `/accessibility/`, the self-hosted font files and the
newest event's `.ics` — all of which postdate the Cloudflare move. **It was
still connected to this GitHub repo and rebuilding on every push.**

And because `netlify.toml` was deleted in commit `17eaa39`, that mirror served
the entire site with **no CSP, no X-Frame-Options, no Permissions-Policy and no
nosniff**. Every security header the eleventh and twelfth passes were spent
getting right was absent on a complete, current, publicly reachable copy of the
same site, reachable by anyone who had the old link. Its `/admin/` was live and
framable too.

The owner has since deleted the Netlify site, which closes this.

**The lesson to keep:** a migration removes a platform from the codebase long
before it removes the platform from the internet. Security controls are
per-deployment, not per-repository — so an abandoned deployment that still
builds from the same source inherits every content fix and none of the
platform-specific hardening, which makes it strictly *worse* than the site it
replaced. Nothing in this repo could have revealed it. It was found by probing a
hostname mentioned in passing in this very file.

If the site ever moves hosts again, the migration is not finished until the old
deployment returns 404.

### 3. New: a custom 404 page — and the `/404` vs `/404.html` trap inside `worker.js`

Unknown URLs used to return a 404 with a **completely empty body** — a blank
white screen for anyone who mistyped a URL or followed a dead link from an
Instagram bio. Workers Static Assets has no notion of an error page.

Added `src/pages/404.njk` (`permalink: /404.html`) and wiring in `worker.js`.
Three things there are load-bearing:

- **The status stays 404.** Serving the page with a 200 is a "soft 404" and gets
  the broken URL indexed as duplicate content.
- **It only fires when the client accepts `text/html`.** Without that check, a
  missing image or a stale `.ics` link would be handed 8KB of markup labelled as
  an image — worse than the empty body for anything that isn't a browser tab.
- **It asks for `/404` first and `/404.html` second.** The page is *built* as
  `/404.html`, but Static Assets' default `html_handling`
  ("auto-trailing-slash") canonicalises that to `/404` and answers the `.html`
  form with a **307**. Asking only for `/404.html` appeared to work, but only
  because something followed that redirect for us — which is not a behaviour to
  depend on. The second entry is the fallback if `html_handling` is ever set to
  `"none"`, where the reverse is true.

`404.njk` also carries `eleventyExcludeFromCollections: true`, without which the
error page joins the collections feeding `sitemap.njk` and the site advertises
its own 404 to Google. `robots.njk` disallows `/404` for the same reason, since
the page returns 200 when requested directly.

### 4. Subresource Integrity on the Decap bundle — and the trap if you bump the version

`admin/index.html` now loads `decap-cms@3.1.1` with an `integrity` hash and
`crossorigin="anonymous"`. Pinning the version stops a malicious *release*; only
the hash stops a compromised or hijacked CDN response — and that page is the one
that ends up holding a GitHub token with `public_repo` write scope on this repo,
which is also the deploy source for the live site.

**If you change the version you MUST regenerate the hash**, or the browser
refuses to run the script and `/admin/` renders as a blank page with nothing but
a console error to explain it. The command is in a comment right above the tag:

```
curl -sL https://unpkg.com/decap-cms@<version>/dist/decap-cms.js \
  | openssl dgst -sha384 -binary | openssl base64 -A
```

This was the single riskiest edit in the pass — a wrong hash locks the exec team
out of the CMS — so it was verified in a real browser both locally and against
production: `window.CMS` defined, config loads, "Login with GitHub" renders, no
config error.

### 5. Markdown no longer renders raw HTML

Eleventy defaults markdown-it to `html: true`, and the layouts render entry
bodies with `{{ content | safe }}`. Combined with `script-src 'unsafe-inline'`
in the site CSP, a `<script>` pasted into a CMS field would have executed on the
live site. Now `eleventyConfig.amendLibrary("md", md => md.set({ html: false }))`.

Verified before flipping that **no markdown body on this site used raw HTML**, so
nothing rendered differently. Worth knowing: there is exactly **one** `markdown`
widget in the entire CMS — "Description" on Achievements. Exec biographies use a
`text` widget, so they were never affected.

This was never privilege escalation — editors are collaborators who could edit
templates directly. It was a sharp edge pointed at people who write prose, where
a snippet pasted from a Google Doc becomes live markup. If a future page
genuinely needs embedded HTML, give it a template rather than turning this back
on.

### 6. `cssUrl` — finishing the sweep the eleventh pass §7 started

§7 added `cssPosition`/`cssFit`/`cssZoom` for CMS values interpolated into
`style="..."`, and left the **image path itself** raw in the three page-header
templates:

```
style="background-image:url('{{ photo }}'); background-position:{{ ... | cssPosition }}"
```

The escaping story is identical — Nunjucks turns `'` into `&#39;`, and the HTML
parser turns it back into `'` before the CSS parser sees the attribute — so a
photo path could close the `url()` early and append a declaration. The focal
point sitting *next to it on the same line* was filtered; the URL was not.

New `cssUrl` filter accepts only `^/assets/uploads/[A-Za-z0-9._~\-\/]+$`,
rejects `..` explicitly, and returns `""` otherwise so the caller's `{% if %}`
fails closed to the plain navy header. Applied in `macros.njk`, `member.njk` and
`achievement.njk`. Confirmed all 25 banner photos still render, and that the
responsive `--bg-sm/md/lg` transform still applies on top of it.

### 7. Heading levels — and why you must measure before you retag

Headings skipped levels on **29 of 30 pages** (`h1`→`h3`, `h2`→`h4`), which
breaks heading-based screen-reader navigation. Fixed across 12 templates and 17
CSS selectors; the site now has zero skips and exactly one `h1` per page.

**The trap, if you ever do this again:** an HTML tag carries a font size from the
user-agent stylesheet, and several rules here set only `margin-bottom` and
inherited that size silently. Changing `<h4>` to `<h3>` in those cases is not a
semantic-only change — it enlarges the text, with nothing in the diff to say so.
The computed `fontSize` of every affected selector was captured in a browser
*before* the edit and pinned explicitly on the new selectors afterwards. A
refactor described as "semantic only" is only semantic if something checked.

One heading is deliberately left alone: `<h2 id="lightbox-title">` in
`photos.njk` is empty in the static HTML and filled by JS. A static scan flags it
as an empty heading, but `.lightbox` computes to `display: none` when closed, so
it is excluded from the accessibility tree entirely. **If the lightbox is ever
hidden with `opacity` or `visibility` instead of `display`, that becomes a real
finding.**

### 8. Six lightbox images were requesting the page itself

`<img id="lightbox-img" src="" alt="">` appeared in six templates. An empty
`src` resolves against the current document, so **every page carrying a lightbox
fired a second, entirely pointless request for itself on load**, and reported a
broken image to anything inspecting `document.images`. The `src` attribute is
now absent; the open handler sets `.src` as it always did.

This one was not in the audit at all — it surfaced while verifying an unrelated
fix. Worth remembering that verification is not just confirmation of what you
already believe: it is the first time the system is actually exercised, and
exercise finds things that reading cannot.

### 9. Smaller items

- **Materials links** pointed at Google Docs `/edit` URLs. Now
  `/export?format=pdf`, which sends `Content-Disposition: attachment` and makes
  the button's "Download" label true. `download` is inert cross-origin, so it is
  emitted only for same-origin uploads; external links get `rel="noopener"`. Both
  buttons now carry distinct `aria-label`s instead of announcing as the single
  word "Download" twice. A hint on the CMS field tells the next editor not to
  paste an `/edit` link back in.
- **Privacy policy** said the site sets no cookies. The editor login sets one
  short-lived `__Host-csrf_state` cookie. Narrowed the claim to match reality
  rather than leaving an absolute statement the code contradicts; date bumped to
  September 2026. Terms and Accessibility are unchanged, so their dates were
  deliberately left at August.
- **`nav`** now has an `aria-label`; the home `<h1>` has an explicit
  `aria-label`, because `<br>` contributes nothing to the accessible name and it
  was announcing as "Guelph-HumberPre-Law Society".
- **Deps:** `sharp` 0.35.3 → 0.35.4, `wrangler` 4.120.0 → 4.128.0. `npm audit`: 0.

### How this was verified — and the wrangler check you should repeat

The twelfth pass's rule was followed exactly. After the GitHub Action went
green, the deploy log was read for the version that **actually ran**:

```
[command] npx --no-install wrangler --version
 ⛅️ wrangler 4.128.0
```

4.128.0 on Node 22, matching `package.json` — the silent fallback to a bundled
3.x did **not** recur despite this pass bumping wrangler, which is precisely the
change that triggered it last time. **Repeat this check on any future wrangler
bump; a green tick is what lied the first time.**

Then, against production rather than a local server: full CSP and every security
header on `/404` — a path that **did not exist before this deploy**, so no result
here rests on a cached response; 200 with CSP on all 12 public pages and
`/admin/`; the custom 404 returning 404 with 8,248 bytes while a missing image
still returns 0; `.legal a` measuring 4.84:1 live; zero contrast failures and
zero heading skips; Materials links resolving to `/export?format=pdf`; `/admin/`
booting Decap with `integrity` intact; and zero third-party requests.

### Still open after this pass

1. **Confirm the two GH Cup Google Docs are shared as *Viewer*, not *Editor*.**
   They are world-readable, which is intended — but the write role cannot be
   determined without attempting a write, which was not done. If either is set to
   "Anyone with the link can edit", anyone who ever had the old link can rewrite
   the competition rules and the judges' rubric. Drive → Share on each doc.
2. **Nobody has logged into `/admin/` since the tenth pass.** The panel boots and
   its code was audited, but the focal-point crop tool, image upload and the
   publish flow are still unverified against a real GitHub session — and this
   pass changed `admin/config.yml` and `admin/index.html`. Both parse and boot,
   but a real save is a different code path. Have an exec publish one trivial
   edit to close this out.
3. Everything carried over from the twelfth pass's list that isn't code work —
   exec bios, GH Cup gallery photos, real material PDFs, remaining "TBD" winner
   names.

The audit report, with every finding's evidence and verification step, is at
`.ship-check/report-2026-09-01.md`. It is gitignored on purpose: this repo is
public, and the report is a map of where the weak points were.

## Twelfth pass, Aug 10 2026 — the eleventh pass's §0 fix didn't actually ship; here's why, and how it was caught

**Read this if you're about to trust "verified against a running `wrangler
dev`" as proof something works on the real deployed site. It isn't, and this
is the story of why.**

The previous section (Eleventh pass, §0) describes fixing
`run_worker_first` — the setting that makes every request actually go through
`worker.js` instead of bypassing it for any URL that matches a real file —
and says it was verified. It was verified against `wrangler dev --local`, and
it genuinely did work there. It was pushed, deployed, and **did not take
effect on the live site.** The deploy succeeded, `wrangler.toml` was correct,
and the security headers were still missing from every real page.

**What was actually wrong:** `.github/workflows/deploy.yml` pinned
`node-version: 20`. `wrangler` 4.x requires Node ≥ 22. `cloudflare/
wrangler-action` detects that mismatch and silently falls back to a
*different, older, bundled* wrangler — **3.90.0** was what actually ran, not
the 4.120.0 pinned in `package.json` — with no error and no warning printed
anywhere in the deploy log. Wrangler 3.x doesn't apply `run_worker_first` the
same way 4.x does, so every request that matched a real static asset kept
bypassing the Worker exactly as before the "fix," while a 404 or a
freshly-added redirect source looked completely fine, because those always
reach the Worker either way regardless of this setting. **That's precisely
why local `wrangler dev` testing didn't catch it**: the locally-installed
wrangler (whatever version `npx` resolves to on the machine actually doing the
work) has no reason to hit the same Node-version gate CI does, so it doesn't
reproduce the fallback at all.

**How it was caught:** by not trusting the deploy and instead running `curl
-sD- -o /dev/null <live-url> | grep -i content-security` against the actual
production URL after every deploy. First pass at that showed no CSP header on
`/` and `/about/`. The obvious wrong conclusion at that point would have been
"Cloudflare's edge cache is just serving something stale" — plausible, and
partly true (see below) — but the way to actually tell the difference between
"cached" and "never worked" is to test a URL that **cannot possibly have a
cached response**, because it didn't exist before this exact deploy:
`/assets/fonts/inter-normal-latin.woff2`, one of the new self-hosted font
files. It came back with the *default* asset cache-control, not the custom
one `worker.js` sets for that path — proof the Worker's header-setting code
genuinely wasn't running for that request, not just proof of a stale cache.

Fixed by bumping `node-version` to `22` in the workflow (see the comment
there — it names the exact log line to check,
`npx --no-install wrangler --version`, if this is ever in doubt again).
Redeployed, and this time confirmed against a URL that had **never been
requested by anyone, ever** —
`/assets/fonts/playfair-display-italic-latin-ext.woff2`, untouched by even my
own earlier testing — which came back `cf-cache-status: MISS` with every
header correct: full CSP, `Strict-Transport-Security`, `Permissions-Policy`,
`X-Frame-Options`, and the font's own 30-day cache-control. Then swept all 12
public pages (`/`, `/about/`, `/achievements/`, `/ghcup/`, `/minimoot/`,
`/events/`, `/photos/`, `/contact/`, `/materials/`, `/privacy/`, `/terms/`,
`/accessibility/`) — CSP present on all 12, some still `HIT` from Cloudflare
having already cached the *new*, correct response by the time of the sweep,
none showing the old headerless version.

**The general lesson, worth keeping even after this specific bug is old
news:** "verified locally" and "verified in production" are different claims,
and the gap between them is exactly the kind of environment-specific
behaviour (a CI runner's Node version, here) that only shows up by actually
checking the live URL. `wrangler dev` proves the *code* is correct. It does
not prove the *deploy pipeline* delivers that code. When the two diverge, the
site can look identically broken before and after a "successful" fix — same
missing headers, same 200 status, same everything an incurious check would
compare — which is exactly the shape of bug that survives a re-read of the
source and only breaks under an actual request against the actual URL.

Also folded into this pass: six commits had landed on `main` via the live CMS
while the Eleventh pass work was in progress (a new event, two photos, a team
member update) — `git fetch` + `git rebase origin/main` before the final
push, no conflicts, clean rebuild against the merged content confirmed
nothing regressed (in particular, the new event correctly passed the
upcoming-events date filter and the near-miss-name / slug-year build checks
added in the Eleventh pass, all added *before* this content existed, all
still correct against it).

## Eleventh pass, Aug 10 2026 — full code + legal audit, then a follow-up pass

Two sessions back to back: a from-scratch audit of the whole site (code and
legal), then everything in it fixed, then three follow-up requests. Every fix
below was verified — built, and where it touches something the browser can
observe, checked live in a browser or against a running `wrangler dev`, not
just read back from the source. Where that mattered enough to be worth saying
twice, it's called out.

### 0. `run_worker_first` — the site had been serving NO security headers since the Cloudflare move

> **This section's fix did not actually take effect when first deployed —
> the config below was correct, but CI silently ran an old wrangler that
> ignored it. See the Twelfth pass, above, for the root cause and how it was
> caught. That section is the important one; treat this one as the first
> half of the story, not the whole thing.**

**This is the one thing in this pass worth reading even if nothing else is.**
`worker.js` sets `Content-Security-Policy`, `X-Frame-Options`,
`Strict-Transport-Security` and the rest — and they were correct, and they were
never being applied to a single real page. Workers Static Assets serves a
matching file **directly** and only invokes the Worker when nothing matches.
Every real URL on the site matches a file, so the Worker never ran for `/`,
`/about/`, or anywhere else — only for URLs that didn't exist. The migration
carried the headers over from `netlify.toml` faithfully; it just carried them
into code that never executed. Nothing about the live site looked wrong from
the outside.

Reading `worker.js` could not have caught this at any level of care — the
defect is in the platform's request-dispatch behaviour, not in the file. It was
only caught by starting `wrangler dev` and running `curl -sD- -o /dev/null
<url> | grep -i content-security` against an actual response. **That command
is worth running after any change near `wrangler.toml` or `worker.js`** — if it
prints nothing, the headers are off.

Fix: `run_worker_first = true` in `wrangler.toml`. Do not remove that line.
There's a `> **These headers were not actually live...**` blockquote in
`SECURITY.md` explaining this for a non-technical reader; keep it in sync if
this ever changes again.

### 1. GitHub OAuth token leak (critical) — `functions/api/callback.js`, `functions/api/auth.js`

The CMS login callback posted the access token to `window.opener` with a
wildcard target origin, and separately echoed it back to the origin of any
inbound `message` event. Neither hole needs the attacker to forge the OAuth
flow — they just start the real one: open `/api/auth` in a popup, let an
already-authorised exec sail through GitHub's silent re-auth, and the callback
hands the token to whichever window opened it. The CSRF `state` cookie doesn't
help, because the state genuinely matches.

Fixed by posting only to `url.origin` (this site, fixed, never derived from an
inbound message), scoping the OAuth request down from `repo,user` to
**`public_repo`** (a leaked token now reaches only this one public repo, not an
exec's private/coursework repos), adding `no-store` + a strict single-page CSP
to the token response, and switching the CSRF cookie to `__Host-` prefix.
Long comments in both files explain the attack — read them before touching
either postMessage call.

### 2. CSP: video host, self-hosted fonts (see §12) — `worker.js`

Public CSP had no `frame-src`, so it fell back to `default-src 'self'` and
would have silently blocked the first GH Cup / Mini Moot final video any exec
adds (both collections exist in `admin/config.yml`; neither had an entry yet,
so nobody had hit this). Added `frame-src 'self' https://www.youtube-nocookie.com`
and switched the embed in `ghcup.njk`/`minimoot.njk` to `youtube-nocookie.com`
— same player, no tracking cookie until play is pressed.

Verified live against a running Worker: an injected iframe to
`youtube-nocookie.com` loads, an injected iframe/image to `evil.example.com`
fires a `securitypolicyviolation` event and is blocked. The CSP is genuinely
enforcing, not just present.

### 3. SEO: sitemap, robots.txt, meta tags — `src/sitemap.njk` (rewritten, now a template), `src/robots.njk` (new, replaces static `src/robots.txt`), `src/_includes/base.njk`, `src/_includes/macros.njk` (new)

- Both files pointed at `guelphhumberprelawsociety.netlify.app` — a domain the
  site left months ago. Both now read `site.url` (new field in
  `src/_data/site.json`, also editable from the CMS under Site Settings —
  **if the site ever moves domains again, change it there and the sitemap,
  robots.txt, canonical tags and OG tags all follow**).
- `robots.txt` was disallowing `/assets/uploads/`, which also covers
  `/assets/uploads/resized/` — every responsive image variant on the site was
  blocked from image search. Fixed.
- Sitemap is now generated from the collections (29 URLs: every achievement
  page and every exec profile included) instead of a hand-maintained list of
  10 that had already drifted (missing `/minimoot/`, `/accessibility/`, every
  detail page).
- Every page now emits `<meta name="description">`, `<link rel="canonical">`,
  and Open Graph / Twitter Card tags, computed in `base.njk` from a
  `pageDescription` front-matter field (added to every page) with fallbacks.
  Previously: none of this existed anywhere, so a link shared to Instagram —
  the society's own main channel — rendered as a bare URL.
- The eight page-header `<section>` blocks (200 characters each, copy-pasted
  into eight templates) are now one macro, `pageHeader()` in
  `src/_includes/macros.njk`. They all shared the same unsanitised
  `photoPosition` interpolation (see §7); fixing it once here means it can't
  drift again the way it had.

### 4. "Upcoming Events" now actually means upcoming — `.eleventy.js`

The `events` collection had no date filter at all — an event stayed listed as
upcoming forever. Added a cutoff at the start of today (UTC, matching the
calendar-day handling documented further down in this file — see the tenth
pass). Verified with throwaway fixture entries: a 2025-dated event is excluded,
an event dated *today* is kept (still upcoming for the whole of that day) and
still gets its `.ics` file.

### 5. Lightbox script-injection in two templates — `src/pages/events.njk`, `src/pages/ghcup.njk`

Two of the site's lightboxes (past-event extra photos, GH Cup gallery) still
built `onclick="openLightbox('{{ x }}', '{{ y }}')"` by string interpolation.
Nunjucks HTML-escapes `'` to `&#39;`, which the HTML parser decodes straight
back to `'` before the JS is parsed — so a caption containing an apostrophe
closed the string literal early and broke the button, and a crafted one would
have executed. Converted both to the `data-img`/`data-caption` + `dataset`
pattern the other lightboxes already used correctly.

**Regression-tested**, not just read: added a temporary past-event entry with
caption `Ireland's trip: "quoted" & <script>alert(1)</script>`, clicked it in a
real browser, confirmed no throw, no script execution, and the caption renders
as inert text (`cap.querySelectorAll('script').length === 0`). Removed the
fixture afterward.

### 6. Accessibility — `src/styles.css`, `src/pages/about.njk`, `src/_includes/base.njk`

- **Five WCAG AA contrast failures**, all the same bug repeated: `--peach`
  (1.9:1 on white/cream) used where `--peach-ink` (4.84:1) was needed. The rule
  was already written down in a comment above `.cal-add` in `styles.css` — the
  violations just hadn't been checked against it. Fixed:
  `.schedule-info .time`, `.past-event-date`, `.contact-links a:hover`, the
  FAQ's `+`/`×` indicator, and an inline `style="color:var(--peach)"` on the GH
  Cup sponsor link.
- **FAQ rebuilt on native `<details>`/`<summary>`** instead of a `<button>`
  toggling a class. The old version never set `aria-expanded`, so a screen
  reader announced "button" and nothing about state — and `.faq-answer` was
  hidden with `max-height:0; overflow:hidden`, which hides content visually
  while leaving it fully in the accessibility tree, so a screen-reader user
  heard every answer read out at once. `<details>` gets both for free.
- **Nav hamburger now reports its own state.** `aria-expanded`/`aria-controls`
  added, kept in sync with the open class through one function
  (`setOpen(bool)`) so they can't drift apart, Escape closes the menu and
  returns focus to the button.
- **Reduced motion is now genuinely blanket**, not three specific rules. It
  used to miss `scroll-behavior: smooth` on `html` and ~30 hover
  transforms/transitions across the site — the accessibility statement's claim
  that "animated elements are suppressed" was false. Fixed with a
  `*, *::before, *::after { transition-duration: 0.01ms !important; ... }`
  reset inside the existing media query (near-zero rather than `none`, so
  `transitionend` still fires for anything listening).
- All of the above verified live: FAQ toggles via native `open` attribute and
  `answerHidden` tracks it correctly; nav `aria-expanded` flips `false → true →
  false` across two clicks with the class in sync; the FAQ indicator measures
  4.84:1 computed in-browser.

### 7. CSS injection via CMS fields — new filters in `.eleventy.js`: `cssPosition`, `cssFit`, `cssZoom`; applied across every template that interpolates a photo field into `style="..."`

`photoPosition`/`photoSize`/`photoZoom` came straight from the CMS into
`style="object-position: {{ photoPosition }}"` with only HTML-escaping, which
does nothing against a CSS-level payload (no quotes or brackets needed — a
`photoPosition` of `center; background:url(https://evil/track.gif)` was
HTML-safe and would have added a third-party request). Editor-only, so this
was defence-in-depth rather than a live hole, but the CMS's entire point is
that non-developers type into it. `cssPosition`/`cssFit` validate against a
known pattern/closed set and fall back to a safe default; `cssZoom` clamps to a
sane numeric range. Applied everywhere a photo field reaches a `style`
attribute — grep for `| cssPosition` to find every site.

### 8. Content integrity: 9 renamed files + 301 redirects, one CMS slug fix — `worker.js` (REDIRECTS map), `admin/config.yml`

A file's name is its URL, and several had drifted from what they actually
contain:

- `src/team/mooting-director.md` → `kate-hilton.md` (it held the **President**,
  Kate Hilton — the URL said "mooting-director"). Similarly `president.md` →
  `francesco-deleo.md`, `secretary.md` → `tala-taha.md`, `vp.md` →
  `muhammad-ali.md`. All four predate the CMS's `slug: "{{name}}"` config,
  which only applies going forward.
- Four achievement files whose slug year disagreed with the entry's `year`
  field (corrected after the slug was generated at creation) —
  `highland-cup-2026.md` actually said `year: 2024` and rendered "Highland Cup
  2024" at a URL claiming 2026. Renamed to match. **Added a build-time check**
  (`warnOnSlugYearMismatch` in `.eleventy.js`, next to the existing near-miss-
  name check) so a future mismatch surfaces as a build warning instead of
  silently shipping.
- The GH Cup winner entry whose filename was the *entire entry object*
  slugified (200 characters, starting `map-photosize-cover-...`) — caused by
  `slug: "{{slug}}"` on a collection with no `title` field. Fixed the config to
  `slug: "ghcup-{{year}}"` (matching what `minimoot-winners` already used) and
  renamed the existing file to `ghcup-2025.md`.
- Every renamed URL gets a 301 in the `REDIRECTS` map at the top of
  `worker.js`, matched with or without a trailing slash, so any link already
  shared — an Instagram bio, a group chat — still resolves. These can be
  deleted once traffic to the old paths stops, but cost nothing sitting there.

### 9. Mobile performance

The core mistake was one wrong default: every `<img>` on the site told the
browser it might need the full viewport width, so a 179px-diameter headshot
circle downloaded the 1280px copy. Fixed with per-context `data-sizes` on every
image (about.njk, achievements.njk, events.njk, ghcup.njk, minimoot.njk,
photos.njk, the two detail includes), lazy-loading everywhere except the first
achievement card, and `<picture>` + WebP with a JPEG fallback.

**`<picture>` was previously avoided on purpose** — an old comment explained
that wrapping every image breaks `height: 100%`-style rules because the
percentage resolves against the new `<picture>` box instead of the original
styled parent. That's still true in general, and is answered by one line:
`picture { display: contents }` in `styles.css`. A `display: contents` element
generates no box, so the `<img>`'s containing block is the original parent
again. **Do not remove that CSS rule without reverting the `<picture>` wrapping
in `.eleventy.js` at the same time** — the comment above it in `.eleventy.js`
says the same thing from the other side.

**A regression was caught and fixed within this same pass, worth flagging so
it isn't reintroduced:** an early version also emitted `width`/`height`
attributes on every `<img>` for layout-shift prevention. Verified live in a
browser and found the 179px circular exec headshots rendering **813px tall** —
`width`/`height` attributes become presentational hints, and a presentational
hint loses to an author CSS rule for the *same* property but not to
`aspect-ratio`, which only derives a height when height is `auto`. Since every
image container on this site already reserves its own box via a fixed height
or `aspect-ratio`, there was nothing for the attributes to gain anyway.
Removed them; the comment in `.eleventy.js` explains why they must not come
back.

Page-header banners (background-images, can't use `srcset`) now swap between
three breakpoint-specific copies via CSS custom properties (`--bg-sm/md/lg`)
emitted by the same transform, rather than always serving the 1920px original.

**Cold-build time regression, caught before it shipped:** the image pipeline
originally wrote variants straight into `_site/`, staleness-checked against the
source file's mtime. That's invisible on a machine where `_site/` persists
between builds and catastrophic in CI, where the checkout is always fresh —
every deploy was regenerating ~200 image files from scratch, measured at **8.6
minutes**. Moved generation to a `.image-cache/` directory outside `_site`
(gitignored), published from there into `_site/` on every build, and added a
GitHub Actions cache step (`.github/workflows/deploy.yml`, keyed on a hash of
`assets/uploads/**`) so CI reuses it too. Local rebuild dropped to **3.5
seconds**. Also added `workflow_dispatch` (manual redeploy without an empty
commit) and a `concurrency` group (a newer deploy cancels an older one still
running, so two CMS publishes in a row can't race to be last).

Also stopped shipping the ~25MB of untouched camera originals in the deploy —
`copyUnprocessed()` in `.eleventy.js` now skips any upload that has generated
variants and copies through only what doesn't (PDFs, anything too small to
resize). Deploy size: 36MB → 21MB even after adding WebP.

Measured, not estimated: `/about/`'s above-the-fold image weight went from
384KB to 40KB; full-page image weight from 716KB to 144KB.

### 10. Legal pages rewritten to match reality — `src/pages/privacy.njk`, `terms.njk`, `accessibility.njk`

Not legal advice, but each page previously made claims the code contradicted
or described data flows that didn't exist. Privacy: reframed PIPEDA as
voluntary-adherence rather than governing (a non-profit club almost certainly
isn't in PIPEDA's "commercial activity" scope), added a §4 naming every actual
third party handling data (Cloudflare, GitHub, YouTube — see §12 re: fonts),
removed the Google Drive/Sheets claim that only applied if a Google Form was
configured (neither is), added retention periods, a breach-notification
commitment, a section on names/results being published as a matter of
competition record with an opt-out, and replaced the COPPA-derived "under 13"
line with a general no-children commitment plus an explicit note on photo
consent for minors. Terms: corrected the logo/IP overclaim (the crest
incorporates the University's name; the Society doesn't own that), added
changes/severability/takedown-request clauses. Accessibility: claims now
describe what's actually true post-fix (contrast measured, native disclosure
controls, blanket reduced-motion) instead of overclaiming, and named the exec
carousel's drag-only progress bar as a known limitation. All three had stale
"last updated" dates relative to when they were actually last edited; fixed.

### 11. Dependencies — `package.json`

`npm audit`: 11 advisories (3 moderate, 8 high, all inside `wrangler`/
`miniflare`) → **0**. Bumped `wrangler` 3→4, `sharp` 0.33→0.35, `@11ty/eleventy`
2→3 (verified: all 30 pages still build and render correctly under 3.x — no
template or filter syntax changed on this site). None of this reaches
visitors; `npm audit --omit=dev` was already 0 before and after.

### 12. Follow-up, same day: unify a role title, self-host fonts, confirm the exec-carousel swipe hint survived

Three small requests after the pass above landed:

- **Ava Gonsalves's title corrected** from "Vice President of **Mooting**
  Training" to "Vice President of **Moot** Training" — confirmed against
  Francesco Deleo's existing title, they're the same role.
- **Fonts are now self-hosted** instead of loaded from
  `fonts.googleapis.com`/`fonts.gstatic.com` — this was the site's last
  third-party request on an ordinary page load (every visitor's IP reached
  Google just to draw text), and it was also slower: a second render-blocking
  stylesheet fetch, from a different origin, before the browser could even
  start on the font bytes.

  Eight `.woff2` files now live in `assets/fonts/` (both families × normal/
  italic × `latin`/`latin-ext` subset, matching what Google Fonts itself
  splits a Latin-script site into) and are referenced by `@font-face` rules at
  the top of `src/styles.css` — **read the comment there before touching
  anything font-related**, it has the exact command to regenerate the set if a
  weight or style is ever added. `base.njk` preloads only the two "latin
  normal" files (Inter body text, Playfair headings — used on every page);
  italic and `latin-ext` load on demand, verified live: a page with no `<em>`
  fetches 2 files, `/privacy/` (which uses `<em>`) fetches a third,
  `italic-latin`, and nothing else. `document.fonts` confirms all 8 faces are
  registered but only the ones actually used per page report `status:
  "loaded"`.

  Passthrough copy needed a second line —
  `eleventyConfig.addPassthroughCopy("assets/fonts")` — because
  `addPassthroughCopy("assets/*.*")` (added earlier in this same pass, to stop
  shipping raw camera originals) only matches files directly inside `assets/`
  and was silently skipping the new subdirectory. Caught by checking `_site/`
  after a build, not by assuming the glob covered it.

  `worker.js`'s two CSPs no longer list `fonts.googleapis.com`/
  `fonts.gstatic.com` at all — `font-src 'self'` already covers everything now.
  Verified against a running Worker, not just read: both response headers
  print no google references, and the font files themselves come back with
  the right `Content-Type: font/woff2`. Font files get a 30-day cache
  (**not** the `immutable` 1-year treatment the resized images get — a font
  file's name doesn't change if it's later regenerated with a different
  weight range, unlike an image's, so `immutable` risked a silently stale font
  for up to a year with nothing to invalidate it).

  The admin CMS's live-preview pane (`admin/cms-extras.js`) used to load
  Google Fonts a second time, separately from the site's own `styles.css` —
  redundant now that `styles.css` self-hosts the same families and the preview
  already loads that stylesheet. Removed the second `registerPreviewStyle`
  call; left a comment for whoever touches this next, since a future
  reintroduction of a Google Fonts URL there would need the admin CSP's
  `font-src`/`style-src` widened again to match.

  Privacy policy's §4 (who else is involved) updated to drop the Google Fonts
  line — it's no longer true — rather than leave a disclosure for a request
  the site no longer makes.

- **The exec-carousel swipe hint was never touched.** Checked, not assumed:
  `src/pages/about.njk` still has `<span>Drag, scroll, or swipe to meet the
  rest of the team</span>`, the animated arrow, the one-time auto-nudge
  `setTimeout`, and the `prefers-reduced-motion` opt-out on it, byte-for-byte
  as before this whole pass started. It was flagged in §6's accessibility
  statement rewrite as a *known limitation* (the thin progress bar under the
  carousel is drag-only, mouse/touch, not keyboard) — that's a documentation
  addition, not a functional change to the hint itself.

## Tenth pass, Aug 9 2026 — Mini Moot banner, Contact page, admin on phones, Add to Calendar

Three user-reported problems plus an Add to Calendar feature, all reproduced or
verified before being called done.

### 0. Add to Calendar on /events/ — and the date bug it exposed

**A latent timezone bug had to be fixed first.** The date filters read a
calendar day with LOCAL getters (`.getDate()`, `toLocaleDateString()`) out of a
value that `new Date("2026-10-20")` parses as **UTC midnight**. Every event
therefore rendered one day early anywhere west of Greenwich: a local build in
Toronto showed "OCT 19" for an event dated the 20th. **The live site was
correct only because GitHub Actions builds in UTC** — the bug was invisible in
production purely by accident of where the build runs. `dateFormat` /
`monthShort` / `dayNum` now read UTC parts, so local and CI agree. Deployed
output is unchanged; only local builds were ever wrong. Don't reintroduce local
getters here — these values are calendar days the society picked, not instants.

The feature itself:

- **One `.ics` file per upcoming event**, generated at build time by new
  `src/event-ics.njk` at `/events/<slug>.ics`, plus a **Google Calendar
  pre-filled link**. Two routes because neither covers everyone: the `.ics`
  opens Apple Calendar directly when tapped on an iPhone and imports into
  Outlook, while Google users are far better served by a link than by
  downloading a file and importing it.
- **The control is a `<details>`/`<summary>` disclosure — no JavaScript.**
  Keyboard-operable and screen-reader announced for free, and it can't break at
  runtime. Same reasoning that put RSVP on a plain link (eighth pass).
- **The `time` field is free text** ("5:00 PM - 7:00 PM") and stays that way —
  switching to structured start/end fields would invalidate every existing
  entry and make execs re-type them. `parseEventTime` in `.eleventy.js` reads
  it, and **anything it can't parse still gets a working button**: the event
  becomes an **all-day** entry on the right date rather than no button or, far
  worse, one filed at the wrong hour. A build warning names any event that took
  the fallback, so a typo surfaces at build time instead of in someone's
  calendar. Verified against 10 formats: `5:00 PM - 7:00 PM`, `6 PM – 8 PM`
  (en dash), `5 - 7 PM` (trailing meridiem governs the earlier bare hour →
  17:00), `17:00 - 19:00`, `7:30 PM` (single time → +1h, a stated assumption),
  `12:00 PM - 1:30 PM` (noon is 12:00, not 00:00), `9:00 AM - 12:00 PM`,
  `10 PM - 1 AM` (correctly rolls to the next day), `TBD` (all-day + warning)
  and empty (all-day, no warning — a missing time isn't a mistake).
- **A bare hour with no am/pm anywhere is deliberately rejected**, not guessed.
  "5 - 7" falls back to all-day; being vague beats being twelve hours wrong.
- **The `.ics` body is assembled in JS, not a Nunjucks template.** RFC 5545
  needs CRLF endings and 75-octet line folding, and neither survives template
  whitespace control — a bare LF makes strict parsers (Outlook) reject the file
  silently, which presents as "nothing happens when I tap the button". Verified
  the output is 100% CRLF with zero bare LFs, no line over 75 octets, and that
  folded DESCRIPTION lines unfold back to the exact original text.
- `dates=` on the Google URL is appended by hand because `URLSearchParams`
  percent-encodes the `/` separator and Google's documented form uses a literal
  slash.
- The CMS hint on the Time field now explains that the format drives the
  calendar entry.

**Latent, not fixed — worth knowing before the execs add a final video:**
`SITE_CSP` in `worker.js` has no `frame-src`, so it falls back to
`default-src 'self'` and **would block the YouTube embeds** on the GH Cup and
Mini Moot pages. Nothing is broken today only because both video collections
are empty. Add `frame-src https://www.youtube.com` before the first video goes
in, or it will look like the video simply doesn't appear.

---

The three reported problems follow. `git pull --rebase origin main` before
committing — execs push CMS commits.

### 1. The Mini Moot banner "didn't work" because two fields both claimed to be it

An exec set Page Content → Mini Moot Page → **"Banner Photo"** and the banner
didn't change. Nothing was broken in the usual sense: that field renders a
**200px circle inside the hero box**, not the page banner. Their photo was
live the whole time, as a squashed oval halfway down the page (`border-radius:
50%` on a non-square image), while the real banner — Page Content → **Page
Header Photos** → Mini Moot Page — was still empty and showing plain navy.

- **Removed the "Banner Photo" field and its `<img>` from both the Mini Moot
  and GH Cup pages.** The GH Cup copy was unused (`ghcup.json`'s `photo` was
  `""`) but identical, so it was the same trap waiting for the next editor.
- **Migrated the exec's photo** (`img_8312.jpeg`) into
  `pageHeaders.minimoot.photo` so their upload became the real banner instead
  of being deleted, and set a focal point of `50% 72%` so the group's faces sit
  in the 380px strip. They can re-drag it in the CMS at any time.
- **Page Header Photos is now the single place every page banner is set**, with
  the same drag-to-position control on all nine. Both page entries' CMS
  descriptions now say so.
- Fixed two related gaps: the Page Header Photos **preview pane never rendered
  a Mini Moot entry** (the page list in `cms-extras.js` was written before the
  Mini Moot existed and nothing keeps them in step — there is now a comment),
  and **`minimoot-page` had no preview template at all**. GH Cup's gallery
  preview is now a shared `competitionGalleryPreview()` used by both.

**If you add a 10th page:** it needs an entry in `admin/config.yml` under Page
Header Photos *and* in the `pages` array in `cms-extras.js`. Miss the second
and the field works but silently previews nothing.

### 2. Contact page — every route was listed twice

The page invited the same action twice under two headings. "Get in Touch" sat
above a bare list of Instagram/LinkedIn/email; "Send us a message" then
repeated the email as a button and Instagram and LinkedIn as a sentence. Three
routes, six mentions.

Rebuilt so **each route appears exactly once**, with one rule worth preserving:
the primary card holds whichever route we most want used, and "Other ways to
reach us" holds the rest — so when `contactFormUrl` is set the email moves down
into the list, and when it isn't, the email *is* the primary button and is
therefore omitted from the list. **Both branches were checked** for duplicates
(the fallback branch is the one live right now, since no Google Form is
configured yet). `.contact-cta-alt` is gone from `styles.css`.

### 3. `/admin/` on an iPhone — the content was off-screen and unreachable

Measured at 375px: **three Decap containers carry a hard `min-width: 800px`**
(`AppHeaderContent`, `AppMainContainer`, `EditorContainer`/`ToolbarContainer`),
so the admin renders on an 800px canvas at any screen size. The entry list, the
Publish button and the account menu all sat past the right edge — and
`admin/index.html`'s `overflow-x: hidden`, added previously to stop sideways
scrolling, **made that unreachable rather than merely awkward**: you saw the
Collections sidebar and nothing else, with no way to scroll to it. That
`overflow-x` is now gone; do not put it back.

New `admin/cms-mobile.css`, scoped entirely to `@media (max-width: 799px)` (one
pixel below Decap's own floor, so **desktop is byte-for-byte unchanged** —
verified). It releases the min-widths, un-fixes the 250px sidebar so it stacks,
zeroes the entry list's `padding-left: 280px`, collapses the editor's
react-split-pane to one column and hides the preview pane, wraps the toolbar so
Publish is reachable, puts the date field's "Now"/"Clear" on their own row
(they were rendering one letter per line), forces 16px inputs so iOS stops
zooming on focus, and sets 44px touch targets.

**Read the header comment in that file before editing it.** Every selector
matches `[class*="ComponentName"]`, never an emotion hash (`css-y7r3-AppHeader`)
— the hash changes between Decap versions, the component-name suffix doesn't.
Two selector mistakes are already documented in there because both were made
and caught: `[class*="ViewControls"]` unscoped also hides the collection list's
sort and filter controls, and the "Now" button's wrapper is `Buttons`, not
`NowButton`.

### The focal-point widget didn't work on touch at all

Separately from layout: the crop tool bound `onMouseDown/Move/Up` only. iOS
synthesises a click from a tap but **not a mousemove stream from a drag**, so
"drag to position" did nothing on a phone — the gesture scrolled the page. It
now uses Pointer Events (mouse, touch and pen in one path) with
`setPointerCapture`, falling back to the mouse handlers where `PointerEvent` is
missing, so a drag can't be applied twice. Verified by dispatching real
`pointerType: "touch"` events and confirming the saved value.

The box was also a hardcoded 320px, wider than the editor column on a phone.
It is now `width: 100%; max-width: 320px` with the aspect ratio pinned.

**The important part, if you touch this widget:** the crop overlay and focal dot
are drawn in `render()`, while the pointer is mapped from the box's *live*
bounding rect in `onPointer()`. A first attempt stored a measured pixel width in
state to bridge the two — and that number went stale on resize (observed: 283
stored, 228 actual), which puts the crop guide somewhere other than where the
finger actually lands, with nothing on screen to reveal it. A `ResizeObserver`
was tried and **could not be verified** — a control probe confirmed observer
callbacks are never delivered in this automation environment. So the stored
width was **removed entirely**: the ratio is pinned and every overlay offset is
a percentage, which makes the rendered geometry width-independent and leaves
only one source of truth. Do not reintroduce a measured width here.

Verified by round-trip at 320 / 375 / 414px — drive a drag to a known fraction
of the box, then read back where the dot actually rendered (e.g. dragged to
0.65/0.20 → saved `66% 20%` → dot rendered back at 0.645/0.204) — plus a
desktop check at 1280px confirming the preview pane, resizer, 800px min-width
and 66px toolbar are all exactly as before.

**Testing the admin locally:** GitHub OAuth isn't available on localhost, so
this used a throwaway `admin/_local-harness.html` — `CMS_MANUAL_INIT`, fetch
the real `config.yml`, swap `backend` for `test-repo`, seed a photo via a
folder collection's field-level `default:` (see failure-log item 8). **It was
deleted before the end of the session**; recreate it if you need it, and delete
it again — it must never ship.

**Files touched:** `.eleventy.js`, `admin/cms-extras.js`, `admin/config.yml`,
`admin/index.html`, `src/_data/{ghcup,minimoot,pageHeaders}.json`,
`src/pages/{contact,events,ghcup,minimoot}.njk`, `src/styles.css`, new
`admin/cms-mobile.css`, new `src/event-ics.njk`.

## Ninth pass, Aug 9 2026 — The Mini Moot page

Added `/minimoot/` for the Mini Moot: the same competition format as the GH
Cup, but **open only to University of Guelph-Humber students**. Committed as
`b30567a`, deployed and verified live.

**Built to mirror `ghcup.njk` section for section on purpose** — the two
competitions run the same way and visitors compare them directly, so the
layouts should rhyme. What makes it distinct:

- A **reversed hero gradient** (navy → plum → `--peach-ink`) instead of the GH
  Cup's flat navy, via `.minimoot-hero`.
- An **eligibility badge** above the headline (`.eligibility-badge`, CMS field
  `eligibility`). The Guelph-Humber-only rule is the single fact most likely to
  be misread, so it is a badge rather than a sentence buried in prose.
- **Its own three feature cards** — Start Here / Get Coached / Go Further,
  pitched at first-time advocates — rather than the GH Cup's Compete / Judge /
  Network.
- A **"How is this different from The GH Cup?" callout** (`.minimoot-note`)
  that links across, because the two pages are otherwise near-identical and
  someone landing on the wrong one should be able to tell immediately.
- **No sponsors section.** The Mini Moot is internal; soliciting sponsorship on
  it would be wrong. This is a deliberate omission, not a gap to fill in.

**Data and CMS:** `src/_data/minimoot.json` + a "Mini Moot Page" entry under
Page Content (same fields as the GH Cup page, plus `eligibility`), a "Mini Moot
Page" header photo entry, and **separate `minimootWinners` / `minimootVideos`
collections** with their own CMS sections. Deliberately *not* shared with the
GH Cup's collections — mixing them would misreport who won which competition.
Both start empty, so the page shows its empty state rather than seeded or
invented results; the execs fill them in. Both collection folders carry
`permalink: false` from the start, so they can't recreate the orphan-page
problem the eighth pass just cleaned up.

### The nav needed real work to take a 9th item — read this before adding a 10th

`.nav-inner` is capped at `max-width: 1200px`. **A wider screen therefore buys
the menu nothing**: past roughly 1248px viewport the nav layout is byte-for-byte
identical at every width, so raising the hamburger breakpoint — the instinctive
fix, and the one applied twice before — does *not* relieve a crowded menu. It
only changes the width at which the menu is hidden entirely.

Measured with the 9th item in place: only **7px** separated the brand name from
the first menu item, at every desktop width. Nothing overlapped, so it looked
fine, but a fallback font rendering wider than Playfair would have closed that
gap and reproduced exactly the clipped-hamburger bug from the fifth pass.

The fix was to reclaim space from the menu itself — `nav ul { gap: 28px → 22px }`,
which frees ~48px and takes the clearance to **45px** — and then set the
breakpoint from the width where `.nav-inner` actually starts shrinking
(measured at ~1205px, so `max-width: 1250px`). Verified no overflow, no
horizontal scroll, and no brand/menu collision at **1391, 1251, 375 and 320px**,
that the hamburger stays a 44×44 target fully on-screen, that the mobile menu
lists all 9 items, and that the GH Cup page renders unchanged.

**If a 10th nav item is ever added:** the gap is nearly spent. The next move is
either a shorter label, raising `.nav-inner`'s `max-width` on wide screens
(which will misalign the nav from the 1200px page container — check that), or
accepting the hamburger at desktop widths.

**Reconfirmed the eighth pass's caching gotcha:** `/minimoot/` returned `404`
and `/admin/config.yml` showed none of the new fields for roughly a minute
after a green deploy, then both came good with no further action. The CI log
(`+ /minimoot/index.html` in the wrangler output) is the reliable signal that a
deploy really shipped a file — check that before debugging a "missing" page.

**Files touched:** `.eleventy.js`, `admin/config.yml`, `src/_data/pageHeaders.json`,
`src/_includes/base.njk`, `src/pages/index.njk`, `src/styles.css`, new
`src/_data/minimoot.json`, new `src/pages/minimoot.njk`, new
`src/minimoot-{winners,videos}/<dir>.json`.

**Left for the execs:** add Mini Moot winners and final videos through
`/admin/`, set a Mini Moot page header photo and banner photo (both currently
blank, so the header falls back to the plain navy banner), and add Competition
Gallery photos once there are some.

## Eighth pass, Aug 9 2026 — both forms were dead; accessibility statement

The headline finding: **the contact form and the event RSVP form had never
worked on the current host, and every submission failed outright.** Both
carried Netlify's `data-netlify="true"` / `netlify-honeypot` attributes, which
are a Netlify *platform* feature — they do nothing anywhere else. The site
moved to a Cloudflare Worker (see section 2), and `worker.js` routes only
`/api/auth` and `/api/callback`; everything else is static assets, with no
form handling at all. Verified against the live site: `POST /contact/` and
`POST /events/` both returned **HTTP 405**. So anyone who used the contact
form or RSVP'd got an error page, and no message ever reached the exec team.
This was not a silent queue somewhere — it was a hard failure, and it had been
live since the Netlify → Cloudflare migration.

**Fixes, all committed in `86b406e` and verified on the live site:**

- **RSVP and contact now link out to Google Forms**, chosen by the user over a
  third-party form backend or a Cloudflare D1 database, because responses land
  in a Google Sheet the execs already know how to use and can hand on with the
  rest of the account. Deliberately a **link**, not an on-page form posting to
  Google: a link needs no CORS handling, no API key, no CSP relaxation
  (`form-action 'self'` is untouched), and cannot silently break the way the
  Netlify markup did.
  - Configured entirely from the CMS — three new Site Settings fields:
    `rsvpFormUrl`, `rsvpFormEventField`, `contactFormUrl`. **No code change is
    needed to finish the setup**, which is the point; see "What the user still
    has to do" below.
  - `rsvpFormEventField` takes a Google Forms `entry.123456789` id and
    **prefills the event name** into the form, so one RSVP form serves every
    event. Verified: each event generated its own correctly URL-encoded
    prefill link.
  - **Both fall back to `mailto:` when unconfigured** (RSVP prefills a
    "RSVP: <event name>" subject), so the site can never again show a control
    that goes nowhere. This is the state it's in right now.
- **Removed the RSVP "how many attending" field** (user's request — it was
  always 1). The whole inline form, its toggle button, and `toggleRsvp()` are
  gone; the dead `.rsvp-form` / `.rsvp-fields` / `.rsvp-toggle` and
  `.contact-form input|textarea|select` CSS went with them.
- **New `/accessibility/` page** + a footer link beside Privacy and Terms.
  Written to be **honest rather than maximal**: it claims *partial* WCAG 2.1
  AA conformance, states plainly that there has been no third-party audit, and
  names known limitations (volunteer-added photo descriptions, untagged PDFs,
  third-party embeds like the YouTube iframe). **Every measure it claims was
  verified present before it was written** — `prefers-reduced-motion` support,
  zero images missing `alt`, nav/main/footer landmarks, `lang="en"`. Do not
  upgrade the wording to full conformance without an actual audit; overclaiming
  here increases legal exposure rather than reducing it.
- **Real accessibility fixes behind the statement** (these matter more than the
  page does): a **skip link** as the first tab stop on every page, and a global
  **`:focus-visible` indicator**. The form styles had been applying
  `outline: none` with only a border-colour change, which is a WCAG 2.4.7
  failure — there is now a comment in `styles.css` warning not to reintroduce
  that. Verified with a real `Tab` keypress in the browser (note: programmatic
  `.focus()` will *not* match `:focus` when the automation tab lacks system
  focus — `document.hasFocus()` returns false and it looks like a CSS bug that
  isn't there).
- **Stopped emitting 8 layout-less orphan pages** — the `permalink: false`
  cleanup that sections "Left undone, on purpose" and 0a had both flagged.
  `src/{events,photos,past-events,ghcup-winners}/<dir>.json` now set
  `permalink: false`, so collection items stay available to the listing pages
  but no longer generate their own unstyled, nav-less, CSS-less URLs. Confirmed
  beforehand that nothing linked to any of them, and afterwards that all
  collection content still renders (3 photos, 4 GH Cup winner awards, 2 events,
  1 past event — each matched against its source files). They now 404.

**Gotcha worth knowing:** immediately after a deploy, Cloudflare's CDN can
serve a cached `200` for a URL the new build no longer contains. Three of the
removed orphans looked like they were still live until the cache revalidated,
at which point all returned `404`. Don't chase a phantom bug there — check
`cf-cache-status` and re-test after a minute.

### What the user still has to do (nothing works end-to-end until this is done)

1. **Create two Google Forms** (RSVP, and contact) on the club's Google
   account, and link each to a responses Sheet.
   - RSVP form questions: Name, Email, and an **Event** question (this is the
     one the prefill targets). *Do not* add a "how many attending" question.
   - Contact form questions: Name, Email, Subject, Message.
2. **Paste both "Send → link" URLs** into `/admin/` → Page Content → Site
   Settings → "RSVP Google Form link" / "Contact Google Form link".
3. **For the RSVP prefill**, in the Google Form use ⋮ → "Get pre-filled link",
   type anything into the Event question, click "Get link", and copy the
   `entry.123456789` portion into "RSVP form — event field ID". Optional; the
   link works without it, the event just won't be pre-filled.
4. **Take down the old Netlify site.** `guelphhumberprelawsociety.netlify.app`
   was still live and serving a stale copy of the whole site (verified HTTP
   200 this session) — bad for search results and actively misleading. In the
   Netlify dashboard: pick that site → Site configuration → General → Danger
   zone → "Delete this site" (or "Stop builds" then unpublish to keep it
   recoverable). Nothing in this repo depends on it; `netlify.toml` is already
   documented as legacy.

**Files touched:** `admin/config.yml`, `src/_includes/base.njk`,
`src/pages/contact.njk`, `src/pages/events.njk`, `src/styles.css`, new
`src/pages/accessibility.njk`, new `src/{events,photos,past-events,
ghcup-winners}/<dir>.json`.

**Noticed, not fixed:** the site has **no custom 404 page** — unknown URLs
return a bare, empty `404`. Low priority, but a styled 404 with a link home
would be a small, self-contained improvement.

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
  **Superseded (eighth pass, Aug 9 2026): this never worked once the site
  left Netlify — every submission 405'd. Both forms are now Google Form links
  and the `rsvp` boolean still controls whether the RSVP button shows.**
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
Winners) · **Mini Moot** (Guelph-Humber-only counterpart to the GH Cup, added
Aug 9 2026) · Events (upcoming + past) · Photos (gallery + lightbox) ·
Materials · Contact · Privacy · Terms · **Accessibility**.
Nine items now sit in the nav — see the ninth pass before adding a tenth.

### CMS collections (`admin/config.yml`)
Achievements · Upcoming Events · Past Events · GH Cup Previous Winners · GH Cup
Final Videos · **Mini Moot Previous Winners** · **Mini Moot Final Videos** ·
Photo Gallery · Executive Team · Page Content (Site Settings, About Page, GH
Cup Page, **Mini Moot Page**, **Page Header Photos**, **Materials Page**). The
Page Header Photos and Materials Page entries were added Aug 8 2026 (section
0); everything Mini Moot was added Aug 9 2026 (ninth pass).
Every image field has a **drag-to-position focal point**
(rebuilt into an accurate live crop tool this session, see section 0) and most
have **size**/**fit**/**zoom** controls, per the user's ask to be able to
resize/reposition every photo and see it accurately before saving.

### Security & legal
- CSP + security headers applied for `/*`, with a **separate looser CSP
  scoped to `/admin/*`** so Decap CMS isn't broken. **Now enforced in
  `worker.js`** (see section 2's correction above) — `netlify.toml`'s copy of
  this is legacy/unused.
- ~~Honeypot + length/type validation on the contact form.~~ **Gone as of the
  eighth pass (Aug 9 2026)** — there is no on-site form any more, so there is
  no submission surface of ours to defend. Spam filtering is Google Forms'
  problem now.
- `.gitignore` (stopped tracking `node_modules/` + `_site/`).
- `robots.txt`, Privacy Policy (PIPEDA-aware), Terms of Use, **Accessibility
  statement** (`/accessibility/`, added eighth pass), footer disclaimer.
- Full writeup in `SECURITY.md` — **note: that document still describes the
  old Netlify/Netlify-Identity setup** (same drift as section 2 had); it
  wasn't updated this session since it wasn't in scope, but it should be
  before anyone relies on it for the current architecture.

## 3. Files actively being edited

None — the tenth pass is committed, pushed and deployed. `git pull --rebase
origin main` before pushing anything new; execs push CMS commits while you
work, and one landed mid-session this time too.

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
