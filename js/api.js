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

function isLikelyCorsFailure(err) {
  // fetch() often throws TypeError on CORS/network failures
  return err && (err.name === "TypeError" || String(err.message || "").includes("Failed to fetch"));
}

const GAS_DEPLOY_HINT =
  "GAS側に Code.gs が反映されていません。Apps Script エディタで gas/Code.gs を貼り付けて保存し、Webアプリを「新バージョン」で再デプロイしてください。";

function formatApiError(err, fallback = "API_ERROR") {
  const msg = String(err && err.message ? err.message : err || fallback);
  if (
    msg.includes("API_JSONP_LOAD_FAILED") ||
    msg.includes("doGet") ||
    msg.includes("doPost") ||
    msg.includes(GAS_DEPLOY_HINT)
  ) {
    return msg.includes(GAS_DEPLOY_HINT) ? msg : `${msg}\n\n${GAS_DEPLOY_HINT}`;
  }
  return msg;
}

export { formatApiError };

async function probeGasHtmlError(apiUrl, apiToken, action) {
  try {
    const u = new URL(apiUrl);
    u.searchParams.set("token", apiToken);
    u.searchParams.set("action", action);
    u.searchParams.set("limit", "1");
    const res = await fetch(u.toString(), { method: "GET", mode: "cors" });
    const text = await res.text();
    if (/スクリプト関数が見つかりません|Script function not found/i.test(text)) {
      return GAS_DEPLOY_HINT;
    }
    if (/INVALID_TOKEN/i.test(text)) {
      return "API_TOKEN が一致しません。env.js の apiToken と GAS の API_TOKEN を同じ値にしてください。";
    }
  } catch {
    // ignore probe failures
  }
  return "";
}

function buildJsonpUrl(apiUrl, apiToken, action, payload, callbackName) {
  const u = new URL(apiUrl);
  u.searchParams.set("token", apiToken);
  u.searchParams.set("action", action);
  u.searchParams.set("callback", callbackName);
  Object.entries(payload || {}).forEach(([k, v]) => {
    if (v === undefined || v === null) return;
    u.searchParams.set(k, String(v));
  });
  return u.toString();
}

async function jsonpCall(apiUrl, apiToken, action, payload = {}) {
  const cb = `__rhr_jsonp_${Math.random().toString(36).slice(2)}`;
  const url = buildJsonpUrl(apiUrl, apiToken, action, payload, cb);

  return await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => cleanup(new Error("API_TIMEOUT")), 15000);

    function cleanup(err, data) {
      clearTimeout(timeout);
      try {
        delete window[cb];
      } catch {
        window[cb] = undefined;
      }
      script.remove();
      if (err) reject(err);
      else resolve(data);
    }

    window[cb] = (json) => {
      try {
        if (!json || json.ok !== true) {
          const code = json && json.error ? json.error : "API_ERROR";
          const msg = json && json.message ? json.message : "";
          cleanup(new Error(`${code}${msg ? `: ${msg}` : ""}`));
          return;
        }
        cleanup(null, json.data);
      } catch (e) {
        cleanup(e);
      }
    };

    const script = document.createElement("script");
    script.src = url;
    script.async = true;
    script.onerror = async () => {
      const hint = await probeGasHtmlError(apiUrl, apiToken, action);
      cleanup(new Error(hint || "API_JSONP_LOAD_FAILED"));
    };
    document.head.appendChild(script);
  });
}

export async function apiCall(action, payload = {}) {
  const { apiUrl, apiToken } = getApiConfig();
  if (!apiUrl) {
    throw new Error("API_URL_NOT_SET");
  }
  if (!apiToken) {
    throw new Error("API_TOKEN_NOT_SET");
  }

  try {
    const res = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: apiToken, action, ...payload })
    });

    const text = await res.text();
    if (/Script function not found|スクリプト関数が見つかりません/i.test(text)) {
      throw new Error(GAS_DEPLOY_HINT);
    }
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      throw new Error(`API_BAD_JSON: ${text.slice(0, 200)}`);
    }

    if (!res.ok) throw new Error(`API_HTTP_${res.status}`);
    if (!json || json.ok !== true) {
      const code = json && json.error ? json.error : "API_ERROR";
      const msg = json && json.message ? json.message : "";
      throw new Error(`${code}${msg ? `: ${msg}` : ""}`);
    }
    return json.data;
  } catch (err) {
    if (!isLikelyCorsFailure(err)) throw err;

    // Fallback: JSONP GET for supported actions
    const jsonpSupported = new Set(["createRoom", "getRooms", "getAssessment", "getRoomSummary"]);
    if (jsonpSupported.has(action)) {
      return await jsonpCall(apiUrl, apiToken, action, payload);
    }

    // Last resort: fire-and-forget no-cors (cannot read response)
    if (action === "saveAssessment" || action === "saveAssessmentBatch") {
      await fetch(apiUrl, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: apiToken, action, ...payload })
      });
      return { ok: true };
    }

    throw err;
  }
}

