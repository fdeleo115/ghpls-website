// Cloudflare Worker route — finishes the GitHub OAuth login for Decap CMS.
// GitHub redirects the popup here with ?code=...&state=...; we swap the code
// for an access token (server-side, so the client secret never reaches the
// browser) and hand the token back to the Decap window via postMessage.
//
// Route: /api/callback   (this exact URL must be the GitHub OAuth App's
// "Authorization callback URL")
//
// ---------------------------------------------------------------------------
// SECURITY: the target origin below is NOT negotiable — read this before
// touching the postMessage calls.
//
// This page holds a live GitHub access token. An earlier version posted it with
// a target origin of '*' and additionally echoed it back to the origin of any
// inbound message. Both are token-exfiltration holes, and neither is closed by
// the CSRF state check, because an attacker does not need to forge the flow —
// they just start the real one:
//
//   1. attacker page calls window.open('https://<site>/api/auth')
//   2. an exec who has already authorised the OAuth app is redirected straight
//      through GitHub with no consent prompt (re-auth is silent)
//   3. GitHub sends them here, the state cookie matches because /api/auth set
//      it moments earlier, and this page posts the token to window.opener
//   4. window.opener is the ATTACKER'S page
//
// Posting to a fixed, same-origin target means step 4 silently drops the
// message instead: the browser refuses to deliver it to any other origin. The
// only legitimate opener is /admin/ on this same site, so the fixed origin
// costs the real flow nothing.
//
// Do not reintroduce '*', and do not derive the target from an inbound
// message's origin — that is the same hole wearing a different hat.
// ---------------------------------------------------------------------------

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  const clientId = env.GITHUB_OAUTH_CLIENT_ID;
  const clientSecret = env.GITHUB_OAUTH_CLIENT_SECRET;

  // A response carrying a token must never be stored by a browser, a proxy or
  // a CDN. Applied to every branch below, including the error ones, so a
  // failure path can't quietly become the cacheable exception.
  const noStore = {
    "Cache-Control": "no-store, no-cache, must-revalidate, private",
    Pragma: "no-cache",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    // This page runs exactly one inline script, talks to nobody, and must never
    // be framed. Nothing looser is needed, so nothing looser is allowed.
    "Content-Security-Policy":
      "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
  };

  if (!clientId || !clientSecret) {
    return new Response(
      "Missing GitHub OAuth env vars (GITHUB_OAUTH_CLIENT_ID / GITHUB_OAUTH_CLIENT_SECRET).",
      { status: 500, headers: noStore }
    );
  }

  // Verify the state cookie set in /api/auth (CSRF protection).
  const cookie = request.headers.get("Cookie") || "";
  const savedState = (cookie.match(/__Host-csrf_state=([^;]+)/) || [])[1];
  if (!code || !state || !savedState || state !== savedState) {
    return new Response("Invalid OAuth state. Please try logging in again.", {
      status: 400,
      headers: noStore,
    });
  }

  // Exchange the code for an access token.
  const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "User-Agent": "ghpls-website",
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: `${url.origin}/api/callback`,
    }),
  });

  let data = null;
  try {
    data = await tokenRes.json();
  } catch (e) {
    data = null;
  }

  const token = data && data.access_token;
  const status = token ? "success" : "error";
  const result = token
    ? { token, provider: "github" }
    : { error: (data && data.error_description) || "No access token returned" };

  // The payload is embedded in an inline script, so it is serialised as JSON
  // and then escaped for a JS string context. JSON.stringify alone is NOT
  // enough: an error_description containing "</script>" would close the script
  // element early, and U+2028/U+2029 are literal line terminators in JS source
  // even though JSON permits them raw.
  const payload = JSON.stringify(JSON.stringify(result))
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");

  // Decap listens for "authorization:github:success:{...json...}" from the
  // popup, then closes it. The handshake is: we announce, Decap answers, we
  // send. The answer is only used as a readiness signal — the destination is
  // always this site's own origin, never the sender's.
  const page = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Signing in…</title></head><body>
<script>
  (function () {
    var ORIGIN = ${JSON.stringify(url.origin)};
    var MESSAGE = 'authorization:github:${status}:' + ${payload};
    var sent = false;
    function send() {
      if (sent || !window.opener) return;
      sent = true;
      window.opener.postMessage(MESSAGE, ORIGIN);
    }
    window.addEventListener('message', function (e) {
      // Only our own admin page can trigger the send, and the reply goes to a
      // fixed origin regardless of who asked.
      if (e.origin === ORIGIN) send();
    }, false);
    if (window.opener) window.opener.postMessage('authorizing:github', ORIGIN);
    // Fallback for the case where Decap never answers the handshake.
    setTimeout(send, 500);
  })();
</script>
<p>Login complete. You can close this window.</p>
</body></html>`;

  return new Response(page, {
    headers: Object.assign({}, noStore, {
      "Content-Type": "text/html; charset=utf-8",
      // Clear the state cookie — it is single-use.
      "Set-Cookie":
        "__Host-csrf_state=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0",
    }),
  });
}
