// Cloudflare Pages Function — starts the GitHub OAuth login for Decap CMS.
// Reads two environment variables you set in the Cloudflare dashboard:
//   GITHUB_OAUTH_CLIENT_ID
//   GITHUB_OAUTH_CLIENT_SECRET   (used by the callback, not here)
//
// Route: /api/auth  (Decap opens this in a popup when an editor clicks "Login")

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  const clientId = env.GITHUB_OAUTH_CLIENT_ID;
  if (!clientId) {
    return new Response(
      "Missing GITHUB_OAUTH_CLIENT_ID. Set it in Cloudflare Pages → Settings → Environment variables.",
      { status: 500 }
    );
  }

  // Random state to protect against CSRF; echoed back and checked in callback.
  const state = crypto.randomUUID();
  const redirectUri = `${url.origin}/api/callback`;

  const authorize = new URL("https://github.com/login/oauth/authorize");
  authorize.searchParams.set("client_id", clientId);
  authorize.searchParams.set("redirect_uri", redirectUri);
  authorize.searchParams.set("scope", "repo,user");
  authorize.searchParams.set("state", state);

  return new Response(null, {
    status: 302,
    headers: {
      Location: authorize.toString(),
      // Remember the state in a short-lived, http-only cookie.
      "Set-Cookie": `csrf_state=${state}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=600`,
    },
  });
}
