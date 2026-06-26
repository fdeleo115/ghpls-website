# Handoff — GHPLS Website

_Written: June 2026 · For whoever (human or AI) picks this up next._

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

- `src/_data/site.json` — **just added `email: ghpls@uoguelph.ca`**. Now shown
  on the Contact page and auto-pulled into the Privacy Policy.
- `src/pages/contact.njk` — **just added a visible mailto link** for the email.
- These two changes are **committed locally but may not be pushed yet** — see
  next step.

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

1. **Push the pending email changes:**
   ```
   cd ~/Claude/GHPLS/site
   git pull --rebase origin main
   git add -A && git commit -m "Add society email to contact page and settings"
   git push
   ```
2. **After Netlify redeploys (~30s), open `/admin/` and confirm the CMS still
   loads.** This is the one unverified risk from the security work. If it's
   blank, revert the `netlify.toml` commit and redeploy — that's the instant fix.
3. **Open question raised but not answered:** make the **Privacy/Terms pages
   CMS-editable** (currently hardcoded in `src/pages/privacy.njk` /
   `terms.njk`). Would move their text into a `_data` file + add a CMS "Legal
   Pages" file collection, mirroring how About/GH Cup already work.
4. **Lower priority / user's to-do:** fill real exec team members, set actual
   event dates, upload material PDFs (Materials page download buttons are still
   `href="#"` placeholders), add sponsor logos, and fill GH Cup winner names
   (currently "TBD").

## Quick reference

- **Local dev:** `cd ~/Claude/GHPLS/site && npx @11ty/eleventy --serve`
- **Build:** `npx @11ty/eleventy` → outputs to `_site/`
- **Admin:** `https://guelphhumberprelawsociety.netlify.app/admin/`
- **Add an exec to CMS:** Netlify dashboard → Identity → Invite users.
- **Handoff to next exec:** add them as a GitHub collaborator + transfer/share
  Netlify access; they invite future execs via Netlify Identity.
