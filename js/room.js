export function parseQuery(search = window.location.search) {
  const params = new URLSearchParams(search || "");
  const out = {};
  for (const [k, v] of params.entries()) out[k] = v;
  return out;
}

export function getRoomContext() {
  const q = parseQuery();
  const roomId = String(q.room || "").trim();
  const role = String(q.role || "").trim(); // legacy; optional
  return { roomId, role };
}

export function isRoomLink(search = window.location.search) {
  const q = parseQuery(search);
  return Boolean(String(q.room || "").trim());
}

export function getBaseUrl() {
  const { origin, pathname } = window.location;
  const basePath = pathname.replace(/[^/]+$/, "");
  return `${origin}${basePath}`;
}

export function buildViewerUrl(roomId) {
  const base = getBaseUrl();
  const r = encodeURIComponent(roomId);
  return `${base}viewer.html?room=${r}`;
}
