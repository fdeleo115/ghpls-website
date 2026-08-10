// Cloudflare Worker route — starts the GitHub OAuth login for Decap CMS.
// Reads two environment variables set in the Cloudflare dashboard:
//   GITHUB_OAUTH_CLIENT_ID
//   GITHUB_OAUTH_CLIENT_SECRET   (used by the callback, not here)
//
// Route: /api/auth  (Decap opens this in a popup when an editor clicks "Login")

// ---------------------------------------------------------------------------
// SCOPE: public_repo, deliberately — do not widen this to `repo`.
//
// `repo` grants read AND write access to EVERY repository the signed-in person
// owns or can push to, public and private, for as long as the token lives. This
// site's content lives in one public repo, so `public_repo` is the whole job.
// The difference matters because the token is handed to a browser: anything
// that gets hold of it inherits whatever the scope allows, and the blast radius
// of a leak should stop at this website rather than reaching an exec's personal
// and coursework repositories.
//
// The `user` scope was also removed. Decap only needs it to display an avatar,
// which is not worth read access to profile and email data.
// ---------------------------------------------------------------------------
const OAUTH_SCOPE = "public_repo";

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  const clientId = env.GITHUB_OAUTH_CLIENT_ID;
  if (!clientId) {
    return new Response(
      "Missing GITHUB_OAUTH_CLIENT_ID. Set it in the Cloudflare dashboard → Workers & Pages → ghpls → Settings → Variables.",
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }

  // Random state to protect against CSRF; echoed back and checked in callback.
  const state = crypto.randomUUID();
  const redirectUri = `${url.origin}/api/callback`;

  const authorize = new URL("https://github.com/login/oauth/authorize");
  authorize.searchParams.set("client_id", clientId);
  authorize.searchParams.set("redirect_uri", redirectUri);
  authorize.searchParams.set("scope", OAUTH_SCOPE);
  authorize.searchParams.set("state", state);

  return new Response(null, {
    status: 302,
    headers: {
      Location: authorize.toString(),
      // Nothing about this redirect is cacheable — it carries a one-time state.
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
      // The `__Host-` prefix is enforced by the browser: it will only accept the
      // cookie if it is Secure, has Path=/, and carries no Domain attribute.
      // That makes it impossible for a subdomain to set or overwrite this
      // cookie, which is exactly the trick that would otherwise let an attacker
      // fix the CSRF state to a value they know.
      "Set-Cookie": `__Host-csrf_state=${state}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=600`,
    },
  });
}
