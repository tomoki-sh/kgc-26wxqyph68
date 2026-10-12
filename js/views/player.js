/* 個人ページ：プロフィールと称号、主要な数字、スコア推移、Par 別（自分の平均と比べて）、前半・後半、内訳、
   ホールの位置、安定感、連続記録、○○切り、自己ベストの歴史、コース別、ラウンド一覧。 */
"use strict";
(function () {
  const KGC = (window.KGC = window.KGC || {});
  KGC.views = KGC.views || {};

  KGC.views.player = (root, data, params) => {
    const U = KGC.ui, C = KGC.charts, P = KGC.parts, db = KGC.db, html = U.html;
    const p = db.player(params.id);
    if (!p) {
      root.innerHTML = String(html`<div class="page-head"><h1 class="page-title">メンバーが見つかりません</h1></div>${U.empty("指定されたメンバーはいません。")}<p class="center"><a class="btn" href="#/stats">成績へ</a></p>`);
      return;
    }
    KGC.app.setTitle(p.display || p.name);
    const scope = db.scope("all");
    const s = (scope && scope.players && scope.players[p.id]) || {};
    const color = db.color(p.id);
    const titles = (db.stats.titles || {})[p.id] || [];
    const lbRow = ((scope && scope.group && scope.group.leaderboard) || []).find((x) => x.player === p.id) || {};
    const ins = (scope && scope.group && scope.group.insights) || {};
    const n = db.nPlayers;
    const rankIn = (key) => { const row = (ins[key] || []).find((x) => x.player === p.id); return row ? row.rank : null; };

    /* 見出し */
    const others = db.players.filter((x) => x.id !== p.id);
    const head = html`<header class="profile" style="${"--c:" + color}">
      <div class="profile-mark" aria-hidden="true"><span>${(p.display || p.name || "").slice(0, 1)}</span></div>
      <div class="profile-text">
        <p class="kicker">MEMBER</p>
        <h1 class="page-title">${p.name || p.display}</h1>
        <p class="page-meta">${U.dot(p.id)} <b>${p.display}</b><span class="sep" aria-hidden="true">｜</span>${s.rounds || 0}ラウンド・優勝${lbRow.wins || 0}回${lbRow.ties ? `（同率${lbRow.ties}）` : ""}</p>
      </div>
    </header>
    ${others.length ? html`<nav class="pswitch" aria-label="ほかのメンバー"><span>ほかのメンバー</span>${others.map((x) => U.chip(x.id))}</nav>` : ""}`;

    if (!s.rounds && !s.holes) {
      root.innerHTML = String(html`${head}${U.empty("まだラウンドの記録がありません")}`);
      return;
    }

    /* 称号 */
    const tsec = titles.length ? U.section("titles", "称号", html`<ul class="tlist">${titles.map((t) => html`<li class="tl-item"><span class="title-chip">${t.label}</span><span class="tl-desc">${t.desc}</span></li>`)}</ul>`) : "";

    /* 主要な数字 */
    const hcNeed = 3;
    const kpi = (label, value, sub, cls) => html`<div class="${"ktile " + (cls || "")}"><p class="kt-label">${label}</p><p class="kt-value">${value}</p>${sub ? html`<p class="kt-sub">${sub}</p>` : ""}</div>`;
    const lastR = s.last ? db.round(s.last.roundId) : null;
    const kpis = html`<div class="ktiles">
      ${kpi("ラウンド", String(s.rounds || 0), s.holes ? `${s.holes}ホール` : "")}
      ${kpi("平均", U.fmt.avg(s.avg), U.isNum(s.avgToPar) ? `パー${U.fmt.diff(s.avgToPar, 1)}` : "")}
      ${kpi("ベスト", U.fmt.int(s.best), s.worst != null ? `ワースト ${s.worst}` : "", "is-gold")}
      ${kpi("前回", s.last ? U.fmt.int(s.last.total) : "—", lastR ? `第${lastR.no}回` : "")}
      ${kpi("ステーブルフォード", s.stableford && U.isNum(s.stableford.avg) ? U.fmt.num(s.stableford.avg, 1) : "—", s.stableford && U.isNum(s.stableford.best) ? `平均点・最高 ${s.stableford.best}` : "平均点")}
      ${kpi("ハンディキャップ", U.isNum(s.handicap) ? U.fmt.num(s.handicap, 1) : U.pending(U.remain(hcNeed, s.rounds)), U.isNum(s.handicap) ? "簡易計算（参考）" : `${hcNeed}ラウンドで表示`)}
    </div>`;
    const kpiSec = U.section("kpi", "主要な数字", kpis);

    /* 推移 */
    const trend = U.section("trend", "スコア推移", P.trendFigure(scope, { pids: [p.id], title: "1ラウンドの合計", h: 210,
      takeaway: [U.isNum(s.stdev) ? `スコアのブレ（標準偏差）±${U.fmt.num(s.stdev, 1)}` : `スコアのブレは${hcNeed}ラウンドから表示（${U.remain(hcNeed, s.rounds)}）`,
        U.isNum(s.form) ? `直近3ラウンドは通算平均より ${U.fmt.diff(s.form, 1)} 打` : ""] }));

    /* Par 別 */
    const base = s.avgToParPerHole;
    const pts = ["3", "4", "5"].filter((pt) => s.parType && s.parType[pt] && s.parType[pt].n);
    let parSec = "";
    if (pts.length) {
      const rows = pts.map((pt) => ({ pt, ...s.parType[pt], rel: U.isNum(base) && U.isNum(s.parType[pt].toPar) ? s.parType[pt].toPar - base : null }));
      const valid = rows.filter((r) => U.isNum(r.rel));
      const bestRel = valid.length ? valid.reduce((a, b) => (b.rel < a.rel ? b : a)) : null;
      const worstRel = valid.length ? valid.reduce((a, b) => (b.rel > a.rel ? b : a)) : null;
      const chart = C.slot((el, w) => C.bars(el, w, {
        label: "Par別の平均",
        groups: [{ rows: rows.map((r) => ({
          label: `Par${r.pt}`, value: r.toPar, color, strong: bestRel && r.pt === bestRel.pt,
          text: U.fmt.toParAvg(r.toPar),
          tip: { title: `Par${r.pt}（${r.n}ホール）`, rows: [{ color, value: U.fmt.toParAvg(r.toPar), label: "1ホールの平均（パーとの差）" }, { value: U.fmt.toParAvg(r.rel), label: "自分の平均との差" }, { value: U.fmt.pct(r.parOrBetter), label: "パー以内率" }] },
        })) }],
        refs: U.isNum(base) ? [{ value: base, label: `自分の平均 ${U.fmt.toParAvg(base)}` }] : [],
      }), { minH: 120 });
      const lines = [];
      if (bestRel && bestRel.rel < -0.05) lines.push(`得意は Par${bestRel.pt}（自分の平均より ${U.fmt.toParAvg(bestRel.rel)} 打/H）`);
      if (worstRel && worstRel !== bestRel && worstRel.rel > 0.05) lines.push(`課題は Par${worstRel.pt}（自分の平均より ${U.fmt.toParAvg(worstRel.rel)} 打/H）`);
      const firsts = pts.filter((pt) => { const rk = ((ins.parType || {})[pt] || []).find((x) => x.player === p.id); return rk && rk.rank === 1; });
      if (firsts.length && n > 1) lines.push(`${firsts.map((pt) => "Par" + pt).join("・")} は${n}人の中で一番得意`);
      parSec = U.section("par", "Par 別", U.figure({
        title: "Par 別の平均", sub: "1ホールあたりのパーとの差・線は自分の全ホール平均",
        body: chart, takeaway: lines,
        table: { cols: [{ label: "種類" }, { label: "ホール数", num: true }, { label: "平均打数", num: true }, { label: "パーとの差", num: true }, { label: "自分の平均との差", num: true }, { label: "パー以内率", num: true }],
          rows: rows.map((r) => [`Par${r.pt}`, String(r.n), U.fmt.num(r.avg, 2), U.fmt.toParAvg(r.toPar), U.fmt.toParAvg(r.rel), U.fmt.pct(r.parOrBetter)]) },
      }));
    }

    /* 前半・後半 */
    const bmf = s.backMinusFront;
    const fbType = !U.isNum(bmf) ? "" : bmf <= -1.5 ? "後半型" : bmf >= 1.5 ? "前半型" : "ペース型";
    const fb = U.section("halves", "前半・後半", html`<div class="card">
      <div class="ktiles ktiles-3">
        ${kpi("前半", U.fmt.avg(s.front), "最初の9H")}
        ${kpi("後半", U.fmt.avg(s.back), "後の9H")}
        ${kpi("後半−前半", U.isNum(bmf) ? U.fmt.diff(bmf, 1) : "—", fbType ? html`<span class="${"fbtag " + (fbType === "ペース型" ? "is-pace" : "")}">${fbType}</span>` : "", "is-diff")}
      </div>
      <div class="ktiles ktiles-2 ktiles-sub">
        ${kpi("OUT（1〜9番）", U.fmt.avg(s.out), "")}
        ${kpi("IN（10〜18番）", U.fmt.avg(s.in), "")}
      </div>
      <p class="fig-note">前半・後半はプレーした順（IN スタートなら IN が前半）。OUT・IN はホール番号で分けた平均。</p>
    </div>`);

    /* 内訳 */
    const dist = s.dist || {};
    const distSec = s.holes ? U.section("dist", "結果の内訳", U.figure({
      title: "全ホールの結果", sub: `${s.holes}ホール`,
      legend: P.resultLegend(),
      body: C.slot((el, w) => C.divstack(el, w, { label: "結果の内訳", rows: [{ label: p.display, rate: s.distRate || {}, count: dist, n: s.holes }] }), { minH: 70 }),
      table: { cols: [{ label: "結果" }, { label: "回数", num: true }, { label: "割合", num: true }], rows: U.CATS.map((c) => [U.CAT_LABEL[c], String(dist[c] || 0), U.fmt.pct((s.distRate || {})[c])]) },
      takeaway: [`パー以内 ${U.fmt.pct(s.parOrBetter)}・ボギー以内 ${U.fmt.pct(s.bogeyOrBetter)}・トリプル以上 ${U.fmt.pct(s.blowup)}`, s.birdiesOrBetter ? `バーディー以上 ${s.birdiesOrBetter} 回` : ""],
    })) : "";

    /* ホールの位置 */
    const segs = (s.segments || []).filter((x) => x);
    let posSec = "";
    if (segs.length) {
      const chart = C.slot((el, w) => C.line(el, w, {
        label: "ホールの位置ごとの平均", h: 190, zero: true,
        x: segs.map((g) => ({ label: `${g.from}–${g.to}`, title: `${g.from}〜${g.to}ホール目` })),
        series: [{ id: p.id, name: p.display, color, values: segs.map((g) => g.toPar) }],
        divider: segs.length === 6 ? { after: 2, labels: ["前半", "後半"] } : null,
        fmt: (v) => U.fmt.toParAvg(v), endLabel: (se, v) => U.fmt.toParAvg(v),
      }), { minH: 190 });
      posSec = U.section("pos", "スタート・昼イチ・上がり", html`<div class="ktiles ktiles-4">
          ${kpi("1ホール目", U.fmt.toParAvg(s.firstHole), "平均・パーとの差")}
          ${kpi("スタート3H", U.fmt.toParAvg(s.start3), "1〜3ホール目")}
          ${kpi("昼イチ", U.fmt.toParAvg(s.lunchHole), "後半の1ホール目")}
          ${kpi("上がり3H", U.fmt.toParAvg(s.last3), "16〜18ホール目")}
        </div>
        ${U.figure({
          title: "3ホールごとの平均（パーとの差／ホール）", sub: "プレー順・低いほど良い",
          body: chart,
          table: { cols: [{ label: "ホール目" }, { label: "平均", num: true }], rows: segs.map((g) => [`${g.from}〜${g.to}`, U.fmt.toParAvg(g.toPar)]) },
          takeaway: U.isNum(base) ? [U.isNum(s.start3) ? `スタート3Hは自分の平均より ${U.fmt.toParAvg(s.start3 - base)} 打/H` : "", U.isNum(s.last3) ? `上がり3Hは自分の平均より ${U.fmt.toParAvg(s.last3 - base)} 打/H` : ""] : [],
        })}`);
    }

    /* 安定感 */
    const stab = [
      ["ホールのブレ", U.fmt.num(s.holeStdev, 2), "1ホールの打数（パーとの差）の標準偏差。小さいほど安定", "holeStdev"],
      ["トリプル以上率", U.fmt.pct(s.blowup), "大叩きの割合。低いほど良い", "blowup"],
      ["ボギー以内率", U.fmt.pct(s.bogeyOrBetter), "ボギー以内で上がった割合", "bogeyOrBetter"],
      ["バウンスバック率", U.fmt.pct(s.bounceBack && s.bounceBack.rate), `ボギー以上の次のホールをパー以内（${s.bounceBack ? `${s.bounceBack.ok}/${s.bounceBack.n}` : "—"}）`, "bounceBack"],
      ["立て直し率", U.fmt.pct(s.recovery && s.recovery.rate), `ダボ以上の次をボギー以内（${s.recovery ? `${s.recovery.ok}/${s.recovery.n}` : "—"}）`, "recovery"],
      ["崩れの連鎖率", U.fmt.pct(s.chain && s.chain.rate), `ダボ以上の次もダボ以上（${s.chain ? `${s.chain.hit}/${s.chain.n}` : "—"}）・低いほど良い`, null],
      ["スコアのブレ", U.isNum(s.stdev) ? "±" + U.fmt.num(s.stdev, 1) : U.pending(U.remain(3, s.rounds)), "ラウンド合計の標準偏差", "stdev"],
    ];
    const stabSec = U.section("stab", "安定感", html`<div class="card"><dl class="stab">${stab.map((x) => {
      const rk = x[3] ? rankIn(x[3]) : null;
      return html`<div class="stab-row"><dt><b>${x[0]}</b><small>${x[2]}</small></dt><dd><span class="stab-val">${x[1]}</span>${rk ? html`<span class="${"stab-rank " + (rk === 1 ? "is-top" : "")}">${n}人中${rk}位</span>` : ""}</dd></div>`;
    })}</dl></div>`);

    /* 連続記録 */
    const st = s.streaks || {};
    const stTile = (label, x, unit, cls) => {
      if (!x || !x.len) return html`<div class="${"ktile " + (cls || "")}"><p class="kt-label">${label}</p><p class="kt-value">—</p></div>`;
      const r = db.round(x.roundId);
      return html`<a class="${"ktile is-link " + (cls || "")}" href="${"#/round/" + encodeURIComponent(x.roundId)}"><p class="kt-label">${label}</p><p class="kt-value">${x.len}<small>${unit}</small></p>
        <p class="kt-sub">${r ? `第${r.no}回` : U.date.short(x.date)}・${x.fromSeq === x.toSeq ? `${x.fromSeq}H` : `${x.fromSeq}〜${x.toSeq}H`}</p></a>`;
    };
    const stSec = U.section("streaks", "連続記録", html`<p class="sec-lead">1ラウンドの中で続いたホール数（ダボ以上はワースト記録）。</p><div class="ktiles ktiles-3">
      ${stTile("パー以内", st.parOrBetter, "連続", "is-gold")}${stTile("ボギー以内", st.bogeyOrBetter, "連続")}${stTile("ダボ以上", st.doubleOrWorse, "連続", "is-bad")}
    </div>`);

    /* ○○切り */
    const ms = s.milestones || {};
    const msSec = U.section("miles", "○○切り", html`<div class="ktiles ktiles-3">${["100", "90", "80"].map((k) => {
      const x = ms[k] || {};
      if (x.count) {
        const r = db.round(x.firstRoundId);
        return html`<a class="ktile is-link is-done" href="${"#/round/" + encodeURIComponent(x.firstRoundId)}"><p class="kt-label">${k}切り</p><p class="kt-value">${U.icon("medal")}達成</p><p class="kt-sub">初 ${r ? `第${r.no}回` : U.date.short(x.first)}・計${x.count}回</p></a>`;
      }
      const gap = U.isNum(s.best) ? s.best - (Number(k) - 1) : null;
      return html`<div class="ktile is-todo"><p class="kt-label">${k}切り</p><p class="kt-value">未達成</p><p class="kt-sub">${U.isNum(gap) && gap > 0 ? `ベストまであと ${gap} 打` : ""}</p></div>`;
    })}</div>`);

    /* 自己ベストの歴史 */
    const pbs = s.pbHistory || [];
    const pbSec = pbs.length ? U.section("pb", "自己ベストの歴史", html`<div class="card"><ol class="pbh">${pbs.map((x, i) => {
      const r = db.round(x.roundId);
      const prev = i ? pbs[i - 1].total : null;
      return html`<li><a href="${"#/round/" + encodeURIComponent(x.roundId)}"><span class="pbh-total">${x.total}</span>
        <span class="pbh-meta"><b>${r ? `第${r.no}回` : ""}</b>${r ? db.courseShort(r.course) : ""}<small>${U.date.mid(x.date)}</small></span>
        <span class="pbh-tag">${x.first ? "初ラウンド" : `${U.fmt.diff(x.total - prev, 0)} 更新`}</span></a></li>`;
    })}</ol></div>`) : "";

    /* コース別 */
    const cs = s.courses || {};
    const cids = Object.keys(cs);
    const cSec = cids.length ? U.section("courses", "コース別", html`<div class="card">${U.table({
      cols: [{ label: "コース" }, { label: "回数", num: true }, { label: "平均", num: true }, { label: "ベスト", num: true }],
      rows: cids.map((cid) => [html`<a href="${"#/course/" + encodeURIComponent(cid)}">${db.courseShort(cid)}</a>`, String(cs[cid].rounds), U.fmt.avg(cs[cid].avg), U.fmt.int(cs[cid].best)]),
    })}</div>`) : "";

    /* ラウンド一覧 */
    const mine = db.rounds.filter((r) => (r.scores || []).some((x) => x.player === p.id)).reverse();
    const rlSec = U.section("rounds", "ラウンド", html`<div class="card"><ul class="prounds">${mine.map((r) => {
      const sc = r.scores.find((x) => x.player === p.id) || {};
      const rk = U.ranking(r).find((x) => x.player === p.id);
      return html`<li><a href="${"#/round/" + encodeURIComponent(r.id)}">
        <span class="pr-no">第${r.no}回</span>
        <span class="pr-meta"><b>${db.courseShort(r.course)}</b><small>${U.date.mid(r.date)}${sc.halves && sc.halves.length === 2 ? `・${sc.halves[0]}／${sc.halves[1]}` : ""}</small></span>
        <span class="pr-score"><b>${U.isNum(sc.total) ? sc.total : "—"}</b><small>${U.fmt.toPar(sc.toPar)}</small></span>
        <span class="${"pr-rank " + (rk && rk.rank === 1 ? "is-win" : "")}">${rk ? (rk.rank === 1 ? html`${U.icon("crown")}優勝` : `${rk.rank}位`) : ""}</span>
      </a></li>`;
    })}</ul></div>`);

    root.innerHTML = String(html`${head}${tsec}${kpiSec}${trend}${parSec}<div class="grid-2">${fb}${distSec}</div>${posSec}${stabSec}<div class="grid-2">${stSec}${msSec}</div><div class="grid-2">${pbSec}${cSec}</div>${rlSec}`);
  };
})();
