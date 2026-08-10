// Cloudflare Worker entry point.
//
// The site is built by Eleventy into _site/ and served as static assets by the
// ASSETS binding. This Worker exists for two reasons: the GitHub-login routes
// that Decap CMS needs (/api/auth, /api/callback), and the security headers
// applied to every static response below.
//
// Those headers ARE the security control here. There is no server of ours to
// attack — so instead we constrain what a browser is willing to do with our
// pages. Reference: https://owasp.org/www-project-secure-headers/

import { onRequest as authHandler } from "./functions/api/auth.js";
import { onRequest as callbackHandler } from "./functions/api/callback.js";

// The CMS admin panel legitimately needs to load Decap from a CDN, spin up web
// workers (blob:), and talk to the GitHub API. This policy is exactly what
// Decap requires and nothing more. It is scoped to /admin only — the public
// site never gets these relaxations.
//
// fonts.googleapis.com / fonts.gstatic.com are deliberately NOT listed. The
// admin panel's live preview pane used to load the site's fonts from Google
// separately from the site's own stylesheet; now that styles.css self-hosts
// them (see the font-face comment at the top of that file), the preview gets
// them for free from 'self' and the two Google origins have nothing left to
// do here. If Decap or a future admin feature ever needs Google Fonts again,
// add both back — but check first, since that is what let this drift silently
// out of date before.
const ADMIN_CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://unpkg.com",
  "style-src 'self' 'unsafe-inline' https://unpkg.com",
  "font-src 'self' data: https://unpkg.com",
  "img-src 'self' data: blob: https:",
  "connect-src 'self' blob: data: https://unpkg.com https://api.github.com https://*.githubusercontent.com",
  "frame-src 'self'",
  "worker-src 'self' blob:",
  "child-src 'self' blob:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

// Public site.
//
// `frame-src` is NOT optional and must list the video host explicitly. Without
// it the directive falls back to `default-src 'self'`, which silently blocks
// every embedded competition final — the CMS offers "GH Cup Final Videos" and
// "Mini Moot Final Videos" collections, so the first video an exec adds would
// render as an empty box with nothing but a console error to explain it.
//
// youtube-nocookie.com is used rather than youtube.com: same player, but it
// does not write tracking cookies until the visitor actually presses play,
// which is what the privacy policy tells people we do.
//
// 'unsafe-inline' in script-src is a knowing trade-off: the templates carry a
// handful of small inline scripts (nav toggle, photo lightbox, exec carousel).
// Nonces would mean giving up static hosting for marginal benefit on a
// brochure site. The policy still blocks every unexpected third-party origin,
// which is the win that matters.
//
// fonts.googleapis.com / fonts.gstatic.com are gone from here entirely — the
// fonts are self-hosted under /assets/fonts/ now (see styles.css), so 'self'
// already covers font-src and there is no longer a second origin for
// style-src to admit. This was the site's last third-party request on a
// normal page load; removing it means a visitor's IP no longer reaches Google
// just to render text.
const SITE_CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self'",
  "img-src 'self' data: https://i.ytimg.com",
  "connect-src 'self'",
  "frame-src 'self' https://www.youtube-nocookie.com",
  "media-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  "upgrade-insecure-requests",
].join("; ");

const SECURITY_HEADERS = {
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
  // Switch off browser features the site never uses, so a future injected
  // script can't reach for them either.
  "Permissions-Policy":
    "camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=(), interest-cohort=()",
  "X-DNS-Prefetch-Control": "off",
  // "-allow-popups", NOT plain "same-origin" — read before changing.
  //
  // The CMS login is a popup that navigates away to github.com and back. Plain
  // `same-origin` severs the opener relationship the moment the popup lands on
  // a cross-origin document, which would leave the popup unable to hand the
  // token back and the editor stuck on a spinner forever. The
  // "-allow-popups" variant keeps popups this document opened usable while
  // still isolating us from anything that tries to open US.
  "Cross-Origin-Opener-Policy": "same-origin-allow-popups",
};

// ---------------------------------------------------------------------------
// Permanent redirects for pages that have moved.
//
// A page's address is its filename, and several files were named after a role
// rather than a person — /team/mooting-director/ was the President's profile,
// /team/president/ was a VP's. Others carried a year that disagreed with the
// entry ( /achievements/highland-cup-2026/ showed "Highland Cup 2024" ).
// Renaming them was the fix, but any link already shared — in a group chat, an
// Instagram bio, a message to a prospective member — would otherwise now 404.
//
// 301 rather than 302: the move is permanent, and it tells search engines to
// transfer the old address's standing to the new one instead of treating them
// as two competing pages.
//
// These can be deleted once they stop being requested, but they cost nothing.
// ---------------------------------------------------------------------------
const REDIRECTS = {
  "/team/mooting-director/": "/team/kate-hilton/",
  "/team/president/": "/team/francesco-deleo/",
  "/team/secretary/": "/team/tala-taha/",
  "/team/vp/": "/team/muhammad-ali/",
  "/achievements/highland-cup-2026/": "/achievements/highland-cup-2024/",
  "/achievements/gryphons-cup-2026-1/": "/achievements/gryphons-cup-2025/",
  "/achievements/humber-cup-2026/": "/achievements/humber-cup-2025/",
  "/achievements/western-cup-2026/": "/achievements/western-cup-2025/",
};

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Match with and without the trailing slash, so both forms of an old link
    // land in the right place.
    const target =
      REDIRECTS[url.pathname] ||
      (url.pathname.endsWith("/") ? null : REDIRECTS[url.pathname + "/"]);
    if (target) {
      return Response.redirect(new URL(target, url.origin).toString(), 301);
    }

    // The OAuth routes set their own headers — including no-store, which the
    // static-asset headers below do not apply. Return them untouched rather
    // than merging, so nothing here can weaken the token-handling response.
    if (url.pathname === "/api/auth") {
      return authHandler({ request, env, ctx });
    }
    if (url.pathname === "/api/callback") {
      return callbackHandler({ request, env, ctx });
    }

    const response = await env.ASSETS.fetch(request);
    const newResponse = new Response(response.body, response);

    for (const [k, v] of Object.entries(SECURITY_HEADERS)) {
      newResponse.headers.set(k, v);
    }

    const isAdmin = url.pathname.startsWith("/admin");
    newResponse.headers.set("Content-Security-Policy", isAdmin ? ADMIN_CSP : SITE_CSP);

    // The admin panel must never be cached — a stale Decap bundle against a
    // changed config.yml is a confusing, hard-to-diagnose failure.
    if (isAdmin) {
      newResponse.headers.set("Cache-Control", "no-store");
    } else if (/\/assets\/uploads\/resized\//.test(url.pathname)) {
      // Generated image variants are content-addressed by filename (the width
      // is in the name) and are regenerated under a new name if the source
      // changes, so they are safe to cache hard. This is a large part of why
      // a repeat visit on a phone is fast.
      newResponse.headers.set("Cache-Control", "public, max-age=31536000, immutable");
    } else if (/\/assets\/fonts\//.test(url.pathname)) {
      // Font files, deliberately NOT `immutable` like the resized images
      // above. Those are safe to cache forever because the width is baked
      // into the filename — a changed photo gets a new name. A font file's
      // name stays `inter-normal-latin.woff2` even if it is later
      // regenerated with a different weight range or subset, so a visitor
      // whose browser cached the old bytes for a year would keep silently
      // serving the wrong font from cache with nothing to invalidate it. A
      // 30-day cache still means a returning visitor almost never re-fetches
      // — these files change on the order of once a year, by hand — without
      // that failure mode.
      newResponse.headers.set("Cache-Control", "public, max-age=2592000");
    }

    return newResponse;
  },
};
