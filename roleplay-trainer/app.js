(() => {
  "use strict";

  // ---------- storage ----------
  const KEYS = { scenarios: "rpt.scenarios", history: "rpt.history", trainee: "rpt.trainee" };
  const store = {
    get(key, fallback) {
      try { const v = localStorage.getItem(key); return v == null ? fallback : JSON.parse(v); }
      catch { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* private mode etc. */ }
    }
  };

  // ---------- helpers ----------
  const $ = (sel) => document.querySelector(sel);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fmt = (sec) => `${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(sec % 60).padStart(2, "0")}`;
  const initials = (name) => (name || "?").trim().split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase();
  const uid = () => Math.random().toString(36).slice(2, 10);
  const clone = (o) => JSON.parse(JSON.stringify(o));

  // ---------- state ----------
  let scenarios = store.get(KEYS.scenarios, null) || clone(window.DEFAULT_SCENARIOS || []);
  let direction = "inbound";
  let selectedId = null;
  let editingId = null;
  const call = {
    phase: "idle", // idle | waiting | ringing | dialing | oncall | acw
    scenario: null,
    startedAt: null,
    callSeconds: 0,
    acwSeconds: 0,
    onHold: false,
    timer: null,
    acwTimer: null,
    waitTimeout: null,
    todos: []
  };

  // ---------- audio (ring / ringback) ----------
  const tone = (() => {
    let ctx = null, interval = null, nodes = [];
    function burst(freqs, ms) {
      if (!ctx) return;
      const gain = ctx.createGain();
      gain.gain.value = 0.08;
      gain.connect(ctx.destination);
      freqs.forEach((f) => {
        const o = ctx.createOscillator();
        o.frequency.value = f;
        o.connect(gain);
        o.start();
        o.stop(ctx.currentTime + ms / 1000);
        nodes.push(o);
      });
    }
    return {
      start(kind) {
        this.stop();
        try { ctx = ctx || new (window.AudioContext || window.webkitAudioContext)(); ctx.resume(); } catch { return; }
        const pattern = kind === "ring"
          ? () => { burst([440, 480], 400); setTimeout(() => burst([440, 480], 400), 600); }
          : () => burst([400, 450], 1000);
        pattern();
        interval = setInterval(pattern, kind === "ring" ? 2400 : 3000);
      },
      stop() {
        clearInterval(interval); interval = null;
        nodes.forEach((n) => { try { n.stop(); } catch { /* already stopped */ } });
        nodes = [];
      }
    };
  })();

  // ---------- status / views ----------
  const STATUS = {
    idle: ["Ready", "pill-ready"], waiting: ["Available — waiting", "pill-ready"],
    ringing: ["Ringing", "pill-ringing"], dialing: ["Dialing", "pill-ringing"],
    oncall: ["On call", "pill-oncall"], hold: ["On hold", "pill-hold"], acw: ["After-call work", "pill-acw"]
  };
  function setStatus(key) {
    const [label, cls] = STATUS[key];
    const pill = $("#status-pill");
    pill.textContent = label;
    pill.className = `pill ${cls}`;
  }
  function show(view) {
    ["idle", "ringing", "call", "acw"].forEach((v) => $(`#view-${v}`).classList.toggle("hidden", v !== view));
  }
  const busy = () => !["idle", "waiting"].includes(call.phase);

  // ---------- scenario list ----------
  function saveScenarios() { store.set(KEYS.scenarios, scenarios); }

  function renderList() {
    const q = $("#filter").value.trim().toLowerCase();
    const items = scenarios.filter((s) => s.direction === direction &&
      (!q || `${s.project} ${s.customer?.name}`.toLowerCase().includes(q)));
    const list = $("#scenario-list");
    if (!items.length) {
      list.innerHTML = `<li class="muted small">No ${direction} scenarios yet. Click “+ New scenario”.</li>`;
      return;
    }
    list.innerHTML = items.map((s) => `
      <li class="scenario ${s.id === selectedId ? "selected" : ""}" data-id="${esc(s.id)}">
        <span class="name">${esc(s.customer?.name)}</span>
        <span><span class="diff diff-${esc(s.difficulty)}">${esc(s.difficulty || "")}</span>
          <button class="edit" data-edit="${esc(s.id)}" title="Edit">Edit</button></span>
        <span class="project">${esc(s.project)}</span>
        ${s.widgetCode?.trim() ? "" : `<span class="warn">No widget code yet</span>`}
      </li>`).join("");
  }

  function factsHtml(s) {
    const c = s.customer || {};
    const rows = [["Name", c.name], ["Phone", c.phone], ["Gender", c.gender], ["Age", c.age], ["Project", s.project], ["Brief", s.brief]]
      .filter(([, v]) => v !== undefined && v !== null && v !== "");
    return `<dl class="customer-facts">${rows.map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join("")}</dl>`;
  }

  function renderIdle() {
    const s = scenarios.find((x) => x.id === selectedId);
    const card = $("#idle-card");
    if (!s) {
      card.innerHTML = `<p class="muted">Pick a scenario on the left to start a practice call.</p>`;
      return;
    }
    const inbound = s.direction === "inbound";
    const waiting = call.phase === "waiting";
    card.innerHTML = `
      <p class="eyebrow">${inbound ? "Inbound role-play" : "Outbound role-play"}</p>
      <h2>${esc(s.project)}</h2>
      <div style="text-align:left;margin:16px 0">${inbound
        ? `<p class="muted">The customer will call you. Go available and answer when the phone rings.</p>
           <p class="small muted">Brief: ${esc(s.brief || "—")}</p>`
        : factsHtml(s)}</div>
      ${s.widgetCode?.trim() ? "" : `<p class="small" style="color:var(--warn)">This scenario has no OneInbox widget code yet — edit it to paste the snippet.</p>`}
      ${inbound
        ? (waiting
            ? `<p class="muted">Waiting for a call…</p><button id="btn-unavailable" class="btn btn-secondary">Cancel</button>`
            : `<button id="btn-available" class="btn btn-primary">Go available</button>`)
        : `<button id="btn-dial" class="btn btn-success">Dial ${esc(s.customer?.phone || "")}</button>`}`;
  }

  // ---------- call flow ----------
  function selectScenario(id) {
    if (busy()) return;
    cancelWaiting();
    selectedId = id;
    renderList();
    renderIdle();
    show("idle");
  }

  function goAvailable() {
    call.phase = "waiting";
    setStatus("waiting");
    renderIdle();
    const delay = 2000 + Math.random() * 4000;
    call.waitTimeout = setTimeout(() => startRinging(scenarios.find((x) => x.id === selectedId)), delay);
  }

  function cancelWaiting() {
    clearTimeout(call.waitTimeout);
    if (call.phase === "waiting") { call.phase = "idle"; setStatus("idle"); }
  }

  function startRinging(s) {
    if (!s) return;
    call.scenario = s;
    const inbound = s.direction === "inbound";
    call.phase = inbound ? "ringing" : "dialing";
    setStatus(call.phase);
    $("#ring-avatar").textContent = initials(s.customer?.name);
    $("#ring-label").textContent = inbound ? "Incoming call" : "Calling…";
    $("#ring-name").textContent = s.customer?.name || "Unknown caller";
    $("#ring-phone").textContent = s.customer?.phone || "";
    $("#ring-project").textContent = s.project || "";
    $("#btn-answer").classList.toggle("hidden", !inbound);
    $("#btn-decline").textContent = inbound ? "Decline" : "Cancel";
    show("ringing");
    tone.start(inbound ? "ring" : "ringback");
    if (!inbound) call.waitTimeout = setTimeout(connect, 3500 + Math.random() * 2500);
  }

  function decline() {
    tone.stop();
    clearTimeout(call.waitTimeout);
    call.phase = "idle";
    setStatus("idle");
    renderIdle();
    show("idle");
  }

  function connect() {
    tone.stop();
    clearTimeout(call.waitTimeout);
    const s = call.scenario;
    call.phase = "oncall";
    call.startedAt = new Date();
    call.callSeconds = 0;
    call.onHold = false;
    setStatus("oncall");
    $("#call-dir-label").textContent = s.direction === "inbound" ? "Inbound call" : "Outbound call";
    $("#call-name").textContent = s.customer?.name || "";
    $("#call-phone").textContent = s.customer?.phone || "";
    $("#call-sep").classList.toggle("hidden", !s.customer?.phone);
    $("#call-project").textContent = s.project || "";
    $("#call-facts").outerHTML = factsHtml(s).replace("<dl ", `<dl id="call-facts" `);
    $("#live-notes").value = "";
    $("#btn-hold").textContent = "Hold";
    $("#view-call").classList.remove("on-hold");
    $("#call-timer").textContent = "00:00";
    mountWidget(s);
    show("call");
    call.timer = setInterval(() => { call.callSeconds++; $("#call-timer").textContent = fmt(call.callSeconds); }, 1000);
    $("#live-notes").focus();
  }

  function toggleHold() {
    call.onHold = !call.onHold;
    $("#btn-hold").textContent = call.onHold ? "Resume" : "Hold";
    $("#view-call").classList.toggle("on-hold", call.onHold);
    setStatus(call.onHold ? "hold" : "oncall");
  }

  function hangup() {
    clearInterval(call.timer);
    unmountWidget();
    call.phase = "acw";
    call.acwSeconds = 0;
    call.todos = [];
    setStatus("acw");
    $("#acw-name").textContent = call.scenario.customer?.name || "";
    $("#acw-duration").textContent = fmt(call.callSeconds);
    $("#acw-timer").textContent = "00:00";
    $("#acw-notes").value = $("#live-notes").value;
    ["#acw-summary", "#acw-request", "#acw-self", "#todo-input"].forEach((id) => { $(id).value = ""; });
    $("#acw-disposition").value = "";
    renderTodos();
    show("acw");
    call.acwTimer = setInterval(() => { call.acwSeconds++; $("#acw-timer").textContent = fmt(call.acwSeconds); }, 1000);
    $("#acw-summary").focus();
  }

  function buildRecord() {
    const s = call.scenario;
    return {
      id: uid(),
      trainee: $("#trainee-name").value.trim(),
      startedAt: call.startedAt?.toISOString(),
      direction: s.direction,
      project: s.project,
      customer: s.customer,
      difficulty: s.difficulty,
      callSeconds: call.callSeconds,
      acwSeconds: call.acwSeconds,
      notes: $("#acw-notes").value,
      summary: $("#acw-summary").value,
      customerRequest: $("#acw-request").value,
      todos: clone(call.todos),
      disposition: $("#acw-disposition").value,
      selfReview: $("#acw-self").value
    };
  }

  function recordToText(r) {
    return [
      `Role-play call report`,
      `Trainee: ${r.trainee || "-"}`,
      `Date: ${r.startedAt ? new Date(r.startedAt).toLocaleString() : "-"}`,
      `Type: ${r.direction} · ${r.project} · ${r.difficulty || ""}`,
      `Customer: ${r.customer?.name || "-"} (${r.customer?.phone || "-"})`,
      `Call duration: ${fmt(r.callSeconds)} · ACW: ${fmt(r.acwSeconds)}`,
      `Result: ${r.disposition || "-"}`,
      ``,
      `Customer wants: ${r.customerRequest || "-"}`,
      ``,
      `Summary:`, r.summary || "-",
      ``,
      `To-do:`, ...(r.todos.length ? r.todos.map((t) => `  [${t.done ? "x" : " "}] ${t.text}`) : ["  -"]),
      ``,
      `Notes:`, r.notes || "-",
      ``,
      `Self-review:`, r.selfReview || "-"
    ].join("\n");
  }

  function download(name, text, type = "text/plain") {
    const url = URL.createObjectURL(new Blob([text], { type }));
    const a = Object.assign(document.createElement("a"), { href: url, download: name });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function finishAcw(save) {
    if (save) {
      if (!$("#acw-summary").value.trim() && !confirm("The call summary is empty. Save anyway?")) return;
      const history = store.get(KEYS.history, []);
      history.unshift(buildRecord());
      store.set(KEYS.history, history.slice(0, 500));
    } else if (!confirm("Discard this call's notes?")) {
      return;
    }
    clearInterval(call.acwTimer);
    call.phase = "idle";
    call.scenario = null;
    setStatus("idle");
    renderIdle();
    show("idle");
  }

  // ---------- widget mounting ----------
  function mountWidget(s) {
    const slot = $("#widget-slot");
    slot.innerHTML = "";
    const code = (s.widgetCode || "").trim();
    if (!code) {
      slot.innerHTML = `<div class="widget-empty">
        <p><strong>No OneInbox widget configured for this scenario.</strong></p>
        <p class="small">Build the customer agent in OneInbox, copy its widget embed code and paste it via “Edit” on this scenario.
        You can still practise note-taking and ACW with a colleague playing the customer.</p></div>`;
      return;
    }
    if (s.widgetMode === "inline") {
      // Inject into the page and re-create <script> tags so they execute.
      const tpl = document.createElement("template");
      tpl.innerHTML = code;
      tpl.content.querySelectorAll("script").forEach((old) => {
        const sc = document.createElement("script");
        [...old.attributes].forEach((a) => sc.setAttribute(a.name, a.value));
        sc.textContent = old.textContent;
        old.replaceWith(sc);
      });
      slot.appendChild(tpl.content);
      return;
    }
    // Isolated frame: widget lives in its own document and is destroyed on hang-up.
    const frame = document.createElement("iframe");
    frame.setAttribute("allow", "microphone; autoplay; clipboard-write");
    frame.title = "OneInbox voice widget";
    frame.srcdoc = `<!doctype html><html><head><meta charset="utf-8">
      <meta name="viewport" content="width=device-width,initial-scale=1">
      <style>html,body{margin:0;height:100%;font-family:system-ui,sans-serif;background:transparent}</style>
      </head><body>${code}</body></html>`;
    slot.appendChild(frame);
  }

  function unmountWidget() {
    $("#widget-slot").innerHTML = "";
  }

  // ---------- to-dos ----------
  function renderTodos() {
    $("#todo-list").innerHTML = call.todos.map((t, i) => `
      <li class="${t.done ? "done" : ""}">
        <input type="checkbox" data-todo="${i}" ${t.done ? "checked" : ""}>
        <span>${esc(t.text)}</span>
        <button data-remove="${i}" title="Remove">✕</button>
      </li>`).join("");
  }
  function addTodo() {
    const v = $("#todo-input").value.trim();
    if (!v) return;
    call.todos.push({ text: v, done: false });
    $("#todo-input").value = "";
    renderTodos();
  }

  // ---------- notes timestamp ----------
  function insertStamp() {
    const ta = $("#live-notes");
    const stamp = `[${fmt(call.callSeconds)}] `;
    const { selectionStart: a, selectionEnd: b, value } = ta;
    const prefix = a > 0 && value[a - 1] !== "\n" ? "\n" : "";
    ta.value = value.slice(0, a) + prefix + stamp + value.slice(b);
    ta.selectionStart = ta.selectionEnd = a + prefix.length + stamp.length;
    ta.focus();
  }

  // ---------- scenario editor ----------
  function openEditor(id) {
    if (busy()) return;
    editingId = id || null;
    const s = scenarios.find((x) => x.id === id) || { direction, difficulty: "medium", widgetMode: "iframe", customer: {} };
    const f = $("#scenario-form");
    f.direction.value = s.direction;
    f.difficulty.value = s.difficulty || "medium";
    f.project.value = s.project || "";
    f.name.value = s.customer?.name || "";
    f.phone.value = s.customer?.phone || "";
    f.gender.value = s.customer?.gender || "";
    f.age.value = s.customer?.age ?? "";
    f.brief.value = s.brief || "";
    f.widgetCode.value = s.widgetCode || "";
    f.widgetMode.value = s.widgetMode || "iframe";
    $("#scenario-dialog-title").textContent = id ? "Edit scenario" : "New scenario";
    $("#scenario-delete").classList.toggle("hidden", !id);
    $("#scenario-dialog").showModal();
  }

  function saveEditor(e) {
    e.preventDefault();
    const f = e.target;
    const data = {
      id: editingId || `sc-${uid()}`,
      direction: f.direction.value,
      difficulty: f.difficulty.value,
      project: f.project.value.trim(),
      customer: {
        name: f.name.value.trim(),
        phone: f.phone.value.trim(),
        gender: f.gender.value.trim(),
        age: f.age.value ? Number(f.age.value) : undefined
      },
      brief: f.brief.value.trim(),
      widgetCode: f.widgetCode.value,
      widgetMode: f.widgetMode.value
    };
    const i = scenarios.findIndex((x) => x.id === data.id);
    if (i >= 0) scenarios[i] = data; else scenarios.push(data);
    saveScenarios();
    $("#scenario-dialog").close();
    setDirection(data.direction);
    selectScenario(data.id);
  }

  function deleteScenario() {
    if (!editingId || !confirm("Delete this scenario?")) return;
    scenarios = scenarios.filter((x) => x.id !== editingId);
    if (selectedId === editingId) selectedId = null;
    saveScenarios();
    $("#scenario-dialog").close();
    renderList();
    renderIdle();
  }

  function importScenarios(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        const list = Array.isArray(data) ? data : data.scenarios;
        if (!Array.isArray(list)) throw new Error("Expected an array of scenarios");
        list.forEach((s) => {
          if (!s.id) s.id = `sc-${uid()}`;
          if (!["inbound", "outbound"].includes(s.direction)) throw new Error(`Scenario ${s.id}: direction must be inbound or outbound`);
          const i = scenarios.findIndex((x) => x.id === s.id);
          if (i >= 0) scenarios[i] = s; else scenarios.push(s);
        });
        saveScenarios();
        renderList();
        alert(`Imported ${list.length} scenario(s).`);
      } catch (err) {
        alert(`Import failed: ${err.message}`);
      }
    };
    reader.readAsText(file);
  }

  // ---------- history ----------
  function openHistory() {
    const history = store.get(KEYS.history, []);
    $("#history-list").innerHTML = history.length
      ? history.map((r) => `
        <details class="history-item">
          <summary>${esc(new Date(r.startedAt).toLocaleString())} · ${esc(r.direction)} · ${esc(r.customer?.name)} · ${esc(r.disposition || "no result")}</summary>
          <pre>${esc(recordToText(r))}</pre>
        </details>`).join("")
      : `<p class="muted">No saved calls yet.</p>`;
    $("#history-dialog").showModal();
  }

  // ---------- direction tabs ----------
  function setDirection(d) {
    direction = d;
    document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("active", t.dataset.dir === d));
    renderList();
  }

  // ---------- wiring ----------
  document.querySelectorAll(".tab").forEach((t) => t.addEventListener("click", () => setDirection(t.dataset.dir)));
  $("#filter").addEventListener("input", renderList);
  $("#scenario-list").addEventListener("click", (e) => {
    const edit = e.target.closest("[data-edit]");
    if (edit) { e.stopPropagation(); openEditor(edit.dataset.edit); return; }
    const li = e.target.closest(".scenario");
    if (li) selectScenario(li.dataset.id);
  });
  $("#idle-card").addEventListener("click", (e) => {
    if (e.target.id === "btn-available") goAvailable();
    if (e.target.id === "btn-unavailable") { cancelWaiting(); renderIdle(); }
    if (e.target.id === "btn-dial") startRinging(scenarios.find((x) => x.id === selectedId));
  });
  $("#btn-answer").addEventListener("click", connect);
  $("#btn-decline").addEventListener("click", decline);
  $("#btn-hold").addEventListener("click", toggleHold);
  $("#btn-hangup").addEventListener("click", () => { if (confirm("End the call?")) hangup(); });
  $("#btn-stamp").addEventListener("click", insertStamp);
  $("#live-notes").addEventListener("keydown", (e) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); insertStamp(); }
  });

  $("#todo-add").addEventListener("click", addTodo);
  $("#todo-input").addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); addTodo(); } });
  $("#todo-list").addEventListener("click", (e) => {
    if (e.target.dataset.todo !== undefined) call.todos[+e.target.dataset.todo].done = e.target.checked;
    if (e.target.dataset.remove !== undefined) call.todos.splice(+e.target.dataset.remove, 1);
    renderTodos();
  });
  $("#acw-save").addEventListener("click", () => finishAcw(true));
  $("#acw-discard").addEventListener("click", () => finishAcw(false));
  $("#acw-download").addEventListener("click", () => {
    const r = buildRecord();
    download(`roleplay-${(r.customer?.name || "call").replace(/\s+/g, "_")}-${r.startedAt?.slice(0, 10)}.txt`, recordToText(r));
  });

  $("#new-scenario").addEventListener("click", () => openEditor(null));
  $("#scenario-form").addEventListener("submit", saveEditor);
  $("#scenario-cancel").addEventListener("click", () => $("#scenario-dialog").close());
  $("#scenario-delete").addEventListener("click", deleteScenario);
  $("#export-scenarios").addEventListener("click", () =>
    download("roleplay-scenarios.json", JSON.stringify(scenarios, null, 2), "application/json"));
  $("#import-scenarios").addEventListener("change", (e) => { if (e.target.files[0]) importScenarios(e.target.files[0]); e.target.value = ""; });

  $("#open-history").addEventListener("click", openHistory);
  $("#history-close").addEventListener("click", () => $("#history-dialog").close());
  $("#history-export").addEventListener("click", () =>
    download("roleplay-history.json", JSON.stringify(store.get(KEYS.history, []), null, 2), "application/json"));
  $("#history-clear").addEventListener("click", () => {
    if (confirm("Delete all saved calls from this browser?")) { store.set(KEYS.history, []); openHistory(); }
  });

  $("#trainee-name").value = store.get(KEYS.trainee, "");
  $("#trainee-name").addEventListener("change", (e) => store.set(KEYS.trainee, e.target.value.trim()));

  window.addEventListener("beforeunload", (e) => {
    if (["oncall", "acw"].includes(call.phase)) { e.preventDefault(); e.returnValue = ""; }
  });

  setDirection("inbound");
  renderIdle();
})();
