# Security — GHPLS Website

_Last reviewed: August 2026_

This document describes how this website is actually built and hosted, what the
real security controls are, and what a future executive needs to know to keep it
safe. It is written to be understood by a non-technical exec.

**If you are handing this site over to someone new, this is the page they should
read first.**

## Reporting a problem

If you believe you have found a security problem with this site, email the
Society (the address on the [contact page](https://ghpls.fdeleo115.workers.dev/contact/))
with the word **SECURITY** in the subject line. Please describe what you found
and how to reproduce it, and give us a reasonable chance to fix it before
sharing it publicly. We are a student club, not a company with a bug bounty —
but we will take a genuine report seriously and credit you if you would like.

## What this site actually is

- **Eleventy** turns Markdown and templates into plain HTML files.
- Those files are served by a **Cloudflare Worker** (`worker.js`), which also
  applies the security headers described below.
- Content is edited through **Decap CMS** at `/admin/`.
- Editors log in with **GitHub**. There is no separate password to manage.
- Publishing a change in the CMS writes a commit to the
  **`fdeleo115/ghpls-website`** repository on GitHub, and a GitHub Action
  rebuilds and redeploys the site.

There is no database, no user accounts, and no form that posts back to us.
Whole categories of vulnerability (SQL injection, server compromise, leaked
database credentials) cannot exist here, because the components they attack do
not exist.

> **Historical note.** This site previously ran on Netlify with Netlify
> Identity and Netlify Forms. None of that is true any more. If you find
> documentation, config, or a comment that mentions Netlify, it is stale —
> please fix or delete it.

## The single most important control: who can log in

**Access to the CMS is exactly "who has write access to the GitHub repository."**
There is no other list. If someone can push to `fdeleo115/ghpls-website`, they
can publish anything to this website; if they cannot, they cannot log in at all.

This means the annual handover checklist is:

1. **Add the incoming exec** to the repository (GitHub → Settings → Collaborators).
2. **Remove the outgoing exec.** This is the step that gets forgotten. A
   graduated exec who still has write access still has full control of the
   website.
3. **Confirm the repository owner account has two-factor authentication on.**
   That account is the root of trust for the entire site.
4. Check the collaborator list has nobody on it you cannot name.

## Security controls in place

### HTTP security headers (`worker.js`)

Applied to every response. These are the primary real control for a static
site — there is no server of ours to attack, so we constrain what a browser
will do with our pages instead.

| Header | What it does |
| --- | --- |
| `Content-Security-Policy` | Allows only the external origins we actually use (Google Fonts, YouTube for competition videos). Blocks everything else, including any injected script trying to phone home. |
| `X-Frame-Options` + `frame-ancestors 'none'` | Stops other sites embedding ours in an iframe (clickjacking). |
| `Strict-Transport-Security` | Forces HTTPS for two years. |
| `X-Content-Type-Options: nosniff` | Stops browsers second-guessing a file's declared type. |
| `Referrer-Policy` | Stops full URLs leaking to other sites. |
| `Permissions-Policy` | Switches off camera, microphone, geolocation, payment and other APIs the site never uses. |
| `Cross-Origin-Opener-Policy` | Isolates our pages from any site that opens them. |

A separate, deliberately looser CSP is scoped to `/admin/*`, because Decap CMS
needs to load from a CDN and talk to the GitHub API. That relaxation applies to
the admin panel only and never to a public page.

> **These headers were not actually live until August 2026, and it is worth
> understanding why.** They had been configured properly on Netlify. After the
> move to Cloudflare they were re-written into `worker.js` and looked correct —
> but Workers Static Assets serves a matching file *directly* and only falls
> through to the Worker when nothing matches. Every real page matched a file, so
> the Worker never ran, and the site served no security headers at all. Nothing
> about the site looked wrong.
>
> The fix is `run_worker_first = true` in `wrangler.toml`. **Do not remove that
> line.** If you are ever unsure whether the headers are live, check rather than
> assume:
>
> ```
> curl -sD- -o /dev/null https://ghpls.fdeleo115.workers.dev/ | grep -i content-security
> ```
>
> If that prints nothing, the headers are off.

### OAuth login (`functions/api/auth.js`, `functions/api/callback.js`)

Two small routes handle the GitHub login. Both carry security decisions that
are documented in comments **in the files themselves** — read those before
changing either one. In short:

- The login requests **`public_repo` scope only**, so a stolen token cannot
  reach an exec's private or coursework repositories.
- The callback hands the token back to **this site's own origin only**. It must
  never use a wildcard origin, and must never send to the origin of an inbound
  message. Both were real vulnerabilities that allowed any website to steal a
  logged-in exec's GitHub token.
- The token-bearing response is `no-store` and carries its own strict CSP.
- The CSRF cookie uses the `__Host-` prefix so no subdomain can overwrite it.

### Other measures

- **`robots.txt`** keeps `/admin/` out of search results and opts out of the
  major AI-training crawlers.
- **Git hygiene** — `node_modules/`, `_site/`, and any `.env` file are
  gitignored. A full-repo scan finds no API keys or secrets; the two OAuth
  secrets live in Cloudflare's environment variables, not in the code.
- **Legal pages** — Privacy Policy, Terms of Use, and an Accessibility
  statement, linked in the footer, plus a "not affiliated with the University"
  disclaimer on every page.

## Honest limitations

- **`robots.txt` is advisory.** Well-behaved crawlers obey it; malicious
  scrapers ignore it entirely. Real bot-blocking needs a WAF, which is not
  warranted here.
- **`'unsafe-inline'` is allowed for scripts.** The templates use small inline
  scripts. Removing this would mean giving up static hosting for marginal
  benefit. The CSP still blocks every unexpected third-party origin.
- **Editors are trusted.** Anyone who can log in to the CMS can publish
  arbitrary content, including content that would break the page. This is
  inherent to giving people an editor, and is why the collaborator list matters
  more than any header in this document.
- **We have had no external security audit.** This document reflects our own
  review.

## If something goes wrong

1. **Suspected stolen GitHub token:** the exec should revoke it immediately at
   GitHub → Settings → Applications → Authorized OAuth Apps, and change their
   GitHub password.
2. **Unexpected content on the site:** check the repository's commit history —
   every CMS publish is a commit with an author. Revert the commit and remove
   that person's access.
3. **Site down or defaced:** the entire site can be rebuilt from the repository.
   Nothing about it is unrecoverable so long as the GitHub repository is intact.
