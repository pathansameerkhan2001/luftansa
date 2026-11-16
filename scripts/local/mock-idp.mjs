/**
 * LOCAL-ONLY mock identity provider for admin sign-in during development (D2).
 *
 *   npm run local:idp      -> http://localhost:4010
 *
 * Implements just enough of the Cognito Hosted UI / OAuth endpoints used by
 * src/app/api/auth/* (authorize with PKCE S256, token, JWKS, revoke, logout)
 * for ONE fixed local test identity (admin@luftansa.local).
 *
 * Why it can never be used in production:
 *   - it is a separate process, not part of the deployed Next.js app;
 *   - it only binds to 127.0.0.1 and only redirects to localhost callbacks;
 *   - the app rejects any localhost/non-Cognito issuer or domain in the
 *     production runtime (assertAuthEndpointsForRuntime in src/lib/auth/config.ts).
 * The production Cognito user pool is never contacted or modified.
 */
import { createHash, randomBytes } from "node:crypto";
import http from "node:http";
import { exportJWK, generateKeyPair, SignJWT } from "jose";
import { IDP_PORT, LOCAL_ADMIN_EMAIL, LOCAL_CLIENT_ID } from "./env.mjs";

const ISSUER = `http://localhost:${IDP_PORT}`;
const { privateKey, publicKey } = await generateKeyPair("RS256", { extractable: true });
const jwk = { ...(await exportJWK(publicKey)), kid: "local-mock-key", alg: "RS256", use: "sig" };

const codes = new Map(); // code -> { challenge, nonce, redirectUri, expires }
const refreshTokens = new Set();

const isLocalCallback = (value) => {
  try {
    const u = new URL(value);
    return u.protocol === "http:" && (u.hostname === "localhost" || u.hostname === "127.0.0.1");
  } catch {
    return false;
  }
};
const b64url = (buf) => Buffer.from(buf).toString("base64url");
const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

async function idToken(nonce) {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({ email: LOCAL_ADMIN_EMAIL, email_verified: true, token_use: "id", "cognito:username": "local-admin", ...(nonce ? { nonce } : {}) })
    .setProtectedHeader({ alg: "RS256", kid: jwk.kid })
    .setIssuer(ISSUER)
    .setAudience(LOCAL_CLIENT_ID)
    .setSubject("local-admin")
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(privateKey);
}

function send(res, status, body, headers = {}) {
  res.writeHead(status, { "Cache-Control": "no-store", ...headers });
  res.end(body);
}
const json = (res, status, obj) => send(res, status, JSON.stringify(obj), { "Content-Type": "application/json" });

async function readForm(req) {
  let raw = "";
  for await (const chunk of req) raw += chunk;
  return new URLSearchParams(raw);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", ISSUER);
  try {
    if (req.method === "GET" && url.pathname === "/.well-known/jwks.json") return json(res, 200, { keys: [jwk] });

    if (req.method === "GET" && url.pathname === "/oauth2/authorize") {
      const p = url.searchParams;
      if (p.get("client_id") !== LOCAL_CLIENT_ID || !isLocalCallback(p.get("redirect_uri")) || p.get("code_challenge_method") !== "S256" || !p.get("code_challenge")) {
        return send(res, 400, "Invalid authorization request");
      }
      const hidden = ["redirect_uri", "state", "nonce", "code_challenge"].map((k) => `<input type="hidden" name="${k}" value="${escapeHtml(p.get(k) ?? "")}">`).join("");
      return send(
        res,
        200,
        `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Local admin sign-in</title>
<body style="font-family:system-ui;background:#fffdf8;color:#171717;display:grid;place-items:center;min-height:100vh;margin:0">
<form method="post" action="/oauth2/approve" style="max-width:360px;padding:32px;border:1px solid #c6a76a;border-radius:20px;background:#fff">
<p style="margin:0;font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:#7a5a2b">Local development only</p>
<h1 style="font-size:22px;margin:.4em 0">Mock administrator sign-in</h1>
<p style="font-size:14px;color:#555">Signs in as <b>${LOCAL_ADMIN_EMAIL}</b> on this computer. This page does not exist in production.</p>
${hidden}<button id="approve" style="width:100%;height:44px;border:0;border-radius:12px;background:#171717;color:#fff;font-weight:600">Sign in as local admin</button></form>`,
        { "Content-Type": "text/html; charset=utf-8" },
      );
    }

    if (req.method === "POST" && url.pathname === "/oauth2/approve") {
      const f = await readForm(req);
      const redirectUri = f.get("redirect_uri");
      if (!isLocalCallback(redirectUri)) return send(res, 400, "Invalid redirect");
      const code = b64url(randomBytes(24));
      codes.set(code, { challenge: f.get("code_challenge"), nonce: f.get("nonce"), redirectUri, expires: Date.now() + 120_000 });
      const target = new URL(redirectUri);
      target.searchParams.set("code", code);
      target.searchParams.set("state", f.get("state") ?? "");
      return send(res, 302, "", { Location: target.toString() });
    }

    if (req.method === "POST" && url.pathname === "/oauth2/token") {
      const f = await readForm(req);
      if (f.get("client_id") !== LOCAL_CLIENT_ID) return json(res, 400, { error: "invalid_client" });
      if (f.get("grant_type") === "authorization_code") {
        const entry = codes.get(f.get("code") ?? "");
        codes.delete(f.get("code") ?? "");
        if (!entry || entry.expires < Date.now() || entry.redirectUri !== f.get("redirect_uri")) return json(res, 400, { error: "invalid_grant" });
        const challenge = b64url(createHash("sha256").update(f.get("code_verifier") ?? "").digest());
        if (challenge !== entry.challenge) return json(res, 400, { error: "invalid_grant" });
        const refresh = b64url(randomBytes(32));
        refreshTokens.add(refresh);
        return json(res, 200, { id_token: await idToken(entry.nonce), access_token: b64url(randomBytes(16)), refresh_token: refresh, expires_in: 3600, token_type: "Bearer" });
      }
      if (f.get("grant_type") === "refresh_token") {
        if (!refreshTokens.has(f.get("refresh_token") ?? "")) return json(res, 400, { error: "invalid_grant" });
        return json(res, 200, { id_token: await idToken(), access_token: b64url(randomBytes(16)), expires_in: 3600, token_type: "Bearer" });
      }
      return json(res, 400, { error: "unsupported_grant_type" });
    }

    if (req.method === "POST" && url.pathname === "/oauth2/revoke") {
      const f = await readForm(req);
      refreshTokens.delete(f.get("token") ?? "");
      return send(res, 200, "");
    }

    if (req.method === "GET" && url.pathname === "/logout") {
      const target = url.searchParams.get("logout_uri");
      return send(res, 302, "", { Location: isLocalCallback(target) ? target : "http://localhost:3000/" });
    }

    return send(res, 404, "Not found");
  } catch (e) {
    console.error("[local:idp] error:", e?.name ?? e);
    return send(res, 500, "Mock IdP error");
  }
});

server.listen(IDP_PORT, "127.0.0.1", () => console.log(`[local:idp] Mock admin identity provider on ${ISSUER} (local only)`));
