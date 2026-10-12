/* 成績（メンバー比較）：順位表、推移、Par 別の得意（全員比較と自分の平均比）、前半・後半、スタート・昼イチ・上がり、
   安定感、結果の内訳、対戦成績、称号、天気。各項目にデータから作った一言を添える。 */
"use strict";
(function () {
  const KGC = (window.KGC = window.KGC || {});
  KGC.views = KGC.views || {};
  let scopeId = "all";

  KGC.views.stats = (root) => {
    KGC.app.setTitle("成績");
    const db = KGC.db;
    if (!db.scope(scopeId)) scopeId = (db.scopes[0] || {}).id || "all";
    render(root);
  };

  function render(root) {
    const U = KGC.ui, C = KGC.charts, P = KGC.parts, db = KGC.db, html = U.html;
    const scope = db.scope(scopeId);
    const head = html`<header class="page-head"><p class="kicker">STATS</p><h1 class="page-title">成績</h1>
      <p class="page-lead">${db.players.length}人の比較。グラフは押すと数字が出ます。「表で見る」で一覧にも切り替えられます。</p></header>`;
    if (!scope) { root.innerHTML = String(html`${head}${U.empty("まだ成績の記録がありません")}`); return; }
    const S = scope.players || {};
    const G = scope.group || {};
    const I = G.insights || {};
    const pids = db.players.map((p) => p.id).filter((p) => S[p]);
    const nm = (p) => db.name(p);
    const nR = (scope.roundIds || []).length;
    const tops = (list) => (list || []).filter((x) => x.rank === 1);
    const who = (list) => tops(list).map((x) => nm(x.player)).join("・");

    /* 切り替え・目次 */
    const scopeBar = db.scopes.length > 1 ? html`<div class="scope-bar">${U.seg("scope", db.scopes.map((x) => ({ value: x.id, label: x.label })), scope.id, "集計の範囲")}</div>` : "";
    const toc = [["board", "順位"], ["trend", "推移"], ["par", "得意なPar"], ["halves", "前半・後半"], ["pos", "スタート・上がり"], ["stab", "安定感"], ["dist", "内訳"], ["h2h", "対戦"], ["titles", "称号"], ["wx", "天気"]];
    const subnav = html`<nav class="subnav" aria-label="この画面の項目"><div class="subnav-in">${toc.map((t) => html`<button type="button" data-jump="${t[0]}">${t[1]}</button>`)}</div></nav>`;
    const members = html`<ul class="member-legend">${pids.map((p) => html`<li>${U.chip(p)}</li>`)}</ul>`;

    /* 順位表 */
    const lb = (G.leaderboard || []).filter((x) => S[x.player]);
    let prev = null, rank = 0;
    const lbRows = lb.map((x, i) => { if (x.avg !== prev) { rank = i + 1; prev = x.avg; } return { ...x, rank: U.isNum(x.avg) ? rank : null }; });
    const boardTk = [];
    const lbTop = lbRows.filter((x) => x.rank === 1);
    if (lbTop.length) boardTk.push(`平均スコアのトップは${lbTop.map((x) => nm(x.player)).join("・")}（${U.fmt.avg(lbTop[0].avg)}）`);
    const maxWins = Math.max(0, ...lbRows.map((x) => x.wins));
    if (maxWins > 0) boardTk.push(`優勝回数は${lbRows.filter((x) => x.wins === maxWins).map((x) => nm(x.player)).join("・")}が最多（${maxWins}回）`);
    if (lbRows.length > 1 && U.isNum(lbRows[0].avg) && U.isNum(lbRows[1].avg) && lbRows[1].avg > lbRows[0].avg) boardTk.push(`1位と2位の差は平均 ${U.fmt.num(lbRows[1].avg - lbRows[0].avg, 1)} 打`);
    const board = U.section("board", "順位表", html`<div class="card board-card"><div class="tbl-wrap"><table class="tbl board">
      <thead><tr><th scope="col">順位</th><th scope="col">選手</th><th scope="col" class="num">平均</th><th scope="col" class="num">ベスト</th><th scope="col" class="num">前回</th><th scope="col" class="num">優勝</th><th scope="col" class="num">R</th></tr></thead>
      <tbody>${lbRows.map((x) => html`<tr class="${x.rank === 1 ? "is-top" : ""}">
        <td class="board-rank">${x.rank === 1 ? html`<span class="medal">${U.icon("crown")}</span>` : x.rank || "—"}</td>
        <th scope="row">${U.chip(x.player)}</th>
        <td class="num board-avg">${U.fmt.avg(x.avg)}</td><td class="num">${U.fmt.int(x.best)}</td><td class="num">${U.fmt.int(x.last)}</td>
        <td class="num">${x.wins}${x.ties ? html`<small>+${x.ties}</small>` : ""}</td><td class="num">${x.rounds}</td>
      </tr>`)}</tbody></table></div>
      ${U.takeaway(boardTk)}
      <p class="fig-note">平均の少ない順。${nR}ラウンド分（${scope.label || "通算"}）。優勝の「+」は同スコアで並んだ回数。</p></div>`);

    /* 推移 */
    const trend = U.section("trend", "スコア推移", P.trendFigure(scope, { title: "1ラウンドの合計" }));

    /* 得意な Par */
    const PT = ["3", "4", "5"];
    const parTk = [];
    const parGroups = PT.map((pt) => {
      const list = ((I.parType || {})[pt] || []).filter((x) => S[x.player]);
      const t = tops(list);
      if (t.length === 1) parTk.push(`Par${pt} は${nm(t[0].player)}が最も得意（平均 ${U.fmt.toParAvg(t[0].value)}／H）`);
      else if (t.length > 1) parTk.push(`Par${pt} は${who(list)}が並んで得意（平均 ${U.fmt.toParAvg(t[0].value)}／H）`);
      const nTxt = (() => { const ns = [...new Set(pids.map((p) => (S[p].parType && S[p].parType[pt] ? S[p].parType[pt].n : 0)))]; return ns.length === 1 ? `${ns[0]}ホール/人` : ""; })();
      return {
        label: `Par${pt}`, note: nTxt,
        rows: list.map((x) => {
          const pt0 = S[x.player].parType[pt];
          return {
            label: nm(x.player), value: x.value, color: db.color(x.player), strong: x.rank === 1,
            tip: { title: `Par${pt}・${nm(x.player)}`, rows: [{ color: db.color(x.player), value: U.fmt.toParAvg(x.value), label: "1ホールの平均（パーとの差）" }, { value: U.fmt.num(pt0.avg, 2) + "打", label: "平均打数" }, { value: U.fmt.pct(pt0.parOrBetter), label: `パー以内率（${pt0.n}ホール）` }] },
            text: U.fmt.toParAvg(x.value),
          };
        }),
      };
    }).filter((g) => g.rows.length);
    const parFig = parGroups.length ? U.figure({
      title: "Par 別の平均", sub: "1ホールあたりのパーとの差・棒が短いほど得意",
      legend: U.playerLegend(pids, "box"),
      body: C.slot((el, w) => C.bars(el, w, { label: "Par別の平均", groups: parGroups }), { minH: 260 }),
      takeaway: parTk,
      table: {
        cols: [{ label: "選手" }].concat(PT.map((pt) => ({ label: `Par${pt}`, num: true }))).concat(PT.map((pt) => ({ label: `Par${pt} パー以内`, num: true }))),
        rows: pids.map((p) => [nm(p)].concat(PT.map((pt) => U.fmt.toParAvg((S[p].parType[pt] || {}).toPar))).concat(PT.map((pt) => U.fmt.pct((S[p].parType[pt] || {}).parOrBetter)))),
      },
    }) : U.empty("Par 別の記録がまだありません");

    // 自分の平均と比べた得意・不得意
    const relTk = [];
    const relGroups = pids.map((p) => {
      const base = S[p].avgToParPerHole;
      const rows = PT.map((pt) => { const v = (S[p].parType[pt] || {}).toPar; return { pt, rel: U.isNum(v) && U.isNum(base) ? v - base : null }; }).filter((x) => U.isNum(x.rel));
      if (!rows.length) return null;
      const best = rows.reduce((a, b) => (b.rel < a.rel ? b : a));
      const worst = rows.reduce((a, b) => (b.rel > a.rel ? b : a));
      if (best.rel <= -0.1) relTk.push(`${nm(p)}は Par${best.pt} が武器（自分の平均より ${U.fmt.toParAvg(best.rel)} 打/H）${worst.rel >= 0.1 ? `、Par${worst.pt} が課題（${U.fmt.toParAvg(worst.rel)}）` : ""}`);
      else relTk.push(`${nm(p)}は Par による差が小さい（最大 ${U.fmt.toParAvg(worst.rel)} 打/H）`);
      return {
        label: nm(p), note: `自分の平均 ${U.fmt.toParAvg(base)}／H`,
        rows: rows.map((x) => ({ label: `Par${x.pt}`, value: x.rel, color: db.color(p), strong: x === best, text: U.fmt.toParAvg(x.rel),
          tip: { title: `${nm(p)}・Par${x.pt}`, rows: [{ color: db.color(p), value: U.fmt.toParAvg(x.rel), label: "自分の平均との差（打/H）" }] } })),
      };
    }).filter(Boolean);
    const relFig = relGroups.length ? U.figure({
      title: "自分の平均と比べて", sub: "左（マイナス）に伸びるほど、その Par が得意",
      legend: U.playerLegend(pids, "box"),
      body: C.slot((el, w) => C.bars(el, w, { label: "自分の平均との差", groups: relGroups, barH: 12 }), { minH: 300 }),
      takeaway: relTk,
      table: {
        cols: [{ label: "選手" }, { label: "全ホール平均", num: true }].concat(PT.map((pt) => ({ label: `Par${pt}との差`, num: true }))),
        rows: pids.map((p) => [nm(p), U.fmt.toParAvg(S[p].avgToParPerHole)].concat(PT.map((pt) => { const v = (S[p].parType[pt] || {}).toPar; return U.isNum(v) && U.isNum(S[p].avgToParPerHole) ? U.fmt.toParAvg(v - S[p].avgToParPerHole) : "—"; }))),
      },
    }) : "";
    const parSec = U.section("par", "誰が得意？ Par3・Par4・Par5", html`<div class="grid-2 inner">${parFig}${relFig}</div>`);

    /* 前半・後半 */
    const fbRows = pids.map((p) => ({ label: nm(p), a: S[p].front, b: S[p].back, color: db.color(p), d: S[p].backMinusFront, p }));
    const fbType = (d) => (!U.isNum(d) ? "" : d <= -1.5 ? "後半型" : d >= 1.5 ? "前半型" : "ペース型");
    const fbTk = [];
    const fbValid = fbRows.filter((r) => U.isNum(r.d));
    if (fbValid.length) {
      const back = fbValid.reduce((a, b) => (b.d < a.d ? b : a));
      const front = fbValid.reduce((a, b) => (b.d > a.d ? b : a));
      if (back.d <= -1.5) fbTk.push(`後半に強いのは${back.label}（後半が平均 ${U.fmt.num(-back.d, 1)} 打良い）`);
      if (front.d >= 1.5) fbTk.push(`前半に強いのは${front.label}（前半が平均 ${U.fmt.num(front.d, 1)} 打良い）`);
      const pace = fbValid.filter((r) => Math.abs(r.d) < 1.5);
      if (pace.length) fbTk.push(`${pace.map((r) => r.label).join("・")}は前半・後半の差が小さいペース型`);
    }
    const fbFig = U.figure({
      title: "前半と後半の平均スコア", sub: "プレーした順の9ホールずつ・左ほど良い",
      legend: U.legend([{ label: "前半", color: "var(--ink-2)", kind: "ring" }, { label: "後半", color: "var(--ink-2)", kind: "dot" }]),
      body: html`${C.slot((el, w) => C.dumbbell(el, w, { rows: fbRows, aLabel: "前半", bLabel: "後半", fmt: (v) => U.fmt.avg(v), label: "前半と後半" }), { minH: 150 })}
        <ul class="fbtags">${fbRows.map((r) => html`<li>${U.dot(r.p)}<span>${r.label}</span>${fbType(r.d) ? html`<span class="${"fbtag " + (fbType(r.d) === "ペース型" ? "is-pace" : "")}">${fbType(r.d)}</span>` : ""}<b>${U.isNum(r.d) ? U.fmt.diff(r.d, 1) : "—"}</b></li>`)}</ul>`,
      takeaway: fbTk,
      note: "数字は「後半 − 前半」。マイナスなら後半のほうが良い。",
      table: {
        cols: [{ label: "選手" }, { label: "前半", num: true }, { label: "後半", num: true }, { label: "後半−前半", num: true }, { label: "OUT", num: true }, { label: "IN", num: true }],
        rows: pids.map((p) => [nm(p), U.fmt.avg(S[p].front), U.fmt.avg(S[p].back), U.fmt.diff(S[p].backMinusFront, 1), U.fmt.avg(S[p].out), U.fmt.avg(S[p].in)]),
      },
    });
    const halvesSec = U.section("halves", "前半に強い？ 後半に強い？", fbFig);

    /* スタート・昼イチ・上がり */
    const POS = [["start3", "スタート3H", "start3"], ["lunchHole", "昼イチ", "lunchHole"], ["last3", "上がり3H", "last3"], ["avgToParPerHole", "全体", null]];
    const posBest = {};
    POS.forEach(([k]) => {
      const vals = pids.map((p) => S[p][k]).filter(U.isNum);
      const min = vals.length ? Math.min(...vals) : null;
      // 全員が同じ値なら「いちばん」を付けない
      posBest[k] = vals.length > 1 && vals.some((v) => v !== min) ? min : null;
    });
    const posTable = html`<div class="tbl-wrap"><table class="tbl pos-table">
      <thead><tr><th scope="col">選手</th>${POS.map((x) => html`<th scope="col" class="num">${x[1]}</th>`)}</tr></thead>
      <tbody>${pids.map((p) => html`<tr><th scope="row">${U.chip(p)}</th>${POS.map(([k]) => {
        const v = S[p][k];
        const best = U.isNum(v) && v === posBest[k] && k !== "avgToParPerHole" && pids.length > 1;
        return html`<td class="${"num " + (best ? "is-best" : "") + (k === "avgToParPerHole" ? " is-base" : "")}">${U.fmt.toParAvg(v)}</td>`;
      })}</tr>`)}</tbody></table></div>`;
    const posTk = [];
    [["start3", "出だし（スタート3H）"], ["lunchHole", "昼イチ（後半の1H目）"], ["last3", "上がり3H"]].forEach(([k, label]) => {
      const list = (I[k] || []).filter((x) => S[x.player]);
      const t = tops(list);
      if (!t.length) return;
      if (t.length === list.length && list.length > 1) posTk.push(`${label}は全員 ${U.fmt.toParAvg(t[0].value)} で並ぶ`);
      else posTk.push(`${label}に強いのは${who(list)}（平均 ${U.fmt.toParAvg(t[0].value)}／H）`);
    });
    const segX = ["1–3", "4–6", "7–9", "10–12", "13–15", "16–18"];
    const segSeries = pids.map((p) => ({ id: p, name: nm(p), color: db.color(p), values: segX.map((_, i) => ((S[p].segments || [])[i] || {}).toPar) }));
    const segFig = U.figure({
      title: "3ホールごとの平均", sub: "1ホールあたりのパーとの差・プレー順・低いほど良い",
      legend: U.playerLegend(pids),
      body: C.slot((el, w) => C.line(el, w, {
        label: "3ホールごとの平均", h: 220, zero: true,
        x: segX.map((l) => ({ label: l, title: `${l.replace("–", "〜")}ホール目` })),
        series: segSeries, divider: { after: 2, labels: ["前半", "後半"] },
        fmt: (v) => U.fmt.toParAvg(v), endLabel: (s, v) => `${s.name} ${U.fmt.toParAvg(v)}`,
      }), { minH: 220 }),
      table: { cols: [{ label: "ホール目" }].concat(pids.map((p) => ({ label: nm(p), num: true }))), rows: segX.map((l, i) => [l].concat(segSeries.map((s) => U.fmt.toParAvg(s.values[i])))) },
    });
    // 昼イチ（10ホール目）を実際に何回プレーしたか。いちばん少ない人に合わせて表示する
    const lunchN = pids.length ? Math.min(...pids.map((p) => { const n = S[p] && S[p].positionN; return n && n.lunchHole != null ? n.lunchHole : nR; })) : 0;
    const posSec = U.section("pos", "スタート・昼イチ・上がり", html`${U.figure({
      title: "ホールの位置ごとの平均", sub: "1ホールあたりのパーとの差・金の枠がいちばん良い人",
      body: posTable, takeaway: posTk,
      note: `昼イチ＝昼休みのあとの最初のホール（10ホール目）。1人あたり${lunchN}回分なので、ラウンドが増えるほど確かになります。`,
    })}${segFig}`);

    /* 安定感 */
    const M = [
      { key: "holeStdev", label: "ホールのブレ", desc: "1ホールの打数のばらつき（標準偏差）", low: true, v: (s) => s.holeStdev, f: (v) => U.fmt.num(v, 2) },
      { key: "blowup", label: "トリプル以上率", desc: "大叩きの割合", low: true, v: (s) => s.blowup, f: (v) => U.fmt.pct(v) },
      { key: "bogeyOrBetter", label: "ボギー以内率", desc: "ボギー以内で上がった割合", low: false, v: (s) => s.bogeyOrBetter, f: (v) => U.fmt.pct(v) },
      { key: "parOrBetter", label: "パー以内率", desc: "パー以内で上がった割合", low: false, v: (s) => s.parOrBetter, f: (v) => U.fmt.pct(v) },
      { key: "bounceBack", label: "バウンスバック率", desc: "ボギー以上の次のホールをパー以内", low: false, v: (s) => s.bounceBack && s.bounceBack.rate, f: (v) => U.fmt.pct(v), n: (s) => (s.bounceBack ? `${s.bounceBack.ok}/${s.bounceBack.n}` : "") },
      { key: "recovery", label: "立て直し率", desc: "ダボ以上の次をボギー以内", low: false, v: (s) => s.recovery && s.recovery.rate, f: (v) => U.fmt.pct(v), n: (s) => (s.recovery ? `${s.recovery.ok}/${s.recovery.n}` : "") },
      { key: "chain", label: "崩れの連鎖率", desc: "ダボ以上の次もダボ以上", low: true, v: (s) => s.chain && s.chain.rate, f: (v) => U.fmt.pct(v), n: (s) => (s.chain ? `${s.chain.hit}/${s.chain.n}` : "") },
      { key: "stdev", label: "スコアのブレ", desc: "ラウンド合計の標準偏差（3ラウンドから）", low: true, v: (s) => s.stdev, f: (v) => "±" + U.fmt.num(v, 1) },
    ];
    const bestCount = {};
    const mRows = M.map((m) => {
      const vals = pids.map((p) => ({ p, v: m.v(S[p]) }));
      const ok = vals.filter((x) => U.isNum(x.v));
      if (!ok.length) {
        const minR = Math.min(...pids.map((p) => S[p].rounds || 0));
        return html`<div class="mrow"><div class="mhead"><p class="mhead-top"><b>${m.label}</b></p><small>${m.desc}</small></div><div class="mpending">${U.pending(m.key === "stdev" ? U.remain(3, minR) : "データ蓄積中")}</div></div>`;
      }
      const target = m.low ? Math.min(...ok.map((x) => x.v)) : Math.max(...ok.map((x) => x.v));
      const maxV = Math.max(...ok.map((x) => x.v), 1e-9);
      const winners = ok.filter((x) => x.v === target);
      if (winners.length === 1 && ok.length > 1) bestCount[winners[0].p] = (bestCount[winners[0].p] || 0) + 1;
      return html`<div class="mrow">
        <div class="mhead"><p class="mhead-top"><b>${m.label}</b>${ok.length > 1 ? html`<span class="mwin">${U.icon("crown")}${winners.map((x) => nm(x.p)).join("・")}</span>` : ""}</p><small>${m.desc}・${m.low ? "低いほど良い" : "高いほど良い"}</small></div>
        <div class="mvals">${vals.map((x) => html`<div class="${"mv " + (U.isNum(x.v) && x.v === target && ok.length > 1 ? "is-best" : "")}">
          <span class="mv-name">${U.dot(x.p)}${nm(x.p)}</span>
          <span class="mv-bar"><i style="${`width:${U.isNum(x.v) ? Math.max(2, Math.round((x.v / maxV) * 100)) : 0}%;background:${db.color(x.p)}`}"></i></span>
          <span class="mv-val">${U.isNum(x.v) ? m.f(x.v) : "—"}${m.n && m.n(S[x.p]) ? html`<small>${m.n(S[x.p])}</small>` : ""}</span>
        </div>`)}</div>
      </div>`;
    });
    const bc = Object.entries(bestCount).sort((a, b) => b[1] - a[1]);
    const nMetrics = M.filter((m) => pids.some((p) => U.isNum(m.v(S[p])))).length;
    const stabTk = [];
    if (bc.length) stabTk.push(bc.length > 1 && bc[0][1] === bc[1][1] ? `安定感は${bc.filter((x) => x[1] === bc[0][1]).map((x) => nm(x[0])).join("・")}が互角（各 ${bc[0][1]} 項目で1位）` : `安定感は${nm(bc[0][0])}がリード（${nMetrics}項目中 ${bc[0][1]} 項目で1位）`);
    const hs = tops(I.holeStdev);
    if (hs.length === 1) stabTk.push(`ホールごとのブレが最も小さいのは${nm(hs[0].player)}（${U.fmt.num(hs[0].value, 2)}）`);
    const bl = tops(I.blowup);
    if (bl.length) stabTk.push(`大叩き（トリプル以上）が少ないのは${who(I.blowup)}（${U.fmt.pct(bl[0].value)}）`);
    const stabSec = U.section("stab", "スコアの安定感", U.figure({
      title: "安定感の指標", sub: "金の冠がその項目の1位・小さな数字は回数（成功/機会）",
      body: html`<div class="mrows">${mRows}</div>`, takeaway: stabTk,
      table: {
        cols: [{ label: "指標" }].concat(pids.map((p) => ({ label: nm(p), num: true }))),
        rows: M.map((m) => [m.label].concat(pids.map((p) => { const v = m.v(S[p]); return U.isNum(v) ? m.f(v) + (m.n && m.n(S[p]) ? `（${m.n(S[p])}）` : "") : "—"; }))),
      },
    }));

    /* 内訳 */
    const distRows = pids.map((p) => ({ label: nm(p), rate: S[p].distRate || {}, count: S[p].dist || {}, n: S[p].holes || 0 }));
    const distTk = [];
    const pob = tops(I.parOrBetter);
    if (pob.length) distTk.push(`パー以内の割合トップは${who(I.parOrBetter)}（${U.fmt.pct(pob[0].value)}）`);
    const bob = tops(I.bogeyOrBetter);
    if (bob.length) distTk.push(`ボギー以内の割合トップは${who(I.bogeyOrBetter)}（${U.fmt.pct(bob[0].value)}）`);
    const bird = pids.map((p) => ({ p, v: S[p].birdiesOrBetter || 0 })).sort((a, b) => b.v - a.v);
    if (bird.length && bird[0].v) distTk.push(`バーディー以上は${bird.filter((x) => x.v === bird[0].v).map((x) => nm(x.p)).join("・")}の ${bird[0].v} 回が最多`);
    const distSec = U.section("dist", "結果の内訳", U.figure({
      title: "全ホールの結果の割合", sub: "中央がパー・左がパーより良い・右がパーより悪い",
      legend: P.resultLegend(),
      body: C.slot((el, w) => C.divstack(el, w, { label: "結果の内訳", rows: distRows }), { minH: 140 }),
      takeaway: distTk,
      table: {
        cols: [{ label: "結果" }].concat(pids.map((p) => ({ label: nm(p), num: true }))),
        rows: U.CATS.map((c) => [U.CAT_LABEL[c]].concat(pids.map((p) => `${(S[p].dist || {})[c] || 0}（${U.fmt.pct((S[p].distRate || {})[c])}）`))),
      },
    }));

    /* 対戦成績 */
    const h2h = (G.h2h || []).filter((x) => S[x.a] && S[x.b]);
    const h2hTk = [];
    const h2hCards = h2h.map((x) => {
      const ha = (x.holes || {}).a || 0, hb = (x.holes || {}).b || 0, hh = (x.holes || {}).halved || 0;
      const leader = x.aWins > x.bWins ? x.a : x.bWins > x.aWins ? x.b : null;
      if (leader) h2hTk.push(`${nm(leader)}が${nm(leader === x.a ? x.b : x.a)}に ${Math.max(x.aWins, x.bWins)}勝${Math.min(x.aWins, x.bWins)}敗${x.draws ? x.draws + "分" : ""}`);
      return html`<li class="h2h">
        <div class="h2h-head">${U.chip(x.a)}<span class="h2h-vs">vs</span>${U.chip(x.b)}</div>
        <div class="h2h-row"><span class="h2h-label">ストローク</span><span class="h2h-bar">${C.split([{ n: x.aWins, color: db.color(x.a), label: `${nm(x.a)}の勝ち` }, { n: x.draws, color: "var(--r-par)", label: "引き分け" }, { n: x.bWins, color: db.color(x.b), label: `${nm(x.b)}の勝ち` }])}</span>
          <span class="h2h-score"><b>${x.aWins}</b>–<b>${x.bWins}</b>${x.draws ? html`<small>分${x.draws}</small>` : ""}</span></div>
        <div class="h2h-row"><span class="h2h-label">ホール</span><span class="h2h-bar">${C.split([{ n: ha, color: db.color(x.a), label: `${nm(x.a)}の勝ち` }, { n: hh, color: "var(--r-par)", label: "引き分け" }, { n: hb, color: db.color(x.b), label: `${nm(x.b)}の勝ち` }])}</span>
          <span class="h2h-score"><b>${ha}</b>–<b>${hb}</b>${hh ? html`<small>分${hh}</small>` : ""}</span></div>
        <p class="h2h-sub">${x.rounds}ラウンド${U.isNum(x.avgDiff) && x.avgDiff !== 0 ? `・平均 ${U.fmt.num(Math.abs(x.avgDiff), 1)} 打差で${nm(x.avgDiff < 0 ? x.a : x.b)}が上` : ""}</p>
      </li>`;
    });
    const h2hSec = U.section("h2h", "対戦成績", h2h.length ? U.figure({
      title: "1対1の勝ち負け", sub: "ストローク＝ラウンド合計で比べた勝敗、ホール＝18ホールそれぞれの勝敗",
      body: html`<ul class="h2hs">${h2hCards}</ul>`, takeaway: h2hTk,
      table: {
        cols: [{ label: "対戦" }, { label: "ストローク", num: true }, { label: "ホール", num: true }, { label: "平均差", num: true }],
        rows: h2h.map((x) => [`${nm(x.a)} vs ${nm(x.b)}`, `${x.aWins}勝${x.bWins}敗${x.draws}分`, `${(x.holes || {}).a || 0}勝${(x.holes || {}).b || 0}敗${(x.holes || {}).halved || 0}分`, U.fmt.diff(x.avgDiff, 1)]),
      },
    }) : U.empty("対戦の記録がまだありません"));

    /* 称号 */
    const T = db.stats.titles || {};
    const titlesSec = U.section("titles", "称号", html`<div class="tcards">${pids.map((p) => html`<div class="tcard" style="${"--c:" + db.color(p)}">
      <p class="tcard-name">${U.chip(p)}<small>${(T[p] || []).length}個</small></p>
      ${(T[p] || []).length ? html`<ul class="tlist">${T[p].map((t) => html`<li class="tl-item"><span class="title-chip">${t.label}</span><span class="tl-desc">${t.desc}</span></li>`)}</ul>` : html`<p class="muted small">まだ称号はありません</p>`}
    </div>`)}</div>`, { lead: "データから自動で付く称号。ラウンドが増えると入れ替わります。" });

    /* 天気 */
    const W = db.stats.weather || {};
    const wRows = W.rows || [];
    let wxBody;
    if (W.enough) {
      const temps = wRows.map((r) => r.temp).filter(U.isNum).sort((a, b) => a - b);
      const med = temps.length ? temps[Math.floor(temps.length / 2)] : null;
      const winds = wRows.map((r) => r.wind).filter(U.isNum).sort((a, b) => a - b);
      const wmed = winds.length ? winds[Math.floor(winds.length / 2)] : null;
      const avgOf = (p, pred) => { const v = wRows.filter(pred).map((r) => r.scores && r.scores[p]).filter(U.isNum); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
      const lines = [];
      const rows = pids.map((p) => {
        const hot = avgOf(p, (r) => U.isNum(r.temp) && r.temp >= med), cool = avgOf(p, (r) => U.isNum(r.temp) && r.temp < med);
        const windy = avgOf(p, (r) => U.isNum(r.wind) && r.wind >= wmed), calm = avgOf(p, (r) => U.isNum(r.wind) && r.wind < wmed);
        if (U.isNum(hot) && U.isNum(cool) && Math.abs(hot - cool) >= 2) lines.push(`${nm(p)}は${hot < cool ? "暑い日" : "涼しい日"}のほうが ${U.fmt.num(Math.abs(hot - cool), 1)} 打良い`);
        if (U.isNum(windy) && U.isNum(calm) && Math.abs(windy - calm) >= 2) lines.push(`${nm(p)}は風が${windy < calm ? "強い日" : "弱い日"}のほうが ${U.fmt.num(Math.abs(windy - calm), 1)} 打良い`);
        return [U.chip(p), U.fmt.avg(hot), U.fmt.avg(cool), U.fmt.avg(windy), U.fmt.avg(calm)];
      });
      wxBody = U.figure({
        title: "気温・風とスコア", sub: `平均気温 ${U.fmt.num(med, 1)}℃・平均風速 ${U.fmt.num(wmed, 1)}m/s を境に分けた平均スコア`,
        body: U.table({ cols: [{ label: "選手" }, { label: "暑い日", num: true }, { label: "涼しい日", num: true }, { label: "風が強い日", num: true }, { label: "風が弱い日", num: true }], rows }),
        takeaway: lines.length ? lines : ["天気による差はまだはっきりしません"],
      });
    } else {
      wxBody = html`<div class="card">
        <p class="wx-wait">${U.pending(U.remain(W.minRounds || 6, wRows.length))}<span>天気とスコアの関係は ${W.minRounds || 6} ラウンドたまったら分析します。</span></p>
        ${wRows.length ? U.table({
          cols: [{ label: "回" }, { label: "天気" }, { label: "気温", num: true }, { label: "風", num: true }].concat(pids.map((p) => ({ label: nm(p), num: true }))),
          rows: wRows.slice().reverse().map((r) => [db.roundLabel(r.roundId) || U.date.short(r.date), r.label || "—", U.isNum(r.temp) ? `${U.fmt.num(r.temp, 1)}℃` : "—", U.isNum(r.wind) ? `${U.fmt.num(r.wind, 1)}m/s` : "—"].concat(pids.map((p) => (r.scores && U.isNum(r.scores[p]) ? String(r.scores[p]) : "—")))),
        }) : ""}
      </div>`;
    }
    const wxSec = U.section("wx", "天気とスコア", wxBody);

    const more = html`<p class="more-links"><a class="btn" href="#/courses">${U.icon("course")}コース別の成績</a><a class="btn" href="#/records">${U.icon("trophy")}記録を見る</a></p>`;

    root.innerHTML = String(html`${head}${scopeBar}${members}${subnav}${board}${trend}${parSec}${halvesSec}${posSec}${stabSec}${distSec}${h2hSec}${titlesSec}${wxSec}${more}`);

    /* 操作 */
    U.onSeg(root, "scope", (v) => {
      scopeId = v;
      KGC.charts.reset();
      render(root);
      KGC.charts.hydrate(root);
    });
    root.querySelectorAll("[data-jump]").forEach((b) => b.addEventListener("click", () => {
      const t = document.getElementById("sec-" + b.dataset.jump);
      if (t) t.scrollIntoView({ behavior: "smooth", block: "start" });
    }));
  }
})();
