import { authApiUrl } from "../lib/firebaseAdmin.ts";
import { firebaseWebKey } from "../lib/firebaseSession.ts";
import { ApiError, body, endpoint, text, verifiedAccount } from "../lib/http.ts";

export default endpoint(["POST"], async (request) => {
  const key = firebaseWebKey();
  const input = await body(request);
  const token = text(input.refreshToken, "refreshToken", 4096);
  const response = await fetch(`${authApiUrl("securetoken", "token")}?key=${key}`, {
    method: "POST",
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: token }),
  });
  if (!response.ok) throw new ApiError(401, "Session expired");
  const data = await response.json();
  await verifiedAccount(data.id_token);
  return { idToken: data.id_token, refreshToken: data.refresh_token, expiresIn: data.expires_in };
});
