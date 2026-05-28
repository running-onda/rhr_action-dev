import { apiCall } from "./api.js";

function $(id) {
  return document.getElementById(id);
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fmtAvg(x) {
  const v = Number(x || 0);
  if (!v) return "—";
  return Number.isInteger(v) ? String(v) : v.toFixed(2);
}

function fmtDt(iso) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  } catch {
    return "—";
  }
}

let allRows = [];

function render(rows) {
  const tbody = $("tbody");
  $("count").textContent = String(rows.length);

  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="7">データがありません。</td></tr>`;
    return;
  }

  tbody.innerHTML = rows
    .map(r => {
      const roomId = escapeHtml(r.roomId || "");
      const detailUrl = `admin-detail.html?room=${encodeURIComponent(r.roomId || "")}`;
      return `<tr>
        <td>${escapeHtml(r.employeeName || "")}</td>
        <td>${escapeHtml(r.gradeName || "")}</td>
        <td class="mono">${roomId}</td>
        <td class="num">${escapeHtml(fmtAvg(r.selfAvg))}</td>
        <td class="num">${escapeHtml(fmtAvg(r.managerAvg))}</td>
        <td>${escapeHtml(fmtDt(r.lastUpdatedAt))}</td>
        <td><a class="link" href="${escapeHtml(detailUrl)}">詳細</a></td>
      </tr>`;
    })
    .join("");
}

function applyFilter() {
  const q = $("q").value.trim().toLowerCase();
  if (!q) {
    render(allRows);
    return;
  }
  const filtered = allRows.filter(r => {
    const hay = `${r.employeeName || ""} ${r.roomId || ""} ${r.gradeName || ""}`.toLowerCase();
    return hay.includes(q);
  });
  render(filtered);
}

async function refresh() {
  $("err").hidden = true;
  $("tbody").innerHTML = `<tr><td colspan="7">読み込み中…</td></tr>`;
  try {
    const rows = await apiCall("getRoomSummary", { limit: 300 });
    allRows = Array.isArray(rows) ? rows : [];
    applyFilter();
  } catch (e) {
    $("err").hidden = false;
    $("err").textContent = `取得に失敗しました: ${e.message || String(e)}`;
    render([]);
  }
}

function init() {
  $("q").addEventListener("input", applyFilter);
  $("refreshBtn").addEventListener("click", refresh);
  refresh();
}

init();

