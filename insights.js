(function () {
  const data = window.GUIDELINE_DATA;
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

  const STORAGE_KEY = window.APP_ENV.storageKey;
  const USER_NAME_KEY = window.APP_ENV.userNameKey;
  const MY_GRADE_KEY = window.APP_ENV.myGradeKey;
  const MINUTES_KEY = window.APP_ENV.minutesKey || "rhr-guideline-mtg-minutes";

  function itemKey(d) {
    return `${d.category}::${d.item}`;
  }

  function loadAssessments() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
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

    data.forEach(d => {
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
    const total = data.length;
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
    if (!canvas || typeof Chart === "undefined") return;

    const labels = middleList.map(m => m.middle);
    const values = middleList.map(m => m.avg10);
    const colors = middleList.map(m => (categoryTheme[m.category] || {}).color || "#5a6269");

    if (radarChart) radarChart.destroy();

    radarChart = new Chart(canvas, {
      type: "radar",
      data: {
        labels,
        datasets: [
          {
            label: "自己評価（10段階平均）",
            data: values,
            backgroundColor: "rgba(26, 39, 68, 0.12)",
            borderColor: "#1a2744",
            borderWidth: 2,
            pointBackgroundColor: colors,
            pointBorderColor: "#fff",
            pointBorderWidth: 1,
            pointRadius: 5,
            pointHoverRadius: 7
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
            ticks: { stepSize: 2, backdropColor: "transparent" },
            grid: { color: "rgba(26,39,68,0.08)" },
            angleLines: { color: "rgba(26,39,68,0.1)" },
            pointLabels: {
              font: { size: 11, family: '"Noto Sans JP", sans-serif' },
              color: "#1a2744"
            }
          }
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label(ctx) {
                return ` ${ctx.parsed.r.toFixed(1)} 点`;
              }
            }
          }
        }
      }
    });
  }

  function renderPromoScale(gradeIndex, displayScore) {
    const wrap = document.getElementById("promoScale");
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

  リー";
    const envBanner = document.getElementById("envBanner");
    if (window.APP_ENV.id === "development" && envBanner) {
      envBanner.textContent = "開発環境 — 自己評価サマリー";
      envBanner.hidden = false;
    }

    const assessments = loadAssessments();
    const userName = localStorage.getItem(USER_NAME_KEY) || "";
    const rawGrade = localStorage.getItem(MY_GRADE_KEY);
    const gradeIndex =
      rawGrade === null || rawGrade === "" ? -1 : Number(rawGrade);
    const gradeName =
      gradeIndex >= 0 && grades[gradeIndex] ? `${grades[gradeIndex].name}` : "未設定";

    document.getElementById("summaryUser").textContent = userName || "（氏名未設定）";
    document.getElementById("summaryGrade").textContent = gradeName;

    const stats = collectSelfRatings(assessments);
    const alertEl = document.getElementById("completionAlert");
    const mainEl = document.getElementById("summaryMain");

    if (stats.rated.length === 0) {
      alertEl.hidden = false;
      alertEl.className = "alert";
      alertEl.textContent =
        "自己評価がまだありません。行動指針ページで10段階評価を入力し「保存する」を押してから、再度お越しください。";
      mainEl.hidden = true;
      return;
    }

    if (!stats.complete) {
      alertEl.hidden = false;
      alertEl.className = "alert alert-warn";
      alertEl.textContent = `入力済み ${stats.rated.length} / ${stats.total} 項目で表示しています。未入力の項目は行動指針ページで評価・保存してください。`;
    } else {
      alertEl.hidden = true;
    }

    mainEl.hidden = false;
    mainEl.removeAttribute("hidden");

    document.getElementById("avgScore10").textContent = stats.avg10.toFixed(2);
    document.getElementById("avgScoreDisplay").textContent = stats.avgDisplay.toFixed(2);

    const tier =
      gradeIndex === 0
        ? getIkuseiTier(stats.avgDisplay)
        : getUpperTier(stats.avgDisplay);
    renderPromoScale(gradeIndex, stats.avgDisplay);
    if (stats.middleList.length) {
      renderRadar(stats.middleList);
    }
    renderItemTable(stats.rows);

    const minutesTa = document.getElementById("minutesText");
    const savedMinutes = localStorage.getItem(MINUTES_KEY);
    if (savedMinutes) minutesTa.value = savedMinutes;

    const apiKeyInput = document.getElementById("apiKeyInput");
    const savedKey = localStorage.getItem("rhr-openai-api-key");
    if (savedKey) apiKeyInput.value = savedKey;

    document.getElementById("minutesFile").addEventListener("change", async e => {
      const file = e.target.files?.[0];
      if (!file) return;
      const text = await file.text();
      minutesTa.value = text;
      localStorage.setItem(MINUTES_KEY, text);
    });

    minutesTa.addEventListener("change", () => {
      localStorage.setItem(MINUTES_KEY, minutesTa.value);
    });

    apiKeyInput.addEventListener("change", () => {
      localStorage.setItem("rhr-openai-api-key", apiKeyInput.value.trim());
    });

    document.getElementById("generateBtn").addEventListener("click", async () => {
      const out = document.getElementById("aiCommentary");
      const btn = document.getElementById("generateBtn");
      btn.disabled = true;
      out.textContent = "分析を生成しています…";
      localStorage.setItem(MINUTES_KEY, minutesTa.value);

      const commentary = await generateCommentary({
        userName,
        gradeName,
        avg10: stats.avg10,
        avgDisplay: stats.avgDisplay,
        tierLabel: tier.label,
        middleList: stats.middleList,
        minutes: minutesTa.value
      });

      out.textContent = commentary;
      btn.disabled = false;
    });
  }

  window.initInsights = init;
})();
