// Cloudflare Worker entry point.
//
// Static files (the built Eleventy site in _site/) are served by the ASSETS
// binding. This Worker only intercepts the two GitHub-login endpoints used by
// Decap CMS; everything else falls through to the static site.
import { onRequest as authHandler } from "./functions/api/auth.js";
import { onRequest as callbackHandler } from "./functions/api/callback.js";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === "/api/auth") {
      return authHandler({ request, env, ctx });
    }
    if (url.pathname === "/api/callback") {
      return callbackHandler({ request, env, ctx });
    }

    // Everything else: serve the static site.
    return env.ASSETS.fetch(request);
  },
};
