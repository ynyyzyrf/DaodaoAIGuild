type UnknownRecord = Record<string, unknown>;

export interface OmeLoginResult {
  accessToken: string;
}

const OME_AUTHORIZATION_API = (process.env.NEXT_PUBLIC_OME_AUTHORIZATION_API ?? "").trim();
const OME_PASSWORD_FLOW_APP_ID = (process.env.NEXT_PUBLIC_OME_PASSWORD_FLOW_APP_ID ?? "").trim();
const OME_PASSWORD_FLOW_APP_SECRET = (process.env.NEXT_PUBLIC_OME_PASSWORD_FLOW_APP_SECRET ?? "").trim();
const OME_PASSWORD_FLOW_SCOPES = (process.env.NEXT_PUBLIC_OME_PASSWORD_FLOW_SCOPES ?? "").trim();

function trimSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

async function readJson(res: Response, fallback: string): Promise<UnknownRecord> {
  try {
    const body = await res.json();
    if (body && typeof body === "object" && !Array.isArray(body)) {
      return body as UnknownRecord;
    }
  } catch {
    // Ignore non-JSON response bodies from upstream services.
  }
  throw new Error(fallback);
}

async function readError(res: Response, fallback: string): Promise<string> {
  try {
    const body = await res.json();
    if (body && typeof body === "object") {
      const record = body as UnknownRecord;
      return String(record.message || record.error_description || record.error || fallback);
    }
  } catch {
    // Ignore non-JSON error bodies.
  }
  return fallback;
}

export function isOmeAccountConfigured(): boolean {
  return Boolean(OME_AUTHORIZATION_API);
}

export async function loginWithOmeAccount(username: string, password: string): Promise<OmeLoginResult> {
  const authorizationApi = trimSlash(OME_AUTHORIZATION_API);
  if (!authorizationApi) {
    throw new Error("帳號登入尚未配置完成");
  }

  const form = new URLSearchParams();
  form.set("grant_type", "password");
  form.set("username", username);
  form.set("password", password);

  if (OME_PASSWORD_FLOW_APP_ID) form.set("client_id", OME_PASSWORD_FLOW_APP_ID);
  if (OME_PASSWORD_FLOW_APP_SECRET) form.set("client_secret", OME_PASSWORD_FLOW_APP_SECRET);
  if (OME_PASSWORD_FLOW_SCOPES) form.set("scope", OME_PASSWORD_FLOW_SCOPES);

  const tokenRes = await fetch(`${authorizationApi}/connect/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: form,
  });
  if (!tokenRes.ok) {
    throw new Error(await readError(tokenRes, "登入失敗，請確認帳號或密碼"));
  }

  const tokenBody = await readJson(tokenRes, "登入服務返回格式不正確");
  const accessToken = String(tokenBody.access_token || "");
  if (!accessToken) {
    throw new Error("登入服務未返回有效憑證");
  }

  localStorage.setItem("external_token", accessToken);

  return { accessToken };
}
