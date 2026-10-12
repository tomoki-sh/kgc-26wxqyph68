/* ホーム：最新ラウンドの表紙と順位、ハイライト、選手ごとの成績、スコア推移、各ページへの入口。 */
"use strict";
(function () {
  const KGC = (window.KGC = window.KGC || {});
  KGC.views = KGC.views || {};

  KGC.views.home = (root) => {
    const U = KGC.ui, C = KGC.charts, P = KGC.parts, db = KGC.db, html = U.html;
    const r = db.latest;
    if (!r) {
      root.innerHTML = String(html`<div class="page-head"><h1 class="page-title">${db.site.title || ""}</h1></div>${U.empty("まだラウンドの記録がありません", "最初のラウンドを登録すると、ここに結果が並びます。")}`);
      return;
    }
    const scope = db.scope("all");

    /* 表紙 */
    const cov = U.coverItem(r);
    const hero = html`<section class="hero ${cov ? "has-photo" : "no-photo"}">
      ${cov ? html`<img class="hero-img" ${U.attrs({ "data-enc": cov.src, alt: cov.caption || "" })}>` : html`<div class="hero-art" aria-hidden="true"><img src="emblem.svg" alt=""></div>`}
      <div class="hero-shade" aria-hidden="true"></div>
      <div class="hero-body">
        <p class="hero-kicker">最新ラウンド</p>
        <h1 class="hero-title"><span class="hero-no">第${r.no}回</span>${db.cup ? html` <span class="hero-cup">${db.cup}</span>` : ""}</h1>
        <p class="hero-meta">${U.date.long(r.date)}<span class="sep" aria-hidden="true">｜</span>${db.courseShort(r.course)}</p>
        <div class="hero-chips">${U.wxChip(r.weather, { cls: "on-dark" })}</div>
      </div>
    </section>`;

    /* 結果 */
    const result = U.section("result", `第${r.no}回の結果`, html`<div class="card">
        ${P.podium(r, { halves: true })}
        <a class="card-more" href="${"#/round/" + encodeURIComponent(r.id)}">スコアカード・写真を見る<span aria-hidden="true">›</span></a>
      </div>`);

    const hl = P.highlights(r, 6);
    const hlSec = hl ? U.section("hl", "ハイライト", html`<div class="card">${hl}</div>`) : "";

    /* 選手ごと */
    const titles = (db.stats.titles || {});
    const cards = html`<div class="pcards">${db.players.map((p) => {
      const s = (scope && scope.players && scope.players[p.id]) || {};
      const t = (titles[p.id] || []).slice(0, 3);
      const trend = (s.trend || []).map((x) => x.total);
      return html`<a class="pcard" href="${"#/player/" + encodeURIComponent(p.id)}" style="${"--c:" + db.color(p.id)}">
        <div class="pcard-head">
          <span class="pcard-name">${U.dot(p.id)}${p.display}</span>
          <span class="pcard-sub">${s.rounds || 0}ラウンド</span>
        </div>
        <dl class="kpis">
          <div class="kpi"><dt>平均</dt><dd>${U.fmt.avg(s.avg)}</dd></div>
          <div class="kpi"><dt>ベスト</dt><dd>${U.fmt.int(s.best)}</dd></div>
          <div class="kpi"><dt>前回</dt><dd>${s.last ? U.fmt.int(s.last.total) : "—"}</dd></div>
          ${trend.length >= 3 ? html`<div class="kpi kpi-spark"><dt>推移</dt><dd>${C.spark(trend, db.color(p.id))}</dd></div>` : ""}
        </dl>
        ${t.length ? html`<ul class="titles">${t.map((x) => html`<li class="title-chip">${x.label}</li>`)}</ul>` : ""}
      </a>`;
    })}</div>`;
    const players = U.section("players", "メンバー", cards, { link: ["#/stats", "成績を比べる"] });

    /* 推移 */
    const best = (db.stats.records && db.stats.records.bestRounds && db.stats.records.bestRounds[0]) || null;
    const trend = U.section("trend", "スコア推移", P.trendFigure(scope, {
      title: "1ラウンドの合計",
      takeaway: best ? [`これまでの最少スコアは${db.name(best.player)}の ${best.total}（${db.roundLabel(best.roundId)}）`] : [],
    }));

    /* 入口 */
    const nPhoto = db.rounds.reduce((a, x) => a + (x.media || []).filter((m) => m.type === "photo").length, 0);
    const nVideo = db.rounds.reduce((a, x) => a + (x.media || []).filter((m) => m.type === "video").length, 0);
    const links = [
      ["#/rounds", "flag", "ラウンド", `全${db.rounds.length}回の記録`],
      ["#/stats", "chart", "成績", "得意・不得意を比べる"],
      ["#/records", "trophy", "記録", "ベストスコアと名場面"],
      ["#/album", "photo", "アルバム", [nPhoto ? `写真${nPhoto}枚` : "", nVideo ? `動画${nVideo}本` : ""].filter(Boolean).join("・") || "写真と動画"],
      ["#/courses", "course", "コース", `${db.courses.length}コース`],
    ];
    const nav = U.section("more", "もっと見る", html`<ul class="linkgrid">${links.map((l) => html`<li><a class="linktile" href="${l[0]}">
      <span class="linktile-ico">${U.icon(l[1])}</span><span class="linktile-text"><b>${l[2]}</b><small>${l[3]}</small></span></a></li>`)}</ul>`);

    root.innerHTML = String(html`${hero}<div class="home-grid"><div class="home-main">${result}${hlSec}</div><div class="home-side">${players}</div></div>${trend}${nav}`);
  };
})();
