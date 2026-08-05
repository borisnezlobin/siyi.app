import { createPrivateKey, createSign } from "node:crypto";

function base64Url(value: string | Buffer) {
  return Buffer.from(value)
    .toString("base64")
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
}

function appleConfiguration() {
  const clientId = process.env.APPLE_CLIENT_ID?.trim();
  const teamId = process.env.APPLE_TEAM_ID?.trim();
  const keyId = process.env.APPLE_KEY_ID?.trim();
  const privateKey = process.env.APPLE_PRIVATE_KEY?.replaceAll("\\n", "\n");
  if (!clientId || !teamId || !keyId || !privateKey) return null;
  return { clientId, teamId, keyId, privateKey };
}

function createAppleClientSecret(
  configuration: NonNullable<ReturnType<typeof appleConfiguration>>,
) {
  const issuedAt = Math.floor(Date.now() / 1000);
  const header = base64Url(
    JSON.stringify({
      alg: "ES256",
      kid: configuration.keyId,
      typ: "JWT",
    }),
  );
  const payload = base64Url(
    JSON.stringify({
      iss: configuration.teamId,
      iat: issuedAt,
      exp: issuedAt + 300,
      aud: "https://appleid.apple.com",
      sub: configuration.clientId,
    }),
  );
  const signingInput = `${header}.${payload}`;
  const signer = createSign("SHA256");
  signer.update(signingInput);
  signer.end();
  const signature = signer.sign({
    key: createPrivateKey(configuration.privateKey),
    dsaEncoding: "ieee-p1363",
  });
  return `${signingInput}.${base64Url(signature)}`;
}

export async function revokeAppleAuthorizationCode(code: string) {
  const configuration = appleConfiguration();
  if (!configuration) return false;
  const clientSecret = createAppleClientSecret(configuration);
  const tokenResponse = await fetch("https://appleid.apple.com/auth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: configuration.clientId,
      client_secret: clientSecret,
      code,
      grant_type: "authorization_code",
    }),
  });
  if (!tokenResponse.ok) return false;

  const tokenPayload = (await tokenResponse.json()) as {
    access_token?: string;
    refresh_token?: string;
  };
  const token = tokenPayload.refresh_token || tokenPayload.access_token;
  if (!token) return false;

  const revokeResponse = await fetch("https://appleid.apple.com/auth/revoke", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: configuration.clientId,
      client_secret: clientSecret,
      token,
      token_type_hint: tokenPayload.refresh_token
        ? "refresh_token"
        : "access_token",
    }),
  });
  return revokeResponse.ok;
}
