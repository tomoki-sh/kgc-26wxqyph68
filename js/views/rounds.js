/* ラウンド一覧：新しい順のカード（写真・第N回・日付・コース・天気・各選手のスコアと順位）。年ごとに区切る。 */
"use strict";
(function () {
  const KGC = (window.KGC = window.KGC || {});
  KGC.views = KGC.views || {};

  function card(r) {
    const U = KGC.ui, db = KGC.db, html = U.html;
    const rk = U.ranking(r);
    const thumb = U.thumbItem(r);
    const nPhoto = (r.media || []).filter((m) => m.type === "photo").length;
    const nVideo = (r.media || []).filter((m) => m.type === "video").length;

    return html`<li><a class="rcard" href="${"#/round/" + encodeURIComponent(r.id)}">
      <div class="rcard-thumb">
        ${thumb ? html`<img ${U.attrs({ "data-enc": thumb, alt: "" })}>` : html`<span class="rcard-ph" aria-hidden="true"><img src="emblem.svg" alt=""></span>`}
        <span class="rcard-no">第${r.no}回</span>
      </div>
      <div class="rcard-body">
        <p class="rcard-date">${U.date.long(r.date)}</p>
        <h2 class="rcard-course">${db.courseShort(r.course)}</h2>
        <p class="rcard-meta">${U.wxChip(r.weather)}${nPhoto ? html`<span class="rcard-media">${U.icon("photo")}写真${nPhoto}</span>` : ""}${nVideo ? html`<span class="rcard-media">${U.icon("film")}動画${nVideo}</span>` : ""}${r.nines && r.nines.length === 1 ? html`<span class="rcard-media">9ホール</span>` : ""}</p>
        ${rk.length ? html`<ol class="rcard-scores">${rk.map((x) => html`<li class="${x.rank === 1 ? "is-win" : ""}">
          <span class="rs-rank">${x.rank === 1 ? U.icon("crown") : x.rank}</span>${U.dot(x.player)}<span class="rs-name">${db.name(x.player)}</span>
          <span class="rs-total">${x.total}</span><span class="rs-topar">${U.fmt.toPar(x.toPar)}</span></li>`)}</ol>` : html`<p class="muted">スコアの記録なし</p>`}
      </div>
    </a></li>`;
  }

  KGC.views.rounds = (root) => {
    const U = KGC.ui, db = KGC.db, html = U.html;
    KGC.app.setTitle("ラウンド");
    const list = db.rounds.slice().reverse();
    const head = html`<header class="page-head"><p class="kicker">ROUNDS</p><h1 class="page-title">ラウンド</h1>
      <p class="page-lead">全${list.length}回・新しい順。カードを押すとスコアカードと写真が見られます。</p></header>`;
    if (!list.length) { root.innerHTML = String(html`${head}${U.empty("まだラウンドの記録がありません")}`); return; }
    const years = [];
    list.forEach((r) => {
      const y = U.date.year(r.date) || "";
      let g = years.find((x) => x.y === y);
      if (!g) { g = { y, rounds: [] }; years.push(g); }
      g.rounds.push(r);
    });
    const body = years.map((g) => html`<section class="ygroup">
      ${years.length > 1 ? html`<h2 class="ygroup-title">${g.y}年<small>${g.rounds.length}ラウンド</small></h2>` : ""}
      <ul class="rlist">${g.rounds.map(card)}</ul></section>`);
    root.innerHTML = String(html`${head}${body}`);
  };
})();
