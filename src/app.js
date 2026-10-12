import { emptyProgress, validateProgress, transitionStage } from "./domain.js";
import { mountSimulation } from "./simulations.js";

const $ = (s) => document.querySelector(s);
const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const paths = {
  home: "M3 10l9-7 9 7v10H3z M9 20v-7h6v7",
  map: "M6 4v6m12 4v6M6 10h12v4 M3 2h6v4H3z M15 18h6v4h-6z",
  review: "M4 5h16v15H4z M8 10h8 M8 15h5",
  arrow: "M5 12h14m-6-6 6 6-6 6",
  check: "M5 12l4 4L19 6",
  book: "M3 4h7l2 2 2-2h7v15h-7l-2 2-2-2H3z M12 6v15",
  clock: "M12 8v5l3 2 M21 12a9 9 0 11-18 0 9 9 0 0118 0",
  layers: "M3 8l9-5 9 5-9 5z M3 12l9 5 9-5 M3 16l9 5 9-5",
};
export const icon = (name) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name] ?? paths.book}"/></svg>`;
const stages = ["아직 시작 전", "읽음", "직접 확인함", "설명 가능"];
const KEY = "project-study:progress:v1";
let course,
  progress = emptyProgress(),
  currentId,
  simulationCleanup,
  saveFailed = false,
  importCandidate;
let toastTimer;
function toast(message) {
  $("#toast").textContent = message;
  $("#toast").classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $("#toast").classList.remove("show"), 4500);
}
function record(id) {
  return (
    progress.lessons[id] ?? {
      stage: 0,
      memo: "",
      answers: course.lessons.find((l) => l.id === id).quiz.map(() => null),
    }
  );
}
function update(id, patch) {
  progress.lessons[id] = { ...record(id), ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(progress));
    saveFailed = false;
  } catch {
    if (!saveFailed)
      toast("브라우저 저장에 실패했어요. 학습 기록을 파일로 백업해 주세요.");
    saveFailed = true;
  }
}
function codexLatest() {
  const result = {};
  for (const s of [...(course.study?.sessions ?? [])].sort(
    (a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id),
  ))
    result[s.topic] = s;
  return result;
}
function codexDone(id) {
  return codexLatest()[id]?.status === "completed";
}
function nextCodexLesson() {
  const latest = codexLatest();
  const available = (l) => l.requires.every(codexDone);
  return (
    course.lessons.find(
      (l) => available(l) && latest[l.id]?.status === "review-needed",
    ) ?? course.lessons.find((l) => available(l) && !codexDone(l.id))
  );
}
function codexStatus(id) {
  return (
    { completed: "Codex 확인 완료", "review-needed": "다시 설명해 보기" }[
      codexLatest()[id]?.status
    ] ?? "대화 학습 전"
  );
}
function sidebar() {
  const complete = course.lessons.filter((l) => codexDone(l.id)).length;
  const route = location.hash.split("/")[1] || "home";
  $("#sidebar").innerHTML =
    `<a class="brand" href="#/home"><span class="brand-icon">p<span>•</span></span><span>project<span class="brand-second">study</span></span></a>
    <div class="sidebar-caption">프로젝트에서 배운 것들</div>
    <nav class="primary-nav" aria-label="주요 메뉴">${[
      ["home", "학습 홈"],
      ["study", "Codex와 학습"],
      ["sessions", "학습 노트"],
      ["map", "개념 지도"],
      ["review", "복습 카드"],
    ]
      .map(
        ([v, t]) =>
          `<a href="#/${v}" class="${route === v ? "active" : ""}" ${route === v ? 'aria-current="page"' : ""}>${icon(v)}${t}${v === "review" ? `<span class="nav-count">${course.lessons.reduce((n, l) => n + l.quiz.length, 0)}</span>` : ""}</a>`,
      )
      .join("")}</nav>
    <div class="sidebar-section"><span>CHAPTER 01</span><b>로깅 & 모니터링</b></div>
    <nav class="lesson-nav" aria-label="학습 주제">${course.lessons.map((l, i) => `<a href="#/lesson/${l.id}" class="${currentId === l.id ? "selected" : ""}" ${currentId === l.id ? 'aria-current="page"' : ""}><span class="lesson-num ${codexDone(l.id) ? "done" : ""}">${codexDone(l.id) ? "✓" : String(i + 1).padStart(2, "0")}</span><span>${esc(l.title)}<small>${esc(l.category)}</small></span></a>`).join("")}</nav>
    <div class="sidebar-bottom"><div><span>Codex 확인 완료</span><b>${complete}<small> / ${course.lessons.length}</small></b></div><div class="progress-track"><i style="width:${(complete / course.lessons.length) * 100}%"></i></div><p>대화에서 확인한 이해를 기록해요.</p></div>`;
}
function card(l, i) {
  return `<a class="lesson-card" href="#/lesson/${l.id}"><div class="card-top"><span class="index">${String(i + 1).padStart(2, "0")}</span><span class="pill ${codexDone(l.id) ? "green" : ""}">${codexStatus(l.id)}</span></div><h3>${esc(l.title)}</h3><p>${esc(l.subtitle)}</p><div class="card-footer"><span>${icon("clock")}${l.minutes}분 · ${esc(l.category)}</span>${icon("arrow")}</div></a>`;
}
function home() {
  const done = course.lessons.filter((l) => codexDone(l.id)).length;
  const needsReview = Object.values(codexLatest()).filter(
    (s) => s.status === "review-needed",
  ).length;
  const next = nextCodexLesson();
  $("#main").innerHTML =
    `<div class="page-heading"><div><span class="eyebrow">MY LEARNING NOTEBOOK</span><h1>배운 것을, 내 지식으로.</h1><p>프로젝트에서 만난 개념을 짧게 읽고, 직접 확인하고, 다시 설명해 보세요.</p></div><span class="workspace-label"><span></span>나만의 학습 공간</span></div>
    <section class="course-hero"><div class="hero-copy"><div class="chapter-label">CHAPTER 01 <span>실제 프로젝트 기반</span></div><h2>${esc(course.title)}</h2><p>Codex가 묻고, 내가 설명하고.<br>헷갈린 부분을 함께 고쳐 내 지식으로 만듭니다.</p><a href="#/study" class="button primary">Codex와 학습하기 ${icon("arrow")}</a><span class="hero-duration">한 번에 한 주제 · 대화 학습 약 10~20분</span></div><div class="hero-illustration" aria-label="요청에서 로그, 메트릭, 알림으로 이어지는 흐름"><div class="diagram-cap">OBSERVE → UNDERSTAND → RESPOND</div><div class="hero-node request-node">${icon("layers")}<span>사용자 요청</span><i></i></div><div class="hero-branches"><div><span class="mini-icon">≡</span><b>로그</b><small>무슨 일이?</small></div><div><span class="mini-icon">▥</span><b>메트릭</b><small>얼마나?</small></div><div><span class="mini-icon">◉</span><b>알림</b><small>누가 알게?</small></div></div><div class="diagram-note"><span class="status-dot"></span>하나의 요청을 세 가지 관점으로</div></div></section>
    <section class="stats-row" aria-label="Codex 학습 현황"><div><span>확인한 이해</span><strong>${done}<small> / ${course.lessons.length}</small></strong></div><div><span>복습할 주제</span><strong>${needsReview}</strong></div><div><span>쌓인 학습 노트</span><strong>${course.study.sessions.length}</strong></div><div class="stats-note">${icon("book")}<p>다음 대화 주제<br><b>${esc(next?.title ?? "전체 학습 완료 · 다시 복습하기")}</b></p></div></section>
    <div class="section-heading"><div><h2>차근차근, ${course.lessons.length}개의 학습</h2><p>앞에서 뒤로 이어 읽어도, 궁금한 주제부터 열어도 좋아요.</p></div><a class="inline-link" href="#/map">연결해서 보기 ${icon("arrow")}</a></div><div class="lesson-grid">${course.lessons.map(card).join("")}</div>
    <section class="learning-note"><span>✦</span><div><b>대화는 Codex에서, 배운 내용은 이곳에.</b><p>학습을 마치면 이해한 내용·교정한 부분·확인 질문이 공개 학습 노트로 반영돼요. 혼자 적은 메모와 복습 체크는 이 브라우저에만 저장됩니다.</p><a class="inline-link" href="#/sessions">학습 노트 보기 →</a></div></section>`;
}
function addCopyButtons() {
  document.querySelectorAll(".prose pre").forEach((pre) => {
    const btn = document.createElement("button");
    btn.className = "copy-button";
    btn.textContent = "복사";
    btn.type = "button";
    btn.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(
          pre.querySelector("code").textContent,
        );
        toast("복사했어요. 실제 환경과 ID를 확인한 뒤 사용하세요.");
      } catch {
        toast("복사 권한이 없어요. 코드를 직접 선택해 주세요.");
      }
    });
    pre.append(btn);
  });
}
function quizMarkup(l, mode = "lesson", onlyAgain = false) {
  const r = record(l.id);
  return l.quiz
    .map((q, i) =>
      onlyAgain && r.answers[i] !== false
        ? ""
        : `<article class="quiz-card"><div class="quiz-number">Q${String(i + 1).padStart(2, "0")} ${mode === "review" ? `<a href="#/lesson/${l.id}">${esc(l.title)} ↗</a>` : ""}</div><h3>${esc(q.q)}</h3><details><summary>생각한 뒤 답 확인하기 <span>+</span></summary><p>${esc(q.a)}</p><div class="self-grade"><span>내 설명은 어땠나요?</span><button data-grade="${l.id}:${i}:true" class="${r.answers[i] === true ? "selected" : ""}">설명했어요 ✓</button><button data-grade="${l.id}:${i}:false" class="${r.answers[i] === false ? "selected" : ""}">다시 볼게요 ↻</button></div></details>${r.answers[i] === false ? '<span class="review-flag">다시 볼 질문</span>' : ""}</article>`,
    )
    .join("");
}
function studyGuide() {
  const next = nextCodexLesson();
  $("#main").innerHTML =
    `<div class="page-heading"><div><span class="eyebrow">LEARN WITH CODEX</span><h1>질문 하나부터, 함께 공부해요.</h1><p>내 답변에서 막힌 곳을 찾고, 설명과 실습으로 이해를 확인합니다.</p></div></div>
  <section class="study-next"><span class="eyebrow">${esc(course.study.learner)} · 다음 주제</span><h2>${esc(next?.title ?? "전체 주제를 마쳤어요")}</h2><p>${esc(next?.lead ?? "학습 노트의 복습 질문이나 다시 공부할 주제를 골라 주세요.")}</p><div class="study-actions"><button class="button primary" id="copy-study">Codex 시작 문장 복사 ${icon("arrow")}</button>${next ? `<a class="button" href="#/lesson/${next.id}">학습 자료·모의 실습 보기</a>` : '<a class="button" href="#/sessions">학습 노트 보기</a>'}</div></section>
  <div class="study-steps">
    <section><span class="step-index">01</span><h2>저장소를 Codex에서 열어요</h2><p>처음 한 번만 설치합니다. 이미 프로젝트 폴더가 있다면 그대로 사용하세요.</p><div class="prose"><pre><code>git clone https://github.com/JYL35/project-study.git
cd project-study
npm ci
npm run context -- JYL35</code></pre></div><p>Codex에 <b>project-study 폴더</b>를 프로젝트로 추가하세요. <code>context</code>는 기존 대화 학습 기록을 읽어 다음 주제와 복습할 내용을 알려 줍니다.</p></section>
    <section><span class="step-index">02</span><h2>Study를 불러와 답해요</h2><p>Codex에서 <code>$study</code> 또는 <b>“공부 시작하자”</b>를 입력하세요. 스킬 선택 목록에서는 <b>Study</b>를 고릅니다. 목록에 안 보이면 프로젝트를 다시 열거나 위 시작 문장을 붙여 넣으세요.</p><div class="dialogue-example"><b>Codex의 첫 질문 예시</b><p>“사용자가 오류를 봤어요. 로그·메트릭·알림은 각각 어떤 질문에 답해 줄까요?”</p><span>모르는 부분까지 솔직하게 설명해 주세요. 답변을 받은 뒤 필요한 힌트와 설명을 이어갑니다.</span></div></section>
    <section><span class="step-index">03</span><h2>흐름을 설명하고, 직접 확인해요</h2><p>정답을 외우기보다 <b>누가 → 무엇을 → 왜 하는지</b> 내 말로 설명해요. 막히면 “더 쉽게”, “힌트”, “그 단계가 왜 필요한지 모르겠어”라고 말하면 됩니다.</p><p>사이트 모의 실습에서 결과를 예측하고 확인합니다. 마지막에는 다른 상황의 질문에 도움 없이 답해 봅니다.</p></section>
    <section><span class="step-index">04</span><h2>학습 노트로 남아요</h2><p>Codex가 이해한 내용, 교정 전후, 확인 질문과 남은 과제를 정리합니다. 충분히 설명하지 못한 내용은 <b>복습 필요</b>로 남깁니다.</p><p>정리본을 저장소에 반영하고 배포가 끝나면 이 사이트의 <a href="#/sessions">학습 노트</a>와 진행 상태가 바뀝니다. 원문 대화 전체를 게시하지 않습니다.</p></section>
  </div><section class="learning-note"><span>✦</span><div><b>이 화면은 학습의 입구입니다.</b><p>질문·답변은 Codex에서 진행해요. 사이트는 자료·모의 실습·학습 결과를 보여 줍니다. 별도 AI API 키나 추가 유료 서버는 필요하지 않습니다.</p></div></section>`;
  addCopyButtons();
  $("#copy-study").onclick = async () => {
    const prompt = `project-study의 .agents/skills/study/SKILL.md를 읽고 Study 학습을 시작해 줘. npm run context -- JYL35로 다음 주제와 중간 기록을 확인하고, 한 번에 질문 하나씩 내 답변을 기다려 줘. 헷갈리는 부분을 교정하고 학습 후 확인된 결과를 사이트에 반영해 줘.`;
    try {
      await navigator.clipboard.writeText(prompt);
      toast("Codex에 붙여 넣으면 학습을 시작할 수 있어요.");
    } catch {
      toast("복사가 안 되면 Codex에서 ‘공부 시작하자’라고 입력하세요.");
    }
  };
}
function sessionMarkup(s) {
  const topic = course.lessons.find((l) => l.id === s.topic);
  return `<article class="session-card" id="session-${esc(s.id)}"><header><div><span class="eyebrow">${esc(s.date)} · ${esc(s.learner)}</span><h2>${esc(topic.title)}</h2></div><span class="pill ${s.status === "completed" ? "green" : ""}">${s.status === "completed" ? "Codex 확인 완료" : "복습 필요"}</span></header><p class="session-summary">${esc(s.summary)}</p>
  <details><summary>학습 과정과 확인 근거 펼치기</summary><h3>처음의 이해</h3><p>${esc(s.initialUnderstanding)}</p>
  ${s.corrections.length ? `<h3>함께 교정한 부분</h3>${s.corrections.map((c) => `<div class="correction"><p><b>처음에는</b> ${esc(c.before)}</p><p><b>다시 설명한 내용</b> ${esc(c.after)}</p><small>${esc(c.evidence)}</small></div>`).join("")}` : ""}
  <h3>목표별 확인</h3><ul>${s.goals.map((g) => `<li><b>${g.verdict === "met" ? "✓" : "↻"} ${esc(g.goal)}</b><p>${esc(g.evidence)}</p></li>`).join("")}</ul>
  <h3>확인 질문</h3>${s.checks.map((c) => `<div class="session-check"><b>${esc(c.question)}</b><p>내 답변 요약: ${esc(c.answer)}</p><p>${esc(c.feedback)}</p><span class="muted small">${c.independent ? "힌트 없이 답변" : "도움받아 답변"} · ${c.passed ? "확인됨" : "다시 설명 필요"}</span></div>`).join("")}
  <h3>직접 확인한 것</h3><p><b>${{ simulation: "모의 실습", dev: "dev 환경 확인", explanation: "설명으로 확인" }[s.exercise.kind]}</b> · ${esc(s.exercise.description)}</p><p>${esc(s.exercise.result)}</p>
  <div class="prose">${s.html}</div>
  ${s.nextReview.length ? `<h3>다시 확인할 질문</h3><ul>${s.nextReview.map((q) => `<li>${esc(q)}</li>`).join("")}</ul>` : ""}
  ${s.connections.length ? `<h3>연결되는 주제</h3><ul>${s.connections.map((c) => `<li><a href="#/lesson/${esc(c.topic)}">${esc(course.lessons.find((l) => l.id === c.topic).title)}</a> — ${esc(c.reason)}</li>`).join("")}</ul>` : ""}
  ${s.sources.length ? `<h3>참고한 자료</h3><ul>${s.sources.map((v) => `<li><a href="${esc(v.url)}" target="_blank" rel="noopener noreferrer">${esc(v.title)}</a></li>`).join("")}</ul>` : ""}</details><a class="inline-link" href="#/lesson/${esc(s.topic)}">주제 자료·실습 보기 →</a></article>`;
}
function sessionsView() {
  const list = [...course.study.sessions].sort(
    (a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id),
  );
  $("#main").innerHTML =
    `<div class="page-heading"><div><span class="eyebrow">WHAT I LEARNED</span><h1>대화하며 쌓은 학습 노트</h1><p>${esc(course.study.learner)}의 이해·교정·확인 질문을 기록합니다. 기기를 바꿔도 같은 정리본을 볼 수 있어요.</p></div></div>${list.length ? `<div class="session-list">${list.map(sessionMarkup).join("")}</div>` : '<section class="empty-state"><h2>아직 대화 학습 기록이 없어요.</h2><p>첫 Study 세션을 마치면 실제 답변을 바탕으로 기록이 생깁니다.<br>브라우저에서 체크한 복습 기록은 이곳의 완료 상태와 별개입니다.</p><a class="button primary" href="#/study">첫 대화 학습 시작하기 →</a></section>'}`;
}
function lesson(id) {
  const l = course.lessons.find((l) => l.id === id);
  if (!l) {
    $("#main").innerHTML =
      '<h1>주제를 찾을 수 없어요.</h1><a href="#/home">홈으로 돌아가기</a>';
    return;
  }
  const i = course.lessons.indexOf(l),
    r = record(id);
  $("#main").innerHTML =
    `<a class="back-link" href="#/home">← 전체 주제</a><div class="lesson-heading"><span class="eyebrow">CHAPTER 01 / ${String(i + 1).padStart(2, "0")} · ${esc(l.category)}</span><h1>${esc(l.title)}</h1><p>${esc(l.lead)}</p><div class="lesson-meta"><span>${icon("clock")}약 ${l.minutes}분</span><span>총총 프로젝트 기반</span>${l.simulation ? "<span>모의 실습 포함</span>" : ""}</div></div>
 <div class="goal-box"><b>이 주제를 마치면</b>${l.goals.map((g) => `<span>✓ ${esc(g)}</span>`).join("")}</div>
 <section class="lesson-study-banner"><div><b>${codexStatus(id)}</b><p>이 자료와 실습을 보며 Codex에서 질문·답변을 이어갈 수 있어요.</p></div><a class="button" href="#/study">Study 시작 방법 →</a></section>
 ${
   course.study.sessions.some((s) => s.topic === id)
     ? `<section class="session-list">${[...course.study.sessions]
         .filter((s) => s.topic === id)
         .sort(
           (a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id),
         )
         .map(sessionMarkup)
         .join("")}</section>`
     : ""
 }
 ${l.simulation ? `<section class="simulation-section" aria-label="모의 실습"><div class="simulation-title"><div><span class="eyebrow">TRY IT YOURSELF</span><h2>직접 움직여 보세요</h2></div><span class="pill">모의 데이터 · AWS 연결 없음</span></div><div id="simulation"></div></section>` : ""}
 <article class="prose">${l.html}</article>
 <section class="quiz-section"><div class="section-heading"><div><span class="eyebrow">RECALL, DON'T JUST READ</span><h2>내 말로 답해 보기</h2><p>답을 펼치기 전에 먼저 설명해 보세요.</p></div></div>${quizMarkup(l)}</section>
 <section class="memo-section"><label for="memo"><b>내가 이해한 말로 한 줄</b><span>헷갈린 점이나 실제 확인 결과를 남겨 보세요.</span></label><textarea id="memo" maxlength="4000" placeholder="예: 수집기가 살아 있어도 전송이 성공했다는 뜻은 아니다.">${esc(r.memo)}</textarea><span class="save-label">${saveFailed ? "저장 실패 · 기록 백업 필요" : "이 브라우저에 자동 저장"}</span></section>
 <section class="stage-section"><b>혼자 복습한 기록</b><p>이 브라우저의 개인 체크입니다. Codex의 완료 판단과는 별개예요. 같은 단계를 다시 누르면 취소됩니다.</p><div class="stage-buttons">${[1, 2, 3].map((s) => `<button data-stage="${s}" aria-pressed="${r.stage >= s}" class="${r.stage >= s ? "checked" : ""}"><span>${r.stage >= s ? "✓" : s}</span>${stages[s]}</button>`).join("")}</div></section>
 <nav class="lesson-pagination" aria-label="이전 다음 주제">${i ? `<a href="#/lesson/${course.lessons[i - 1].id}"><small>이전 주제</small>← ${esc(course.lessons[i - 1].title)}</a>` : "<span></span>"}${i < course.lessons.length - 1 ? `<a href="#/lesson/${course.lessons[i + 1].id}"><small>다음 주제</small>${esc(course.lessons[i + 1].title)} →</a>` : '<a href="#/review"><small>학습 이어가기</small>복습 카드 열기 →</a>'}</nav>`;
  addCopyButtons();
  if (l.simulation)
    simulationCleanup = mountSimulation(l.simulation, $("#simulation"));
  $("#memo").addEventListener("input", (e) => {
    update(id, { memo: e.target.value });
    $(".save-label").textContent = saveFailed
      ? "저장 실패 · 학습 기록에서 백업해 주세요."
      : "이 브라우저에 자동 저장";
  });
}
function mapView() {
  const ranks = new Map();
  const rank = (id) => {
    if (ranks.has(id)) return ranks.get(id);
    const l = course.lessons.find((l) => l.id === id);
    const value = l.requires.length ? 1 + Math.max(...l.requires.map(rank)) : 0;
    ranks.set(id, value);
    return value;
  };
  course.lessons.forEach((l) => rank(l.id));
  const rows = Array.from(
    { length: Math.max(...ranks.values()) + 1 },
    () => [],
  );
  course.lessons.forEach((l) => rows[ranks.get(l.id)].push(l.id));
  const width = Math.max(820, ...rows.map((r) => r.length * 310 + 40)),
    height = rows.length * 145 + 20;
  const positions = Object.fromEntries(
    rows.flatMap((row, i) =>
      row.map((id, j) => [
        id,
        [(width - row.length * 310) / 2 + j * 310 + 15, i * 145 + 20],
      ]),
    ),
  );
  const edges = course.lessons
    .flatMap((l) =>
      l.requires.map((id) => {
        const [x, y] = positions[id],
          [tx, ty] = positions[l.id];
        const sx = x + 140,
          sy = y + 85,
          ex = tx + 140,
          ey = ty;
        return `<path d="M${sx} ${sy} C${sx} ${sy + 45},${ex} ${ey - 45},${ex} ${ey}"/>`;
      }),
    )
    .join("");
  $("#main").innerHTML =
    `<div class="page-heading"><div><span class="eyebrow">CONNECT THE DOTS</span><h1>개념을 연결해 보세요.</h1><p>화살표는 먼저 알면 도움이 되는 주제에서 다음 주제로 이어져요.</p></div></div><section class="map-panel"><div class="map-legend"><span><i></i>학습 주제</span><span>→ 이해가 이어지는 방향</span><span>✓ Codex 확인 완료</span></div><div class="map-scroll"><svg class="knowledge-map" viewBox="0 0 ${width} ${height}" role="group" aria-label="학습 주제의 선행 지식 지도"><defs><marker id="arrowhead" markerWidth="7" markerHeight="7" refX="5" refY="3" orient="auto"><path d="M0 0L6 3L0 6" fill="none" stroke="#adb6ab"/></marker></defs><g class="map-edges" marker-end="url(#arrowhead)">${edges}</g>${course.lessons
      .map((l, i) => {
        const [x, y] = positions[l.id];
        return `<a href="#/lesson/${l.id}" aria-label="${esc(l.title)} 열기"><g class="map-node ${codexDone(l.id) ? "complete" : ""}" transform="translate(${x},${y})"><rect width="280" height="85" rx="13"/><text x="20" y="28" class="map-category">${String(i + 1).padStart(2, "0")} · ${esc(l.category)}</text><text x="20" y="56">${esc(l.title)} ${codexDone(l.id) ? "✓" : ""}</text></g></a>`;
      })
      .join(
        "",
      )}</svg></div></section><section class="learning-note"><span>✦</span><div><b>문제가 생겼을 때도 연결을 따라가세요.</b><p>메트릭으로 시간과 규모를 찾고 → 로그로 요청과 원인을 좁히고 → 알림이 사람에게 닿았는지 확인합니다.</p></div></section>`;
}
let reviewFilter = "all";
function review() {
  const list = course.lessons.filter(
    (l) =>
      reviewFilter === "all" || record(l.id).answers.some((a) => a === false),
  );
  $("#main").innerHTML =
    `<div class="page-heading"><div><span class="eyebrow">A LITTLE RECALL</span><h1>읽었던 것을 꺼내 보세요.</h1><p>정답을 보는 것보다, 먼저 내 말로 설명하는 시간이 중요해요.</p></div></div><div class="filter-tabs"><button data-filter="all" class="${reviewFilter === "all" ? "active" : ""}">전체 질문 <span>${course.lessons.reduce((n, l) => n + l.quiz.length, 0)}</span></button><button data-filter="again" class="${reviewFilter === "again" ? "active" : ""}">다시 볼 질문 <span>${course.lessons.reduce((n, l) => n + record(l.id).answers.filter((a) => a === false).length, 0)}</span></button></div><div class="review-list">${list.length ? list.map((l) => quizMarkup(l, "review", reviewFilter === "again")).join("") : '<div class="empty-state">✓<h2>다시 볼 질문이 아직 없어요.</h2><p>복습하면서 헷갈리는 질문에 ‘다시 볼게요’를 표시해 주세요.</p><button class="button" data-filter="all">전체 질문 보기</button></div>'}</div>`;
}
function route() {
  simulationCleanup?.();
  simulationCleanup = null;
  const [, view = "home", id] = location.hash.split("/");
  currentId = view === "lesson" ? id : null;
  sidebar();
  $("#crumb").textContent = currentId
    ? (course.lessons.find((l) => l.id === id)?.title ?? "학습 주제")
    : ({
        home: "학습 홈",
        study: "Codex와 학습",
        sessions: "학습 노트",
        map: "개념 지도",
        review: "복습 카드",
      }[view] ?? "학습 홈");
  if (view === "lesson") lesson(id);
  else if (view === "study") studyGuide();
  else if (view === "sessions") sessionsView();
  else if (view === "map") mapView();
  else if (view === "review") review();
  else home();
  document.title = `${$("#crumb").textContent} · Project Study`;
  document.body.classList.remove("menu-open");
  $("#menu").setAttribute("aria-expanded", "false");
  window.scrollTo({ top: 0 });
}
function openRecords() {
  const dialog = $("#records-dialog");
  dialog.innerHTML = `<div class="dialog-heading"><div><span class="eyebrow">YOUR LEARNING RECORD</span><h2 id="records-title">개인 복습 기록을 보관하세요.</h2></div><button class="icon-button" id="close-dialog" aria-label="닫기">×</button></div><p>진행 단계, 복습 표시, 내 메모는 <b>이 브라우저에만 저장</b>돼요. 다른 기기에서는 파일로 옮길 수 있어요. Codex의 공개 학습 노트는 별도로 저장소에 보존됩니다.</p><div class="backup-actions"><button class="button primary" id="export">백업 다운로드 ↓</button><label class="button" for="import-file">백업 가져오기 ↑</label><input type="file" id="import-file" accept="application/json,.json" hidden></div><div id="import-preview" role="status"></div><p class="muted small">개인 메모에 비밀번호·토큰·웹훅 주소를 적지 마세요.</p>`;
  dialog.showModal();
  $("#close-dialog").onclick = () => dialog.close();
  $("#export").onclick = () => {
    const blob = new Blob([JSON.stringify(progress, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `project-study-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  $("#import-file").onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      if (file.size > 1024 * 1024)
        throw new Error("파일은 1MB 이하로 선택해 주세요.");
      importCandidate = validateProgress(
        JSON.parse(await file.text()),
        course.lessons,
      );
      $("#import-preview").innerHTML =
        `<p>주제 ${Object.keys(importCandidate.lessons).length}개의 기록을 확인했어요. 적용하면 현재 기록이 바뀝니다.</p><button class="button primary" id="apply-import">이 기록 적용</button>`;
      $("#apply-import").onclick = () => {
        progress = importCandidate;
        try {
          localStorage.setItem(KEY, JSON.stringify(progress));
          saveFailed = false;
        } catch {
          saveFailed = true;
        }
        dialog.close();
        route();
        toast(
          saveFailed
            ? "불러왔지만 브라우저 저장에 실패했어요. 백업 파일을 보관해 주세요."
            : "학습 기록을 가져왔어요.",
        );
      };
    } catch (err) {
      $("#import-preview").textContent = err.message;
    }
    e.target.value = "";
  };
}
document.addEventListener("click", (e) => {
  const stage = e.target.closest("[data-stage]");
  if (stage && currentId) {
    const value = transitionStage(
      record(currentId).stage,
      Number(stage.dataset.stage),
    );
    update(currentId, { stage: value });
    sidebar();
    document.querySelectorAll("[data-stage]").forEach((btn) => {
      const n = Number(btn.dataset.stage);
      btn.classList.toggle("checked", value >= n);
      btn.setAttribute("aria-pressed", String(value >= n));
      btn.querySelector("span").textContent = value >= n ? "✓" : n;
    });
    if (value === 3) toast("이 브라우저의 개인 복습 기록에 표시했어요.");
  }
  const grade = e.target.closest("[data-grade]");
  if (grade) {
    const [id, index, value] = grade.dataset.grade.split(":");
    const answers = [...record(id).answers];
    answers[Number(index)] = value === "true";
    update(id, { answers });
    const reviewCount = document.querySelector('[data-filter="again"] span');
    if (reviewCount)
      reviewCount.textContent = course.lessons.reduce(
        (n, lesson) =>
          n +
          record(lesson.id).answers.filter((answer) => answer === false).length,
        0,
      );
    grade
      .closest(".self-grade")
      .querySelectorAll("button")
      .forEach((btn) => btn.classList.toggle("selected", btn === grade));
    if (location.hash.includes("/review") && reviewFilter === "again") review();
    else {
      const card = grade.closest(".quiz-card");
      card.querySelector(".review-flag")?.remove();
      if (value === "false")
        card.insertAdjacentHTML(
          "beforeend",
          '<span class="review-flag">다시 볼 질문</span>',
        );
    }
  }
  const filter = e.target.closest("[data-filter]");
  if (filter) {
    reviewFilter = filter.dataset.filter;
    review();
  }
});
$("#menu").onclick = () => {
  document.body.classList.toggle("menu-open");
  $("#menu").setAttribute(
    "aria-expanded",
    String(document.body.classList.contains("menu-open")),
  );
};
$("#records").onclick = openRecords;
$(".skip-link").onclick = (event) => {
  event.preventDefault();
  $("#main").focus();
  $("#main").scrollIntoView();
};
addEventListener("hashchange", route);
addEventListener("storage", (e) => {
  if (e.key === KEY) {
    try {
      progress = e.newValue
        ? validateProgress(JSON.parse(e.newValue), course.lessons)
        : emptyProgress();
      route();
      toast("다른 탭의 기록을 반영했어요.");
    } catch {
      toast("다른 탭의 기록을 읽지 못했어요.");
    }
  }
});
try {
  const response = await fetch("/data.json");
  if (!response.ok) throw new Error("학습 데이터 로딩 실패");
  course = await response.json();
  course.study ??= { learner: "JYL35", sessions: [] };
  let storageWarning = false;
  try {
    const saved = localStorage.getItem(KEY);
    if (saved) progress = validateProgress(JSON.parse(saved), course.lessons);
  } catch {
    storageWarning = true;
  }
  route();
  if (storageWarning)
    toast(
      "저장된 기록을 읽지 못했어요. 학습 기록 메뉴에서 백업을 가져올 수 있어요.",
    );
} catch (err) {
  $("#main").innerHTML =
    `<div class="empty-state"><h1>학습 공간을 열지 못했어요.</h1><p>${esc(err.message)}</p><button class="button" onclick="location.reload()">다시 불러오기</button></div>`;
}
