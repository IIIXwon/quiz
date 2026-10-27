/* Java 문제풀이 — questions 폴더의 CSV를 읽어 문제를 출제하고, 풀이를 마친 뒤에만 채점 결과를 보여 준다. */
(() => {
  "use strict";

  /* ---------- 설정 ---------- */
  // 문제 파일 목록. 새 CSV를 추가했다면 여기에 경로를 한 줄 넣으면 됩니다.
  const POOL_FILES = [
    "questions/beginner.csv", "questions/intermediate.csv", "questions/advanced.csv",
    "questions/cs_beginner.csv", "questions/cs_intermediate.csv", "questions/cs_advanced.csv",
    "questions/spring_beginner.csv", "questions/spring_intermediate.csv", "questions/spring_advanced.csv",
  ];
  const SUBJECTS = [
    { key: "Java", desc: "Java 문법과 동작 원리" },
    { key: "CS", desc: "컴퓨터 구조, 자료구조·알고리즘, 운영체제, 네트워크, DB" },
    { key: "Spring", desc: "IoC/DI, AOP, 트랜잭션, MVC, Boot (Spring 6.1 기준)" },
  ];
  const LEVELS = [
    { key: "초급", desc: { Java: "자료형, 연산자, 조건·반복문, 배열, 문자열, 메서드, 클래스 기초", CS: "진법, 컴퓨터 구조, 자료구조·알고리즘, OS·네트워크·DB 기초", Spring: "IoC/DI, 빈 등록·주입, 스코프·생명주기, MVC·Boot 기초, 설정" } },
    { key: "중급", desc: { Java: "상속, 다형성, 인터페이스, 컬렉션, 예외, 래퍼, 제네릭 기초", CS: "캐시, 트리·힙·그래프, 스케줄링·가상 메모리, TCP·HTTP, 정규화·트랜잭션, 보안", Spring: "AOP, 트랜잭션, 빈 고급, 이벤트·SpEL, MVC 심화, 데이터 접근, 테스트" } },
    { key: "고급", desc: { Java: "스트림, 제네릭 심화, 동시성, 불변성, JVM, enum·record", CS: "캐시 일관성, 고급 알고리즘, 페이지 교체, TLS·HTTP/3, MVCC·인덱스, 분산 시스템", Spring: "프록시 내부, 트랜잭션 전파, 생명주기·설정 심화, 이벤트·비동기, Boot 내부, JPA, Security" } },
  ];
  const COUNT_PRESETS = [10, 20, 30, 50];
  const CIRCLED = ["①", "②", "③", "④"];

  /* ---------- 유틸 ---------- */
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const shuffle = (arr) => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  // 주관식 채점: 대소문자, 공백, 쉼표, 괄호, 따옴표 차이는 무시한다. 정답이 여러 개면 | 로 구분.
  const norm = (s) => String(s ?? "").toLowerCase().replace(/[\s,()\[\]{}"'`]/g, "");
  const answerList = (a) => String(a).split("|").map((x) => x.trim()).filter(Boolean);
  const answerText = (a) => answerList(a).join("  또는  ");

  const KW = new Set(("abstract boolean break byte case catch char class continue default do double else enum extends final finally float for if implements import instanceof int interface long new null package private protected public record return short static super switch synchronized this throw throws true false try var void volatile while " +
    "String Integer Long Double Object List ArrayList Map HashMap TreeMap LinkedHashMap Set HashSet TreeSet Arrays Collections Stream IntStream Collectors Optional StringBuilder Thread Runnable Function Predicate Supplier BinaryOperator Comparator Deque ArrayDeque Queue LinkedList PriorityQueue Iterator AutoCloseable Exception RuntimeException System " +
    "SELECT FROM WHERE JOIN LEFT INNER ON GROUP BY HAVING ORDER DESC ASC LIMIT COUNT SUM AVG AS IS NULL AND OR OVER RANK INSERT INTO VALUES UPDATE DELETE").split(" "));
  function highlight(src) {
    const re = /(\/\/[^\n]*)|("(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*')|(\b\d+(?:\.\d+)?[LlFfDd]?\b)|(@[A-Za-z_]\w*)|([A-Za-z_]\w*)/g;
    let out = "", last = 0, m;
    while ((m = re.exec(src))) {
      out += esc(src.slice(last, m.index));
      if (m[1]) out += `<span class="c">${esc(m[1])}</span>`;
      else if (m[4]) out += `<span class="a">${m[4]}</span>`;
      else if (m[2]) out += `<span class="s">${esc(m[2])}</span>`;
      else if (m[3]) out += `<span class="n">${m[3]}</span>`;
      else out += KW.has(m[5]) ? `<span class="k">${m[5]}</span>` : m[5];
      last = re.lastIndex;
    }
    return out + esc(src.slice(last));
  }

  /* ---------- CSV ---------- */
  function parseCSV(text) {
    text = text.replace(/^﻿/, "");
    const rows = [];
    let row = [], field = "", i = 0, inQ = false;
    while (i < text.length) {
      const ch = text[i];
      if (inQ) {
        if (ch === '"') {
          if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
          inQ = false; i++; continue;
        }
        field += ch; i++; continue;
      }
      if (ch === '"') { inQ = true; i++; continue; }
      if (ch === ",") { row.push(field); field = ""; i++; continue; }
      if (ch === "\r") { i++; continue; }
      if (ch === "\n") { row.push(field); rows.push(row); row = []; field = ""; i++; continue; }
      field += ch; i++;
    }
    if (field !== "" || row.length) { row.push(field); rows.push(row); }
    return rows.filter((r) => r.some((c) => c.trim() !== ""));
  }

  function rowsToQuestions(rows, source) {
    if (!rows.length) return { list: [], errors: [`${source}: 내용이 비어 있어요`] };
    const head = rows[0].map((h) => h.trim());
    const col = (name) => head.indexOf(name);
    const need = ["번호", "난이도", "분류", "유형", "문제", "정답"];
    const missing = need.filter((n) => col(n) < 0);
    if (missing.length) return { list: [], errors: [`${source}: 머리글에 ${missing.join(", ")} 열이 없어요`] };
    const get = (r, name) => (col(name) >= 0 ? (r[col(name)] ?? "") : "");
    const list = [], errors = [];
    rows.slice(1).forEach((r, k) => {
      const q = {
        id: get(r, "번호").trim(),
        subject: get(r, "과목").trim() || "Java",
        level: get(r, "난이도").trim(),
        cat: get(r, "분류").trim() || "기타",
        type: get(r, "유형").trim() === "객관식" ? "객관식" : "주관식",
        text: get(r, "문제").trim(),
        code: get(r, "코드").replace(/\s+$/, ""),
        choices: [1, 2, 3, 4].map((n) => get(r, "보기" + n).trim()),
        answer: get(r, "정답").trim(),
        exp: get(r, "해설").trim(),
      };
      const line = k + 2;
      if (!q.id || !q.text) { errors.push(`${source} ${line}번째 줄: 번호나 문제가 비어 있어 건너뛰었어요`); return; }
      if (!LEVELS.some((l) => l.key === q.level)) { errors.push(`${source} ${q.id}: 난이도는 초급/중급/고급 중 하나여야 해요`); return; }
      if (q.type === "객관식") {
        const a = Number(q.answer);
        if (!(a >= 1 && a <= 4) || !q.choices[a - 1]) { errors.push(`${source} ${q.id}: 객관식 정답은 1~4 중 보기가 있는 번호여야 해요`); return; }
      } else if (!q.answer) { errors.push(`${source} ${q.id}: 정답이 비어 있어요`); return; }
      list.push(q);
    });
    return { list, errors };
  }

  /* ---------- 상태 ---------- */
  let POOL = [];                       // 모든 문제
  const setup = { subject: "Java", level: "초급", mode: "random", count: 10, cats: new Set(), type: "", picked: new Set() };
  let session = null;                  // { items: [{q, order}], answers: [], pos }
  let lastResult = null;

  /* ---------- 문제 불러오기 ---------- */
  function addQuestions(list) {
    const seen = new Set(POOL.map((q) => q.id));
    list.forEach((q) => { if (!seen.has(q.id)) { POOL.push(q); seen.add(q.id); } });
  }

  function showLoaded(errors) {
    const st = $("load-status");
    const counts = subjectsInPool().map((s) => `${s} ${POOL.filter((q) => q.subject === s).length}`).join(" · ");
    st.className = "load-status" + (errors.length ? " err" : "");
    st.textContent = `문제 ${POOL.length}개를 불러왔어요 (${counts})` + (errors.length ? ` · 확인이 필요한 줄 ${errors.length}개: ${errors.slice(0, 3).join(" / ")}` : "");
    if (errors.length) console.warn(errors);
    if (POOL.length) {
      $("load-fallback").hidden = true;
      $("setup").hidden = false;
      if (!POOL.some((q) => q.subject === setup.subject)) setup.subject = POOL[0].subject;
      if (!levelPool().length) setup.level = (POOL.find((q) => q.subject === setup.subject) || {}).level || "초급";
      renderSetup();
    }
  }

  async function loadFromFolder() {
    const errors = [];
    const results = await Promise.allSettled(POOL_FILES.map(async (f) => {
      const r = await fetch(f, { cache: "no-store" });
      if (!r.ok) throw new Error(f);
      return [f, await r.text()];
    }));
    results.forEach((res, i) => {
      if (res.status === "fulfilled") {
        const [f, t] = res.value;
        const r = rowsToQuestions(parseCSV(t), f); addQuestions(r.list); errors.push(...r.errors);
      } else errors.push(`${POOL_FILES[i]}: 파일을 읽지 못했어요`);
    });
    if (POOL.length) showLoaded(errors);
    else {
      $("load-status").textContent = "questions 폴더의 문제 파일을 자동으로 읽지 못했어요.";
      $("load-fallback").hidden = false;
    }
  }

  async function loadFromFiles(files) {
    const errors = [];
    for (const f of files) {
      if (!/\.csv$/i.test(f.name)) { errors.push(`${f.name}: CSV 파일이 아니에요`); continue; }
      const r = rowsToQuestions(parseCSV(await f.text()), f.name);
      addQuestions(r.list);
      errors.push(...r.errors);
    }
    if (!POOL.length) {
      $("load-status").className = "load-status err";
      $("load-status").textContent = "문제를 하나도 읽지 못했어요. " + errors.slice(0, 3).join(" / ");
      return;
    }
    showLoaded(errors);
  }

  /* ---------- 시작 화면 ---------- */
  const subjectsInPool = () => {
    const known = SUBJECTS.map((s) => s.key);
    const all = [...new Set(POOL.map((q) => q.subject))];
    return [...known.filter((k) => all.includes(k)), ...all.filter((s) => !known.includes(s))];
  };
  const levelPool = () => POOL.filter((q) => q.subject === setup.subject && q.level === setup.level);
  const catsOf = (list) => [...new Set(list.map((q) => q.cat))];

  function randomCandidates() {
    return levelPool().filter((q) => (!setup.cats.size || setup.cats.has(q.cat)) && (!setup.type || q.type === setup.type));
  }

  function renderSetup() {
    // 과목
    $("subjects").innerHTML = subjectsInPool().map((s) => {
      const info = SUBJECTS.find((x) => x.key === s);
      const n = POOL.filter((q) => q.subject === s).length;
      return `<button class="subject" role="radio" aria-checked="${setup.subject === s}" data-subject="${esc(s)}">
        <b>${esc(s)}</b><small>${n}문제${info ? " · " + esc(info.desc) : ""}</small></button>`;
    }).join("");
    $("subjects").querySelectorAll(".subject").forEach((b) => b.addEventListener("click", () => {
      if (setup.subject === b.dataset.subject) return;
      setup.subject = b.dataset.subject; setup.cats.clear(); setup.picked.clear();
      if (!levelPool().length) setup.level = (POOL.find((q) => q.subject === setup.subject) || {}).level || "초급";
      renderSetup();
    }));

    // 난이도
    $("levels").innerHTML = LEVELS.map((l, i) => {
      const n = POOL.filter((q) => q.subject === setup.subject && q.level === l.key).length;
      const desc = l.desc[setup.subject] || "";
      return `<button class="level" role="radio" aria-checked="${setup.level === l.key}" data-level="${l.key}" ${n ? "" : "disabled"}>
        <b><span class="lv" style="background:var(--lv${i + 1})"></span>${l.key}</b>
        <small>${n}문제${desc ? " · " + esc(desc) : ""}</small></button>`;
    }).join("");
    $("levels").querySelectorAll(".level").forEach((b) => b.addEventListener("click", () => {
      if (setup.level === b.dataset.level) return;
      setup.level = b.dataset.level; setup.cats.clear(); setup.picked.clear();
      renderSetup();
    }));

    // 랜덤: 문제 수
    $("count-chips").innerHTML = COUNT_PRESETS.map((n) => `<button class="chip" data-n="${n}" aria-pressed="${setup.count === n}">${n}</button>`).join("");
    $("count-chips").querySelectorAll(".chip").forEach((c) => c.addEventListener("click", () => {
      setup.count = Number(c.dataset.n); $("count-input").value = setup.count; renderSetup();
    }));
    $("count-input").value = setup.count;

    // 랜덤: 분류
    const cats = catsOf(levelPool());
    $("cat-chips").innerHTML = `<button class="chip" data-cat="" aria-pressed="${!setup.cats.size}">전체</button>` +
      cats.map((c) => `<button class="chip" data-cat="${esc(c)}" aria-pressed="${setup.cats.has(c)}">${esc(c)}</button>`).join("");
    $("cat-chips").querySelectorAll(".chip").forEach((c) => c.addEventListener("click", () => {
      const v = c.dataset.cat;
      if (!v) setup.cats.clear();
      else if (setup.cats.has(v)) setup.cats.delete(v);
      else setup.cats.add(v);
      renderSetup();
    }));

    // 랜덤: 유형
    $("type-chips").innerHTML = [["", "전체"], ["객관식", "객관식"], ["주관식", "주관식"]]
      .map(([v, t]) => `<button class="chip" data-type="${v}" aria-pressed="${setup.type === v}">${t}</button>`).join("");
    $("type-chips").querySelectorAll(".chip").forEach((c) => c.addEventListener("click", () => { setup.type = c.dataset.type; renderSetup(); }));

    const avail = randomCandidates().length;
    $("avail").textContent = `조건에 맞는 문제 ${avail}개 중에서 무작위로 뽑아요.` + (setup.count > avail ? ` (문제 수가 더 많아서 ${avail}문제만 출제돼요)` : "");

    // 직접 선택
    const mCat = $("m-cat"), prev = mCat.value;
    mCat.innerHTML = `<option value="">모든 분류</option>` + cats.map((c) => `<option value="${esc(c)}">${esc(c)}</option>`).join("");
    mCat.value = cats.includes(prev) ? prev : "";
    renderPickList();
    renderSummary();
  }

  function manualVisible() {
    const cat = $("m-cat").value, type = $("m-type").value, s = $("m-search").value.trim().toLowerCase();
    return levelPool().filter((q) => (!cat || q.cat === cat) && (!type || q.type === type) &&
      (!s || (q.text + " " + q.code + " " + q.id + " " + q.cat).toLowerCase().includes(s)));
  }

  function renderPickList() {
    const list = manualVisible();
    const el = $("pick-list");
    if (!list.length) { el.innerHTML = `<div class="empty">조건에 맞는 문제가 없어요.</div>`; return; }
    el.innerHTML = list.map((q) => {
      const preview = q.text + (q.code ? "  " + q.code.split("\n").find((l) => l.trim()) : "");
      return `<label class="pick"><input type="checkbox" data-id="${esc(q.id)}" ${setup.picked.has(q.id) ? "checked" : ""}>
        <span class="pid">${esc(q.id)}</span><span class="ptxt" title="${esc(preview)}">${esc(preview)}</span>
        <span class="ptag">${esc(q.cat)} · ${q.type}</span></label>`;
    }).join("");
    el.querySelectorAll("input").forEach((cb) => cb.addEventListener("change", () => {
      if (cb.checked) setup.picked.add(cb.dataset.id); else setup.picked.delete(cb.dataset.id);
      renderSummary();
    }));
  }

  function plannedQuestions() {
    if (setup.mode === "manual") {
      return levelPool().filter((q) => setup.picked.has(q.id));
    }
    return shuffle(randomCandidates()).slice(0, Math.max(0, setup.count));
  }

  function renderSummary() {
    const n = setup.mode === "manual" ? levelPool().filter((q) => setup.picked.has(q.id)).length
      : Math.min(setup.count, randomCandidates().length);
    $("start-summary").innerHTML = `<b>${esc(setup.subject)} ${setup.level}</b> · ${setup.mode === "manual" ? "직접 선택" : "랜덤"} <b>${n}문제</b>` +
      (n ? "" : (setup.mode === "manual" ? " · 풀 문제를 하나 이상 선택해 주세요" : " · 조건에 맞는 문제가 없어요"));
    $("start").disabled = n === 0;
  }

  function setMode(mode) {
    setup.mode = mode;
    $("tab-random").setAttribute("aria-selected", mode === "random");
    $("tab-manual").setAttribute("aria-selected", mode === "manual");
    $("pane-random").hidden = mode !== "random";
    $("pane-manual").hidden = mode !== "manual";
    renderSummary();
  }

  /* ---------- 풀이 ---------- */
  function show(screen) {
    ["home", "quiz", "result"].forEach((s) => { $("screen-" + s).hidden = s !== screen; });
    window.scrollTo(0, 0);
  }

  function startSession(questions) {
    if (!questions.length) return;
    session = {
      items: questions.map((q) => ({ q, order: q.type === "객관식" ? shuffle([0, 1, 2, 3].filter((i) => q.choices[i])) : null })),
      answers: questions.map(() => ""),
      pos: 0,
    };
    show("quiz");
    renderQuestion();
  }

  const answeredCount = () => session.answers.filter((a) => String(a).trim() !== "").length;

  function renderQuestion() {
    const { items, answers, pos } = session;
    const { q, order } = items[pos];
    $("q-pos").textContent = pos + 1;
    $("q-total").textContent = items.length;
    $("q-answered").textContent = `${answeredCount()}문제 답함`;
    $("bar-fill").style.width = `${(answeredCount() / items.length) * 100}%`;

    let body = `<div class="meta"><span class="tag">${esc(q.subject)}</span><span class="tag lv-${esc(q.level)}">${esc(q.level)}</span><span class="tag">${esc(q.cat)}</span><span class="tag">${q.type}</span></div>
      <p class="q-text">${esc(q.text)}</p>${q.code ? `<pre>${highlight(q.code)}</pre>` : ""}`;
    if (q.type === "객관식") {
      body += `<div class="choices" role="radiogroup" aria-label="보기">` + order.map((ci, k) =>
        `<button class="choice" role="radio" aria-checked="${answers[pos] === String(ci + 1)}" data-ci="${ci + 1}">
          <span class="no">${k + 1}</span><span class="ct">${esc(q.choices[ci])}</span></button>`).join("") + `</div>
        <p class="key-hint">키보드 1~4로 보기 선택, ← → 로 문제 이동</p>`;
    } else {
      body += `<div class="short-answer"><label class="label" for="sa">내 답 (출력 결과를 그대로 입력)</label>
        <textarea id="sa" spellcheck="false" autocomplete="off" placeholder="예: 3 / [1, 2] / true false">${esc(answers[pos])}</textarea></div>
        <p class="key-hint">여러 줄 출력은 줄바꿈이나 공백으로 구분해 쓰면 돼요. Ctrl+Enter로 다음 문제</p>`;
    }
    $("question").innerHTML = body;

    if (q.type === "객관식") {
      $("question").querySelectorAll(".choice").forEach((b) => b.addEventListener("click", () => {
        session.answers[pos] = answers[pos] === b.dataset.ci ? "" : b.dataset.ci;
        renderQuestion();
      }));
    } else {
      const ta = $("sa");
      ta.addEventListener("input", () => { session.answers[pos] = ta.value; updateProgressOnly(); });
      ta.focus();
      ta.setSelectionRange(ta.value.length, ta.value.length);
    }
    $("prev").disabled = pos === 0;
    $("next").textContent = pos === items.length - 1 ? "마지막 문제" : "다음 →";
    $("next").disabled = pos === items.length - 1;
    renderPalette();
  }

  function updateProgressOnly() {
    $("q-answered").textContent = `${answeredCount()}문제 답함`;
    $("bar-fill").style.width = `${(answeredCount() / session.items.length) * 100}%`;
    renderPalette();
  }

  function renderPalette() {
    $("palette").innerHTML = session.items.map((_, i) =>
      `<button class="pal${String(session.answers[i]).trim() ? " done" : ""}${i === session.pos ? " cur" : ""}" data-i="${i}" aria-label="${i + 1}번 문제">${i + 1}</button>`).join("");
    $("palette").querySelectorAll(".pal").forEach((b) => b.addEventListener("click", () => go(Number(b.dataset.i))));
  }

  function go(i) {
    if (!session || i < 0 || i >= session.items.length) return;
    session.pos = i;
    renderQuestion();
  }

  /* ---------- 확인 창 ---------- */
  function confirmBox(title, body, okText, onOk) {
    $("modal-title").textContent = title;
    $("modal-body").textContent = body;
    $("modal-ok").textContent = okText;
    $("modal").hidden = false;
    $("modal-ok").focus();
    const close = () => { $("modal").hidden = true; $("modal-ok").onclick = null; $("modal-cancel").onclick = null; };
    $("modal-ok").onclick = () => { close(); onOk(); };
    $("modal-cancel").onclick = close;
  }

  /* ---------- 채점·결과 ---------- */
  function grade() {
    const rows = session.items.map(({ q, order }, i) => {
      const mine = String(session.answers[i] ?? "").trim();
      const ok = q.type === "객관식" ? mine === q.answer : mine !== "" && answerList(q.answer).some((a) => norm(mine) === norm(a));
      return { q, order, mine, ok };
    });
    lastResult = { rows, questions: session.items.map((it) => it.q) };
    session = null;
    renderResult("all");
    show("result");
  }

  function choiceLabel(q, order, ci) {
    const k = order.indexOf(Number(ci) - 1);
    return `${CIRCLED[k] ?? ""} ${q.choices[Number(ci) - 1]}`;
  }

  function renderResult(filter) {
    const { rows } = lastResult;
    const score = rows.filter((r) => r.ok).length;
    const unanswered = rows.filter((r) => !r.mine).length;
    $("r-score").textContent = score;
    $("r-total").textContent = rows.length;
    $("r-pct").textContent = `정답률 ${Math.round((score / rows.length) * 100)}%`;
    $("r-meta").textContent = `${rows[0].q.subject} ${rows[0].q.level} · 틀린 문제 ${rows.length - score - unanswered}개 · 안 푼 문제 ${unanswered}개`;

    const byCat = {};
    rows.forEach((r) => { const c = (byCat[r.q.cat] ||= { ok: 0, n: 0 }); c.n++; if (r.ok) c.ok++; });
    $("r-cats").innerHTML = Object.entries(byCat).sort((a, b) => a[1].ok / a[1].n - b[1].ok / b[1].n).map(([cat, v]) =>
      `<div class="cat"><div class="cat-top"><span>${esc(cat)}</span><b>${v.ok}/${v.n}</b></div><div class="cat-bar"><i style="width:${(v.ok / v.n) * 100}%"></i></div></div>`).join("");

    $("retry-wrong").disabled = score === rows.length;
    $("rv-all").setAttribute("aria-selected", filter === "all");
    $("rv-wrong").setAttribute("aria-selected", filter === "wrong");

    const shown = rows.map((r, i) => ({ ...r, i })).filter((r) => filter === "all" || !r.ok);
    $("review").innerHTML = shown.length ? shown.map(({ q, order, mine, ok, i }) => {
      const mineText = !mine ? "" : q.type === "객관식" ? choiceLabel(q, order, mine) : mine;
      const rightText = q.type === "객관식" ? choiceLabel(q, order, q.answer) : answerText(q.answer);
      const choiceList = q.type === "객관식"
        ? `<dl class="cmp">${order.map((ci, k) => `<dt>${CIRCLED[k]}</dt><dd>${esc(q.choices[ci])}</dd>`).join("")}</dl>` : "";
      return `<article class="panel rv${ok ? "" : " wrong"}">
        <div class="rv-head"><b>${i + 1}번</b><span class="pill ${ok ? "ok" : "bad"}">${ok ? "정답" : mine ? "오답" : "안 풀었음"}</span>
          <span class="tag">${esc(q.cat)}</span><span class="tag">${q.type}</span><span class="tag">${esc(q.id)}</span></div>
        <p class="q-text">${esc(q.text)}</p>${q.code ? `<pre>${highlight(q.code)}</pre>` : ""}${choiceList}
        <dl class="cmp">
          <dt>내 답</dt><dd class="${mine ? (ok ? "" : "wrong") : "none"}">${mine ? esc(mineText) : "입력하지 않음"}</dd>
          <dt>정답</dt><dd class="right">${esc(rightText)}</dd>
        </dl>
        ${q.exp ? `<p class="exp">${esc(q.exp)}</p>` : ""}
      </article>`;
    }).join("") : `<div class="panel empty">틀린 문제가 없어요. 모두 맞혔어요!</div>`;
  }

  /* ---------- 이벤트 연결 ---------- */
  $("tab-random").addEventListener("click", () => setMode("random"));
  $("tab-manual").addEventListener("click", () => setMode("manual"));
  $("count-input").addEventListener("input", () => {
    const v = Math.floor(Number($("count-input").value));
    if (v > 0) { setup.count = v; renderSetup(); $("count-input").focus(); }
  });
  ["m-cat", "m-type"].forEach((id) => $(id).addEventListener("change", renderPickList));
  $("m-search").addEventListener("input", renderPickList);
  $("m-all").addEventListener("click", () => { manualVisible().forEach((q) => setup.picked.add(q.id)); renderPickList(); renderSummary(); });
  $("m-none").addEventListener("click", () => { setup.picked.clear(); renderPickList(); renderSummary(); });
  $("start").addEventListener("click", () => startSession(plannedQuestions()));

  $("prev").addEventListener("click", () => go(session.pos - 1));
  $("next").addEventListener("click", () => go(session.pos + 1));
  $("finish").addEventListener("click", () => {
    const left = session.items.length - answeredCount();
    if (left > 0) confirmBox("풀이를 종료할까요?", `아직 답하지 않은 문제가 ${left}개 있어요. 종료하면 안 푼 문제는 오답으로 처리되고 점수와 정답이 공개돼요.`, "종료하고 채점", grade);
    else confirmBox("풀이를 종료할까요?", "종료하면 점수와 정답이 공개되고, 답을 더 이상 바꿀 수 없어요.", "종료하고 채점", grade);
  });
  $("quit").addEventListener("click", () => confirmBox("풀이를 그만둘까요?", "지금까지 입력한 답은 저장되지 않고 처음 화면으로 돌아가요.", "그만두기", () => { session = null; show("home"); }));

  $("rv-all").addEventListener("click", () => renderResult("all"));
  $("rv-wrong").addEventListener("click", () => renderResult("wrong"));
  $("retry-wrong").addEventListener("click", () => startSession(shuffle(lastResult.rows.filter((r) => !r.ok).map((r) => r.q))));
  $("retry-same").addEventListener("click", () => startSession(shuffle(lastResult.questions)));
  $("home").addEventListener("click", () => { show("home"); renderSetup(); });

  document.addEventListener("keydown", (e) => {
    if (!$("modal").hidden) {
      if (e.key === "Escape") $("modal-cancel").click();
      return;
    }
    if ($("screen-quiz").hidden || !session) return;
    const typing = e.target.tagName === "TEXTAREA";
    if (typing) {
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); go(session.pos + 1); }
      return;
    }
    if (e.key === "ArrowLeft") go(session.pos - 1);
    else if (e.key === "ArrowRight") go(session.pos + 1);
    else if (/^[1-4]$/.test(e.key)) {
      const btn = $("question").querySelectorAll(".choice")[Number(e.key) - 1];
      if (btn) btn.click();
    }
  });

  // 파일 직접 선택 / 끌어다 놓기
  $("file-input").addEventListener("change", (e) => loadFromFiles([...e.target.files]));
  const fb = $("load-fallback");
  fb.addEventListener("dragover", (e) => { e.preventDefault(); fb.classList.add("drag"); });
  fb.addEventListener("dragleave", () => fb.classList.remove("drag"));
  fb.addEventListener("drop", (e) => { e.preventDefault(); fb.classList.remove("drag"); loadFromFiles([...e.dataTransfer.files]); });

  loadFromFolder();
})();
