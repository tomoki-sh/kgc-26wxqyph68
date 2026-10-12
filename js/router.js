/* アプリの骨組み：ヘッダー、ナビ（スマホは下のタブ、PC は上）、ハッシュでの画面切り替え、表示テーマ。
   boot.js が復号のあとで KGC.app.start(data) を呼ぶ。中身（名前・コースなど）はすべて data から出す。 */
"use strict";
(function () {
  const KGC = (window.KGC = window.KGC || {});
  const THEME_KEY = "kgc-theme";
  const THEMES = ["auto", "light", "dark"];
  const THEME_LABEL = { auto: "自動", light: "ライト", dark: "ダーク" };
  const THEME_ICON = { auto: "auto", light: "sun", dark: "moon" };

  /* ------------------------------------------------------------ 表示テーマ（読み込み直後に当てる） */
  function readTheme() {
    try { const t = localStorage.getItem(THEME_KEY); return THEMES.includes(t) ? t : "auto"; } catch (e) { return "auto"; }
  }
  function applyTheme(t) {
    const root = document.documentElement;
    if (t === "light" || t === "dark") root.setAttribute("data-theme", t);
    else root.removeAttribute("data-theme");
  }
  applyTheme(readTheme());

  const TABS = [
    { key: "home", href: "#/", label: "ホーム", icon: "home" },
    { key: "rounds", href: "#/rounds", label: "ラウンド", icon: "flag" },
    { key: "stats", href: "#/stats", label: "成績", icon: "chart" },
    { key: "records", href: "#/records", label: "記録", icon: "trophy" },
    { key: "album", href: "#/album", label: "アルバム", icon: "photo" },
  ];
  const ROUTES = [
    { re: /^\/?$/, view: "home", tab: "home" },
    { re: /^\/rounds\/?$/, view: "rounds", tab: "rounds" },
    { re: /^\/round\/([^/]+)\/?$/, view: "round", tab: "rounds", keys: ["id"] },
    { re: /^\/stats\/?$/, view: "stats", tab: "stats" },
    { re: /^\/player\/([^/]+)\/?$/, view: "player", tab: "stats", keys: ["id"] },
    { re: /^\/courses\/?$/, view: "courses", tab: "stats" },
    { re: /^\/course\/([^/]+)\/?$/, view: "course", tab: "stats", keys: ["id"] },
    { re: /^\/records\/?$/, view: "records", tab: "records" },
    { re: /^\/album\/?$/, view: "album", tab: "album" },
  ];

  let data = null;
  let started = false;

  function themeButton(t) {
    const U = KGC.ui;
    return U.html`${U.icon(THEME_ICON[t])}<span class="theme-label">${THEME_LABEL[t]}</span>`;
  }

  function shell(db) {
    const U = KGC.ui, html = U.html;
    const site = db.site;
    const title = site.title || site.name || "";
    return html`
      <header class="hdr">
        <div class="hdr-in">
          <a class="brand" href="#/" aria-label="${title + "（ホーム）"}">
            <img class="brand-emblem" src="emblem.svg" alt="" width="34" height="40">
            <span class="brand-text"><span class="brand-name">${title}</span>${site.en ? html`<span class="brand-en">${site.en}</span>` : ""}</span>
          </a>
          <nav class="topnav" aria-label="メインメニュー">${TABS.map((t) => html`<a href="${t.href}" data-tab="${t.key}">${t.label}</a>`)}</nav>
          <button type="button" class="theme-btn" data-theme-btn aria-label="${"表示テーマ：" + THEME_LABEL[readTheme()]}">${themeButton(readTheme())}</button>
        </div>
      </header>
      <main id="view" class="view" tabindex="-1"></main>
      <footer class="foot">
        <img class="foot-emblem" src="emblem.svg" alt="" width="40" height="47">
        <p class="foot-name">${title}</p>
        <p class="foot-en">${[site.en, site.est ? "EST. " + site.est : ""].filter(Boolean).join(" · ")}</p>
        <p class="foot-links">
          <a href="#/courses">コース</a>
          <button type="button" class="linklike" data-theme-btn-text>${"表示：" + THEME_LABEL[readTheme()]}</button>
          <button type="button" class="linklike" data-forget>この端末の記憶を消す</button>
        </p>
      </footer>
      <nav class="tabbar" aria-label="メインメニュー">${TABS.map((t) => html`<a href="${t.href}" data-tab="${t.key}">${U.icon(t.icon)}<span>${t.label}</span></a>`)}</nav>`;
  }

  function cycleTheme() {
    const cur = readTheme();
    const next = THEMES[(THEMES.indexOf(cur) + 1) % THEMES.length];
    try { localStorage.setItem(THEME_KEY, next); } catch (e) { /* 保存できなくても切り替える */ }
    applyTheme(next);
    document.querySelectorAll("[data-theme-btn]").forEach((b) => {
      b.innerHTML = String(themeButton(next));
      b.setAttribute("aria-label", "表示テーマ：" + THEME_LABEL[next]);
    });
    document.querySelectorAll("[data-theme-btn-text]").forEach((b) => { b.textContent = "表示：" + THEME_LABEL[next]; });
    KGC.ui.toast(next === "auto" ? "表示：自動（端末の設定に合わせます）" : "表示：" + THEME_LABEL[next]);
  }

  function parse() {
    let h = (location.hash || "#/").replace(/^#/, "") || "/";
    try { h = decodeURIComponent(h); } catch (e) { /* そのまま使う */ }
    for (const r of ROUTES) {
      const m = r.re.exec(h);
      if (m) {
        const params = {};
        (r.keys || []).forEach((k, i) => { params[k] = m[i + 1]; });
        return { route: r, params };
      }
    }
    return null;
  }

  let pageTitle = "";
  function setTitle(t) {
    pageTitle = t || "";
    const site = (KGC.db && KGC.db.site) || {};
    const base = site.title || site.name || "";
    document.title = pageTitle ? `${pageTitle}｜${base}` : base;
  }

  function render() {
    let p = parse();
    if (!p) {
      // 知らない行き先はホームへ
      try { history.replaceState(null, "", "#/"); } catch (e) { location.hash = "#/"; }
      p = parse();
    }
    KGC.ui.closeLightbox();
    KGC.charts.reset();
    const root = document.getElementById("view");
    root.innerHTML = "";
    root.className = "view view-" + p.route.view;
    setTitle("");
    const view = KGC.views[p.route.view];
    try {
      if (typeof view !== "function") throw new Error("view missing: " + p.route.view);
      view(root, data, p.params || {});
    } catch (e) {
      console.error(e);
      root.innerHTML = String(KGC.ui.html`<div class="card notice"><p>この画面を表示できませんでした。</p><p><a href="#/">ホームへ戻る</a></p></div>`);
    }
    KGC.charts.hydrate(root);
    document.querySelectorAll("[data-tab]").forEach((a) => {
      if (a.dataset.tab === p.route.tab) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    });
    window.scrollTo(0, 0);
  }

  function start(d) {
    if (started) return;
    started = true;
    data = d || {};
    const db = KGC.ui.index(data);
    if ("scrollRestoration" in history) history.scrollRestoration = "manual";
    const app = document.getElementById("app");
    app.innerHTML = String(shell(db));
    app.addEventListener("click", (e) => {
      if (e.target.closest("[data-theme-btn], [data-theme-btn-text]")) cycleTheme();
      else if (e.target.closest("[data-forget]")) {
        if (window.confirm("この端末に保存した鍵を消します。次回は合言葉が必要です。よろしいですか？") && KGC.forget) KGC.forget();
      }
    });
    window.addEventListener("hashchange", render);
    render();
  }

  KGC.app = { start, render, setTitle, applyTheme };
})();
