/* コース：回ったコースの一覧と、コースごとの詳細（ホール別の難しさのヒートマップ、難しい・やさしいホール、Par の並び）。 */
"use strict";
(function () {
  const KGC = (window.KGC = window.KGC || {});
  KGC.views = KGC.views || {};

  // 平均の対パーを地の色にする（金＝パーより良い、赤＝悪い）
  function heatStyle(v) {
    if (typeof v !== "number" || !isFinite(v) || Math.abs(v) < 0.005) return "";
    const a = v > 0 ? Math.min(1, v / 3) : Math.min(1, -v / 1.5);
    const alpha = (0.1 + a * 0.9).toFixed(3);
    return `background:rgb(var(${v > 0 ? "--heat-over" : "--heat-under"}) / calc(var(--heat-max) * ${alpha}))`;
  }

  function courseRounds(cid) {
    return KGC.db.rounds.filter((r) => r.course === cid);
  }

  KGC.views.courses = (root) => {
    const U = KGC.ui, db = KGC.db, html = U.html;
    KGC.app.setTitle("コース");
    const cs = db.stats.courses || {};
    const list = db.courses.filter((c) => cs[c.id]).map((c) => ({ c, s: cs[c.id], rounds: courseRounds(c.id) }))
      .sort((a, b) => (b.s.visits - a.s.visits) || ((b.rounds[b.rounds.length - 1] || {}).date || "").localeCompare((a.rounds[a.rounds.length - 1] || {}).date || ""));
    const head = html`<header class="page-head"><p class="kicker">COURSES</p><h1 class="page-title">コース</h1>
      <p class="page-lead">これまでに回った${list.length}コース。コースごとの平均とベスト。</p></header>`;
    if (!list.length) { root.innerHTML = String(html`${head}${U.empty("まだコースの記録がありません")}`); return; }
    const cards = list.map(({ c, s, rounds }) => {
      const last = rounds[rounds.length - 1];
      const pids = db.players.map((p) => p.id).filter((p) => s.players && s.players[p]);
      return html`<li><a class="ccard" href="${"#/course/" + encodeURIComponent(c.id)}">
        <div class="ccard-head">
          <h2 class="ccard-name">${c.name}</h2>
          <p class="ccard-meta">${[c.area, `${s.visits}回`, last ? `最後 ${U.date.mid(last.date)}` : ""].filter(Boolean).join("・")}</p>
        </div>
        <table class="tbl ccard-tbl"><thead><tr><th scope="col">選手</th><th scope="col" class="num">平均</th><th scope="col" class="num">ベスト</th><th scope="col" class="num">回数</th></tr></thead>
        <tbody>${pids.map((p) => { const x = s.players[p]; return html`<tr><th scope="row">${U.chip(p, { link: false })}</th><td class="num">${U.fmt.avg(x.avg)}</td><td class="num">${U.fmt.int(x.best)}</td><td class="num">${x.rounds}</td></tr>`; })}</tbody></table>
      </a></li>`;
    });
    root.innerHTML = String(html`${head}<ul class="clist">${cards}</ul>`);
  };

  KGC.views.course = (root, data, params) => {
    const U = KGC.ui, db = KGC.db, html = U.html;
    const c = db.course(params.id);
    const s = (db.stats.courses || {})[params.id];
    if (!c || !s) {
      root.innerHTML = String(html`<div class="page-head"><h1 class="page-title">コースが見つかりません</h1></div>${U.empty("指定されたコースの記録はありません。")}<p class="center"><a class="btn" href="#/courses">コース一覧へ</a></p>`);
      return;
    }
    KGC.app.setTitle(c.short || c.name);
    const rounds = courseRounds(c.id);
    const pids = db.players.map((p) => p.id).filter((p) => (s.holes || []).some((h) => h.byPlayer && h.byPlayer[p] != null) || (s.players && s.players[p]));
    const head = html`<header class="page-head"><p class="kicker">COURSE</p><h1 class="page-title">${c.name}</h1>
      <p class="page-meta">${[c.area, `${s.visits}回プレー`].filter(Boolean).join("・")}</p></header>`;

    /* 選手ごと */
    const pl = U.section("players", "このコースの成績", html`<div class="card">${U.table({
      cols: [{ label: "選手" }, { label: "回数", num: true }, { label: "平均", num: true }, { label: "ベスト", num: true }],
      rows: pids.filter((p) => s.players && s.players[p]).map((p) => { const x = s.players[p]; return [U.chip(p), String(x.rounds), U.fmt.avg(x.avg), U.fmt.int(x.best)]; }),
    })}</div>`);

    /* Par の並び */
    const nines = Object.keys(c.nines || {}).map((k) => ({ key: k, ...c.nines[k] }));
    const layout = U.section("layout", "Par の並び", html`<div class="card"><div class="parstrips">${nines.map((n) => html`<div class="parstrip">
      <p class="parstrip-head"><b>${n.label || n.key}</b><span>Par ${(n.par || []).reduce((a, b) => a + b, 0)}</span></p>
      <ol class="parstrip-row">${(n.holes || []).map((no, i) => html`<li class="${"ps ps-" + n.par[i]}"><span class="ps-no">${no}</span><span class="ps-par">${n.par[i]}</span></li>`)}</ol>
    </div>`)}</div><p class="fig-note">上段がホール番号、下段が Par。Par3 は淡く、Par5 は濃く表示。</p></div>`);

    /* ヒートマップ */
    const holes = s.holes || [];
    const byNine = [];
    holes.forEach((h) => { let g = byNine.find((x) => x.nine === h.nine); if (!g) { g = { nine: h.nine, label: h.nineLabel || h.nine, holes: [] }; byNine.push(g); } g.holes.push(h); });
    const cell = (v, extra) => html`<td class="num heat-cell" style="${heatStyle(v)}" ${U.raw(KGC.charts.tipAttr(extra.title, [{ value: U.fmt.toParAvg(v, 2), label: extra.label }]))}>${typeof v === "number" ? U.fmt.toParAvg(v, 1) : "—"}</td>`;
    const heat = holes.length ? html`<div class="card heat-card">
      <ul class="heat-legend" aria-label="色の意味">
        <li><i style="${heatStyle(-1.5)}"></i>パーより良い</li><li><i class="heat-zero"></i>パー</li><li><i style="${heatStyle(1)}"></i>+1</li><li><i style="${heatStyle(2)}"></i>+2</li><li><i style="${heatStyle(3)}"></i>+3以上</li>
      </ul>
      <div class="tbl-wrap"><table class="tbl heat">
        <thead><tr><th scope="col">H</th><th scope="col" class="num">Par</th>${pids.map((p) => html`<th scope="col" class="num heat-pl">${U.dot(p)}<span>${db.name(p)}</span></th>`)}<th scope="col" class="num heat-all">全体</th></tr></thead>
        <tbody>${byNine.map((g) => html`<tr class="heat-nine"><th colspan="${pids.length + 3}" scope="colgroup">${g.label}</th></tr>${g.holes.map((h) => html`<tr>
          <th scope="row">${h.no}</th><td class="num heat-par">${h.par}</td>
          ${pids.map((p) => cell(h.byPlayer ? h.byPlayer[p] : null, { title: `${g.label} ${h.no}番 Par${h.par}`, label: db.name(p) }))}
          ${cell(h.toPar, { title: `${g.label} ${h.no}番 Par${h.par}`, label: `全体（${h.n}回分）` })}
        </tr>`)}`)}</tbody>
      </table></div>
      <p class="fig-note">各ホールの平均（パーとの差）。全体はのべ${holes.length ? holes[0].n : 0}回分の平均。回数が少ないうちは参考値です。</p>
    </div>` : U.empty("ホールごとの記録がありません");
    const heatSec = U.section("heat", "ホール別の難しさ", heat);

    /* 難しい・やさしい */
    const find = (pair) => holes.find((h) => h.nine === pair[0] && h.no === pair[1]);
    const hlist = (pairs, cls) => html`<ol class="${"holes-rank " + cls}">${(pairs || []).map(find).filter(Boolean).map((h, i) => html`<li>
      <span class="hr-rank">${i + 1}</span><span class="hr-name"><b>${h.nineLabel || h.nine} ${h.no}番</b><small>Par${h.par}・平均 ${U.fmt.num(h.avg, 2)}打</small></span>
      <span class="hr-val" style="${heatStyle(h.toPar)}">${U.fmt.toParAvg(h.toPar, 2)}</span></li>`)}</ol>`;
    const hard = U.section("hardest", "難しい・やさしいホール", html`<div class="grid-2 inner">
      <div class="card"><h3 class="sub-title first">難しいホール</h3>${hlist(s.hardest, "is-hard")}</div>
      <div class="card"><h3 class="sub-title first">やさしいホール</h3>${hlist(s.easiest, "is-easy")}</div>
    </div>`);

    /* ラウンド */
    const rl = U.section("rounds", "このコースのラウンド", html`<ul class="mini-rounds">${rounds.slice().reverse().map((r) => {
      const w = U.winners(r);
      return html`<li><a href="${"#/round/" + encodeURIComponent(r.id)}"><b>第${r.no}回</b><span>${U.date.mid(r.date)}</span>${w.length ? html`<span class="mr-win">${U.icon("crown")}${w.map((p) => db.name(p)).join("・")}</span>` : ""}<span class="mr-go" aria-hidden="true">›</span></a></li>`;
    })}</ul>`);

    root.innerHTML = String(html`${head}${pl}${heatSec}${hard}${layout}${rl}`);
  };
})();
