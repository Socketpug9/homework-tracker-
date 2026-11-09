(() => {
  "use strict";

  const KEY = "hw-tracker:v1";
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const HOUR = 3600e3;
  const DAY = 24 * HOUR;

  const MSG1 = "You're home. Open Homework and check what's due.";
  const MSG2 = "30 min check-in: start your homework.";

  /* ---------- state ---------- */
  const defaults = () => ({
    version: 1,
    classes: [],
    items: [],
    prefs: { lastTime: "08:00", homeSetup: false, badge: false },
  });

  let state = load();
  let filter = "all";
  let showDone = false;
  let editingId = null;
  let draft = null; // {classId, importance}

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return defaults();
      const d = JSON.parse(raw);
      const base = defaults();
      return {
        ...base,
        ...d,
        prefs: { ...base.prefs, ...(d.prefs || {}) },
        classes: Array.isArray(d.classes) ? d.classes : [],
        items: Array.isArray(d.items) ? d.items : [],
      };
    } catch {
      return defaults();
    }
  }
  function save() {
    localStorage.setItem(KEY, JSON.stringify(state));
  }
  const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
  const classById = (id) => state.classes.find((c) => c.id === id);

  /* ---------- dates ---------- */
  const pad = (n) => String(n).padStart(2, "0");
  const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const toDateInput = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const toTimeInput = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  function fromInputs(date, time) {
    const [y, m, d] = date.split("-").map(Number);
    const [hh, mm] = (time || "00:00").split(":").map(Number);
    return new Date(y, m - 1, d, hh, mm).getTime();
  }
  const dayDiff = (ts, now = Date.now()) =>
    Math.round((startOfDay(new Date(ts)) - startOfDay(new Date(now))) / DAY);

  const fmtTime = (d) =>
    d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }).replace(" ", " ").toLowerCase();
  const fmtDay = (d) => d.toLocaleDateString([], { weekday: "short" }).toLowerCase();
  const fmtDate = (d) => d.toLocaleDateString([], { month: "short", day: "numeric" }).toLowerCase();

  function dueLabel(ts) {
    const d = new Date(ts);
    const dd = dayDiff(ts);
    if (dd === 0) return `today ${fmtTime(d)}`;
    if (dd === 1) return `tomorrow ${fmtTime(d)}`;
    if (dd === -1) return `yesterday ${fmtTime(d)}`;
    if (dd > 1 && dd < 7) return `${fmtDay(d)} ${fmtTime(d)}`;
    return `${fmtDay(d)} ${fmtDate(d)}`;
  }
  function countdown(ts) {
    const diff = ts - Date.now();
    const a = Math.abs(diff);
    let s;
    if (a < HOUR) s = `${Math.max(1, Math.round(a / 60e3))} min`;
    else if (a < 48 * HOUR) s = `${Math.round(a / HOUR)} h`;
    else s = `${Math.round(a / DAY)} d`;
    return diff < 0 ? `${s} late` : `in ${s}`;
  }

  /* ---------- grouping ---------- */
  function bucket(it) {
    const now = Date.now();
    if (it.due < now) return "overdue";
    const dd = dayDiff(it.due, now);
    if (dd === 0) return "today";
    if (dd === 1) return "tomorrow";
    if (dd < 7) return "this week";
    return "later";
  }
  const ORDER = ["overdue", "today", "tomorrow", "this week", "later"];
  const sortOpen = (a, b) => a.due - b.due || b.importance - a.importance;

  /* ---------- render ---------- */
  const esc = (s) =>
    String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const bars = (n) => `<span class="bars b${n}" aria-label="importance ${["", "low", "medium", "high"][n]}"><i></i><i></i><i></i></span>`;
  const checkSvg = `<svg viewBox="0 0 24 24"><path d="M5 12.5l4.2 4.2L19 7" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  const NUM = ["Nothing", "One thing", "Two things", "Three things", "Four things", "Five things", "Six things", "Seven things", "Eight things", "Nine things", "Ten things"];

  function render() {
    const open = state.items.filter((i) => !i.done);
    const visibleOpen = open.filter((i) => filter === "all" || i.classId === filter).sort(sortOpen);
    const done = state.items
      .filter((i) => i.done && (filter === "all" || i.classId === filter))
      .sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0));

    renderHeader(open);
    renderFilters(open);

    const list = $("#list");
    let html = "";
    for (const g of ORDER) {
      const rows = visibleOpen.filter((i) => bucket(i) === g);
      if (!rows.length) continue;
      html += `<section class="group"><div class="group-head"><span class="${g === "overdue" ? "late" : ""}">${g}</span><span>${rows.length}</span></div><div class="cards">`;
      html += rows.map(itemRow).join("");
      html += `</div></section>`;
    }
    if (done.length) {
      html += `<section class="group"><button class="group-head toggle-done" data-act="toggle-done"><span>done / last ${Math.min(done.length, showDone ? 50 : 3)}</span><span>${showDone ? "hide" : "show all " + done.length}</span></button><div class="log">`;
      html += done
        .slice(0, showDone ? 50 : 3)
        .map((i) => {
          const c = classById(i.classId);
          const t = new Date(i.doneAt || i.due);
          return `<div class="log-row"><i></i><span>${fmtDate(t)} ${pad(t.getHours())}:${pad(t.getMinutes())}</span><b>${esc(i.title)}${c ? " · " + esc(c.name.toLowerCase()) : ""}</b><button data-act="undone" data-id="${i.id}">undo</button></div>`;
        })
        .join("");
      html += `</div></section>`;
    }
    list.innerHTML = html;
    $("#empty").hidden = state.items.length > 0;
    updateBadge(open);
  }

  function itemRow(i) {
    const c = classById(i.classId);
    const diff = i.due - Date.now();
    const cls = diff < 0 ? "late" : diff < 24 * HOUR ? "soon" : "";
    return `<div class="item" data-id="${i.id}" data-act="edit">
      <button class="check" data-act="done" data-id="${i.id}" aria-label="Mark done">${checkSvg}</button>
      <div class="body">
        <div class="title">${esc(i.title)}</div>
        <div class="meta">${c ? `<span class="cls">${esc(c.name.toLowerCase())}</span> · ` : ""}${dueLabel(i.due)}${i.notes ? " · note" : ""}</div>
      </div>
      <div class="side"><span class="when ${cls}">${countdown(i.due)}</span>${bars(i.importance)}</div>
    </div>`;
  }

  function renderHeader(open) {
    const now = new Date();
    const late = open.filter((i) => i.due < now.getTime());
    const todayN = open.filter((i) => i.due >= now.getTime() && dayDiff(i.due) === 0).length;
    const weekN = open.filter((i) => i.due >= now.getTime() && dayDiff(i.due) < 7).length;

    const st = $("#status");
    st.classList.toggle("warn", late.length > 0);
    $("span", st).textContent = late.length
      ? `${late.length} overdue`
      : todayN
      ? `${todayN} due today`
      : "all clear";

    $("#heroChip span").textContent = `${fmtDay(now)} ${fmtDate(now)} / ${open.length} open`;

    const h = $("#headline");
    const sub = $("#heroSub");
    const word = (n) => NUM[n] || `${n} things`;
    if (!state.items.length) {
      h.innerHTML = `Homework, <em>handled.</em>`;
      sub.textContent = "Add what's due, pick how much it matters, and get a nudge when you get home.";
    } else if (late.length) {
      h.innerHTML = `${word(late.length)} ${late.length === 1 ? "is" : "are"} <em>overdue.</em>`;
      sub.textContent = `Start with “${late.sort(sortOpen)[0].title}”.`;
    } else if (todayN) {
      h.innerHTML = `${word(todayN)} due <em>today.</em>`;
      sub.textContent = nextUp(open);
    } else if (weekN) {
      h.innerHTML = `${word(weekN)} due <em>this week.</em>`;
      sub.textContent = nextUp(open);
    } else if (open.length) {
      h.innerHTML = `Nothing due <em>this week.</em>`;
      sub.textContent = nextUp(open);
    } else {
      h.innerHTML = `All done. <em>Go outside.</em>`;
      sub.textContent = "Every assignment is checked off.";
    }
  }
  function nextUp(open) {
    const n = [...open].sort(sortOpen)[0];
    if (!n) return "";
    const c = classById(n.classId);
    return `Next up: ${n.title}${c ? " for " + c.name : ""}, ${countdown(n.due)}.`;
  }

  function renderFilters(open) {
    const f = $("#filters");
    if (!state.classes.length) {
      f.innerHTML = "";
      f.hidden = true;
      return;
    }
    f.hidden = false;
    if (filter !== "all" && !classById(filter)) filter = "all";
    const count = (id) => open.filter((i) => i.classId === id).length;
    f.innerHTML =
      `<button data-f="all" class="${filter === "all" ? "on" : ""}">All<span class="n">${open.length}</span></button>` +
      state.classes
        .map((c) => `<button data-f="${c.id}" class="${filter === c.id ? "on" : ""}">${esc(c.name)}<span class="n">${count(c.id)}</span></button>`)
        .join("");
  }

  /* ---------- list interactions ---------- */
  $("#filters").addEventListener("click", (e) => {
    const b = e.target.closest("[data-f]");
    if (!b) return;
    filter = b.dataset.f;
    render();
  });

  $("#list").addEventListener("click", (e) => {
    const t = e.target.closest("[data-act]");
    if (!t) return;
    const act = t.dataset.act;
    if (act === "done") {
      e.stopPropagation();
      const it = state.items.find((i) => i.id === t.dataset.id);
      if (!it) return;
      const row = t.closest(".item");
      row.classList.add("is-done");
      it.done = true;
      it.doneAt = Date.now();
      save();
      if (navigator.vibrate) navigator.vibrate(10);
      setTimeout(render, 260);
      toast(`Done: ${it.title}`, () => {
        it.done = false;
        delete it.doneAt;
        save();
        render();
      });
    } else if (act === "undone") {
      const it = state.items.find((i) => i.id === t.dataset.id);
      if (!it) return;
      it.done = false;
      delete it.doneAt;
      save();
      render();
    } else if (act === "toggle-done") {
      showDone = !showDone;
      render();
    } else if (act === "edit") {
      openEditor(t.dataset.id);
    }
  });

  /* ---------- sheets ---------- */
  let openSheet = null;
  function show(sheet) {
    if (openSheet && openSheet !== sheet) hide(openSheet, true);
    openSheet = sheet;
    const scrim = $("#scrim");
    scrim.hidden = false;
    sheet.hidden = false;
    document.body.classList.add("locked");
    sheet.scrollTop = 0;
    requestAnimationFrame(() => {
      scrim.classList.add("show");
      sheet.classList.add("show");
    });
  }
  function hide(sheet = openSheet, swap = false) {
    if (!sheet) return;
    sheet.classList.remove("show");
    if (!swap) {
      $("#scrim").classList.remove("show");
      document.body.classList.remove("locked");
    }
    const s = sheet;
    setTimeout(() => {
      if (!s.classList.contains("show")) s.hidden = true;
      if (!openSheet) $("#scrim").hidden = true;
    }, 280);
    if (!swap) openSheet = null;
    if (document.activeElement) document.activeElement.blur();
  }
  $("#scrim").addEventListener("click", () => hide());
  $$("[data-close]").forEach((b) => b.addEventListener("click", () => hide()));
  document.addEventListener("keydown", (e) => e.key === "Escape" && hide());

  // swipe down on grabber/header to close
  $$(".sheet").forEach((sheet) => {
    let y0 = null;
    sheet.addEventListener("touchstart", (e) => {
      y0 = sheet.scrollTop <= 0 && e.target.closest(".grabber, .sheet-head, h2") ? e.touches[0].clientY : null;
    }, { passive: true });
    sheet.addEventListener("touchmove", (e) => {
      if (y0 == null) return;
      const dy = Math.max(0, e.touches[0].clientY - y0);
      sheet.style.transition = "none";
      sheet.style.transform = `translateY(${dy}px)`;
    }, { passive: true });
    sheet.addEventListener("touchend", (e) => {
      if (y0 == null) return;
      const dy = e.changedTouches[0].clientY - y0;
      sheet.style.transition = "";
      sheet.style.transform = "";
      y0 = null;
      if (dy > 90) hide();
    });
  });

  /* ---------- editor ---------- */
  const form = $("#editForm");

  function defaultDue() {
    const d = new Date(Date.now() + DAY);
    const [hh, mm] = (state.prefs.lastTime || "08:00").split(":").map(Number);
    d.setHours(hh, mm, 0, 0);
    return d;
  }

  function openEditor(id = null) {
    editingId = id;
    const it = id ? state.items.find((i) => i.id === id) : null;
    const due = it ? new Date(it.due) : defaultDue();
    draft = {
      classId: it ? it.classId : filter !== "all" ? filter : state.prefs.lastClass && classById(state.prefs.lastClass) ? state.prefs.lastClass : null,
      importance: it ? it.importance : 2,
    };
    $("#editTitle").textContent = it ? "Edit homework" : "Add homework";
    $("#editKicker").textContent = it ? `edit / ${it.done ? "done" : bucket(it)}` : "new / 3 fields";
    $("#fTitle").value = it ? it.title : "";
    $("#fNotes").value = it ? it.notes || "" : "";
    $("#fDate").value = toDateInput(due);
    $("#fTime").value = toTimeInput(due);
    $("#deleteBtn").hidden = !it;
    $("#saveBtn").textContent = it ? "Save changes" : "Add homework";
    $("#newClassRow").hidden = state.classes.length > 0;
    renderClassPick();
    renderImportance();
    show($("#editSheet"));
    if (!it) setTimeout(() => $("#fTitle").focus(), 300);
  }

  function renderClassPick() {
    const el = $("#classPick");
    el.innerHTML =
      state.classes
        .map((c) => `<button type="button" data-cid="${c.id}" class="${draft.classId === c.id ? "on" : ""}">${esc(c.name)}</button>`)
        .join("") + `<button type="button" class="add" data-cid="__new">+ New class</button>`;
  }
  $("#classPick").addEventListener("click", (e) => {
    const b = e.target.closest("[data-cid]");
    if (!b) return;
    if (b.dataset.cid === "__new") {
      $("#newClassRow").hidden = false;
      $("#fNewClass").focus();
      return;
    }
    draft.classId = draft.classId === b.dataset.cid ? null : b.dataset.cid;
    renderClassPick();
  });

  function addClass(name) {
    name = name.trim().replace(/\s+/g, " ");
    if (!name) return null;
    const existing = state.classes.find((c) => c.name.toLowerCase() === name.toLowerCase());
    if (existing) return existing;
    const c = { id: uid(), name };
    state.classes.push(c);
    save();
    return c;
  }
  function addClassFromEditor() {
    const c = addClass($("#fNewClass").value);
    if (!c) return;
    $("#fNewClass").value = "";
    $("#newClassRow").hidden = true;
    draft.classId = c.id;
    renderClassPick();
    render();
  }
  $("#addClassBtn").addEventListener("click", addClassFromEditor);
  $("#fNewClass").addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addClassFromEditor();
    }
  });

  function renderImportance() {
    $$("#fImportance button").forEach((b) => {
      const on = Number(b.dataset.v) === draft.importance;
      b.classList.toggle("on", on);
      b.setAttribute("aria-checked", on);
    });
  }
  $("#fImportance").addEventListener("click", (e) => {
    const b = e.target.closest("[data-v]");
    if (!b) return;
    draft.importance = Number(b.dataset.v);
    renderImportance();
  });

  $("#quickDue").addEventListener("click", (e) => {
    const b = e.target.closest("[data-quick]");
    if (!b) return;
    const now = new Date();
    let d = new Date(now);
    const time = (draft.tonight ? state.prefs.lastTime : $("#fTime").value) || state.prefs.lastTime || "08:00";
    draft.tonight = false;
    const q = b.dataset.quick;
    if (q === "tonight") {
      $("#fDate").value = toDateInput(now);
      $("#fTime").value = "21:00";
      draft.tonight = true;
      return;
    }
    if (q === "tomorrow") d.setDate(d.getDate() + 1);
    if (q === "friday") {
      const add = (5 - d.getDay() + 7) % 7 || 7;
      d.setDate(d.getDate() + add);
    }
    if (q === "week") {
      const add = (1 - d.getDay() + 7) % 7 || 7; // next Monday
      d.setDate(d.getDate() + add);
    }
    $("#fDate").value = toDateInput(d);
    $("#fTime").value = time;
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    // a class typed but not "Add"-ed still counts
    if ($("#fNewClass").value.trim()) addClassFromEditor();
    const title = $("#fTitle").value.trim();
    if (!title) return $("#fTitle").focus();
    if (!$("#fDate").value) return $("#fDate").focus();
    const due = fromInputs($("#fDate").value, $("#fTime").value);
    const data = {
      title,
      classId: draft.classId,
      due,
      importance: draft.importance,
      notes: $("#fNotes").value.trim(),
    };
    if (editingId) {
      const it = state.items.find((i) => i.id === editingId);
      Object.assign(it, data);
    } else {
      state.items.push({ id: uid(), done: false, created: Date.now(), ...data });
    }
    if (!draft.tonight) state.prefs.lastTime = $("#fTime").value || state.prefs.lastTime;
    if (draft.classId) state.prefs.lastClass = draft.classId;
    save();
    hide();
    render();
    toast(editingId ? "Saved" : `Added, due ${dueLabel(due)}`);
  });

  $("#deleteBtn").addEventListener("click", () => {
    const idx = state.items.findIndex((i) => i.id === editingId);
    if (idx < 0) return;
    const [removed] = state.items.splice(idx, 1);
    save();
    hide();
    render();
    toast("Deleted", () => {
      state.items.splice(idx, 0, removed);
      save();
      render();
    });
  });

  $("#openAdd").addEventListener("click", () => openEditor());

  /* ---------- settings ---------- */
  function renderSettings() {
    $("#classCount").textContent = state.classes.length;
    const counts = (id) => state.items.filter((i) => i.classId === id && !i.done).length;
    $("#classList").innerHTML = state.classes.length
      ? state.classes
          .map(
            (c) => `<li data-cid="${c.id}">
          <input value="${esc(c.name)}" aria-label="Class name" maxlength="40" />
          <span class="count">${counts(c.id)} open</span>
          <button data-del-class="${c.id}" aria-label="Delete ${esc(c.name)}">
            <svg viewBox="0 0 24 24" width="16" height="16"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
          </button></li>`
          )
          .join("")
      : `<li class="dim small">No classes yet.</li>`;
    $("#homeState").textContent = state.prefs.homeSetup ? "set up" : "not set up";
    $("#homeState").className = "mono " + (state.prefs.homeSetup ? "accent" : "dim");
    const badgeOk = "setAppBadge" in navigator && "Notification" in window;
    const perm = "Notification" in window ? Notification.permission : "unsupported";
    $("#badgeState").textContent = !badgeOk ? "needs home screen" : perm === "granted" ? "on" : perm === "denied" ? "blocked" : "off";
    $("#enableBadge").hidden = badgeOk && perm === "granted";
  }
  $("#openSettings").addEventListener("click", () => {
    renderSettings();
    show($("#settingsSheet"));
  });

  $("#classList").addEventListener("change", (e) => {
    const li = e.target.closest("[data-cid]");
    if (!li) return;
    const c = classById(li.dataset.cid);
    const v = e.target.value.trim();
    if (c && v) c.name = v;
    else if (c) e.target.value = c.name;
    save();
    render();
  });
  $("#classList").addEventListener("click", (e) => {
    const b = e.target.closest("[data-del-class]");
    if (!b) return;
    const c = classById(b.dataset.delClass);
    if (!c) return;
    const n = state.items.filter((i) => i.classId === c.id).length;
    if (n && !confirm(`Delete “${c.name}”? Its ${n} assignment${n === 1 ? "" : "s"} will stay, just without a class.`)) return;
    state.classes = state.classes.filter((x) => x.id !== c.id);
    state.items.forEach((i) => i.classId === c.id && (i.classId = null));
    save();
    renderSettings();
    render();
  });
  function settingsAdd() {
    if (addClass($("#settingsNewClass").value)) {
      $("#settingsNewClass").value = "";
      renderSettings();
      render();
    }
  }
  $("#settingsAddClass").addEventListener("click", settingsAdd);
  $("#settingsNewClass").addEventListener("keydown", (e) => e.key === "Enter" && settingsAdd());

  $("#enableBadge").addEventListener("click", async () => {
    if (!("Notification" in window) || !("setAppBadge" in navigator)) {
      alert("Add Homework to your Home Screen first (Share → Add to Home Screen), then open it from there and try again.");
      return;
    }
    const p = await Notification.requestPermission();
    state.prefs.badge = p === "granted";
    save();
    renderSettings();
    render();
  });

  $("#exportBtn").addEventListener("click", async () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const name = `homework-backup-${toDateInput(new Date())}.json`;
    const file = new File([blob], name, { type: "application/json" });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: "Homework backup" });
        return;
      } catch (err) {
        if (err.name === "AbortError") return;
      }
    }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
  $("#importBtn").addEventListener("click", () => $("#importFile").click());
  $("#importFile").addEventListener("change", async (e) => {
    const f = e.target.files[0];
    e.target.value = "";
    if (!f) return;
    try {
      const d = JSON.parse(await f.text());
      if (!Array.isArray(d.items) || !Array.isArray(d.classes)) throw new Error("bad file");
      if (!confirm(`Replace everything with this backup (${d.items.length} assignments)?`)) return;
      localStorage.setItem(KEY, JSON.stringify(d));
      state = load();
      renderSettings();
      render();
      toast("Backup restored");
    } catch {
      alert("That file isn't a Homework backup.");
    }
  });
  $("#clearDone").addEventListener("click", () => {
    const n = state.items.filter((i) => i.done).length;
    if (!n) return toast("Nothing finished yet");
    if (!confirm(`Remove ${n} finished assignment${n === 1 ? "" : "s"}?`)) return;
    state.items = state.items.filter((i) => !i.done);
    save();
    render();
    toast("Cleared");
  });

  /* ---------- home reminder guide ---------- */
  $("#msg1").textContent = MSG1;
  $("#msg2").textContent = MSG2;
  $$("[data-copy]").forEach((el) => (el.textContent = el.dataset.copy === "msg1" ? `“${MSG1}”` : `“${MSG2}”`));
  $("#openHomeGuide").addEventListener("click", () => show($("#homeSheet")));
  $$("[data-copy-btn]").forEach((b) =>
    b.addEventListener("click", async () => {
      const text = b.dataset.copyBtn === "msg1" ? MSG1 : MSG2;
      try {
        await navigator.clipboard.writeText(text);
        b.classList.add("copied");
        toast("Copied");
        setTimeout(() => b.classList.remove("copied"), 1200);
      } catch {
        toast("Couldn't copy, type it in instead");
      }
    })
  );
  $("#homeDone").addEventListener("click", () => {
    state.prefs.homeSetup = true;
    save();
    hide();
    toast("Home reminders on");
  });

  /* ---------- badge ---------- */
  function updateBadge(open) {
    if (!("setAppBadge" in navigator)) return;
    if (!("Notification" in window) || Notification.permission !== "granted") return;
    const n = open.filter((i) => i.due < Date.now() + 24 * HOUR).length;
    (n ? navigator.setAppBadge(n) : navigator.clearAppBadge()).catch(() => {});
  }

  /* ---------- toast ---------- */
  let toastTimer;
  function toast(text, undo) {
    const t = $("#toast");
    $("#toastText").textContent = text;
    const a = $("#toastAction");
    a.hidden = !undo;
    a.onclick = undo
      ? () => {
          undo();
          t.hidden = true;
        }
      : null;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (t.hidden = true), undo ? 4500 : 2200);
  }

  /* ---------- live refresh ---------- */
  setInterval(() => !openSheet && render(), 60e3);
  document.addEventListener("visibilitychange", () => document.visibilityState === "visible" && render());

  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }

  render();
})();
