export function parseQuery(search = window.location.search) {
  const params = new URLSearchParams(search || "");
  const out = {};
  for (const [k, v] of params.entries()) out[k] = v;
  return out;
}

export function getRoomContext() {
  const q = parseQuery();
  const roomId = String(q.room || "").trim();
  const role = String(q.role || "").trim(); // employee | manager
  return { roomId, role };
}

export function getBaseUrl() {
  // GitHub Pages safe base url for generating links
  // e.g. https://host/repo/ + file.html
  const { origin, pathname } = window.location;
  const basePath = pathname.replace(/[^/]+$/, "");
  return `${origin}${basePath}`;
}

export function buildViewerUrl(roomId, role) {
  const base = getBaseUrl();
  const r = encodeURIComponent(roomId);
  const ro = encodeURIComponent(role);
  return `${base}viewer.html?room=${r}&role=${ro}`;
}

