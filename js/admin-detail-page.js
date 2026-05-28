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

function getRoomId() {
  const p = new URLSearchParams(window.location.search);
  return String(p.get("room") || "").trim();
}

function renderTableBody(el, rows, renderRow, emptyText) {
  if (!rows || !rows.length) {
    el.innerHTML = `<tr><td colspan="99">${escapeHtml(emptyText || "—")}</td></tr>`;
    return;
  }
  el.innerHTML = rows.map(renderRow).join("");
}

function renderComments(comments) {
  const host = $("comments");
  if (!comments || !comments.length) {
    host.innerHTML = `<div class="comment"><div class="txt">コメントはまだありません。</div></div>`;
    return;
  }
  host.innerHTML = comments
    .map(c => {
      const who = c.role === "manager"
        ? `上司${c.name ? `（${c.name}）` : ""}`
        : "本人";
      const title = `${c.category}/${c.middle}/${c.item}`;
      return `<div class="comment">
        <div class="who">${escapeHtml(who)} — ${escapeHtml(title)}</div>
        <div class="txt">${escapeHtml(c.comment || "")}</div>
      </div>`;
    })
    .join("");
}

async function init() {
  const roomId = getRoomId();
  $("backBtn").addEventListener("click", () => (window.location.href = "admin.html"));

  if (!roomId) {
    $("err").hidden = false;
    $("err").textContent = "roomId が指定されていません。";
    return;
  }

  try {
    const res = await apiCall("getRoomSummary", { roomId });
    const room = res.room || {};

    $("meta").textContent = `社員: ${room.employeeName || "—"} / 職級: ${room.gradeName || "—"} / roomId: ${room.roomId || roomId}`;

    renderTableBody(
      $("byCategoryBody"),
      res.byCategory || [],
      r => `<tr>
        <td>${escapeHtml(r.category || "")}</td>
        <td class="num">${escapeHtml(fmtAvg(r.selfAvg))}</td>
        <td class="num">${escapeHtml(fmtAvg(r.managerAvg))}</td>
      </tr>`,
      "データがありません。"
    );

    renderTableBody(
      $("byMiddleBody"),
      res.byMiddle || [],
      r => `<tr>
        <td>${escapeHtml(r.category || "")}</td>
        <td>${escapeHtml(r.middle || "")}</td>
        <td class="num">${escapeHtml(fmtAvg(r.selfAvg))}</td>
        <td class="num">${escapeHtml(fmtAvg(r.managerAvg))}</td>
      </tr>`,
      "データがありません。"
    );

    renderTableBody(
      $("itemsBody"),
      res.items || [],
      r => `<tr>
        <td>${escapeHtml(r.category || "")}</td>
        <td>${escapeHtml(r.middle || "")}</td>
        <td>${escapeHtml(r.item || "")}</td>
        <td class="num">${escapeHtml(fmtAvg(r.selfRating))}</td>
        <td class="num">${escapeHtml(fmtAvg(r.managerRating))}</td>
      </tr>`,
      "データがありません。"
    );

    renderComments(res.comments || []);
  } catch (e) {
    $("err").hidden = false;
    $("err").textContent = `取得に失敗しました: ${e.message || String(e)}`;
  }
}

init();

