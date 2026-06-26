import { onRequest as authHandler } from "./functions/api/auth.js";
import { onRequest as callbackHandler } from "./functions/api/callback.js";

const ADMIN_CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://unpkg.com",
  "style-src 'self' 'unsafe-inline' https://unpkg.com https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com https://unpkg.com",
  "img-src 'self' data: blob: https:",
  "connect-src 'self' blob: data: https://unpkg.com https://api.github.com https://*.githubusercontent.com",
  "frame-src 'self'",
  "worker-src 'self' blob:",
  "child-src 'self' blob:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
].join("; ");

const SITE_CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data:",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const SECURITY_HEADERS = {
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
};

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

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

    return newResponse;
  },
};
