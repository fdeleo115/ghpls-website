// Cloudflare Pages Function — finishes the GitHub OAuth login for Decap CMS.
// GitHub redirects the popup here with ?code=...&state=...; we swap the code
// for an access token (server-side, so the secret never reaches the browser)
// and hand it back to the Decap window via postMessage.
//
// Route: /api/callback   (this exact URL must be the GitHub OAuth App's
// "Authorization callback URL")

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  const clientId = env.GITHUB_OAUTH_CLIENT_ID;
  const clientSecret = env.GITHUB_OAUTH_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return new Response(
      "Missing GitHub OAuth env vars (GITHUB_OAUTH_CLIENT_ID / GITHUB_OAUTH_CLIENT_SECRET).",
      { status: 500 }
    );
  }

  // Verify the state cookie set in /api/auth (CSRF protection).
  const cookie = request.headers.get("Cookie") || "";
  const savedState = (cookie.match(/csrf_state=([^;]+)/) || [])[1];
  if (!code || !state || state !== savedState) {
    return new Response("Invalid OAuth state. Please try logging in again.", {
      status: 400,
    });
  }

  // Exchange the code for an access token.
  const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: `${url.origin}/api/callback`,
    }),
  });

  const data = await tokenRes.json();

  const result = data && data.access_token
    ? { token: data.access_token, provider: "github" }
    : { error: (data && data.error_description) || "No access token returned" };

  const status = data && data.access_token ? "success" : "error";

  // Decap listens for a postMessage of the form
  // "authorization:github:success:{...json...}" from the popup, then closes it.
  const page = `<!doctype html><html><body>
<script>
  (function () {
    function send(e) {
      window.opener && window.opener.postMessage(
        'authorization:github:${status}:${JSON.stringify(result).replace(/'/g, "\\'")}',
        e && e.origin ? e.origin : '*'
      );
    }
    window.addEventListener('message', function (e) { send(e); }, false);
    // Kick off the handshake; Decap replies, then we re-send to its origin.
    window.opener && window.opener.postMessage('authorizing:github', '*');
    setTimeout(function () { send(); }, 500);
  })();
</script>
<p>Login complete. You can close this window.</p>
</body></html>`;

  return new Response(page, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      // Clear the state cookie.
      "Set-Cookie": "csrf_state=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0",
    },
  });
}
