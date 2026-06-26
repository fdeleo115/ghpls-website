# Security Audit & Hardening Report — GHPLS Website

_Last reviewed: June 2026_

This document is an honest security audit of this website and a record of the
hardening applied. It is written to be understood by a non-technical exec.

## What this app actually is (and why that matters)

This is a **static website**: Eleventy turns Markdown/templates into plain HTML
files, and Netlify serves those files from its CDN. There is **no server, no
database, and no custom API** that we wrote and run. Content is edited through
Decap CMS at `/admin/`, which is gated by Netlify Identity login.

This architecture is, by itself, a strong security posture — most classic web
vulnerabilities (SQL injection, server RCE, leaked DB credentials) **cannot
exist here because the components they target do not exist.**

## The original hardening request, mapped to reality

| Requested | Status | Why |
| --- | --- | --- |
| Rate limiting on API endpoints | **N/A — handled by Netlify** | We expose no custom endpoints. The form and `/admin/` are Netlify-operated and rate-limited by Netlify's platform. |
| Input validation / sanitization | **Done where it applies** | Our code never processes user input, so there's no injection surface to sanitize. Added client-side limits/validation on the contact form as defence-in-depth; Netlify validates server-side. |
| Remove hard-coded API keys / rotate | **N/A — none exist** | Full-repo scan found zero API keys or secrets. Nothing to remove or rotate. |
| Security audit | **Done — this document** | |

## What was actually fixed

1. **Security HTTP headers** (`netlify.toml`) — the single biggest real win:
   - `Content-Security-Policy` — whitelists only the external origins we use
     (Google Fonts, Netlify Identity). A separate, looser CSP is scoped to
     `/admin/*` so Decap CMS keeps working.
   - `X-Frame-Options: DENY` + `frame-ancestors 'none'` — blocks clickjacking.
   - `Strict-Transport-Security` — forces HTTPS.
   - `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`.
2. **Contact-form abuse defences** — honeypot field (existing) + input length
   limits, type, and `required` validation (added).
3. **Git hygiene** — stopped committing `node_modules/` and `_site/` (added
   `.gitignore`). No secrets were ever in them, but it removes ~3,000 files of
   noise and shrinks the attack/confusion surface.
4. **`robots.txt`** — keeps `/admin/` and uploads out of search results and opts
   out of major AI-training crawlers.
5. **Legal pages** — Privacy Policy (PIPEDA-aware; we collect emails and post
   identifiable people's photos) and Terms of Use, linked in the footer, plus a
   "not affiliated with the University" disclaimer.

## Remaining considerations / recommended next steps

- **Enable Netlify Forms spam protection / reCAPTCHA** in the Netlify dashboard
  (Forms → Settings) if you start getting spam. The honeypot handles most bots.
- **Keep Netlify Identity registration set to "Invite only"** (already done) so
  randoms can't create CMS logins.
- **Have the legal pages reviewed** if the Society starts taking paid
  registrations or signing sponsorship contracts. The current text is a
  reasonable good-faith baseline for a student club, not lawyer-drafted.
- **Fill in a Society contact email** in the CMS (Site Settings → Contact
  Email); the Privacy Policy will automatically show it once set.
- **Verify `/admin/` still loads after deploy** — the scoped CSP was tested
  against Decap's documented requirements, but confirm in the browser. If the
  editor ever shows a blank screen, the fastest fix is to revert the
  `netlify.toml` change and redeploy.

## Honest limitations

- `robots.txt` is advisory; malicious scrapers ignore it. True bot-blocking
  needs Netlify's paid bot protection or a WAF — not warranted for a club site.
- `'unsafe-inline'` is allowed in the CSP because the templates use small inline
  scripts/styles. This is a normal, acceptable trade-off for a brochure site;
  the CSP still blocks all unexpected third-party domains.
