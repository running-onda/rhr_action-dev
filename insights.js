(function () {
  function getData() {
    return Array.isArray(window.GUIDELINE_DATA) ? window.GUIDELINE_DATA : [];
  }

  const categoryTheme = {
    "アウトプット力": { color: "#6b9b7a", soft: "#eef4ef" },
    "考える力": { color: "#4a8f9c", soft: "#e8f2f4" },
    "統治力": { color: "#7a8f6b", soft: "#f0f3ec" },
    "共感力": { color: "#6b8f9b", soft: "#ecf2f4" },
    "先導力": { color: "#d4846a", soft: "#faf0ec" },
    "快力": { color: "#9b7a6b", soft: "#f4efec" }
  };

  const grades = [
    { name: "育成選手", phase: "知る" },
    { name: "ファーム", phase: "試す" },
    { name: "スタメン", phase: "成果化する" },
    { name: "キャプテン", phase: "他者を巻き込む" },
    { name: "選手権監督", phase: "勝ち方を描く" },
    { name: "監督", phase: "組織を文化にする" },
    { name: "名球会", phase: "社会へ波及する" }
  ];

  const ENV = window.APP_ENV || {};
  const STORAGE_KEY = ENV.storageKey || "rhr-guideline-dev-assessment";
  const STORAGE_KEY_PROD = "rhr-guideline-self-assessment";
  const USER_NAME_KEY = ENV.userNameKey || "rhr-guideline-dev-user-name";
  const MY_GRADE_KEY = ENV.myGradeKey || "rhr-guideline-dev-my-grade";
  const MINUTES_KEY = ENV.minutesKey || "rhr-guideline-dev-mtg-minutes";

  function itemKey(d) {
    return `${d.category}::${d.item}`;
  }

  function loadAssessments() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(STORAGE_KEY_PROD) || "{}";
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }

  function toDisplayScore(avg10) {
    return Math.round(avg10 * 40) / 100;
  }

  function getUpperTier(score) {
    if (score <= 3.0) return { label: "降格", segment: 0, here: "here（降格）" };
    if (score < 3.4) return { label: "降級", segment: 1, here: "here（降級）" };
    if (score < 3.7) return { label: "ステイ", segment: 2, here: "here（ステイ）" };
    if (score < 4.0) return { label: "昇級", segment: 3, here: "here（昇級）" };
    return { label: "昇格", segment: 4, here: "here（昇格！）" };
  }

  function getIkuseiTier(score) {
    if (score < 3.5) return { label: "ステイ", segment: 0, here: "here（ステイ）" };
    return { label: "昇格", segment: 1, here: "here（昇級！）" };
  }

  function markerLeftPercent(segment, totalSegments) {
    const unit = 100 / totalSegments;
    return unit * segment + unit / 2;
  }

  function collectSelfRatings(assessments) {
    const rows = [];
    const byMiddle = new Map();

    getData().forEach(d => {
      const saved = assessments[itemKey(d)] || {};
      const rating = saved.selfRating ?? saved.rating ?? 0;
      rows.push({ ...d, rating });
      if (!rating) return;
      const mk = `${d.category}::${d.middle}`;
      if (!byMiddle.has(mk)) {
        byMiddle.set(mk, {
          category: d.category,
          middle: d.middle,
          sum: 0,
          count: 0
        });
      }
      const m = byMiddle.get(mk);
      m.sum += rating;
      m.count += 1;
    });

    const middleList = [...byMiddle.values()]
      .map(m => ({
        ...m,
        avg10: m.sum / m.count,
        avgDisplay: toDisplayScore(m.sum / m.count)
      }))
      .sort((a, b) => a.category.localeCompare(b.category) || a.middle.localeCompare(b.middle));

    const rated = rows.filter(r => r.rating > 0);
    const total = getData().length;
    const complete = rated.length === total;
    const avg10 = rated.length
      ? rated.reduce((s, r) => s + r.rating, 0) / rated.length
      : 0;

    return { rows, middleList, rated, total, complete, avg10, avgDisplay: toDisplayScore(avg10) };
  }

  function buildTemplateCommentary(ctx) {
    const {
      userName,
      gradeName,
      avg10,
      avgDisplay,
      tierLabel,
      middleList,
      minutes
    } = ctx;

    const sorted = [...middleList].sort((a, b) => b.avg10 - a.avg10);
    const top = sorted.slice(0, 3);
    const low = [...sorted].sort((a, b) => a.avg10 - b.avg10).slice(0, 3);

    const topText = top.length
      ? top.map(m => `「${m.middle}」（${m.category}）の平均 ${m.avg10.toFixed(1)} 点`).join("、")
      : "（データ不足）";

    const lowText = low.length
      ? low.map(m => `「${m.middle}」（${m.category}）の平均 ${m.avg10.toFixed(1)} 点`).join("、")
      : "（データ不足）";

    let minutesBlock = "";
    if (minutes && minutes.trim()) {
      const excerpt = minutes.trim().slice(0, 400).replace(/\s+/g, " ");
      minutesBlock =
        `評定MTGの議事録では、${excerpt}${minutes.length > 400 ? "…" : ""}といった記述が見られ、自己評価の数値と照らすと、言語化されている強み・課題とスコアの傾向には一定の整合がみられます。一方で、会話で触れられた具体的エピソードを次期の行動指針に落とし込むことで、数値だけでは見えない実行力の変化も追跡しやすくなります。`;
    } else {
      minutesBlock =
        "評定MTGの議事録は未登録のため、今回の所見は自己評価の数値と中項目別の傾向を中心に整理しています。議事録をアップロードして再分析すると、会話で共有された背景や覚悟、周囲からのフィードバックを織り込んだコメントに更新できます。";
    }

    const text = [
      `${userName || "ユーザー"}さん（${gradeName}）の自己評価サマリーです。全項目の平均は10段階で ${avg10.toFixed(2)} 点（換算 ${avgDisplay.toFixed(2)} 点）で、判定は「${tierLabel}」ゾーンに該当します。`,
      `レーダーチャート上では、中項目ごとにばらつきがあり、特に力が出ている領域は ${topText} です。これらは日常業務において既に再現性のある強みとして機能している可能性が高く、チームへの展開や後輩への言語化によって組織資産へ昇華できるでしょう。`,
      `相対的に伸ばしどころとして目立つのは ${lowText} です。ここは単に点数を上げるのではなく、行動指針の「概念」と「説明」に立ち返り、どの場面でどの行動が不足していたかを具体化することが重要です。`,
      minutesBlock,
      `総合すると、現時点の自己認識は${avg10 >= 7 ? "おおむね高水準" : avg10 >= 5 ? "標準的で改善余地あり" : "慎重な見立て"}にあり、次の評価期間では中項目ごとに「一つ上の職級のステップ文」を意識した行動実験を設定することを推奨します。MTGでは、強みの横展開と弱みの一点突破の両方を議題に置き、数値の根拠となったエピソードを短く共有すると、評価の納得感と納得感のある合意形成につながります。`
    ].join("\n\n");

    if (text.length > 820) return text.slice(0, 817) + "…";
    if (text.length < 780) {
      return (
        text +
        "引き続き、自己評価と他者評価のギャップを定期的に確認し、行動指針を羅針盤として使い続けることが成長の鍵となります。"
      );
    }
    return text;
  }

  async function generateCommentary(ctx) {
    const apiKey =
      localStorage.getItem("rhr-openai-api-key") ||
      (window.APP_ENV && window.APP_ENV.openaiApiKey) ||
      "";

    if (!apiKey) return buildTemplateCommentary(ctx);

    const middleSummary = ctx.middleList
      .map(m => `${m.category}/${m.middle}: 平均${m.avg10.toFixed(1)}`)
      .join("\n");

    const prompt = `あなたは人事評価に詳しいコンサルタントです。以下の自己評価データと評定MTG議事録をもとに、日本語で800文字前後の分析コメントを書いてください。丁寧で具体的に。

【対象者】${ctx.userName}（${ctx.gradeName}）
【総合平均】10段階 ${ctx.avg10.toFixed(2)} 点 / 換算 ${ctx.avgDisplay.toFixed(2)} 点 / 判定 ${ctx.tierLabel}
【中項目別】
${middleSummary}

【評定MTG議事録】
${ctx.minutes || "（なし）"}`;

    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: "簡潔で実務的な評価コメントを書きます。" },
            { role: "user", content: prompt }
          ],
          max_tokens: 1200,
          temperature: 0.6
        })
      });
      if (!res.ok) throw new Error("API error");
      const json = await res.json();
      const content = json.choices?.[0]?.message?.content?.trim();
      if (content) return content;
    } catch {
      /* fallback */
    }
    return buildTemplateCommentary(ctx);
  }

  let radarChart = null;

  function renderRadar(middleList) {
    const canvas = document.getElementById("radarChart");
    const host = document.querySelector(".chart-wrap");
    if (!canvas || !host) return;

    if (typeof Chart === "undefined") {
      host.insertAdjacentHTML(
        "beforeend",
        '<p class="chart-fallback">チャートを読み込めませんでした。ネット接続を確認して再読み込みしてください。</p>'
      );
      return;
    }

    const labels = middleList.map(m => m.middle);
    const values = middleList.map(m => Number(m.avg10.toFixed(2)));

    if (radarChart) {
      radarChart.destroy();
      radarChart = null;
    }

    radarChart = new Chart(canvas, {
      type: "radar",
      data: {
        labels,
        datasets: [
          {
            label: "自己評価",
            data: values,
            backgroundColor: "rgba(26, 39, 68, 0.15)",
            borderColor: "#1a2744",
            borderWidth: 2,
            pointBackgroundColor: "#1a2744",
            pointBorderColor: "#fff",
            pointBorderWidth: 1,
            pointRadius: 4
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        scales: {
          r: {
            min: 0,
            max: 10,
            ticks: { stepSize: 2 },
            pointLabels: { font: { size: 10 } }
          }
        },
        plugins: { legend: { display: false } }
      }
    });
  }

  function renderPromoScale(gradeIndex, displayScore) {
    const wrap = document.getElementById("promoScale");
    if (!wrap) return;
    const isIkusei = gradeIndex === 0;
    const tier = isIkusei ? getIkuseiTier(displayScore) : getUpperTier(displayScore);
    const segments = isIkusei ? 2 : 5;
    const left = markerLeftPercent(tier.segment, segments);
    const img = isIkusei ? "assets/ikusei.png" : "assets/ikusei-upper.png";

    wrap.innerHTML = `
      <div class="promo-scale-wrap">
        <img class="promo-scale-img" src="${img}" alt="評価スケール" />
        <div class="promo-marker" style="left: ${left}%">
          <span class="promo-marker-arrow">▼</span>
          <span class="promo-marker-label">${tier.here}</span>
        </div>
      </div>
      <p class="promo-tier-result">判定：<strong>${tier.label}</strong>（換算平均 ${displayScore.toFixed(2)} 点）</p>
    `;
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function renderItemTable(rows) {
    const tbody = document.getElementById("itemTableBody");
    if (!tbody) return;
    tbody.innerHTML = rows
      .map(r => {
        const theme = categoryTheme[r.category] || { color: "#5a6269" };
        return `<tr>
          <td><span class="cat-dot" style="background:${theme.color}"></span>${escapeHtml(r.category)}</td>
          <td>${escapeHtml(r.middle)}</td>
          <td>${escapeHtml(r.item)}</td>
          <td class="num">${r.rating ? r.rating : "—"}</td>
        </tr>`;
      })
      .join("");
  }

  let uiBound = false;
  let lastStats = null;
  let lastCtx = null;

  function bindUiOnce() {
    if (uiBound) return;
    uiBound = true;

    const minutesTa = document.getElementById("minutesText");
    const apiKeyInput = document.getElementById("apiKeyInput");
    const savedMinutes = localStorage.getItem(MINUTES_KEY);
    if (savedMinutes && minutesTa) minutesTa.value = savedMinutes;
    const savedKey = localStorage.getItem("rhr-openai-api-key");
    if (savedKey && apiKeyInput) apiKeyInput.value = savedKey;

    document.getElementById("minutesFile")?.addEventListener("change", async e => {
      const file = e.target.files?.[0];
      if (!file || !minutesTa) return;
      const text = await file.text();
      minutesTa.value = text;
      localStorage.setItem(MINUTES_KEY, text);
    });

    minutesTa?.addEventListener("change", () => {
      localStorage.setItem(MINUTES_KEY, minutesTa.value);
    });

    apiKeyInput?.addEventListener("change", () => {
      localStorage.setItem("rhr-openai-api-key", apiKeyInput.value.trim());
    });

    document.getElementById("generateBtn")?.addEventListener("click", async () => {
      if (!lastStats || !lastCtx) return;
      const out = document.getElementById("aiCommentary");
      const btn = document.getElementById("generateBtn");
      const minutesTaEl = document.getElementById("minutesText");
      btn.disabled = true;
      out.textContent = "分析を生成しています…";
      localStorage.setItem(MINUTES_KEY, minutesTaEl?.value || "");

      const commentary = await generateCommentary({
        ...lastCtx,
        minutes: minutesTaEl?.value || ""
      });

      out.textContent = commentary;
      btn.disabled = false;
    });
  }

  function showError(err) {
    console.error(err);
    const alertEl = document.getElementById("completionAlert");
    const mainEl = document.getElementById("summaryMain");
    if (alertEl) {
      alertEl.hidden = false;
      alertEl.className = "alert";
      const detail = err && err.message ? `（${err.message}）` : "";
      alertEl.textContent = `表示中にエラーが発生しました。ページを再読み込みしてください。${detail}`;
    }
    if (mainEl) mainEl.hidden = true;
  }

  function init() {
    try {
      if (!getData().length) {
        const alertEl = document.getElementById("completionAlert");
        if (alertEl) {
          alertEl.hidden = false;
          alertEl.className = "alert";
          alertEl.textContent =
            "行動指針データ（guideline-data.js）を読み込めません。index.html と同じフォルダに置いて再読み込みしてください。";
        }
        return;
      }

      document.title = (ENV.title || "行動指針") + " — 自己評価サマリー";
      const envBanner = document.getElementById("envBanner");
      if (ENV.id === "development" && envBanner) {
        envBanner.textContent = "開発環境 — 自己評価サマリー";
        envBanner.hidden = false;
      }

      const assessments = loadAssessments();
      const userName =
        localStorage.getItem(USER_NAME_KEY) ||
        localStorage.getItem("rhr-guideline-user-name") ||
        "";
      const rawGrade =
        localStorage.getItem(MY_GRADE_KEY) ??
        localStorage.getItem("rhr-guideline-my-grade");
      const gradeIndex =
        rawGrade === null || rawGrade === "" ? -1 : Number(rawGrade);
      const gradeName =
        gradeIndex >= 0 && grades[gradeIndex] ? grades[gradeIndex].name : "未設定";

      const summaryUser = document.getElementById("summaryUser");
      const summaryGrade = document.getElementById("summaryGrade");
      if (summaryUser) summaryUser.textContent = userName || "（氏名未設定）";
      if (summaryGrade) summaryGrade.textContent = gradeName;

      const stats = collectSelfRatings(assessments);
      const alertEl = document.getElementById("completionAlert");
      const mainEl = document.getElementById("summaryMain");

      if (stats.rated.length === 0) {
        if (alertEl) {
          alertEl.hidden = false;
          alertEl.className = "alert";
          alertEl.textContent =
            "自己評価がまだありません。行動指針ページ（index.html）で10段階評価を入力し「保存する」を押してから、再度お越しください。";
        }
        if (mainEl) mainEl.hidden = true;
        return;
      }

      if (alertEl) {
        if (!stats.complete) {
          alertEl.hidden = false;
          alertEl.className = "alert alert-warn";
          alertEl.textContent = `入力済み ${stats.rated.length} / ${stats.total} 項目で表示しています。未入力の項目は行動指針ページで評価・保存してください。`;
        } else {
          alertEl.hidden = true;
        }
      }

      if (mainEl) {
        mainEl.hidden = false;
        mainEl.removeAttribute("hidden");
      }

      const avg10El = document.getElementById("avgScore10");
      const avgDispEl = document.getElementById("avgScoreDisplay");
      if (avg10El) avg10El.textContent = stats.avg10.toFixed(2);
      if (avgDispEl) avgDispEl.textContent = stats.avgDisplay.toFixed(2);

      const tier =
        gradeIndex === 0
          ? getIkuseiTier(stats.avgDisplay)
          : getUpperTier(stats.avgDisplay);

      renderPromoScale(gradeIndex, stats.avgDisplay);
      renderItemTable(stats.rows);

      lastStats = stats;
      lastCtx = {
        userName,
        gradeName,
        avg10: stats.avg10,
        avgDisplay: stats.avgDisplay,
        tierLabel: tier.label,
        middleList: stats.middleList
      };

      bindUiOnce();

      if (stats.middleList.length) {
        requestAnimationFrame(() => {
          try {
            renderRadar(stats.middleList);
          } catch (chartErr) {
            console.error(chartErr);
          }
        });
      }
    } catch (err) {
      showError(err);
    }
  }

  window.initInsights = init;
})();
