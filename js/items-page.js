const grades = [
  { name: "育成選手", phase: "知る" },
  { name: "ファーム", phase: "試す" },
  { name: "スタメン", phase: "成果化する" },
  { name: "キャプテン", phase: "他者を巻き込む" },
  { name: "選手権監督", phase: "勝ち方を描く" },
  { name: "監督", phase: "組織を文化にする" },
  { name: "名球会", phase: "社会へ波及する" }
];

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

const data = Array.isArray(window.GUIDELINE_DATA) ? window.GUIDELINE_DATA : [];
let collapsed = false;

function renderCategoryOptions() {
  const sel = $("cat");
  const cats = [...new Set(data.map(d => d.category))];
  cats.forEach(c => {
    const opt = document.createElement("option");
    opt.value = c;
    opt.textContent = c;
    sel.appendChild(opt);
  });
}

function matchQuery(d, q) {
  if (!q) return true;
  const hay = [
    d.category,
    d.middle,
    d.item,
    d.description,
    ...(Array.isArray(d.steps) ? d.steps : [])
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return hay.includes(q);
}

function render() {
  const q = $("q").value.trim().toLowerCase();
  const cat = $("cat").value;

  const rows = data.filter(d => (!cat || d.category === cat) && matchQuery(d, q));
  $("count").textContent = String(rows.length);

  const tbody = $("tbody");
  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="5">該当する項目がありません。</td></tr>`;
    return;
  }

  tbody.innerHTML = rows
    .map(d => {
      const steps = (d.steps || [])
        .map((s, i) => `${grades[i]?.name || `G${i + 1}`}: ${s}`)
        .join("\n");

      const stepsCell = collapsed
        ? `<span class="toggle" data-expand="1">表示する</span>`
        : `<div class="steps">${escapeHtml(steps)}</div>`;

      return `<tr>
        <td>${escapeHtml(d.category)}</td>
        <td>${escapeHtml(d.middle)}</td>
        <td><strong>${escapeHtml(d.item)}</strong></td>
        <td><div class="desc">${escapeHtml(d.description || "")}</div></td>
        <td>${stepsCell}</td>
      </tr>`;
    })
    .join("");

  if (collapsed) {
    tbody.querySelectorAll("[data-expand]").forEach(a => {
      a.addEventListener("click", () => {
        collapsed = false;
        $("toggleBtn").textContent = "基準文を折りたたむ";
        render();
      });
    });
  }
}

function init() {
  renderCategoryOptions();
  $("q").addEventListener("input", render);
  $("cat").addEventListener("change", render);
  $("toggleBtn").addEventListener("click", () => {
    collapsed = !collapsed;
    $("toggleBtn").textContent = collapsed ? "基準文を表示する" : "基準文を折りたたむ";
    render();
  });
  render();
}

init();

