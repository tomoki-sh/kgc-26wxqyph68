/* アルバム：すべての写真・動画をラウンドごと（新しい順）に並べる。ライトボックスは全体を通して前後に送れる。 */
"use strict";
(function () {
  const KGC = (window.KGC = window.KGC || {});
  KGC.views = KGC.views || {};

  KGC.views.album = (root) => {
    const U = KGC.ui, db = KGC.db, html = U.html;
    KGC.app.setTitle("アルバム");
    const all = [];
    const groups = db.rounds.slice().reverse().filter((r) => (r.media || []).length).map((r) => {
      const items = U.mediaItems(r);
      const g = { r, items, offset: all.length };
      all.push(...items);
      return g;
    });
    const nPhoto = all.filter((m) => m.type === "photo").length, nVideo = all.length - nPhoto;
    const head = html`<header class="page-head"><p class="kicker">ALBUM</p><h1 class="page-title">アルバム</h1>
      <p class="page-lead">${all.length ? [nPhoto ? `写真${nPhoto}枚` : "", nVideo ? `動画${nVideo}本` : ""].filter(Boolean).join("・") + "。押すと大きく表示、左右にスワイプで前後へ。" : ""}</p></header>`;
    if (!all.length) { root.innerHTML = String(html`${head}${U.empty("写真・動画はまだありません", "ラウンドのフォルダに写真や動画を入れると、ここに並びます。")}`); return; }
    const body = groups.map((g) => html`<section class="album-group">
      <header class="album-head">
        <a href="${"#/round/" + encodeURIComponent(g.r.id)}"><b>第${g.r.no}回</b><span>${U.date.mid(g.r.date)}・${db.courseShort(g.r.course)}</span></a>
        <span class="album-count">${g.items.length}件</span>
      </header>
      ${U.gallery(g.items, { offset: g.offset })}
    </section>`);
    root.innerHTML = String(html`${head}<div data-album>${body}</div>`);
    U.bindGallery(root.querySelector("[data-album]"), all);
  };
})();
