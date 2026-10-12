/* 画面共通の小道具：HTML の組み立て、数値・日付の書式、選手チップ、トースト、表の切り替え、ライトボックス。
   名前・コース・日付などの中身はすべて実行時の data から入れる（このファイルには具体的な値を書かない）。 */
"use strict";
(function () {
  const KGC = (window.KGC = window.KGC || {});
  KGC.views = KGC.views || {};

  /* ------------------------------------------------------------ HTML */
  // html`...` は差し込み値を必ずエスケープする。入れ子の html`` と raw() だけはそのまま入る
  class Raw { constructor(s) { this.s = s; } toString() { return this.s; } }
  const raw = (s) => new Raw(s == null ? "" : String(s));
  const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ESC[c]);
  function val(v) {
    // null・undefined・NaN は空にする（画面に出さない）
    if (v == null || v === false || (typeof v === "number" && !isFinite(v))) return "";
    if (v instanceof Raw) return v.s;
    if (Array.isArray(v)) return v.map(val).join("");
    return esc(v);
  }
  function html(strings, ...vals) {
    let out = strings[0];
    for (let i = 0; i < vals.length; i++) out += val(vals[i]) + strings[i + 1];
    return new Raw(out);
  }
  const join = (arr, sep) => raw(arr.map(val).join(sep == null ? "" : val(sep)));
  const attrs = (o) => raw(Object.keys(o).filter((k) => o[k] != null && o[k] !== false)
    .map((k) => (o[k] === true ? k : `${k}="${esc(o[k])}"`)).join(" "));

  /* ------------------------------------------------------------ 数値 */
  const isNum = (v) => typeof v === "number" && isFinite(v);
  const MINUS = "−";
  const DASH = "—";
  // 符号つき（+3 / −2 / ±0）。even="E" ならイーブンを E と書く
  function signed(v, d, even) {
    if (!isNum(v)) return DASH;
    d = d || 0;
    const r = Number(v.toFixed(d));
    if (r === 0) return even === "E" ? "E" : "±" + (0).toFixed(d);
    return (r > 0 ? "+" : MINUS) + Math.abs(r).toFixed(d);
  }
  const fmt = {
    toPar: (v) => signed(v, 0, "E"),           // ラウンドの対パー
    toParAvg: (v, d) => signed(v, d == null ? 2 : d), // 1ホールあたりの平均など
    diff: (v, d) => signed(v, d == null ? 1 : d),
    num: (v, d) => (isNum(v) ? v.toFixed(d || 0) : DASH),
    avg: (v) => (isNum(v) ? (Number.isInteger(v) ? v.toFixed(1) : String(Math.round(v * 10) / 10)) : DASH),
    int: (v) => (isNum(v) ? String(Math.round(v)) : DASH),
    pct: (v, d) => (isNum(v) ? (v * 100).toFixed(d || 0) + "%" : DASH),
    bytes: (n) => (isNum(n) ? (n >= 1048576 ? (n / 1048576).toFixed(1) + "MB" : Math.max(1, Math.round(n / 1024)) + "KB") : ""),
  };

  /* ------------------------------------------------------------ 日付（YYYY-MM-DD を受け取る） */
  const WD = "日月火水木金土";
  function parseDate(s) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || ""));
    if (!m) return null;
    const y = +m[1], mo = +m[2], d = +m[3];
    return { y, mo, d, wd: WD[new Date(y, mo - 1, d).getDay()] };
  }
  const date = {
    long: (s) => { const p = parseDate(s); return p ? `${p.y}年${p.mo}月${p.d}日（${p.wd}）` : DASH; },
    mid: (s) => { const p = parseDate(s); return p ? `${p.y}年${p.mo}月${p.d}日` : DASH; },
    short: (s) => { const p = parseDate(s); return p ? `${p.mo}/${p.d}` : DASH; },
    dot: (s) => { const p = parseDate(s); return p ? `${p.y}.${String(p.mo).padStart(2, "0")}.${String(p.d).padStart(2, "0")}` : DASH; },
    year: (s) => { const p = parseDate(s); return p ? p.y : null; },
  };

  /* ------------------------------------------------------------ データの索引 */
  function index(data) {
    const db = { data };
    db.site = data.site || {};
    db.players = data.players || [];
    db.pmap = new Map(db.players.map((p) => [p.id, p]));
    db.courses = data.courses || [];
    db.cmap = new Map(db.courses.map((c) => [c.id, c]));
    db.rounds = data.rounds || [];
    db.rmap = new Map(db.rounds.map((r) => [r.id, r]));
    db.latest = db.rounds.length ? db.rounds[db.rounds.length - 1] : null;
    db.stats = data.stats || {};
    db.scopes = db.stats.scopes || [];
    db.scope = (id) => db.scopes.find((s) => s.id === id) || db.scopes[0] || null;
    db.player = (pid) => db.pmap.get(pid) || null;
    db.name = (pid) => (db.pmap.get(pid) || {}).display || (db.pmap.get(pid) || {}).name || "ゲスト";
    db.slot = (pid) => { const p = db.pmap.get(pid); return p && p.color ? p.color : 0; };
    db.color = (pid) => { const s = db.slot(pid); return s ? `var(--p${s})` : "var(--guest)"; };
    db.course = (cid) => db.cmap.get(cid) || null;
    db.courseShort = (cid) => { const c = db.cmap.get(cid); return c ? (c.short || c.name) : "コース"; };
    db.courseName = (cid) => { const c = db.cmap.get(cid); return c ? (c.name || c.short) : "コース"; };
    db.round = (rid) => db.rmap.get(rid) || null;
    db.roundLabel = (rid) => { const r = db.rmap.get(rid); return r ? `第${r.no}回` : ""; };
    db.nPlayers = db.players.length;
    db.cup = db.site.cup || "";
    KGC.db = db;
    return db;
  }

  // 1ラウンドの順位（detail.ranking が空＝9ホールのみ等なら合計から作る）
  function ranking(r) {
    const det = (r && r.detail) || {};
    if (det.ranking && det.ranking.length) return det.ranking;
    const rows = ((r && r.scores) || []).filter((s) => isNum(s.total))
      .map((s) => ({ player: s.player, total: s.total, toPar: s.toPar, halves: s.halves || [] }))
      .sort((a, b) => a.total - b.total);
    let prev = null, rank = 0;
    rows.forEach((row, i) => { if (row.total !== prev) { rank = i + 1; prev = row.total; } row.rank = rank; });
    return rows;
  }
  function winners(r) { return ranking(r).filter((x) => x.rank === 1).map((x) => x.player); }

  /* ------------------------------------------------------------ 選手 */
  const dot = (pid, cls) => html`<i class="${"dot " + (cls || "")}" style="${"background:" + KGC.db.color(pid)}" aria-hidden="true"></i>`;
  function chip(pid, opt) {
    opt = opt || {};
    const name = opt.name || KGC.db.name(pid);
    const inner = html`${dot(pid)}<span class="pchip-name">${name}</span>`;
    if (opt.link === false || !KGC.db.player(pid)) return html`<span class="pchip">${inner}</span>`;
    return html`<a class="pchip" href="${"#/player/" + encodeURIComponent(pid)}">${inner}</a>`;
  }

  /* ------------------------------------------------------------ 打数の分類（対パー） */
  const CATS = ["eagle", "birdie", "par", "bogey", "double", "triple"];
  const CAT_LABEL = { eagle: "イーグル以上", birdie: "バーディー", par: "パー", bogey: "ボギー", double: "ダブルボギー", triple: "トリプル以上" };
  const CAT_SHORT = { eagle: "イーグル", birdie: "バーディー", par: "パー", bogey: "ボギー", double: "ダボ", triple: "トリプル+" };
  const CAT_SYM = { eagle: "◎", birdie: "○", par: "—", bogey: "△", double: "□", triple: "+3" };
  function cat(tp) {
    if (!isNum(tp)) return null;
    if (tp <= -2) return "eagle";
    return { "-1": "birdie", "0": "par", "1": "bogey", "2": "double" }[String(tp)] || "triple";
  }
  const sym = (tp) => (tp >= 3 ? "+" + tp : CAT_SYM[cat(tp)] || "");

  /* ------------------------------------------------------------ アイコン（線画 SVG） */
  const ICON_PATHS = {
    home: '<path d="M4 11.5 12 5l8 6.5"/><path d="M6.5 10v9h11v-9"/><path d="M10.5 19v-5h3v5"/>',
    flag: '<path d="M7 21V4"/><path d="M7 4.5c3.5-1.6 6 1.6 10 0v7c-4 1.6-6.5-1.6-10 0"/><path d="M4.5 21h7"/>',
    chart: '<path d="M4 20h16"/><path d="M7 16.5v-5"/><path d="M12 16.5V7"/><path d="M17 16.5v-8"/>',
    trophy: '<path d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M8 6H5a3 3 0 0 0 3 4"/><path d="M16 6h3a3 3 0 0 1-3 4"/><path d="M12 13v4"/><path d="M8.5 20h7"/><path d="M10 17h4"/>',
    photo: '<rect x="3.5" y="5.5" width="17" height="13" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="m20.5 15.5-5-4.5-8.5 7.5"/>',
    course: '<path d="M4 18c2.5-4 6-6 9-6 2.7 0 4.6 1.3 7 3"/><path d="M14 12V4l4 2-4 2"/><circle cx="7.5" cy="18.5" r="1"/>',
    play: '<path d="M8 5.5v13l11-6.5z" fill="currentColor" stroke="none"/>',
    close: '<path d="M6 6l12 12M18 6 6 18"/>',
    prev: '<path d="M15 5l-7 7 7 7"/>',
    next: '<path d="M9 5l7 7-7 7"/>',
    share: '<path d="M12 15V4"/><path d="M8 8l4-4 4 4"/><path d="M6 12v7h12v-7"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>',
    moon: '<path d="M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10z"/>',
    auto: '<circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor" stroke="none"/>',
    star: '<path d="M12 4l2.4 5 5.4.6-4 3.7 1.1 5.3L12 16l-4.9 2.6 1.1-5.3-4-3.7 5.4-.6z"/>',
    up: '<path d="M5 17 11 11l3.5 3.5L20 9"/><path d="M15 9h5v5"/>',
    circle: '<circle cx="12" cy="12" r="6.5"/>',
    half: '<path d="M4 18h16"/><path d="M8 18V9l8-3v12"/>',
    pin: '<path d="M12 21s6-5.6 6-10.5a6 6 0 0 0-12 0C6 15.4 12 21 12 21z"/><circle cx="12" cy="10.5" r="2.2"/>',
    crown: '<path d="M4 17.5 5.5 8l4.5 4 2-6 2 6 4.5-4 1.5 9.5z"/><path d="M5 20h14"/>',
    medal: '<circle cx="12" cy="14.5" r="5"/><path d="M9 4h6l-1.5 5.5h-3z"/>',
    target: '<circle cx="12" cy="12" r="7.5"/><circle cx="12" cy="12" r="3.5"/><circle cx="12" cy="12" r=".6" fill="currentColor"/>',
    info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5"/><path d="M12 7.6v.4"/>',
    table: '<rect x="4" y="5" width="16" height="14" rx="1.5"/><path d="M4 10h16M4 14.5h16M10 10v9"/>',
    film: '<rect x="4" y="5" width="16" height="14" rx="2"/><path d="m10 9.5 5 2.5-5 2.5z" fill="currentColor"/>',
    card: '<rect x="5" y="3.5" width="14" height="17" rx="1.5"/><path d="M8 8h8M8 11.5h8M8 15h5"/>',
    wind: '<path d="M3 9h11a3 3 0 1 0-3-3"/><path d="M3 13h15a3 3 0 1 1-3 3"/>',
    drop: '<path d="M12 4s5.5 6 5.5 10a5.5 5.5 0 0 1-11 0C6.5 10 12 4 12 4z"/>',
    temp: '<path d="M10 14.5V5a2 2 0 0 1 4 0v9.5a4 4 0 1 1-4 0z"/>',
  };
  const WX_PATHS = {
    sun: ICON_PATHS.sun,
    partly: '<circle cx="9" cy="9" r="3.2"/><path d="M9 2.8v1.4M2.8 9h1.4M4.6 4.6l1 1M13.4 4.6l-1 1"/><path d="M8.5 19.5h9a3.5 3.5 0 0 0 0-7 5 5 0 0 0-9.4 1.6A2.8 2.8 0 0 0 8.5 19.5z"/>',
    cloud: '<path d="M7 18.5h10a4 4 0 0 0 .4-8 5.5 5.5 0 0 0-10.6 1.5A3.3 3.3 0 0 0 7 18.5z"/>',
    rain: '<path d="M7 15h10a3.6 3.6 0 0 0 .4-7.2 5 5 0 0 0-9.6 1.4A3 3 0 0 0 7 15z"/><path d="M8.5 18l-1 2.5M12.5 18l-1 2.5M16.5 18l-1 2.5"/>',
    snow: '<path d="M7 14.5h10a3.6 3.6 0 0 0 .4-7.2 5 5 0 0 0-9.6 1.4A3 3 0 0 0 7 14.5z"/><path d="M8.5 18.5h.01M12 20h.01M15.5 18.5h.01"/>',
    fog: '<path d="M7 12.5h10a3.4 3.4 0 0 0 .3-6.8 4.8 4.8 0 0 0-9.2 1.3A2.8 2.8 0 0 0 7 12.5z"/><path d="M5 16h14M7 19.5h10"/>',
    thunder: '<path d="M7 14h10a3.6 3.6 0 0 0 .4-7.2 5 5 0 0 0-9.6 1.4A3 3 0 0 0 7 14z"/><path d="m12.5 15.5-2 3.5h3l-2 3.5"/>',
  };
  function svgIcon(paths, cls) {
    return raw(`<svg class="ico ${cls || ""}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`);
  }
  const icon = (name, cls) => svgIcon(ICON_PATHS[name] || "", cls);
  const wxIcon = (name, cls) => svgIcon(WX_PATHS[name] || WX_PATHS.cloud, "wx-ico " + (cls || ""));

  /* ------------------------------------------------------------ 天気 */
  function wxChip(w, opt) {
    if (!w) return "";
    opt = opt || {};
    const t = isNum(w.tempAvg) ? `${fmt.num(w.tempAvg, 1)}℃` : "";
    return html`<span class="${"wx-chip " + (opt.cls || "")}">${wxIcon(w.icon)}<span>${w.label || ""}</span>${t ? html`<span class="wx-t">${t}</span>` : ""}</span>`;
  }
  function wxDetail(w) {
    if (!w) return html`<p class="muted">天気の記録はありません</p>`;
    const items = [];
    if (isNum(w.tempAvg)) items.push([icon("temp"), "気温", `${fmt.num(w.tempAvg, 1)}℃`, [isNum(w.tempMax) ? `最高 ${fmt.num(w.tempMax, 1)}℃` : "", isNum(w.tempMin) ? `最低 ${fmt.num(w.tempMin, 1)}℃` : ""]]);
    if (isNum(w.windAvg)) items.push([icon("wind"), "風", `${fmt.num(w.windAvg, 1)}m/s`, [isNum(w.gustMax) ? `最大瞬間 ${fmt.num(w.gustMax, 1)}` : ""]]);
    if (isNum(w.precip)) items.push([icon("drop"), "降水", `${fmt.num(w.precip, 1)}mm`, [isNum(w.cloud) ? `雲量 ${fmt.int(w.cloud)}%` : ""]]);
    return html`<div class="wx-detail">
      <div class="wx-main">${wxIcon(w.icon, "wx-big")}<span class="wx-label">${w.label || ""}</span></div>
      <dl class="wx-list">${items.map((it) => html`<div class="wx-item"><dt>${it[0]}${it[1]}</dt><dd><b>${it[2]}</b>${it[3].filter(Boolean).map((x) => html`<small>${x}</small>`)}</dd></div>`)}</dl>
    </div>`;
  }

  /* ------------------------------------------------------------ 部品 */
  function section(id, title, body, opt) {
    opt = opt || {};
    return html`<section class="${"sec " + (opt.cls || "")}" ${id ? attrs({ id: "sec-" + id }) : ""}>
      <header class="sec-head"><h2 class="sec-title">${title}</h2>${opt.link ? html`<a class="sec-link" href="${opt.link[0]}">${opt.link[1]}<span aria-hidden="true">›</span></a>` : ""}</header>
      ${opt.lead ? html`<p class="sec-lead">${opt.lead}</p>` : ""}
      ${body}
    </section>`;
  }
  const empty = (msg, sub) => html`<div class="empty"><p>${msg}</p>${sub ? html`<p class="empty-sub">${sub}</p>` : ""}</div>`;
  const pending = (msg) => html`<span class="pending">${msg || "データ蓄積中"}</span>`;
  // 「あと N ラウンド」
  const remain = (need, have) => {
    const n = Math.max(0, (need || 0) - (have || 0));
    return n > 0 ? `あと ${n} ラウンド` : "データ蓄積中";
  };
  const takeaway = (lines) => {
    lines = (lines || []).filter(Boolean);
    if (!lines.length) return "";
    return html`<ul class="takeaways">${lines.map((l) => html`<li>${l}</li>`)}</ul>`;
  };

  // 表（cols: [{label, num, cls}]、rows: セルの配列。セルは文字列・html・{v, cls}）
  function table(t) {
    if (!t) return "";
    const cell = (c, col, tag) => {
      const o = c && typeof c === "object" && !(c instanceof Raw) ? c : { v: c };
      const cls = [col && col.num ? "num" : "", col && col.cls, o.cls].filter(Boolean).join(" ");
      return tag === "th"
        ? html`<th scope="row" ${cls ? attrs({ class: cls }) : ""}>${o.v == null ? DASH : o.v}</th>`
        : html`<td ${cls ? attrs({ class: cls }) : ""}>${o.v == null ? DASH : o.v}</td>`;
    };
    return html`<div class="tbl-wrap"><table class="${"tbl " + (t.cls || "")}">
      ${t.caption ? html`<caption>${t.caption}</caption>` : ""}
      <thead><tr>${t.cols.map((c) => html`<th scope="col" ${c.num ? attrs({ class: "num" }) : ""}>${c.label}</th>`)}</tr></thead>
      <tbody>${t.rows.map((r) => html`<tr>${r.map((c, i) => cell(c, t.cols[i], i === 0 && t.rowHead !== false ? "th" : "td"))}</tr>`)}</tbody>
    </table></div>`;
  }

  // グラフの枠：見出し・凡例・本体・「表で見る」切り替え
  function figure(o) {
    return html`<figure class="${"fig " + (o.cls || "")}">
      <figcaption class="fig-head">
        <div class="fig-titles">${o.title ? html`<h3 class="fig-title">${o.title}</h3>` : ""}${o.sub ? html`<p class="fig-sub">${o.sub}</p>` : ""}</div>
        ${o.table ? html`<button type="button" class="fig-toggle" data-fig-toggle aria-pressed="false">${icon("table")}<span>表で見る</span></button>` : ""}
      </figcaption>
      ${o.legend || ""}
      <div class="fig-body">${o.body}</div>
      ${o.table ? html`<div class="fig-table" hidden>${table(o.table)}</div>` : ""}
      ${o.takeaway ? takeaway(o.takeaway) : ""}
      ${o.note ? html`<p class="fig-note">${o.note}</p>` : ""}
    </figure>`;
  }
  // 凡例（kind: line / box / ring / dot）
  function legend(items, cls) {
    return html`<ul class="${"legend " + (cls || "")}">${items.map((it) => html`<li>${it.raw ? it.raw : html`<i class="${"key key-" + (it.kind || "box")}" style="${"--c:" + it.color}" aria-hidden="true"></i>`}<span>${it.label}</span></li>`)}</ul>`;
  }
  const playerLegend = (pids, kind) => legend(pids.map((p) => ({ label: KGC.db.name(p), color: KGC.db.color(p), kind: kind || "line" })));

  // 切り替えボタン群（aria-pressed で状態を持つ）
  function seg(name, options, current, label) {
    return html`<div class="seg" role="group" ${attrs({ "aria-label": label || null, "data-seg": name })}>${options.map((o) =>
      html`<button type="button" ${attrs({ "data-v": o.value, "aria-pressed": String(o.value === current) })}>${o.label}</button>`)}</div>`;
  }
  function onSeg(root, name, fn) {
    root.querySelectorAll(`[data-seg="${name}"]`).forEach((g) => {
      g.addEventListener("click", (e) => {
        const b = e.target.closest("button[data-v]");
        if (!b) return;
        g.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
        fn(b.dataset.v, b);
      });
    });
  }

  // 「表で見る」の切り替え（全画面共通）
  document.addEventListener("click", (e) => {
    const btn = e.target.closest && e.target.closest("[data-fig-toggle]");
    if (!btn) return;
    const fig = btn.closest(".fig");
    if (!fig) return;
    const on = btn.getAttribute("aria-pressed") !== "true";
    btn.setAttribute("aria-pressed", String(on));
    const label = btn.querySelector("span");
    if (label) label.textContent = on ? "グラフで見る" : "表で見る";
    const body = fig.querySelector(".fig-body"), tbl = fig.querySelector(".fig-table");
    if (body) body.hidden = on;
    if (tbl) tbl.hidden = !on;
  });

  /* ------------------------------------------------------------ トースト */
  let toastTimer = null;
  function toast(msg, ms) {
    let el = document.querySelector(".toast");
    if (!el) {
      el = document.createElement("div");
      el.className = "toast";
      el.setAttribute("role", "status");
      el.setAttribute("aria-live", "polite");
      document.body.appendChild(el);
    }
    el.textContent = msg;
    // 連続で呼ばれても表示し直す
    el.classList.remove("show");
    void el.offsetWidth;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), ms || 3200);
  }

  /* ------------------------------------------------------------ 写真・動画 */
  // ラウンドの写真・動画を、ライトボックス用の形にそろえる
  function mediaItems(r) {
    return ((r && r.media) || []).map((m) => ({
      type: m.type === "video" ? "video" : "photo", id: m.id, src: m.src, thumb: m.thumb || m.poster || m.src,
      poster: m.poster || m.thumb, w: m.w, h: m.h, bytes: m.bytes, duration: m.duration, caption: m.caption || "",
      roundId: r.id, meta: `第${r.no}回・${date.mid(r.date)}・${KGC.db.courseShort(r.course)}`,
    }));
  }
  function coverItem(r) {
    const media = (r && r.media) || [];
    let it = r && r.cover ? media.find((m) => m.id === r.cover) : null;
    if (!it) it = media.find((m) => m.type === "photo");
    if (!it) { const v = media.find((m) => m.type === "video" && m.poster); if (v) return { src: v.poster, thumb: v.thumb || v.poster, caption: v.caption, w: v.w, h: v.h }; }
    return it ? { src: it.type === "video" ? it.poster : it.src, thumb: it.thumb, caption: it.caption, w: it.w, h: it.h } : null;
  }
  function thumbItem(r) {
    const c = coverItem(r);
    if (c) return c.thumb || c.src;
    const v = ((r && r.media) || []).find((m) => m.thumb);
    return v ? v.thumb : null;
  }
  // サムネイル一覧（data-lb で何番目かを持つ）
  function gallery(items, opt) {
    opt = opt || {};
    if (!items.length) return empty(opt.empty || "写真・動画はまだありません");
    return html`<ul class="${"gallery " + (opt.cls || "")}">${items.map((it, i) => html`<li>
      <button type="button" class="${"g-item " + (it.type === "video" ? "is-video" : "")}" ${attrs({ "data-lb": String((opt.offset || 0) + i), "aria-label": (it.type === "video" ? "動画を再生" : "写真を開く") + (it.caption ? "：" + it.caption : "") })}>
        <img ${attrs({ "data-enc": it.thumb, alt: it.caption || "", width: it.w && it.h ? (it.w >= it.h ? 300 : Math.round(300 * it.w / it.h)) : null, height: it.w && it.h ? (it.w >= it.h ? Math.round(300 * it.h / it.w) : 300) : null })}>
        ${it.type === "video" ? html`<span class="g-play">${icon("play")}</span>` : ""}
        ${it.type === "video" && it.duration ? html`<span class="g-dur">${Math.floor(it.duration / 60)}:${String(Math.round(it.duration % 60)).padStart(2, "0")}</span>` : ""}
      </button></li>`)}</ul>`;
  }
  function bindGallery(root, items) {
    root.addEventListener("click", (e) => {
      const b = e.target.closest("[data-lb]");
      if (!b || !root.contains(b)) return;
      lightbox(items, Number(b.dataset.lb) || 0);
    });
  }

  // 保存・共有（写真）。共有シートが使えなければダウンロード。
  // 公開版は CSP の connect-src で blob: を fetch できないので、表示中の画像を描き直して JPEG にする
  const prepared = new Map(); // id → File
  function loadImage(url) {
    return new Promise((resolve, reject) => {
      const im = new Image();
      im.onload = () => resolve(im);
      im.onerror = () => reject(new Error("image"));
      im.src = url;
    });
  }
  async function fileFor(it) {
    const key = it.id || it.src;
    if (prepared.has(key)) return prepared.get(key);
    const base = (it.id || "kgc-photo").replace(/[^0-9A-Za-z_-]+/g, "-");
    const url = await KGC.media.url(it.src);
    let blob, ext;
    if (KGC.media.blob) { blob = await KGC.media.blob(it.src); ext = (it.src.split(".").pop() || "webp").toLowerCase(); }
    else if (KGC.media.dev) { blob = await (await fetch(url)).blob(); ext = (it.src.split(".").pop() || "webp").toLowerCase(); }
    else {
      const im = await loadImage(url);
      const c = document.createElement("canvas");
      c.width = im.naturalWidth;
      c.height = im.naturalHeight;
      c.getContext("2d").drawImage(im, 0, 0);
      blob = await new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("encode"))), "image/jpeg", 0.92));
      ext = "jpg";
    }
    const file = new File([blob], `${base}.${ext}`, { type: blob.type || "image/jpeg" });
    prepared.set(key, file);
    if (prepared.size > 6) prepared.delete(prepared.keys().next().value);
    return file;
  }
  function download(file) {
    const u = URL.createObjectURL(file);
    const a = document.createElement("a");
    a.href = u;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(u), 4000);
  }
  async function saveMedia(it) {
    if (!it || !KGC.media || !KGC.media.url) return;
    const ready = prepared.get(it.id || it.src);
    let file;
    try { file = ready || await fileFor(it); } catch (e) { toast("写真を用意できませんでした"); return; }
    const canShare = navigator.canShare && navigator.share && navigator.canShare({ files: [file] });
    if (canShare) {
      try { await navigator.share({ files: [file] }); return; } catch (e) {
        if (e && e.name === "AbortError") return; // 共有シートを閉じただけ
        // 押してから時間がたつと共有を断られることがある。用意はできたので、もう一度押してもらう
        if (!ready && e && e.name === "NotAllowedError") { toast("準備ができました。もう一度「保存」を押してください"); return; }
      }
    }
    download(file);
  }

  // ライトボックス（写真の拡大・動画の再生・スワイプ）
  let lbOpen = null;
  function lightbox(items, start) {
    if (!items || !items.length) return;
    if (lbOpen) lbOpen.close(true);
    let idx = Math.max(0, Math.min(items.length - 1, start || 0));
    let videoPath = null;
    let pushed = false;
    const prevFocus = document.activeElement;
    const ov = document.createElement("div");
    ov.className = "lb";
    ov.setAttribute("role", "dialog");
    ov.setAttribute("aria-modal", "true");
    ov.setAttribute("aria-label", "写真・動画");
    ov.innerHTML = String(html`
      <div class="lb-top">
        <span class="lb-count" aria-live="polite"></span>
        <span class="lb-sp"></span>
        <button type="button" class="lb-btn lb-save">${icon("share")}<span>保存</span></button>
        <button type="button" class="lb-btn lb-close" aria-label="閉じる">${icon("close")}</button>
      </div>
      <div class="lb-stage"></div>
      <button type="button" class="lb-nav lb-prev" aria-label="前へ">${icon("prev")}</button>
      <button type="button" class="lb-nav lb-next" aria-label="次へ">${icon("next")}</button>
      <div class="lb-cap"><p class="lb-caption"></p><p class="lb-meta"></p></div>`);
    document.body.appendChild(ov);
    document.documentElement.classList.add("lb-lock");
    const stage = ov.querySelector(".lb-stage");

    function stopVideo() {
      const v = stage.querySelector("video");
      if (v) { try { v.pause(); } catch (e) { /* 続ける */ } v.removeAttribute("src"); v.load && v.load(); }
      if (videoPath && KGC.media && KGC.media.release) KGC.media.release(videoPath);
      videoPath = null;
    }
    function render(dir) {
      stopVideo();
      const it = items[idx];
      ov.querySelector(".lb-count").textContent = `${idx + 1} / ${items.length}`;
      ov.querySelector(".lb-caption").textContent = it.caption || "";
      ov.querySelector(".lb-meta").textContent = it.meta || "";
      ov.querySelector(".lb-prev").hidden = items.length < 2;
      ov.querySelector(".lb-next").hidden = items.length < 2;
      ov.querySelector(".lb-save").hidden = it.type !== "photo";
      const ratio = it.w && it.h ? `aspect-ratio:${it.w}/${it.h}` : "";
      if (it.type === "video") {
        stage.innerHTML = String(html`<div class="${"lb-item lb-video " + (dir ? "from-" + dir : "")}" style="${ratio}">
          <img class="lb-poster" ${attrs({ "data-enc": it.poster || it.thumb, alt: it.caption || "" })}>
          <button type="button" class="lb-playbtn" aria-label="動画を再生">${icon("play")}<span>${it.bytes ? "再生（" + fmt.bytes(it.bytes) + "）" : "再生"}</span></button>
          <div class="lb-progress" hidden><div class="lb-bar"><i></i></div><span>読み込み中…</span></div>
        </div>`);
        stage.querySelector(".lb-playbtn").addEventListener("click", () => playVideo(it));
      } else {
        stage.innerHTML = String(html`<div class="${"lb-item lb-photo " + (dir ? "from-" + dir : "")}" style="${ratio}">
          <img class="lb-ph" ${attrs({ "data-enc": it.thumb || it.src, alt: "" })}>
          <img class="lb-img" ${attrs({ "data-enc": it.src, alt: it.caption || "" })}>
        </div>`);
        const full = stage.querySelector(".lb-img");
        full.addEventListener("load", () => {
          full.classList.add("loaded");
          // 保存ボタンを押したときにすぐ共有シートを出せるよう、少し待ってから用意しておく
          setTimeout(() => { if (lbOpen && items[idx] === it) fileFor(it).catch(() => {}); }, 600);
        });
        full.addEventListener("error", () => toast("写真を読み込めませんでした"));
        // 前後の写真を先に復号しておく
        [idx + 1, idx - 1].forEach((j) => {
          const n = items[(j + items.length) % items.length];
          if (n && n.type === "photo" && KGC.media && KGC.media.url) KGC.media.url(n.src).catch(() => {});
        });
      }
    }
    function playVideo(it) {
      const box = stage.querySelector(".lb-video");
      if (!box || !KGC.media || !KGC.media.video) return;
      const prog = box.querySelector(".lb-progress"), bar = box.querySelector(".lb-bar i"), btn = box.querySelector(".lb-playbtn");
      btn.hidden = true;
      prog.hidden = false;
      const myIdx = idx;
      videoPath = it.src;
      KGC.media.video(it.src, (p) => { bar.style.width = Math.round(p * 100) + "%"; }).then((url) => {
        if (!lbOpen || idx !== myIdx) return;
        const v = document.createElement("video");
        v.controls = true;
        v.playsInline = true;
        v.setAttribute("playsinline", "");
        v.preload = "metadata";
        v.src = url;
        v.className = "lb-vid";
        box.innerHTML = "";
        box.appendChild(v);
        const pr = v.play && v.play();
        if (pr && pr.catch) pr.catch(() => {});
      }).catch(() => {
        btn.hidden = false;
        prog.hidden = true;
        toast("動画を読み込めませんでした");
      });
    }
    function go(d) {
      if (items.length < 2) return;
      idx = (idx + d + items.length) % items.length;
      render(d > 0 ? "right" : "left");
    }
    function close(silent) {
      stopVideo();
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("popstate", onPop);
      ov.remove();
      document.documentElement.classList.remove("lb-lock");
      lbOpen = null;
      if (pushed && !silent) { pushed = false; history.back(); }
      if (prevFocus && prevFocus.focus) { try { prevFocus.focus({ preventScroll: true }); } catch (e) { /* 続ける */ } }
    }
    function onKey(e) {
      if (e.key === "Escape") close();
      else if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
    }
    function onPop() { pushed = false; close(true); }

    // スワイプ（横）で前後、下へ大きく引くと閉じる
    let sx = 0, sy = 0, dragging = false;
    stage.addEventListener("pointerdown", (e) => {
      if (e.target.closest("video, button")) return;
      dragging = true; sx = e.clientX; sy = e.clientY;
    });
    stage.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      const item = stage.querySelector(".lb-item");
      const dx = e.clientX - sx, dy = e.clientY - sy;
      if (item && Math.abs(dx) > Math.abs(dy)) item.style.transform = `translateX(${dx}px)`;
      else if (item && dy > 0) item.style.transform = `translateY(${dy}px)`;
    });
    const end = (e) => {
      if (!dragging) return;
      dragging = false;
      const dx = e.clientX - sx, dy = e.clientY - sy;
      const item = stage.querySelector(".lb-item");
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) go(dx < 0 ? 1 : -1);
      else if (dy > 110 && Math.abs(dy) > Math.abs(dx)) close();
      else if (item) item.style.transform = "";
    };
    stage.addEventListener("pointerup", end);
    stage.addEventListener("pointercancel", () => { dragging = false; const item = stage.querySelector(".lb-item"); if (item) item.style.transform = ""; });
    stage.addEventListener("click", (e) => { if (e.target === stage) close(); });

    ov.querySelector(".lb-close").addEventListener("click", () => close());
    ov.querySelector(".lb-prev").addEventListener("click", () => go(-1));
    ov.querySelector(".lb-next").addEventListener("click", () => go(1));
    ov.querySelector(".lb-save").addEventListener("click", () => saveMedia(items[idx]));
    document.addEventListener("keydown", onKey);
    try { history.pushState({ kgcLightbox: true }, ""); pushed = true; window.addEventListener("popstate", onPop); } catch (e) { /* 続ける */ }

    lbOpen = { close };
    render();
    ov.querySelector(".lb-close").focus({ preventScroll: true });
  }
  const closeLightbox = () => { if (lbOpen) lbOpen.close(true); };

  KGC.ui = {
    html, raw, esc, join, attrs, isNum, fmt, signed, date, parseDate, index, ranking, winners,
    dot, chip, CATS, CAT_LABEL, CAT_SHORT, CAT_SYM, cat, sym, icon, wxIcon, wxChip, wxDetail,
    section, empty, pending, remain, takeaway, table, figure, legend, playerLegend, seg, onSeg,
    toast, mediaItems, coverItem, thumbItem, gallery, bindGallery, lightbox, closeLightbox, saveMedia,
  };
})();

/* 複数の画面で使うゴルフ用の部品（表彰台・ハイライト・スコア推移など） */
(function () {
  const KGC = (window.KGC = window.KGC || {});

  const HL_ICON = { winner: "crown", pb: "star", milestone: "medal", birdie: "circle", eagle: "circle", bestHalf: "flag", comeback: "up", holeWins: "target", memo: "info" };

  // 表彰台（上位3人）と4位以下の一覧
  function podium(r, opt) {
    const U = KGC.ui, db = KGC.db, html = U.html;
    opt = opt || {};
    const rk = U.ranking(r);
    if (!rk.length) return U.empty("このラウンドは順位を出せません（18ホールのスコアがありません）");
    const top = rk.slice(0, 3);
    const order = top.length === 3 ? [top[1], top[0], top[2]] : top.length === 2 ? [top[1], top[0]] : top;
    const col = (x) => html`<li class="${"pod pod-r" + Math.min(3, x.rank)}">
      <div class="pod-who">${x.rank === 1 ? html`<span class="pod-crown">${U.icon("crown")}</span>` : ""}${U.chip(x.player)}</div>
      <p class="pod-score"><b>${x.total}</b><small>${U.fmt.toPar(x.toPar)}</small></p>
      ${opt.halves && x.halves && x.halves.length === 2 ? html`<p class="pod-halves">${x.halves[0]}・${x.halves[1]}</p>` : ""}
      <div class="pod-block"><span class="pod-rank">${x.rank}</span><span class="pod-unit">位</span></div>
    </li>`;
    const rest = rk.slice(3);
    return html`<div class="podium-wrap">
      <ol class="${"podium n" + order.length}">${order.map(col)}</ol>
      ${rest.length ? html`<ol class="rank-rest">${rest.map((x) => html`<li><span class="rr-rank">${x.rank}位</span>${U.chip(x.player)}<span class="rr-score"><b>${x.total}</b><small>${U.fmt.toPar(x.toPar)}</small></span></li>`)}</ol>` : ""}
    </div>`;
  }

  // 自動ハイライト＋手入力のハイライト
  function highlights(r, max) {
    const U = KGC.ui, db = KGC.db, html = U.html;
    const det = (r && r.detail) || {};
    const manual = ((r && r.highlights) || []).map((h) => (typeof h === "string" ? { kind: "memo", text: h } : { kind: h.kind || "memo", player: h.player, text: h.text || h.label || "" }))
      .filter((h) => h.text);
    const all = manual.concat((det.highlights || []).filter((h) => h && h.text));
    if (!all.length) return "";
    return html`<ul class="hl-list">${all.slice(0, max || 99).map((h) => html`<li class="${"hl hl-" + (h.kind || "memo")}">
      <span class="hl-ico">${U.icon(HL_ICON[h.kind] || "info")}</span>
      <span class="hl-text">${h.player && db.player(h.player) ? U.dot(h.player, "hl-dot") : ""}${h.text}</span>
    </li>`)}</ul>`;
  }

  // スコア推移（ラウンドごとの合計）。100切り・90切りの基準線つき
  function trendFigure(scope, opt) {
    const U = KGC.ui, C = KGC.charts, db = KGC.db;
    opt = opt || {};
    const ids = new Set((scope && scope.roundIds) || db.rounds.map((r) => r.id));
    const rounds = db.rounds.filter((r) => ids.has(r.id));
    const pids = opt.pids || db.players.map((p) => p.id);
    const series = pids.map((pid) => {
      const tr = ((scope && scope.players && scope.players[pid]) || {}).trend || [];
      const m = new Map(tr.map((t) => [t.roundId, t.total]));
      return { id: pid, name: db.name(pid), color: db.color(pid), values: rounds.map((r) => (m.has(r.id) ? m.get(r.id) : null)) };
    });
    if (!rounds.length || !series.some((s) => s.values.some((v) => v != null))) return U.empty("スコアの記録がまだありません");
    const x = rounds.map((r) => ({ label: `第${r.no}回`, title: `第${r.no}回・${U.date.mid(r.date)}・${db.courseShort(r.course)}` }));
    const h = opt.h || 240;
    const chart = C.slot((el, w) => C.line(el, w, {
      x, series, h, label: opt.title || "スコア推移",
      refs: [{ y: 100, label: "100切り" }, { y: 90, label: "90切り" }, { y: 80, label: "80切り" }],
      fmt: (v) => String(v),
      tipFmt: (v, s, i) => `${v}（${U.fmt.toPar(v - rounds[i].par)}）`,
      endLabel: pids.length > 1 ? undefined : (s, v) => String(v),
    }), { minH: h });
    const table = {
      cols: [{ label: "回" }, { label: "日付" }].concat(pids.map((p) => ({ label: db.name(p), num: true }))),
      rows: rounds.map((r, i) => [`第${r.no}回`, U.date.dot(r.date)].concat(series.map((s) => (s.values[i] == null ? "—" : String(s.values[i]))))),
    };
    return U.figure({
      title: opt.title || "スコア推移",
      sub: opt.sub || `${rounds.length}ラウンド・低いほど良い・金の線は100／90／80切りの目安`,
      legend: pids.length > 1 ? U.playerLegend(pids) : "",
      body: chart, table, takeaway: opt.takeaway, cls: opt.cls,
    });
  }

  // ラウンドの見出し（第N回・日付・コース）
  function roundMeta(r) {
    const U = KGC.ui, db = KGC.db;
    return `第${r.no}回・${U.date.mid(r.date)}・${db.courseShort(r.course)}`;
  }

  // 打数の分類の凡例（色の箱）
  function resultLegend() {
    const U = KGC.ui;
    return U.legend(U.CATS.map((c) => ({ label: U.CAT_SHORT[c], color: `var(--r-${c})`, kind: "box" })), "legend-result");
  }

  KGC.parts = { podium, highlights, trendFigure, roundMeta, resultLegend };
})();
