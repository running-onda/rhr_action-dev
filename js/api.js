// GAS Web App API client (minimal)
// - Uses window.APP_ENV.apiUrl / apiToken
// - POST JSON: { token, action, ...payload }

export function getEnv() {
  return (typeof window !== "undefined" && window.APP_ENV) ? window.APP_ENV : {};
}

export function getApiConfig() {
  const env = getEnv();
  return {
    apiUrl: String(env.apiUrl || "").trim(),
    apiToken: String(env.apiToken || "").trim()
  };
}

export async function apiCall(action, payload = {}) {
  const { apiUrl, apiToken } = getApiConfig();
  if (!apiUrl) {
    throw new Error("API_URL_NOT_SET");
  }
  if (!apiToken) {
    throw new Error("API_TOKEN_NOT_SET");
  }

  const res = await fetch(apiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: apiToken, action, ...payload })
  });

  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`API_BAD_JSON: ${text.slice(0, 200)}`);
  }

  if (!res.ok) {
    throw new Error(`API_HTTP_${res.status}`);
  }
  if (!json || json.ok !== true) {
    const code = json && json.error ? json.error : "API_ERROR";
    const msg = json && json.message ? json.message : "";
    throw new Error(`${code}${msg ? `: ${msg}` : ""}`);
  }
  return json.data;
}

