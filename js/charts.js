/* 軽量 SVG グラフ（外部ライブラリなし）。
   - 色は CSS 変数（選手は --p1〜、打数の分類は --r-eagle〜）。文字は墨色で、系列色は線・棒・点だけに使う。
   - 実際の幅を測ってから描く（文字の大きさを一定に保つ）。幅が変われば描き直す。
   - ツールチップはタップ／ホバーで出す。値は表（「表で見る」）でも必ず読めるようにする。 */
"use strict";
(function () {
  const KGC = (window.KGC = window.KGC || {});
  const esc = (s) => KGC.ui.esc(s == null ? "" : String(s));
  const isNum = (v) => typeof v === "number" && isFinite(v);

  /* ------------------------------------------------------------ 描画の予約と実行 */
  const registry = new Map();
  const observers = [];
  let seq = 0;
  let clipSeq = 0;
  // ビューの HTML に置く印。挿入後に hydrate() で描く
  function slot(render, opt) {
    const id = "c" + (++seq);
    registry.set(id, render);
    const h = opt && opt.minH ? ` style="min-height:${opt.minH}px"` : "";
    return KGC.ui.raw(`<div class="chart${opt && opt.cls ? " " + opt.cls : ""}" data-chart="${id}"${h}></div>`);
  }
  function hydrate(root) {
    (root || document).querySelectorAll("[data-chart]").forEach((el) => {
      const fn = registry.get(el.dataset.chart);
      if (!fn) return;
      registry.delete(el.dataset.chart);
      let lastW = -1;
      const draw = () => {
        const w = Math.floor(el.clientWidth);
        if (!w || w === lastW) return;
        lastW = w;
        el.textContent = "";
        try { fn(el, w); el.style.minHeight = ""; } catch (e) { console.error(e); el.textContent = "グラフを表示できませんでした"; }
      };
      draw();
      if ("ResizeObserver" in window) {
        const ro = new ResizeObserver(() => draw());
        ro.observe(el);
        observers.push(ro);
      }
    });
  }
  function reset() {
    observers.splice(0).forEach((o) => o.disconnect());
    registry.clear();
    hideTip();
  }

  /* ------------------------------------------------------------ 文字幅 */
  let ctx2d = null, fontFamily = null;
  function tw(text, size, weight) {
    if (!ctx2d) {
      ctx2d = document.createElement("canvas").getContext("2d");
      fontFamily = getComputedStyle(document.body).fontFamily || "sans-serif";
    }
    ctx2d.font = `${weight || 400} ${size}px ${fontFamily}`;
    return ctx2d.measureText(String(text)).width;
  }

  /* ------------------------------------------------------------ 目盛り */
  function niceStep(span, target) {
    const raw = span / Math.max(1, target);
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const n = raw / mag;
    const m = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
    return m * mag;
  }
  function ticks(lo, hi, target) {
    if (!(hi > lo)) { hi = lo + 1; lo = lo - 1; }
    const step = niceStep(hi - lo, target || 4);
    const a = Math.floor(lo / step) * step, b = Math.ceil(hi / step) * step;
    const out = [];
    for (let v = a; v <= b + step * 1e-6; v += step) out.push(Number(v.toFixed(6)));
    return { lo: a, hi: b, step, list: out };
  }
  const tickFmt = (v, step) => {
    const d = step < 1 ? (step < 0.1 ? 2 : 1) : 0;
    const s = Math.abs(v) < 1e-9 ? 0 : v;
    return (s < 0 ? "−" : "") + Math.abs(s).toFixed(d);
  };

  /* ------------------------------------------------------------ ツールチップ */
  let tipEl = null;
  function tipNode() {
    if (!tipEl) {
      tipEl = document.createElement("div");
      tipEl.className = "tip";
      tipEl.setAttribute("role", "tooltip");
      document.body.appendChild(tipEl);
    }
    return tipEl;
  }
  // rows: [{color, value, label, kind}] 値が主役、名前は従
  function showTip(x, y, title, rows) {
    const el = tipNode();
    el.textContent = "";
    if (title) {
      const t = document.createElement("div");
      t.className = "tip-title";
      t.textContent = title;
      el.appendChild(t);
    }
    (rows || []).forEach((r) => {
      const row = document.createElement("div");
      row.className = "tip-row";
      if (r.color) {
        const k = document.createElement("i");
        k.className = "tip-key" + (r.kind ? " tip-key-" + r.kind : "");
        k.style.setProperty("--c", r.color);
        row.appendChild(k);
      }
      const v = document.createElement("b");
      v.textContent = r.value;
      row.appendChild(v);
      if (r.label) {
        const l = document.createElement("span");
        l.textContent = r.label;
        row.appendChild(l);
      }
      el.appendChild(row);
    });
    el.classList.add("show");
    const vw = document.documentElement.clientWidth, vh = window.innerHeight;
    const rect = el.getBoundingClientRect();
    let left = Math.max(8, Math.min(vw - rect.width - 8, x - rect.width / 2));
    let top = y - rect.height - 12;
    if (top < 8) top = Math.min(vh - rect.height - 8, y + 16);
    el.style.left = Math.round(left) + "px";
    el.style.top = Math.round(top) + "px";
  }
  function hideTip() {
    if (tipEl) tipEl.classList.remove("show");
    document.querySelectorAll(".is-hot").forEach((n) => n.classList.remove("is-hot"));
  }
  // data-tip='{"t":見出し,"r":[{c,v,l,k}]}' を持つ要素（棒・セルなど）
  function tipAttr(title, rows) {
    return ` data-tip="${esc(JSON.stringify({ t: title, r: rows.map((r) => ({ c: r.color, v: r.value, l: r.label, k: r.kind })) }))}" tabindex="0"`;
  }
  function tipFrom(el) {
    let d = null;
    try { d = JSON.parse(el.getAttribute("data-tip")); } catch (e) { return; }
    if (!d) return;
    document.querySelectorAll(".is-hot").forEach((n) => n.classList.remove("is-hot"));
    el.classList.add("is-hot");
    const r = el.getBoundingClientRect();
    showTip(r.left + r.width / 2, r.top, d.t, (d.r || []).map((x) => ({ color: x.c, value: x.v, label: x.l, kind: x.k })));
  }
  document.addEventListener("pointerover", (e) => {
    if (e.pointerType !== "mouse") return;
    const el = e.target.closest && e.target.closest("[data-tip]");
    if (el) tipFrom(el);
  });
  document.addEventListener("pointerout", (e) => {
    if (e.pointerType !== "mouse") return;
    const el = e.target.closest && e.target.closest("[data-tip]");
    if (el && !el.contains(e.relatedTarget)) hideTip();
  });
  document.addEventListener("click", (e) => {
    const el = e.target.closest && e.target.closest("[data-tip]");
    if (el) tipFrom(el);
  });
  document.addEventListener("focusin", (e) => {
    const el = e.target.closest && e.target.closest("[data-tip]");
    if (el) tipFrom(el);
  });
  document.addEventListener("pointerdown", (e) => {
    if (!e.target.closest || !e.target.closest(".chart, [data-tip], .tip")) hideTip();
  }, true);
  window.addEventListener("scroll", () => { if (tipEl && tipEl.classList.contains("show")) hideTip(); }, { passive: true });

  /* ------------------------------------------------------------ 共通の SVG */
  function svgOpen(w, h, label) {
    return `<svg class="viz" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(label || "グラフ")}">`;
  }
  const txt = (x, y, s, cls, anchor, extra) =>
    `<text x="${r1(x)}" y="${r1(y)}" class="${cls || "t-axis"}"${anchor ? ` text-anchor="${anchor}"` : ""}${extra || ""}>${esc(s)}</text>`;
  const r1 = (v) => Math.round(v * 10) / 10;
  const hline = (x1, x2, y, cls) => `<line x1="${r1(x1)}" x2="${r1(x2)}" y1="${r1(y) + 0.5}" y2="${r1(y) + 0.5}" class="${cls}"/>`;
  const vline = (x, y1, y2, cls) => `<line x1="${r1(x) + 0.5}" x2="${r1(x) + 0.5}" y1="${r1(y1)}" y2="${r1(y2)}" class="${cls}"/>`;
  // 先端だけ角丸の横棒（x0 が基線）
  function hbarPath(x0, x1, y, h, r) {
    const w = Math.abs(x1 - x0);
    if (w < 0.5) return "";
    r = Math.min(r, w, h / 2);
    if (x1 >= x0) {
      return `M${r1(x0)},${r1(y)}H${r1(x1 - r)}Q${r1(x1)},${r1(y)} ${r1(x1)},${r1(y + r)}V${r1(y + h - r)}Q${r1(x1)},${r1(y + h)} ${r1(x1 - r)},${r1(y + h)}H${r1(x0)}Z`;
    }
    return `M${r1(x0)},${r1(y)}H${r1(x1 + r)}Q${r1(x1)},${r1(y)} ${r1(x1)},${r1(y + r)}V${r1(y + h - r)}Q${r1(x1)},${r1(y + h)} ${r1(x1 + r)},${r1(y + h)}H${r1(x0)}Z`;
  }

  /* ------------------------------------------------------------ 折れ線
     o = { x:[{label, title}], series:[{id,name,color,values:[n|null]}], h, fmt(v), tipFmt(v,s,i),
           refs:[{y,label}], zero, divider:{after, labels:[左,右]}, endLabel(s,v), markers:"all"|"end", yPad, label } */
  function line(el, W, o) {
    const H = o.h || 220;
    const n = o.x.length;
    const vals = [];
    o.series.forEach((s) => s.values.forEach((v) => { if (isNum(v)) vals.push(v); }));
    if (!vals.length || !n) { el.innerHTML = `<p class="chart-empty">データがありません</p>`; return; }
    let lo = Math.min(...vals), hi = Math.max(...vals);
    const refs = (o.refs || []).filter((r) => r.y >= lo - (o.refReach || 6) && r.y <= hi + (o.refReach || 6));
    refs.forEach((r) => { lo = Math.min(lo, r.y); hi = Math.max(hi, r.y); });
    if (o.zero) { lo = Math.min(lo, 0); hi = Math.max(hi, 0); }
    const pad = Math.max((hi - lo) * 0.06, o.yPad || 0.5);
    // 0 を基準にするグラフは、データが 0 の片側だけならその外側に余白を足さない
    const tk = ticks(o.zero && lo >= 0 ? 0 : lo - pad, o.zero && hi <= 0 ? 0 : hi + pad, o.yTicks || 4);
    const fmtv = o.fmt || ((v) => String(v));
    const fs = 11;
    const ml = Math.ceil(Math.max(...tk.list.map((v) => tw(tickFmt(v, tk.step), fs)))) + 10;
    const ends = o.series.map((s) => {
      let li = -1;
      s.values.forEach((v, i) => { if (isNum(v)) li = i; });
      const text = li < 0 ? "" : (o.endLabel ? o.endLabel(s, s.values[li]) : `${s.name} ${fmtv(s.values[li])}`);
      return { s, li, text, w: tw(text, 11.5, 600) };
    });
    const mr = Math.min(Math.ceil(Math.max(0, ...ends.map((e) => e.w))) + 18, Math.round(W * 0.34));
    const mt = o.divider ? 24 : 12, mb = 28;
    const pw = Math.max(40, W - ml - mr), ph = H - mt - mb;
    const inset = n > 1 ? 8 : 0;
    const sx = (i) => (n === 1 ? ml + pw / 2 : ml + inset + (i * (pw - inset * 2)) / (n - 1));
    const sy = (v) => mt + ph - ((v - tk.lo) / (tk.hi - tk.lo)) * ph;

    let s = svgOpen(W, H, o.label);
    // 目盛り線と数字（基準線の値は金色の数字にして、近すぎる目盛りの数字は省く）
    tk.list.forEach((v) => {
      s += hline(ml, ml + pw, sy(v), Math.abs(v) < 1e-9 && o.zero ? "g-zero" : "g-grid");
      const near = refs.some((r) => Math.abs(sy(r.y) - sy(v)) < 12);
      if (!near) s += txt(ml - 6, sy(v) + 3.8, tickFmt(v, tk.step), "t-axis", "end");
    });
    refs.forEach((r) => { s += txt(ml - 6, sy(r.y) + 3.8, tickFmt(r.y, tk.step), "t-axis t-axis-ref", "end"); });
    // 区切り（前半｜後半など）
    if (o.divider && n > 1) {
      const dx = (sx(o.divider.after) + sx(o.divider.after + 1)) / 2;
      s += vline(dx, mt - 4, mt + ph, "g-divider");
      const [lt, rt] = o.divider.labels || [];
      if (lt) s += txt((ml + dx) / 2, mt - 9, lt, "t-sub", "middle");
      if (rt) s += txt((dx + ml + pw) / 2, mt - 9, rt, "t-sub", "middle");
    }
    // 基準線（100切り・90切りなど）。名前は図の説明文で伝える
    refs.forEach((r) => { s += hline(ml, ml + pw, sy(r.y), "g-ref"); });
    // x 軸の文字（重ならないよう間引く）
    const labW = Math.max(...o.x.map((x) => tw(x.label, fs))) + 10;
    const stepPx = n > 1 ? (pw - inset * 2) / (n - 1) : pw;
    let every = 1;
    while (every < n && stepPx * every < labW) every++;
    let shown = [];
    if (o.xShow) {
      // 呼び出し側の指定（例：各ハーフの 1・3・5・7・9 ホール目）。詰まりすぎなら間引く
      shown = o.x.map((_, i) => i).filter((i) => o.xShow(i, every));
    } else {
      for (let i = 0; i < n; i += every) shown.push(i);
      if (n > 1 && shown[shown.length - 1] !== n - 1) {
        if (stepPx * (n - 1 - shown[shown.length - 1]) < labW) shown.pop();
        shown.push(n - 1);
      }
    }
    shown.forEach((i) => {
      const x = sx(i), w = tw(o.x[i].label, fs);
      const anchor = x - w / 2 < 2 ? "start" : x + w / 2 > W - 2 ? "end" : "middle";
      s += txt(anchor === "start" ? Math.max(2, x - 6) : x, mt + ph + 18, o.x[i].label, "t-axis", anchor);
    });
    // 系列
    o.series.forEach((se) => {
      let d = "", started = false;
      se.values.forEach((v, i) => {
        if (!isNum(v)) { if (o.breakGaps) started = false; return; }
        d += (started ? "L" : "M") + r1(sx(i)) + "," + r1(sy(v));
        started = true;
      });
      if (d) s += `<path d="${d}" class="g-line" style="stroke:${se.color}"/>`;
    });
    o.series.forEach((se) => {
      se.values.forEach((v, i) => {
        if (!isNum(v)) return;
        const isEnd = ends.find((e) => e.s === se).li === i;
        if (o.markers === "end" && !isEnd) return;
        if (n > (o.maxMarkers || 12) && !isEnd) return;
        s += `<circle cx="${r1(sx(i))}" cy="${r1(sy(v))}" r="4" class="g-dot" style="fill:${se.color}"/>`;
      });
    });
    // 末尾の名前と値（重なるときは引き出し線）
    const labs = ends.filter((e) => e.li >= 0).map((e) => ({ ...e, x: sx(e.li), y: sy(e.s.values[e.li]) }));
    labs.forEach((l) => { l.ly = l.y; });
    labs.sort((a, b) => a.y - b.y);
    const gap = 15;
    for (let i = 1; i < labs.length; i++) if (labs[i].ly < labs[i - 1].ly + gap) labs[i].ly = labs[i - 1].ly + gap;
    const maxY = mt + ph + 4;
    if (labs.length && labs[labs.length - 1].ly > maxY) {
      labs[labs.length - 1].ly = maxY;
      for (let i = labs.length - 2; i >= 0; i--) if (labs[i].ly > labs[i + 1].ly - gap) labs[i].ly = labs[i + 1].ly - gap;
    }
    labs.forEach((l) => {
      const lx = l.x + 10;
      if (Math.abs(l.ly - l.y) > 2) s += `<path d="M${r1(l.x + 5)},${r1(l.y)}L${r1(lx - 2)},${r1(l.ly)}" class="g-leader"/>`;
      s += txt(lx, l.ly + 4, l.text, "t-end", "start");
    });
    // 操作用（十字線とハイライト）
    s += `<line class="g-cross" x1="0" x2="0" y1="${mt}" y2="${mt + ph}" visibility="hidden"/>`;
    s += `<g class="g-hover"></g>`;
    s += `<rect class="g-hit" x="${ml - 6}" y="0" width="${pw + 12}" height="${H}" fill="transparent"/>`;
    s += `</svg>`;
    el.innerHTML = s;

    const svg = el.querySelector("svg");
    svg.setAttribute("tabindex", "0");
    const cross = svg.querySelector(".g-cross"), hov = svg.querySelector(".g-hover");
    let cur = -1;
    function show(i) {
      if (i < 0 || i >= n) return;
      cur = i;
      const x = sx(i);
      cross.setAttribute("x1", r1(x) + 0.5);
      cross.setAttribute("x2", r1(x) + 0.5);
      cross.setAttribute("visibility", "visible");
      let dots = "", topY = Infinity;
      const rows = [];
      o.series.forEach((se) => {
        const v = se.values[i];
        if (!isNum(v)) return;
        dots += `<circle cx="${r1(x)}" cy="${r1(sy(v))}" r="5.5" class="g-dot g-dot-hot" style="fill:${se.color}"/>`;
        topY = Math.min(topY, sy(v));
        rows.push({ color: se.color, value: o.tipFmt ? o.tipFmt(v, se, i) : fmtv(v), label: se.name, v });
      });
      hov.innerHTML = dots;
      if (o.tipSort !== false) rows.sort((a, b) => a.v - b.v);
      const r = svg.getBoundingClientRect();
      showTip(r.left + x, r.top + (isFinite(topY) ? topY : mt), o.x[i].title || o.x[i].label, rows.map((x2) => ({ ...x2, kind: "line" })));
    }
    function nearest(clientX) {
      const r = svg.getBoundingClientRect();
      const px = clientX - r.left;
      let best = 0, bd = Infinity;
      for (let i = 0; i < n; i++) { const d = Math.abs(sx(i) - px); if (d < bd) { bd = d; best = i; } }
      return best;
    }
    function hide() {
      cross.setAttribute("visibility", "hidden");
      hov.innerHTML = "";
      hideTip();
    }
    svg.addEventListener("pointermove", (e) => { if (e.pointerType === "mouse" || e.buttons) show(nearest(e.clientX)); });
    svg.addEventListener("pointerdown", (e) => show(nearest(e.clientX)));
    svg.addEventListener("pointerleave", (e) => { if (e.pointerType === "mouse") hide(); });
    svg.addEventListener("keydown", (e) => {
      if (e.key === "ArrowRight") { show(Math.min(n - 1, cur + 1)); e.preventDefault(); }
      else if (e.key === "ArrowLeft") { show(Math.max(0, cur < 0 ? n - 1 : cur - 1)); e.preventDefault(); }
      else if (e.key === "Escape") hide();
    });
    svg.addEventListener("focus", () => show(cur < 0 ? n - 1 : cur));
    svg.addEventListener("blur", hide);
  }

  /* ------------------------------------------------------------ 横棒（グループ可）
     o = { groups:[{label, rows:[{label, value, color, text, tip, strong}]}], fmt(v), domain:[lo,hi], refs:[{value,label}], label } */
  function bars(el, W, o) {
    const fs = 12;
    const rowsAll = [];
    o.groups.forEach((g) => g.rows.forEach((r) => rowsAll.push(r)));
    const vals = rowsAll.map((r) => r.value).filter(isNum);
    if (!vals.length) { el.innerHTML = `<p class="chart-empty">データがありません</p>`; return; }
    const fmtv = o.fmt || ((v) => String(v));
    let lo = Math.min(0, ...vals), hi = Math.max(0, ...vals);
    if (o.domain) { lo = Math.min(lo, o.domain[0]); hi = Math.max(hi, o.domain[1]); }
    (o.refs || []).forEach((r) => { lo = Math.min(lo, r.value); hi = Math.max(hi, r.value); });
    if (hi === lo) hi = lo + 1;
    const labelW = Math.ceil(Math.max(...rowsAll.map((r) => tw(r.label, fs)))) + 12;
    const textW = Math.ceil(Math.max(...rowsAll.map((r) => tw(r.text != null ? r.text : fmtv(r.value), fs, 600)))) + 10;
    const x0 = labelW + (lo < 0 ? textW : 0), x1 = W - (hi > 0 ? textW : 4);
    const sx = (v) => x0 + ((v - lo) / (hi - lo)) * (x1 - x0);
    const bh = o.barH || 14, rowH = bh + 9, gh = 24, ggap = 12;
    let H = 6;
    o.groups.forEach((g, gi) => { H += (g.label ? gh : 0) + g.rows.length * rowH + (gi ? ggap : 0); });
    H += (o.refs && o.refs.length ? 18 : 4);
    let s = svgOpen(W, H, o.label);
    let y = 6;
    const zx = sx(0);
    const top = y;
    o.groups.forEach((g, gi) => {
      if (gi) y += ggap;
      if (g.label) {
        s += txt(0, y + 15, g.label, "t-group", "start");
        if (g.note) s += txt(tw(g.label, 13, 700) + 8, y + 15, g.note, "t-sub", "start");
        y += gh;
      }
      g.rows.forEach((r) => {
        const v = r.value;
        const cy = y + rowH / 2;
        s += txt(labelW - 10, cy + 4, r.label, r.strong ? "t-label t-strong" : "t-label", "end");
        if (isNum(v)) {
          const xe = sx(v);
          const tip = r.tip ? tipAttr(r.tip.title, r.tip.rows) : "";
          s += `<g class="g-mark"${tip}><rect x="${labelW}" y="${r1(y)}" width="${r1(W - labelW)}" height="${rowH}" fill="transparent"/>`;
          s += `<path d="${hbarPath(zx, xe, cy - bh / 2, bh, 4)}" class="g-bar" style="fill:${r.color}"/>`;
          const t = r.text != null ? r.text : fmtv(v);
          s += v >= 0 ? txt(Math.max(xe, zx) + 6, cy + 4, t, r.strong ? "t-val t-strong" : "t-val", "start")
            : txt(xe - 6, cy + 4, t, r.strong ? "t-val t-strong" : "t-val", "end");
          s += `</g>`;
        } else {
          s += txt(zx + 6, cy + 4, r.empty || "データなし", "t-sub", "start");
        }
        y += rowH;
      });
    });
    // 基線と基準線
    s += vline(zx, top, y, "g-base");
    (o.refs || []).forEach((rf) => {
      const x = sx(rf.value);
      s += vline(x, top, y + 2, "g-ref");
      if (rf.label) s += txt(Math.min(Math.max(x, labelW + tw(rf.label, 10.5) / 2), W - tw(rf.label, 10.5) / 2), y + 14, rf.label, "t-ref", "middle");
    });
    s += `</svg>`;
    el.innerHTML = s;
  }

  /* ------------------------------------------------------------ ダンベル（前半→後半）
     o = { rows:[{label, a, b, color}], aLabel, bLabel, fmt, label } */
  function dumbbell(el, W, o) {
    const fs = 12;
    const vals = [];
    o.rows.forEach((r) => { if (isNum(r.a)) vals.push(r.a); if (isNum(r.b)) vals.push(r.b); });
    if (!vals.length) { el.innerHTML = `<p class="chart-empty">データがありません</p>`; return; }
    const fmtv = o.fmt || ((v) => String(v));
    const tk = ticks(Math.min(...vals) - 1, Math.max(...vals) + 1, 4);
    const labelW = Math.ceil(Math.max(...o.rows.map((r) => tw(r.label, fs)))) + 14;
    const vw = Math.ceil(Math.max(...vals.map((v) => tw(fmtv(v), 11.5, 600)))) + 12;
    const x0 = labelW + vw, x1 = W - vw;
    const sx = (v) => x0 + ((v - tk.lo) / (tk.hi - tk.lo)) * (x1 - x0);
    const rowH = 38, top = 6;
    const H = top + o.rows.length * rowH + 26;
    let s = svgOpen(W, H, o.label);
    tk.list.forEach((v) => {
      s += vline(sx(v), top, top + o.rows.length * rowH, "g-grid");
      s += txt(sx(v), top + o.rows.length * rowH + 17, tickFmt(v, tk.step), "t-axis", "middle");
    });
    o.rows.forEach((r, i) => {
      const cy = top + i * rowH + rowH / 2;
      s += txt(labelW - 10, cy + 4, r.label, "t-label", "end");
      if (!isNum(r.a) || !isNum(r.b)) { s += txt(x0, cy + 4, "データなし", "t-sub", "start"); return; }
      const xa = sx(r.a), xb = sx(r.b);
      const tip = tipAttr(r.label, [
        { color: r.color, value: fmtv(r.a), label: o.aLabel, kind: "ring" },
        { color: r.color, value: fmtv(r.b), label: o.bLabel, kind: "dot" },
      ]);
      s += `<g class="g-mark"${tip}><rect x="${labelW}" y="${r1(cy - rowH / 2)}" width="${W - labelW}" height="${rowH}" fill="transparent"/>`;
      s += `<line x1="${r1(xa)}" x2="${r1(xb)}" y1="${r1(cy)}" y2="${r1(cy)}" class="g-dumb" style="stroke:${r.color}"/>`;
      s += `<circle cx="${r1(xa)}" cy="${r1(cy)}" r="5.5" class="g-ring" style="stroke:${r.color}"/>`;
      s += `<circle cx="${r1(xb)}" cy="${r1(cy)}" r="6" class="g-dot" style="fill:${r.color}"/>`;
      const left = xa <= xb ? [xa, r.a] : [xb, r.b], right = xa <= xb ? [xb, r.b] : [xa, r.a];
      if (Math.abs(xa - xb) < 1) s += txt(right[0] + 11, cy + 4, fmtv(right[1]), "t-val", "start");
      else {
        s += txt(left[0] - 10, cy + 4, fmtv(left[1]), "t-val", "end");
        s += txt(right[0] + 11, cy + 4, fmtv(right[1]), "t-val", "start");
      }
      s += `</g>`;
    });
    s += `</svg>`;
    el.innerHTML = s;
  }

  /* ------------------------------------------------------------ 中央ぞろえの積み上げ横棒（打数の内訳）
     o = { rows:[{label, rate:{eagle..triple}, count:{...}, n}], label } パーを中央で左右に分ける */
  const CATS = ["eagle", "birdie", "par", "bogey", "double", "triple"];
  function divstack(el, W, o) {
    const fs = 12;
    const U = KGC.ui;
    const rows = o.rows.filter((r) => r.rate);
    if (!rows.length) { el.innerHTML = `<p class="chart-empty">データがありません</p>`; return; }
    const part = (r, c) => (isNum(r.rate[c]) ? r.rate[c] : 0);
    const L = rows.map((r) => part(r, "eagle") + part(r, "birdie") + part(r, "par") / 2);
    const R = rows.map((r) => part(r, "par") / 2 + part(r, "bogey") + part(r, "double") + part(r, "triple"));
    const maxL = Math.max(0.05, ...L), maxR = Math.max(0.05, ...R);
    const labelW = Math.ceil(Math.max(...rows.map((r) => tw(r.label, fs)))) + 14;
    const x0 = labelW, x1 = W - 2;
    const k = (x1 - x0) / (maxL + maxR);
    const cx = x0 + maxL * k;
    const bh = 22, rowH = 36, top = 4;
    const H = top + rows.length * rowH + 24;
    let s = svgOpen(W, H, o.label);
    let defs = "<defs>";
    const by = top + rows.length * rowH;
    s += vline(cx, top, by, "g-center");
    rows.forEach((r, i) => {
      const y = top + i * rowH + (rowH - bh) / 2;
      const cy = y + bh / 2;
      s += txt(labelW - 10, cy + 4, r.label, "t-label", "end");
      let x = cx - L[i] * k;
      const id = `ds${++clipSeq}`;
      defs += `<clipPath id="${id}"><rect x="${r1(x)}" y="${r1(y)}" width="${r1((L[i] + R[i]) * k)}" height="${bh}" rx="4"/></clipPath>`;
      s += `<g clip-path="url(#${id})">`;
      CATS.forEach((c) => {
        const w = part(r, c) * k;
        if (w <= 0) return;
        const cnt = r.count && isNum(r.count[c]) ? `${r.count[c]}回` : "";
        const tip = tipAttr(`${r.label}・${U.CAT_LABEL[c]}`, [{ color: `var(--r-${c})`, value: U.fmt.pct(part(r, c)), label: cnt ? `${cnt}（${r.n}ホール中）` : "" }]);
        s += `<g class="g-mark"${tip}><rect x="${r1(x + 1)}" y="${r1(y)}" width="${r1(Math.max(0.5, w - 2))}" height="${bh}" class="${"seg-" + c}"/>`;
        const label = U.fmt.pct(part(r, c));
        if (w - 2 >= tw(label, 10.5, 600) + 8) s += txt(x + w / 2, cy + 3.8, label, "t-in on-" + c, "middle");
        s += `</g>`;
        x += w;
      });
      s += `</g>`;
    });
    defs += "</defs>";
    s = s.replace(/^(<svg[^>]*>)/, `$1${defs}`);
    s += txt(cx - 8, by + 15, "← パーより良い", "t-sub", "end");
    s += txt(cx + 8, by + 15, "パーより悪い →", "t-sub", "start");
    s += `</svg>`;
    el.innerHTML = s;
  }

  /* ------------------------------------------------------------ 勝敗の帯（HTML） */
  function split(parts) {
    // parts: [{n, color, label, cls}] 0 は省く。数字は帯の下に墨色で出す
    const total = parts.reduce((a, p) => a + (p.n || 0), 0);
    if (!total) return KGC.ui.html`<div class="split split-empty"></div>`;
    return KGC.ui.html`<div class="split" role="img" aria-label="${parts.map((p) => `${p.label} ${p.n}`).join("、")}">${parts.filter((p) => p.n > 0).map((p) =>
      KGC.ui.html`<span class="${"split-seg " + (p.cls || "")}" style="${`flex:${p.n} 1 0;background:${p.color}`}" ${KGC.ui.raw(tipAttr(p.tipTitle || p.label, [{ color: p.color, value: String(p.n), label: p.label }]))}></span>`)}</div>`;
  }

  /* ------------------------------------------------------------ スパークライン（静的） */
  function spark(values, color, w, h) {
    w = w || 84; h = h || 26;
    const v = values.filter(isNum);
    if (v.length < 2) return "";
    const lo = Math.min(...v), hi = Math.max(...v);
    const sx = (i) => 3 + (i * (w - 6)) / (values.length - 1);
    const sy = (x) => (hi === lo ? h / 2 : 3 + ((x - lo) / (hi - lo)) * (h - 6));
    let d = "", last = null;
    values.forEach((x, i) => { if (!isNum(x)) return; d += (d ? "L" : "M") + r1(sx(i)) + "," + r1(sy(x)); last = [sx(i), sy(x)]; });
    return KGC.ui.raw(`<svg class="spark" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true"><path d="${d}" class="g-spark" style="stroke:${color}"/><circle cx="${r1(last[0])}" cy="${r1(last[1])}" r="3" style="fill:${color}" class="g-spark-dot"/></svg>`);
  }

  KGC.charts = { slot, hydrate, reset, line, bars, dumbbell, divstack, split, spark, showTip, hideTip, tipAttr, tw, ticks };
})();
