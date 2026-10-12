/* ラウンド詳細：順位、スコアカード（記号の切り替え）、スコアの流れ、マッチプレー、スキン・ステーブルフォード、
   ハイライト、写真・動画、元のスコアカード画像。 */
"use strict";
(function () {
  const KGC = (window.KGC = window.KGC || {});
  KGC.views = KGC.views || {};
  const MODE_KEY = "kgc-scorecard-mode";

  function readMode() { try { return sessionStorage.getItem(MODE_KEY) === "sym" ? "sym" : "intl"; } catch (e) { return "intl"; } }
  function saveMode(m) { try { sessionStorage.setItem(MODE_KEY, m); } catch (e) { /* 続ける */ } }
  const sum = (a) => (a || []).reduce((x, y) => x + (typeof y === "number" ? y : 0), 0);
  // OUT/IN の呼び名（1番始まりなら OUT、10番始まりなら IN）
  const outIn = (nine) => (nine && nine.holes ? (nine.holes[0] === 1 ? "OUT" : nine.holes[0] === 10 ? "IN" : "") : "");

  // スコアカードの列（選手→ゲストの順）
  function columns(r) {
    const db = KGC.db;
    const order = new Map(db.players.map((p, i) => [p.id, i]));
    const cols = (r.scores || []).slice().sort((a, b) => (order.has(a.player) ? order.get(a.player) : 99) - (order.has(b.player) ? order.get(b.player) : 99))
      .map((s) => ({ pid: s.player, name: db.name(s.player), strokes: s.strokes, halves: s.halves || [], total: s.total, toPar: s.toPar }));
    (((r.detail || {}).guests) || []).forEach((g) => {
      cols.push({ pid: null, guest: true, name: g.name || "ゲスト", strokes: g.strokes, halves: g.strokes ? g.strokes.map(sum) : [], total: g.total, toPar: g.toPar });
    });
    return cols;
  }

  function scoreCell(st, par, mode) {
    const U = KGC.ui, html = U.html;
    if (typeof st !== "number") return html`<td class="sc sc-none">—</td>`;
    const tp = st - par, c = U.cat(tp);
    const title = `${st}打（${U.CAT_LABEL[c]}）`;
    if (mode === "sym") return html`<td class="${"sc r-" + c}" title="${title}"><span class="${"sy sy-" + c}">${U.sym(tp)}</span></td>`;
    return html`<td class="${"sc r-" + c}" title="${title}"><span class="${"mk mk-" + c}">${st}</span></td>`;
  }

  function scorecard(r, mode) {
    const U = KGC.ui, html = U.html;
    const cols = columns(r);
    const nCol = cols.length + 2;
    const body = [];
    (r.nines || []).forEach((nine, h) => {
      const tag = (r.nines.length > 1 ? (h === 0 ? "前半" : "後半") : "");
      body.push(html`<tr class="sc-nine"><th colspan="${nCol}" scope="colgroup">${tag ? html`<span class="sc-half">${tag}</span>` : ""}${nine.label}</th></tr>`);
      (nine.holes || []).forEach((no, i) => {
        body.push(html`<tr><th scope="row" class="sc-no">${no}</th><td class="sc-par">${nine.par[i]}</td>${cols.map((c) => scoreCell(c.strokes && c.strokes[h] ? c.strokes[h][i] : null, nine.par[i], mode))}</tr>`);
      });
      const oi = outIn(nine);
      body.push(html`<tr class="sc-sub"><th scope="row">${tag || "計"}${oi ? html`<small>${oi}</small>` : ""}</th><td class="sc-par">${sum(nine.par)}</td>${cols.map((c) => html`<td>${typeof c.halves[h] === "number" ? c.halves[h] : "—"}</td>`)}</tr>`);
    });
    body.push(html`<tr class="sc-total"><th scope="row">合計</th><td class="sc-par">${r.par}</td>${cols.map((c) => html`<td>${typeof c.total === "number" ? c.total : "—"}</td>`)}</tr>`);
    body.push(html`<tr class="sc-topar"><th scope="row">対パー</th><td class="sc-par"></td>${cols.map((c) => html`<td>${U.fmt.toPar(c.toPar)}</td>`)}</tr>`);
    return html`<div class="tbl-wrap sc-wrap"><table class="${"scard mode-" + mode}">
      <thead><tr><th scope="col" class="sc-no">H</th><th scope="col" class="sc-par">Par</th>${cols.map((c) => html`<th scope="col" class="sc-pl">${c.pid ? U.dot(c.pid) : html`<i class="dot dot-guest" aria-hidden="true"></i>`}<span>${c.name}</span>${c.guest ? html`<small>ゲスト</small>` : ""}</th>`)}</tr></thead>
      <tbody>${body}</tbody>
    </table></div>`;
  }

  function markLegend(mode) {
    const U = KGC.ui, html = U.html;
    if (mode === "sym") {
      return html`<ul class="mk-legend">${["eagle", "birdie", "par", "bogey", "double", "triple"].map((c) =>
        html`<li><span class="${"sy sy-" + c}">${c === "triple" ? "+3" : U.CAT_SYM[c]}</span>${c === "triple" ? "トリプル以上" : U.CAT_SHORT[c]}</li>`)}</ul>`;
    }
    const sample = { eagle: 3, birdie: 3, par: 4, bogey: 5, double: 6, triple: 7 };
    return html`<ul class="mk-legend">${["eagle", "birdie", "par", "bogey", "double"].map((c) =>
      html`<li><span class="${"mk-sample r-" + c}"><span class="${"mk mk-" + c}">${sample[c]}</span></span>${c === "double" ? "ダボ以上" : U.CAT_SHORT[c]}</li>`)}</ul>`;
  }

  KGC.views.round = (root, data, params) => {
    const U = KGC.ui, C = KGC.charts, P = KGC.parts, db = KGC.db, html = U.html;
    const r = db.round(params.id);
    if (!r) {
      root.innerHTML = String(html`<div class="page-head"><h1 class="page-title">ラウンドが見つかりません</h1></div>${U.empty("指定されたラウンドはありません。", "")}<p class="center"><a class="btn" href="#/rounds">ラウンド一覧へ</a></p>`);
      return;
    }
    KGC.app.setTitle(`第${r.no}回`);
    const det = r.detail || {};
    const i = db.rounds.indexOf(r);
    const prev = db.rounds[i - 1], next = db.rounds[i + 1];
    const items = U.mediaItems(r);
    const cov = U.coverItem(r);
    const coverIdx = Math.max(0, items.findIndex((m) => m.id === r.cover));

    /* 見出し */
    const routing = (r.nines || []).map((n) => n.label).join(" → ");
    const head = html`<header class="page-head round-head">
      <p class="kicker">第${r.no}回${db.cup ? " " + db.cup : ""}</p>
      <h1 class="page-title">${db.courseName(r.course)}</h1>
      <p class="page-meta">${U.date.long(r.date)}${routing ? html`<span class="sep" aria-hidden="true">｜</span>${routing}` : ""}${r.nines && r.nines.length === 1 ? "（9ホール）" : ""}</p>
      <p class="page-links"><a href="${"#/course/" + encodeURIComponent(r.course)}">${U.icon("course")}コースの成績</a></p>
    </header>`;
    const banner = cov ? html`<button type="button" class="banner" aria-label="写真を開く">
        <img ${U.attrs({ "data-enc": cov.src, alt: cov.caption || "" })}>${cov.caption ? html`<span class="banner-cap">${cov.caption}</span>` : ""}</button>` : "";
    const wx = html`<div class="card wx-card">${U.wxDetail(r.weather)}</div>`;

    /* 結果 */
    const result = U.section("result", "結果", html`<div class="card">${P.podium(r, { halves: true })}</div>`, { cls: "ga-result" });

    /* スコアカード */
    const mode = readMode();
    const card = U.section("card", "スコアカード", html`<div class="card sc-card">
      <div class="sc-tools">
        ${U.seg("scmode", [{ value: "intl", label: "打数" }, { value: "sym", label: "記号" }], mode, "スコアの表示")}
        <div class="sc-legend" data-sc-legend>${markLegend(mode)}</div>
      </div>
      <div data-sc-body>${scorecard(r, mode)}</div>
    </div>`, { lead: "上から順にプレーした順番です。", cls: "ga-card" });

    /* スコアの流れ */
    const race = det.race || {};
    const rpids = db.players.map((p) => p.id).filter((p) => Array.isArray(race[p]) && race[p].length);
    let raceSec = "";
    if (rpids.length) {
      const n = Math.max(...rpids.map((p) => race[p].length));
      const holeOf = (seq) => { const h = seq < 9 ? 0 : 1, k = seq % 9; const nine = (r.nines || [])[h] || {}; return { nine, no: (nine.holes || [])[k], par: (nine.par || [])[k], h, k }; };
      const x = Array.from({ length: n }, (_, s) => { const o = holeOf(s); return { label: String(o.no), title: `${s + 1}ホール目・${o.nine.label || ""} ${o.no}番 Par${o.par}` }; });
      const strokesOf = (pid, s) => { const sc = (r.scores || []).find((q) => q.player === pid); const o = holeOf(s); return sc && sc.strokes && sc.strokes[o.h] ? sc.strokes[o.h][o.k] : null; };
      const series = rpids.map((p) => ({ id: p, name: db.name(p), color: db.color(p), values: race[p] }));
      const chart = C.slot((el, w) => C.line(el, w, {
        x, series, h: 250, zero: true, markers: "end", label: "スコアの流れ",
        // 狭い画面では各ハーフの 1・3・5・7 ホール目（最後のハーフだけ 9 ホール目も）に数字を出す
        xShow: (k, every) => (every <= 1 ? true : (k % 9) % 2 === 0 && ((k % 9) < 8 || k === n - 1)),
        divider: n > 9 && r.nines.length > 1 ? { after: 8, labels: [`前半 ${outIn(r.nines[0]) || r.nines[0].label}`, `後半 ${outIn(r.nines[1]) || r.nines[1].label}`] } : null,
        fmt: (v) => U.fmt.toPar(v),
        tipFmt: (v, s, k) => { const st = strokesOf(s.id, k); return st != null ? `${U.fmt.toPar(v)}（${st}打）` : U.fmt.toPar(v); },
        endLabel: (s, v) => `${s.name} ${U.fmt.toPar(v)}`,
      }), { minH: 250 });
      // 首位の推移
      const leaderAt = (k) => { let best = Infinity, who = []; rpids.forEach((p) => { const v = race[p][k]; if (typeof v !== "number") return; if (v < best) { best = v; who = [p]; } else if (v === best) who.push(p); }); return { who, best }; };
      const lines = [];
      if (n > 9) { const t = leaderAt(8); if (t.who.length === 1) lines.push(`前半を終えて首位は${db.name(t.who[0])}（${U.fmt.toPar(t.best)}）`); else if (t.who.length > 1) lines.push(`前半を終えて${t.who.map(db.name).join("・")}が首位で並ぶ（${U.fmt.toPar(t.best)}）`); }
      let changes = 0, lastLeader = null, alwaysSame = true;
      for (let k = 0; k < n; k++) {
        const t = leaderAt(k);
        if (t.who.length !== 1) { alwaysSame = false; continue; }
        if (lastLeader && t.who[0] !== lastLeader) { changes++; alwaysSame = false; }
        lastLeader = t.who[0];
      }
      if (alwaysSame && lastLeader) lines.push(`${db.name(lastLeader)}が最初から最後まで単独首位`);
      else if (changes) lines.push(`単独首位の入れ替わり ${changes} 回`);
      const table = {
        cols: [{ label: "順" }, { label: "ホール" }, { label: "Par", num: true }].concat(rpids.map((p) => ({ label: db.name(p), num: true }))),
        rows: x.map((xx, k) => { const o = holeOf(k); return [String(k + 1), `${o.nine.label || ""} ${o.no}番`, String(o.par)].concat(rpids.map((p) => U.fmt.toPar(race[p][k]))); }),
      };
      raceSec = U.section("race", "スコアの流れ", U.figure({
        title: "パーとの差の積み上げ", sub: "ホールごとに加算・下にいるほど良い",
        legend: U.playerLegend(rpids), body: chart, table, takeaway: lines,
      }), { cls: "ga-race" });
    }

    /* マッチプレー */
    let matchSec = "";
    if ((det.match || []).length) {
      const rows = det.match.map((m) => {
        const wA = m.winner === m.a, wB = m.winner === m.b;
        const res = m.winner ? `${db.name(m.winner)} ${m.result}` : "引き分け（AS）";
        return html`<li class="match">
          <div class="match-row">
            <span class="${"match-p " + (wA ? "is-win" : "")}">${U.chip(m.a)}</span>
            <span class="${"match-res " + (m.winner ? "" : "is-draw")}">${res}</span>
            <span class="${"match-p match-p-b " + (wB ? "is-win" : "")}">${U.chip(m.b)}</span>
          </div>
          ${C.split([
            { n: m.aWins, color: db.color(m.a), label: `${db.name(m.a)}の勝ち` },
            { n: m.halved, color: "var(--r-par)", label: "引き分け" },
            { n: m.bWins, color: db.color(m.b), label: `${db.name(m.b)}の勝ち` },
          ])}
          <p class="match-sub"><span>${db.name(m.a)} ${m.aWins}勝</span><span>分け ${m.halved}</span><span>${db.name(m.b)} ${m.bWins}勝</span></p>
        </li>`;
      });
      matchSec = U.section("match", "マッチプレー", html`<div class="card"><ul class="matches">${rows}</ul>
        <p class="fig-note">各ホールの打数で勝ち負けを数える1対1の勝負。「2&1」は残り1ホールで2アップ（そこで決着）、「AS」は引き分け。帯は18ホールの勝ち・分け・負けの数。</p></div>`, { cls: "ga-match" });
    }

    /* スキン・ステーブルフォード */
    let gameSec = "";
    const skins = (det.skins && det.skins.byPlayer) || {};
    const sf = det.stableford || {};
    const gpids = db.players.map((p) => p.id).filter((p) => p in skins || p in sf);
    if (gpids.length) {
      const maxSk = Math.max(1, ...gpids.map((p) => skins[p] || 0));
      const maxSf = Math.max(1, ...gpids.map((p) => sf[p] || 0));
      const sorted = gpids.slice().sort((a, b) => (sf[b] || 0) - (sf[a] || 0));
      gameSec = U.section("games", "スキン・ステーブルフォード", html`<div class="card">
        <table class="tbl games">
          <thead><tr><th scope="col">選手</th><th scope="col" class="num">スキン</th><th scope="col" class="num">ステーブルフォード</th></tr></thead>
          <tbody>${sorted.map((p) => html`<tr>
            <th scope="row">${U.chip(p)}</th>
            <td class="num"><span class="minibar"><i style="${`width:${Math.round(((skins[p] || 0) / maxSk) * 100)}%;background:${db.color(p)}`}"></i></span><b>${skins[p] != null ? skins[p] : "—"}</b></td>
            <td class="num"><span class="minibar"><i style="${`width:${Math.round(((sf[p] || 0) / maxSf) * 100)}%;background:${db.color(p)}`}"></i></span><b>${sf[p] != null ? sf[p] + "点" : "—"}</b></td>
          </tr>`)}</tbody>
        </table>
        <p class="fig-note">スキン＝そのホールを単独の最少打数で上がった数（同じ打数で並んだ ${det.skins && det.skins.none != null ? det.skins.none : 0} ホールは誰も取らず）。ステーブルフォード＝各ホールの点数の合計（パー2点・ボギー1点・バーディー3点・イーグル4点、ダボ以上0点）。</p>
        ${(det.net || []).length ? html`<h3 class="sub-title">ハンディキャップ込み（参考）</h3>${U.table({
          cols: [{ label: "選手" }, { label: "HC", num: true }, { label: "ネット", num: true }],
          rows: det.net.map((x) => [U.chip(x.player), U.fmt.num(x.index, 1), U.fmt.num(x.net, 1)]),
        })}` : ""}
      </div>`, { cls: "ga-games" });
    }

    /* ハイライト・メモ */
    const hl = P.highlights(r);
    const memo = (r.memo || "").trim();
    const hlSec = hl || memo ? U.section("hl", "ハイライト", html`<div class="card">${hl}${memo ? html`<div class="memo"><h3 class="sub-title">メモ</h3><p>${memo}</p></div>` : ""}</div>`) : "";

    /* 写真・動画 */
    const gal = U.section("photos", "写真・動画", items.length ? html`<div data-gallery>${U.gallery(items)}</div>` : U.empty("このラウンドの写真・動画はまだありません"));

    /* 元のスコアカード */
    const scImg = r.scorecard ? html`<details class="card disclose">
        <summary>${U.icon("card")}<span>元のスコアカード（アプリの画面）</span></summary>
        <button type="button" class="sc-img" data-sc-open aria-label="スコアカードの画像を拡大">
          <img ${U.attrs({ "data-enc": r.scorecard.src, alt: "スコアカードの画像", width: r.scorecard.w || null, height: r.scorecard.h || null })}>
        </button>
      </details>` : "";

    /* 前後のラウンド */
    const pager = html`<nav class="pager" aria-label="前後のラウンド">
      ${prev ? html`<a class="pager-prev" href="${"#/round/" + encodeURIComponent(prev.id)}"><span aria-hidden="true">‹</span><span><small>前のラウンド</small>第${prev.no}回</span></a>` : html`<span></span>`}
      <a class="pager-mid" href="#/rounds">一覧</a>
      ${next ? html`<a class="pager-next" href="${"#/round/" + encodeURIComponent(next.id)}"><span><small>次のラウンド</small>第${next.no}回</span><span aria-hidden="true">›</span></a>` : html`<span></span>`}
    </nav>`;

    root.innerHTML = String(html`${head}${banner}${wx}<div class="round-grid">${result}${card}${raceSec}${matchSec}${gameSec}</div>${hlSec}${gal}${scImg}${pager}`);

    /* 操作 */
    U.onSeg(root, "scmode", (m) => {
      saveMode(m);
      root.querySelector("[data-sc-body]").innerHTML = String(scorecard(r, m));
      root.querySelector("[data-sc-legend]").innerHTML = String(markLegend(m));
    });
    const g = root.querySelector("[data-gallery]");
    if (g) U.bindGallery(g, items);
    const b = root.querySelector(".banner");
    if (b) b.addEventListener("click", () => U.lightbox(items, coverIdx));
    const so = root.querySelector("[data-sc-open]");
    if (so) so.addEventListener("click", () => U.lightbox([{ type: "photo", id: r.id + "-scorecard", src: r.scorecard.src, thumb: r.scorecard.thumb || r.scorecard.src, w: r.scorecard.w, h: r.scorecard.h, caption: "スコアカード", meta: P.roundMeta(r) }], 0));
  };
})();
