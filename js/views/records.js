/* 記録：ベストスコア、ベストハーフ、パー以内の最多、連続記録、バーディー一覧、初の○○切り、優勝回数、
   ホールインワン、（ネタ枠）大叩き。各行からそのラウンドへ飛べる。 */
"use strict";
(function () {
  const KGC = (window.KGC = window.KGC || {});
  KGC.views = KGC.views || {};

  // 同じ値は同じ順位
  function ranks(rows, key) {
    let prev = null, rank = 0;
    return rows.map((r, i) => { const v = key(r); if (v !== prev) { rank = i + 1; prev = v; } return rank; });
  }

  function recList(rows, opt) {
    const U = KGC.ui, db = KGC.db, html = U.html;
    if (!rows || !rows.length) return U.empty(opt.empty || "まだ記録がありません");
    const rk = opt.rankKey ? ranks(rows, opt.rankKey) : rows.map((_, i) => i + 1);
    return html`<ol class="${"recs " + (opt.cls || "")}">${rows.map((r, i) => {
      const round = db.round(r.roundId);
      const meta = [round ? `第${round.no}回` : "", db.courseShort(r.course), U.date.dot(r.date)].filter(Boolean).join("・");
      const extra = opt.extra ? opt.extra(r) : "";
      return html`<li><a class="rec" href="${"#/round/" + encodeURIComponent(r.roundId)}">
        ${opt.noRank ? "" : html`<span class="${"rec-rank rk" + Math.min(4, rk[i])}">${rk[i]}</span>`}
        <span class="rec-main"><span class="rec-top">${U.chip(r.player, { link: false })}${extra ? html`<span class="rec-extra">${extra}</span>` : ""}</span><small class="rec-meta">${meta}</small></span>
        <span class="rec-val">${opt.value(r)}</span>
      </a></li>`;
    })}</ol>`;
  }

  KGC.views.records = (root) => {
    const U = KGC.ui, db = KGC.db, html = U.html;
    KGC.app.setTitle("記録");
    const rec = db.stats.records || {};
    const scope = db.scope("all");
    const seq = (r) => (typeof r.fromSeq === "number" ? (r.fromSeq === r.toSeq ? `${r.fromSeq}H目` : `${r.fromSeq}〜${r.toSeq}H目`) : "");
    const val = (main, sub) => html`<b>${main}</b>${sub ? html`<small>${sub}</small>` : ""}`;

    const head = html`<header class="page-head"><p class="kicker">RECORDS</p><h1 class="page-title">記録</h1>
      <p class="page-lead">全${db.rounds.length}ラウンドの名場面。押すとそのラウンドへ。</p></header>`;

    const best = U.section("best", "ベストスコア", html`<div class="card">${recList(rec.bestRounds, { rankKey: (r) => r.total, value: (r) => val(r.total, U.fmt.toPar(r.toPar)) })}</div>`);
    const halves = U.section("halves", "ベストハーフ", html`<div class="card">${recList(rec.bestHalves, {
      rankKey: (r) => r.toPar, value: (r) => val(r.score, U.fmt.toPar(r.toPar)), extra: (r) => r.nine || "",
    })}</div>`, { lead: "9ホールのスコア。パーとの差の小さい順。" });
    const pars = U.section("pars", "パー以内が多かったラウンド", html`<div class="card">${recList(rec.mostPars, {
      rankKey: (r) => r.count, value: (r) => val(r.count, "ホール"),
    })}</div>`);

    const streaks = U.section("streaks", "連続記録", html`<div class="grid-2 inner">
      <div><h3 class="sub-title">連続パー以内</h3><div class="card">${recList(rec.parStreaks, { rankKey: (r) => r.len, value: (r) => val(r.len, "連続"), extra: seq })}</div></div>
      <div><h3 class="sub-title">連続ボギー以内</h3><div class="card">${recList(rec.bogeyStreaks, { rankKey: (r) => r.len, value: (r) => val(r.len, "連続"), extra: seq })}</div></div>
    </div>`, { lead: "1ラウンドの中で続いたホール数。" });

    /* 初の○○切り */
    const ms = ["100", "90", "80"];
    const msRows = db.players.map((p) => {
      const m = ((scope && scope.players[p.id]) || {}).milestones || {};
      return [U.chip(p.id)].concat(ms.map((k) => {
        const x = m[k];
        if (!x || !x.count) return { v: html`<span class="ms-no">未達成</span>`, cls: "ms" };
        const r = db.round(x.firstRoundId);
        return { v: html`<a class="ms-yes" href="${"#/round/" + encodeURIComponent(x.firstRoundId)}">${r ? `第${r.no}回` : U.date.short(x.first)}</a><small>${x.count}回</small>`, cls: "ms" };
      }));
    });
    const miles = U.section("miles", "初の○○切り", html`<div class="card">${U.table({
      cols: [{ label: "選手" }, { label: "100切り" }, { label: "90切り" }, { label: "80切り" }], rows: msRows, cls: "ms-table",
    })}<p class="fig-note">達成した最初のラウンドと、これまでの達成回数。</p></div>`);

    /* 優勝回数 */
    const lb = ((scope && scope.group && scope.group.leaderboard) || []).slice().sort((a, b) => (b.wins - a.wins) || (b.ties - a.ties));
    const maxW = Math.max(1, ...lb.map((x) => x.wins + x.ties));
    const wins = U.section("wins", "優勝回数", html`<div class="card"><ul class="wins">${lb.map((x) => html`<li>
      ${U.chip(x.player)}
      <span class="wins-bar"><i style="${`width:${Math.round(((x.wins + x.ties) / maxW) * 100)}%;background:${db.color(x.player)}`}"></i></span>
      <span class="wins-val"><b>${x.wins}</b>回${x.ties ? html`<small>（同率${x.ties}）</small>` : ""}</span>
    </li>`)}</ul><p class="fig-note">${scope ? `全${(scope.roundIds || []).length}ラウンド。` : ""}同スコアで並んだ優勝は「同率」に数えます。</p></div>`);

    /* バーディー */
    const birdies = (rec.birdies || []).slice().reverse();
    const bird = U.section("birdies", "バーディー以上", birdies.length ? html`<div class="card">${recList(birdies, {
      noRank: true, extra: (r) => `${r.nine || ""} ${r.no}番 Par${r.par}`,
      value: (r) => html`<span class="${"bird-mark " + (r.toPar <= -2 ? "is-eagle" : "")}"><span class="${"mk " + (r.toPar <= -2 ? "mk-eagle" : "mk-birdie")}">${r.strokes}</span></span>`,
    })}<p class="fig-note">全${birdies.length}回（新しい順）。</p></div>` : U.empty("まだバーディーはありません"));

    /* ホールインワン */
    const hio = rec.holeInOnes || [];
    const hioSec = U.section("hio", "ホールインワン", hio.length ? html`<div class="card">${recList(hio, { noRank: true, extra: (r) => `${r.nine || ""} ${r.no}番 Par${r.par}`, value: () => html`<b>1</b><small>打</small>` })}</div>`
      : html`<div class="empty hio-empty"><p class="hio-ico">${U.icon("flag")}</p><p>まだ誰も達成していません</p><p class="empty-sub">最初の1人は、ここに名前が刻まれます。</p></div>`);

    /* 大叩き */
    const blow = U.section("blowups", "大叩き（ネタ枠）", html`<div class="card">${recList(rec.blowups, {
      rankKey: (r) => -r.toPar, extra: (r) => `${r.nine || ""} ${r.no}番 Par${r.par}`, value: (r) => val(r.strokes + "打", U.fmt.toPar(r.toPar)), cls: "recs-blow",
    })}</div>`, { lead: "1ホールで一番叩いた記録。笑って次へ。" });

    root.innerHTML = String(html`${head}<div class="grid-2">${best}${halves}</div>${wins}${miles}${pars}${streaks}${bird}${hioSec}${blow}`);
  };
})();
