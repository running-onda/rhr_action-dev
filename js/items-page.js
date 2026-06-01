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

function groupKey(d) {
  return `${d.category}::${d.middle}`;
}

function renderCriteria(steps) {
  const items = (steps || [])
    .map((text, i) => {
      const grade = grades[i];
      if (!grade) return "";
      return `<div class="criteria-row">
        <span class="grade-label g${i}">${escapeHtml(grade.name)}</span>
        <div class="criteria-text">${escapeHtml(text)}</div>
      </div>`;
    })
    .filter(Boolean)
    .join("");

  return `<div class="criteria-list">${items}</div>`;
}

function renderStepsCell(steps) {
  if (collapsed) {
    return `<span class="toggle" data-expand="1">表示する</span>`;
  }
  return renderCriteria(steps);
}

function buildGroups(rows) {
  const groups = [];
  let current = null;

  rows.forEach(row => {
    const key = groupKey(row);
    if (!current || current.key !== key) {
      current = { key, category: row.category, middle: row.middle, items: [] };
      groups.push(current);
    }
    current.items.push(row);
  });

  return groups;
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

  const html = buildGroups(rows)
    .map(group => {
      const span = group.items.length;
      return group.items
        .map((d, index) => {
          const groupCells =
            index === 0
              ? `<td class="cell-group cell-group-major" rowspan="${span}">${escapeHtml(group.category)}</td>
                 <td class="cell-group cell-group-middle" rowspan="${span}">${escapeHtml(group.middle)}</td>`
              : "";

          return `<tr>
            ${groupCells}
            <td class="cell-item">${escapeHtml(d.item)}</td>
            <td><div class="desc">${escapeHtml(d.description || "")}</div></td>
            <td>${renderStepsCell(d.steps)}</td>
          </tr>`;
        })
        .join("");
    })
    .join("");

  tbody.innerHTML = html;

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
