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

function buildFormFields(apiToken, action, payload = {}) {
  const fields = { token: apiToken, action };
  Object.entries(payload || {}).forEach(([k, v]) => {
    if (v === undefined || v === null) return;
    if (k === "rows" && Array.isArray(v)) {
      fields.rowsJson = JSON.stringify(v);
      return;
    }
    fields[k] = typeof v === "object" ? JSON.stringify(v) : String(v);
  });
  return fields;
}

async function formPostCall(apiUrl, fields) {
  return await new Promise((resolve, reject) => {
    const iframeName = `__rhr_iframe_${Math.random().toString(36).slice(2)}`;
    const iframe = document.createElement("iframe");
    iframe.name = iframeName;
    iframe.style.cssText = "position:absolute;width:0;height:0;border:0;visibility:hidden";

    const form = document.createElement("form");
    form.method = "POST";
    form.action = apiUrl;
    form.target = iframeName;
    form.acceptCharset = "UTF-8";
    form.style.display = "none";

    Object.entries(fields).forEach(([k, v]) => {
      const input = document.createElement("input");
      input.type = "hidden";
      input.name = k;
      input.value = v;
      form.appendChild(input);
    });

    let done = false;
    const timeout = setTimeout(() => finish(null), 4000);

    function finish(err) {
      if (done) return;
      done = true;
      clearTimeout(timeout);
      setTimeout(() => {
        form.remove();
        iframe.remove();
      }, 200);
      if (err) reject(err);
      else resolve({ ok: true });
    }

    iframe.addEventListener("load", () => finish(null));
    iframe.addEventListener("error", () => finish(new Error("FORM_POST_FAILED")));

    document.body.appendChild(iframe);
    document.body.appendChild(form);
    form.submit();
  });
}

function parseApiResponse(text) {
  if (/Script function not found|スクリプト関数が見つかりません/i.test(text)) {
    throw new Error(GAS_DEPLOY_HINT);
  }
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`API_BAD_JSON: ${text.slice(0, 200)}`);
  }
  if (!json || json.ok !== true) {
    const code = json && json.error ? json.error : "API_ERROR";
    const msg = json && json.message ? json.message : "";
    throw new Error(`${code}${msg ? `: ${msg}` : ""}`);
  }
  return json.data;
}

async function writeApiCall(action, payload = {}) {
  const { apiUrl, apiToken } = getApiConfig();
  const body = { token: apiToken, action, ...payload };

  try {
    const res = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const text = await res.text();
    return parseApiResponse(text);
  } catch (err) {
    if (!isLikelyCorsFailure(err) && !String(err.message || "").startsWith("API_")) {
      throw err;
    }
  }

  await formPostCall(apiUrl, buildFormFields(apiToken, action, payload));
  return { ok: true };
}

export async function apiCall(action, payload = {}) {
  const { apiUrl, apiToken } = getApiConfig();
  if (!apiUrl) {
    throw new Error("API_URL_NOT_SET");
  }
  if (!apiToken) {
    throw new Error("API_TOKEN_NOT_SET");
  }

  const writeActions = new Set(["saveAssessment", "saveAssessmentBatch"]);
  if (writeActions.has(action)) {
    return await writeApiCall(action, payload);
  }

  try {
    const res = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: apiToken, action, ...payload })
    });

    const text = await res.text();
    return parseApiResponse(text);
  } catch (err) {
    if (!isLikelyCorsFailure(err)) throw err;

    const jsonpSupported = new Set(["createRoom", "getRooms", "getAssessment", "getRoomSummary"]);
    if (jsonpSupported.has(action)) {
      return await jsonpCall(apiUrl, apiToken, action, payload);
    }

    throw err;
  }
}
