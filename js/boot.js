/* 合言葉の扉と復号（伊勢サイトの方式を流用し、「この端末で覚える」の不具合を直したもの）。
   - 公開しているのは暗号文（enc/）だけ。合言葉で鍵 K を開き、K から作る K_enc で本体と写真を復号する。
   - 「この端末で覚える」は K_enc（取り出し不可・復号専用の CryptoKey）を IndexedDB に置く。合言葉も K も保存しない。
     ★K を記憶すると K_enc で暗号化した本体が開けず、再訪のたびに記憶が消える（伊勢・誕生日サイトの不具合）。
   - 127.0.0.1 / localhost で ?dev を付けると、暗号化前の build/plain を読む（./kgc preview 専用。公開版には無い）。
   画面側は KGC.app.start(data) を実装し、写真は <img data-enc="論理パス"> と書けば見えたときに復号される。 */
"use strict";
(function () {
  const KGC = (window.KGC = window.KGC || {});
  const IDB_NAME = "kgc-key";          // 同じ github.io の他サイトと混ざらない名前
  const IDB_STORE = "k";
  const IMG_BUDGET = 24 * 1024 * 1024; // 復号済み写真を持つ上限。超えたら古い順に捨て、見えたら復号し直す
  const isLocal = location.hostname === "127.0.0.1" || location.hostname === "localhost";
  const DEV = isLocal && new URLSearchParams(location.search).has("dev");

  let keysJson = null;
  let kEnc = null;
  let manifest = null;
  let started = false;
  let failCount = 0;

  const $ = (sel) => document.querySelector(sel);

  function gateMessage(text, kind) {
    const el = $("#gate-msg");
    if (!el) return;
    el.textContent = text || "";
    el.className = "gate-msg" + (kind ? " " + kind : "");
  }

  /* ------------------------------------------------------------ 写真・動画 */
  const cache = new Map();     // 論理パス → { url, size, pinned }
  const inflight = new Map();
  let cachedBytes = 0;

  function evict(keep) {
    for (const [p, v] of cache) {
      if (cachedBytes <= IMG_BUDGET) break;
      if (p === keep || v.pinned) continue;
      cache.delete(p);
      cachedBytes -= v.size;
      try { URL.revokeObjectURL(v.url); } catch (e) { /* 解放できなくても続ける */ }
      document.querySelectorAll("img[data-enc]").forEach((el) => {
        if (el.dataset.enc === p) { el.removeAttribute("src"); el.dataset.hydrated = ""; observeImg(el); }
      });
    }
  }

  async function readBody(res, total, onProgress) {
    if (!onProgress || !res.body || !res.body.getReader) return new Uint8Array(await res.arrayBuffer());
    const reader = res.body.getReader();
    const chunks = [];
    let got = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      got += value.length;
      onProgress(Math.min(1, got / total));
    }
    const out = new Uint8Array(got);
    let i = 0;
    for (const c of chunks) { out.set(c, i); i += c.length; }
    return out;
  }

  async function decrypt(path, onProgress) {
    const f = manifest && manifest.files && manifest.files[path];
    if (!f || !kEnc) throw new Error("ファイルがありません: " + path);
    const res = await fetch(`enc/b/${f.n}.bin?h=${f.h}`, { cache: "force-cache" });
    if (!res.ok) throw new Error("取得できませんでした");
    const buf = await readBody(res, f.s + 36, onProgress);
    const plain = await GC.open(kEnc, buf, path);
    const blob = new Blob([plain], { type: f.t || "application/octet-stream" });
    return { url: URL.createObjectURL(blob), size: plain.length, blob };
  }

  /* 論理パス → 表示できる URL（Promise）。同じパスの同時要求は1回にまとめる */
  function url(path, opts) {
    opts = opts || {};
    if (DEV) return Promise.resolve(`/__plain/${path}`);
    const hit = cache.get(path);
    if (hit) { if (opts.pin) hit.pinned = true; return Promise.resolve(hit.url); }
    let job = inflight.get(path);
    if (!job) {
      job = decrypt(path, opts.onProgress).then(({ url: u, size, blob: b }) => {
        cache.set(path, { url: u, size, pinned: !!opts.pin, blob: b });
        cachedBytes += size;
        evict(path);
        return u;
      }).finally(() => inflight.delete(path));
      inflight.set(path, job);
    }
    return job;
  }

  /* 保存・共有用に復号済みの中身を Blob で返す（CSP の connect-src で blob: を fetch できないため） */
  async function blob(path) {
    if (DEV) return (await fetch(`/__plain/${path}`)).blob();
    await url(path);
    const hit = cache.get(path);
    if (hit && hit.blob) return hit.blob;
    return (await decrypt(path)).blob;
  }

  /* 動画は見えただけでは復号しない（タップで呼ぶ）。同時に保持するのは1本だけ */
  let currentVideo = null;
  function video(path, onProgress) {
    if (currentVideo && currentVideo !== path) release(currentVideo);
    currentVideo = path;
    return url(path, { pin: true, onProgress });
  }
  function release(path) {
    const v = cache.get(path);
    if (!v || DEV) return;
    cache.delete(path);
    cachedBytes -= v.size;
    try { URL.revokeObjectURL(v.url); } catch (e) { /* 続ける */ }
    if (currentVideo === path) currentVideo = null;
  }

  /* <img data-enc="..."> は画面に近づいたら復号して src を入れる（画面側は置くだけでよい） */
  const io = "IntersectionObserver" in window
    ? new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        io.unobserve(e.target);
        loadImg(e.target);
      }
    }, { rootMargin: "400px" })
    : null;
  function loadImg(el) {
    const p = el.dataset.enc;
    if (!p || el.dataset.hydrated === p) return;
    el.dataset.hydrated = p;
    el.classList.add("is-loading");
    url(p).then((u) => {
      if (el.isConnected && el.dataset.enc === p) { el.src = u; }
    }).catch(() => { el.dataset.hydrated = ""; el.classList.add("is-error"); })
      .finally(() => el.classList.remove("is-loading"));
  }
  function observeImg(el) { if (io) io.observe(el); else loadImg(el); }
  function hydrate(root) {
    (root || document).querySelectorAll("img[data-enc]").forEach((el) => {
      if (el.dataset.hydrated !== el.dataset.enc) observeImg(el);
    });
  }
  const mo = "MutationObserver" in window ? new MutationObserver((list) => {
    for (const m of list) {
      for (const n of m.addedNodes) {
        if (n.nodeType !== 1) continue;
        if (n.matches && n.matches("img[data-enc]")) observeImg(n);
        else if (n.querySelectorAll) hydrate(n);
      }
      if (m.type === "attributes" && m.target.matches && m.target.matches("img[data-enc]")) observeImg(m.target);
    }
  }) : null;

  KGC.media = { url, blob, video, release, hydrate, dev: DEV };

  /* ------------------------------------------------------------ 端末の記憶（IndexedDB） */
  function idb(mode, fn, timeoutMs) {
    return new Promise((resolve, reject) => {
      let done = false;
      const finish = (f, v) => { if (!done) { done = true; clearTimeout(timer); f(v); } };
      const timer = setTimeout(() => finish(reject, new Error("timeout")), timeoutMs);
      try {
        if (!window.indexedDB) return finish(reject, new Error("no idb"));
        const req = indexedDB.open(IDB_NAME, 1);
        req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE);
        req.onblocked = () => finish(reject, new Error("blocked"));
        req.onerror = () => finish(reject, req.error);
        req.onsuccess = () => {
          const db = req.result;
          try {
            const tx = db.transaction(IDB_STORE, mode);
            const r = fn(tx.objectStore(IDB_STORE));
            tx.oncomplete = () => { db.close(); finish(resolve, r && r.result); };
            tx.onerror = tx.onabort = () => { db.close(); finish(reject, tx.error || new Error("tx")); };
          } catch (e) { db.close(); finish(reject, e); }
        };
      } catch (e) { finish(reject, e); }
    });
  }
  async function storeKey(key) {
    try { await idb("readwrite", (st) => st.put({ key, v: 2 }, "content"), 3000); return true; }
    catch (e) { return false; }
  }
  async function loadKey() {
    try {
      const rec = await idb("readonly", (st) => st.get("content"), 1500);
      return rec && rec.v === 2 && rec.key ? rec.key : null;
    } catch (e) { return null; }
  }
  async function clearKey() {
    try { await idb("readwrite", (st) => st.delete("content"), 1500); } catch (e) { /* 消せなくても続ける */ }
  }
  KGC.forget = async function () { await clearKey(); location.reload(); };

  /* ------------------------------------------------------------ 本体を開く */
  async function openContent(key) {
    const h = (keysJson && keysJson.manifest && keysJson.manifest.h) || "";
    const res = await fetch(`enc/m.bin?h=${h}`, { cache: "force-cache" });
    if (!res.ok) throw new Error("本体を取得できません");
    const plain = await GC.open(key, new Uint8Array(await res.arrayBuffer()), "manifest");
    manifest = JSON.parse(new TextDecoder().decode(plain));
    kEnc = key;
    start(manifest.data);
  }

  function start(data) {
    if (started) return;
    started = true;
    KGC.data = data;
    const gate = $("#gate");
    if (gate) gate.hidden = true;
    const app = $("#app");
    if (app) app.hidden = false;
    document.body.classList.remove("locked");
    if (mo) mo.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-enc"] });
    if (KGC.app && typeof KGC.app.start === "function") KGC.app.start(data);
    else gateMessage("画面の読み込みに失敗しました。再読み込みしてください。", "error");
    hydrate(document);
  }

  async function unlock(pass, rememberMe) {
    gateMessage("鍵を作っています…");
    const k = await GC.unwrapK(keysJson, pass);
    if (!k) {
      failCount++;
      gateMessage("合言葉が違います", "error");
      await new Promise((r) => setTimeout(r, Math.min(30000, 500 * Math.pow(2, failCount - 1))));
      return false;
    }
    failCount = 0;
    const key = await GC.deriveEncKey(k);
    await openContent(key);
    if (rememberMe) {
      storeKey(key).then((ok) => { if (!ok && KGC.ui && KGC.ui.toast) KGC.ui.toast("この端末では記憶できませんでした（次回も合言葉が必要です）"); });
    }
    return true;
  }

  function showForm() {
    const form = $("#gate-form");
    if (!form) return;
    form.hidden = false;
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = $("#gate-submit");
      if (btn) btn.disabled = true;
      try {
        await unlock($("#gate-pass").value, $("#gate-remember").checked);
      } catch (err) {
        gateMessage("開けませんでした。通信状態を確認して、もう一度お試しください。", "error");
      } finally {
        if (btn) btn.disabled = false;
      }
    });
    const forget = $("#gate-forget");
    if (forget) forget.addEventListener("click", () => KGC.forget());
    const pass = $("#gate-pass");
    if (pass) setTimeout(() => pass.focus(), 50);
  }

  async function boot() {
    if (DEV) {
      try {
        const res = await fetch("/__plain/manifest.json", { cache: "no-store" });
        manifest = { data: await res.json(), files: {} };
        start(manifest.data);
      } catch (e) { gateMessage("開発用データを読めません（./kgc build --plain-only を先に）", "error"); }
      return;
    }
    try {
      const res = await fetch("enc/keys.json", { cache: "no-cache" });
      keysJson = await res.json();
    } catch (e) {
      gateMessage("接続できませんでした。通信状態を確認して再読み込みしてください。", "error");
      return;
    }
    const stored = await loadKey();
    if (stored) {
      try { await openContent(stored); return; } catch (e) {
        const stale = e && (e.name === "OperationError" || /形式|版/.test(String(e.message)));
        if (stale) { await clearKey(); gateMessage("合言葉をもう一度入れてください（鍵が更新されました）"); }
        else { gateMessage("読み込めませんでした。通信状態を確認して再読み込みしてください。", "error"); return; }
      }
    }
    showForm();
  }

  KGC.boot = { state: () => ({ started, dev: DEV, cached: cache.size, cachedBytes }) };
  /* defer の実行中は readyState が interactive。DOMContentLoaded まで待てば後続の画面スクリプトも読み込み済み */
  if (document.readyState === "complete") boot();
  else document.addEventListener("DOMContentLoaded", boot);
})();
