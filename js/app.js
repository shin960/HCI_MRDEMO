/* MR体験ページの動作。設問や文言は js/config.js で変更する。 */
(function () {
  "use strict";

  var CFG = window.MR_CONFIG;
  var STORAGE_KEY = "mr-experience-v1";
  var $ = function (id) { return document.getElementById(id); };

  // ───────── 入力の保存 (ARから戻ったときにページが再読み込みされても消えないように) ─────────
  var state = { model: CFG.models[0].id, answers: {}, memos: {}, arLaunched: false };

  function loadState() {
    try {
      var raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      var saved = JSON.parse(raw);
      if (saved && typeof saved === "object") {
        state.model = saved.model || state.model;
        state.answers = saved.answers || {};
        state.memos = saved.memos || {};
        state.arLaunched = !!saved.arLaunched;
      }
    } catch (e) { /* 保存領域が使えない端末では、開いている間だけ保持する */ }
  }

  function saveState() {
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) { /* 同上 */ }
  }

  // ───────── 端末の判定 ─────────
  var ua = navigator.userAgent || "";
  var isIOS = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  var isAndroid = /Android/.test(ua);
  var isMobile = isIOS || isAndroid;
  var arModeLabel = "未判定";

  function deviceLabel() {
    if (isIOS) return "iPhone / iPad";
    if (isAndroid) return "Android";
    return "PC";
  }

  // ───────── 部品づくり ─────────
  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === "text") node.textContent = attrs[k];
      else if (k === "class") node.className = attrs[k];
      else node.setAttribute(k, attrs[k]);
    });
    (children || []).forEach(function (c) { node.appendChild(c); });
    return node;
  }

  function chipGroup(name, choices, selected, onChange, stacked) {
    var group = el("div", { class: "chips" + (stacked ? " stack" : ""), role: "radiogroup" });
    choices.forEach(function (choice, i) {
      var value = typeof choice === "string" ? choice : choice.value;
      var label = typeof choice === "string" ? choice : choice.label;
      var input = el("input", { type: "radio", name: name, value: value, id: name + "-" + i });
      if (value === selected) input.checked = true;
      input.addEventListener("change", function () { onChange(value); });
      group.appendChild(el("label", { for: name + "-" + i }, [input, el("span", { text: label })]));
    });
    return group;
  }

  function memoField(id, placeholder, multiline) {
    var field = multiline
      ? el("textarea", { id: "memo-" + id, placeholder: placeholder, rows: "4" })
      : el("input", { type: "text", id: "memo-" + id, placeholder: placeholder, autocomplete: "off" });
    field.value = state.memos[id] || "";
    field.setAttribute("aria-label", placeholder);
    field.addEventListener("input", function () {
      state.memos[id] = field.value;
      saveState();
      refresh();
    });
    return field;
  }

  // ───────── 手順1: モデルの選択とAR起動 ─────────
  var mv = $("mv");

  function currentModel() {
    return CFG.models.filter(function (m) { return m.id === state.model; })[0] || CFG.models[0];
  }

  function applyModel() {
    var m = currentModel();
    mv.setAttribute("src", m.file);
    $("model-note").textContent = m.note;
  }

  function buildModelPicker() {
    var picker = $("model-picker");
    var group = chipGroup(
      "model",
      CFG.models.map(function (m) { return { value: m.id, label: m.name }; }),
      currentModel().id,
      function (value) { state.model = value; saveState(); applyModel(); refresh(); }
    );
    while (group.firstChild) picker.appendChild(group.firstChild);
  }

  function showArState(kind, lines) {
    var box = $("ar-state");
    box.className = "notice " + kind;
    box.innerHTML = "";
    lines.forEach(function (line) {
      var p = document.createElement("p");
      if (typeof line === "string") p.textContent = line; else p.appendChild(line);
      box.appendChild(p);
    });
    box.hidden = false;
  }

  function fallbackLines() {
    var lines = ["この場合は、先生が見せるデモ映像を見ながら、手順2と3に答える。"];
    if (CFG.fallbackVideoUrl) {
      lines.push(el("a", { href: CFG.fallbackVideoUrl, target: "_blank", rel: "noopener", text: "デモ映像を開く" }));
    }
    return lines;
  }

  function detectArMode() {
    // 提出テキストに載せる参考情報。実際にどの方式で起動するかは model-viewer が決める。
    if (isIOS) { arModeLabel = "AR Quick Look"; return Promise.resolve(); }
    if (navigator.xr && navigator.xr.isSessionSupported) {
      return navigator.xr.isSessionSupported("immersive-ar").then(function (ok) {
        arModeLabel = ok ? "WebXR" : (isAndroid ? "Scene Viewer" : "非対応");
      }).catch(function () { arModeLabel = isAndroid ? "Scene Viewer" : "非対応"; });
    }
    arModeLabel = isAndroid ? "Scene Viewer" : "非対応";
    return Promise.resolve();
  }

  function reportArAvailability() {
    $("ar-button").hidden = !mv.canActivateAR;
    if (mv.canActivateAR) {
      if (state.arLaunched) {
        showArState("ok", ["ARを起動済み。何度でも置き直せる。試したら手順2に記録しよう。"]);
      } else {
        $("ar-state").hidden = true;
      }
      return;
    }
    arModeLabel = "非対応";
    if (!isMobile) {
      showArState("warn", [
        "PCではARを起動できない。スマホでこのページを開こう。",
        "このまま3D表示の確認と回答の入力だけ行うこともできる。",
      ]);
    } else if (!window.isSecureContext) {
      showArState("warn", [
        "このページが https で開かれていないため、ARを起動できない。",
        "先生が案内した https:// から始まるURLを開き直そう。",
      ]);
    } else {
      showArState("warn", ["この端末またはブラウザは、ARの表示に対応していないようだ。"].concat(fallbackLines()));
    }
    refresh();
  }

  function watchAr() {
    var checked = false;
    function check() {
      if (checked) return;
      checked = true;
      // AR方式の判定は読み込み後に非同期で終わるので、少し待ってから確かめる
      var tries = 0;
      (function poll() {
        if (mv.canActivateAR || tries++ >= 10) { reportArAvailability(); return; }
        setTimeout(poll, 250);
      })();
    }
    mv.addEventListener("load", check);
    setTimeout(check, 6000);

    mv.addEventListener("error", function () {
      showArState("warn", ["3Dモデルを読み込めなかった。通信状況を確かめて、ページを再読み込みしよう。"]);
    });

    // ARボタンが押された (WebXR / Scene Viewer / Quick Look のいずれでも通る)
    $("ar-button").addEventListener("click", function () {
      state.arLaunched = true;
      saveState();
      refresh();
      mv.activateAR();
    });

    // WebXR のときだけ届く状態通知
    mv.addEventListener("ar-status", function (ev) {
      var status = ev.detail && ev.detail.status;
      if (status === "failed") {
        showArState("warn", ["ARを開始できなかった。カメラの使用を許可しているか確かめ、もう一度試そう。"].concat(fallbackLines()));
      } else if (status === "not-presenting" && state.arLaunched) {
        showArState("ok", ["おかえり。いま試したことを手順2に記録しよう。"]);
      }
    });

    // Scene Viewer / Quick Look から戻ってきたとき
    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState === "visible" && state.arLaunched && mv.canActivateAR) {
        showArState("ok", ["おかえり。いま試したことを手順2に記録しよう。"]);
      }
    });
  }

  // ───────── 手順2・3: 設問 ─────────
  function buildObservations() {
    var root = $("observations");
    CFG.observations.forEach(function (o, i) {
      var block = el("div", { class: "q" }, [
        el("h3", {}, [el("small", { text: "観察" + (i + 1) }), document.createTextNode(o.title)]),
        el("p", { class: "task", text: o.task }),
        el("p", { class: "ask", text: o.question }),
        chipGroup("obs-" + o.id, o.choices, state.answers[o.id], function (v) {
          state.answers[o.id] = v; saveState(); refresh();
        }, true),
        memoField(o.id, "気づいたことを一言", false),
      ]);
      root.appendChild(block);
    });
  }

  function buildClassifications() {
    var root = $("classifications");
    CFG.classifications.forEach(function (c, i) {
      root.appendChild(el("div", { class: "q" }, [
        el("h3", {}, [el("small", { text: "分類" + (i + 1) }), document.createTextNode(c.question)]),
        chipGroup("cls-" + c.id, c.choices, state.answers[c.id], function (v) {
          state.answers[c.id] = v; saveState(); refresh();
        }, true),
      ]));
    });
    var r = CFG.reflection;
    $("reflection").appendChild(el("div", { class: "q" }, [
      el("h3", {}, [el("small", { text: "考察" }), document.createTextNode(r.question)]),
      memoField(r.id, r.placeholder, true),
    ]));
  }

  // ───────── 手順4: 提出テキスト ─────────
  function summaryText() {
    var lines = ["【MR体験の記録】", "端末: " + deviceLabel() + " / AR方式: " + arModeLabel +
      " / ARの起動: " + (state.arLaunched ? "あり" : "なし（デモ映像で回答）"), ""];
    lines.push("■ 観察");
    CFG.observations.forEach(function (o, i) {
      lines.push((i + 1) + ". " + o.title + ": " + (state.answers[o.id] || "（未回答）"));
      var memo = (state.memos[o.id] || "").trim();
      if (memo) lines.push("   メモ: " + memo);
    });
    lines.push("", "■ 分類");
    CFG.classifications.forEach(function (c, i) {
      lines.push((i + 1) + ". " + c.question + " → " + (state.answers[c.id] || "（未回答）"));
    });
    lines.push("", "■ 考察", (state.memos[CFG.reflection.id] || "").trim() || "（未回答）");
    return lines.join("\n");
  }

  function countAnswered() {
    var ids = CFG.observations.concat(CFG.classifications).map(function (q) { return q.id; });
    var done = ids.filter(function (id) { return !!state.answers[id]; }).length;
    var total = ids.length + 1;
    if ((state.memos[CFG.reflection.id] || "").trim()) done += 1;
    return { done: done, total: total };
  }

  function refresh() {
    var c = countAnswered();
    var p = $("progress");
    p.textContent = c.done === c.total
      ? "すべて回答済み（" + c.total + "問）"
      : "回答済み " + c.done + " / " + c.total + " 問（未回答のままでもコピーはできる）";
    p.className = "progress" + (c.done === c.total ? " done" : "");
    $("preview").textContent = summaryText();
  }

  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text);
    }
    // http で開いているときなどの代替手段
    return new Promise(function (resolve, reject) {
      var ta = el("textarea", { readonly: "", style: "position:fixed;top:0;left:0;opacity:0;" });
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      ta.setSelectionRange(0, text.length);
      var ok = false;
      try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
      document.body.removeChild(ta);
      if (ok) resolve(); else reject(new Error("copy failed"));
    });
  }

  function wireSubmit() {
    $("copy").addEventListener("click", function () {
      copyText(summaryText()).then(function () {
        $("copied").textContent = "コピーした。manabaの回答欄に貼り付けよう。";
      }).catch(function () {
        $("copied").textContent = "コピーできなかった。下の「内容を確認する」を開いて手動でコピーしよう。";
      });
    });
    $("reset").addEventListener("click", function () {
      if (!window.confirm("入力した内容をすべて消します。よろしいですか?")) return;
      try { window.localStorage.removeItem(STORAGE_KEY); } catch (e) { /* 何もしない */ }
      window.location.reload();
    });
  }

  // ───────── 起動 ─────────
  loadState();
  document.title = CFG.title;
  $("title").textContent = CFG.title;
  $("lecture").textContent = CFG.lecture;
  mv.setAttribute("ar-modes", CFG.arModes);
  buildModelPicker();
  applyModel();
  buildObservations();
  buildClassifications();
  wireSubmit();
  watchAr();
  detectArMode().then(refresh);
  refresh();
})();
