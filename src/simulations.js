import { statistics } from "./domain.js";
const esc = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const button = (id, label, active = false) =>
  `<button data-sim="${id}" class="sim-button ${active ? "active" : ""}">${label}</button>`;
const metric = (name, value, unit = "") =>
  `<div class="metric"><span>${name}</span><strong>${value}<small>${unit}</small></strong></div>`;

export function mountSimulation(type, root) {
  const state = {
    requests: 0,
    collector: true,
    scrapes: 0,
    baseline: null,
    total: 100,
    delta: null,
    preset: "normal",
    env: "dev",
    errors: 0,
    step: 0,
    broken: false,
    case: 0,
    choice: null,
    log: 0,
  };
  const sampleLogs = [
    {
      id: "req-demo-001",
      method: "GET",
      route: "/api/studies/me",
      status: 200,
      ms: 18,
      error: "-",
      level: "INFO",
    },
    {
      id: "req-demo-002",
      method: "GET",
      route: "/api/notifications",
      status: 401,
      ms: 3,
      error: "UNAUTHORIZED",
      level: "INFO",
    },
    {
      id: "req-demo-003",
      method: "POST",
      route: "/api/studies/{studyId}/notices",
      status: 500,
      ms: 126,
      error: "INTERNAL_SERVER_ERROR",
      level: "ERROR",
    },
  ];
  const cases = [
    {
      title: "로그는 도착하는데 요청 메트릭이 끊겼다",
      context:
        "dev 사이트는 정상. 마지막 요청 그래프는 20분 전이고 최근 요청 로그는 도착한다.",
      options: [
        "백엔드를 바로 재시작한다",
        "ADOT 상태와 오류 로그를 확인한다",
        "Discord 역할 설정을 바꾼다",
      ],
      answer: 1,
      why: "로그와 메트릭은 전송 경로가 다르다. 메트릭 경로의 ADOT 실행·수집·전송부터 확인한다. 서비스가 정상인 상황에서 백엔드 재시작은 첫 진단 근거가 되지 않는다.",
    },
    {
      title: "경보는 ALARM인데 Discord가 조용하다",
      context:
        "CloudWatch 기록에 실제 ALARM 전이가 있다. Query Studio에도 해당 시간대 5xx가 보인다.",
      options: [
        "SNS 작업·구독, Lambda 실행 로그를 본다",
        "p95 쿼리만 다시 작성한다",
        "트래픽을 더 크게 만든다",
      ],
      answer: 0,
      why: "경보 판단은 확인됐다. 경보 작업 실행 → SNS 구독 → Lambda 오류/HTTP 응답 → Discord 순서로 전달 경로를 좁힌다.",
    },
    {
      title: "5xx 경보가 정상인데 사이트가 안 열린다",
      context: "5xx 그래프가 비어 있고 전체 요청 메트릭도 최근 데이터가 없다.",
      options: [
        "5xx가 0이므로 기다린다",
        "서비스·컨테이너 상태와 데이터 최신성을 확인한다",
        "경보 임계값을 더 낮춘다",
      ],
      answer: 1,
      why: "요청 자체를 처리하지 못하거나 수집이 멈췄을 수 있다. 사이트 영향과 Nginx·백엔드·EC2 상태를 우선 확인하고 수집 경로도 별도로 본다.",
    },
    {
      title: "Query Studio에는 데이터가 있는데 대시보드가 비었다",
      context:
        'environment="dev" 조회는 성공한다. 대시보드는 prod 화면을 보고 있었다.',
      options: [
        "ADOT 메모리 제한을 늘린다",
        "대시보드의 환경 필터·시간 범위를 확인한다",
        "SNS 구독을 새로 만든다",
      ],
      answer: 1,
      why: "수집과 저장은 이미 확인됐다. 데이터를 표시하는 화면의 환경·리전·쿼리·시간 범위부터 맞춘다.",
    },
  ];
  function pipeline() {
    const sent = state.requests > 0;
    const node = (title, sub, on, tone = "") =>
      `<div class="flow-node ${on ? "lit" : ""} ${tone}"><span class="flow-light"></span><b>${title}</b><small>${sub}</small></div>`;
    root.innerHTML = `<p class="sim-intro">요청은 두 경로로 나뉩니다. 수집기를 꺼도 로그 경로는 계속 동작할까요?</p><div class="sim-controls">${button("request", "요청 보내기 +1")}${button("collect", "60초 수집하기")}<label class="switch-label"><input type="checkbox" data-sim="collector" ${state.collector ? "checked" : ""}>ADOT 실행</label></div><div class="pipeline-visual"><div class="flow-center">${node("Spring Boot", `${state.requests}건 요청 처리`, sent)}</div><div class="flow-branch"><span>↙ 요청 기록</span><span>요청 계측 ↘</span></div><div class="flow-columns"><div>${node("Docker awslogs", "JSON 로그 전송", sent)}<div class="flow-arrow">↓</div>${node("CloudWatch Logs", sent ? `${state.requests}건의 요청 기록` : "아직 요청 없음", sent)}</div><div>${node("ADOT 수집기", state.collector ? "60초마다 읽기" : "수집 중지", state.collector && state.scrapes > 0, state.collector ? "" : "off")}<div class="flow-arrow">↓</div>${node("CloudWatch OTel", state.scrapes ? `${state.scrapes}회 수집` : "아직 수집 안 함", state.scrapes > 0)}</div></div></div><div class="sim-feedback" role="status">${!state.collector ? "수집기가 멈춰도 로그는 Docker awslogs로 전달됩니다. 메트릭은 새로 전송되지 않습니다." : state.scrapes ? "메트릭 수집 경로를 진행했어요. 실제 전송 성공은 CloudWatch의 최신 데이터로 확인합니다." : "요청을 보내고, 수집 버튼을 눌러 두 경로를 비교해 보세요."}</div>`;
  }
  function logs() {
    const l = sampleLogs[state.log];
    root.innerHTML = `<p class="sim-intro">응답에서 받은 ID를 골라 보세요. 같은 ID가 요청을 찾는 열쇠입니다.</p><div class="sim-controls">${sampleLogs.map((s, i) => button(`log-${i}`, `${s.status} 응답 · ${s.id}`, state.log === i)).join("")}</div><div class="log-response"><span>응답 헤더</span><code>X-Request-Id: <b>${l.id}</b></code></div><div class="log-code"><span class="terminal-dot"></span><span class="terminal-title">CloudWatch Logs · 모의 요청 기록</span><pre>${esc(JSON.stringify({ request_id: l.id, level: l.level, method: l.method, route: l.route, status: l.status, duration_ms: l.ms, error_code: l.error }, null, 2))}</pre></div><div class="log-annotation"><span><b>${l.status}</b> HTTP 상태</span><span><b>${l.ms}ms</b> 처리 시간</span><span><b>${l.status >= 500 ? "오류 원인 조사" : l.status === 401 ? "인증 상태 확인" : "정상 요청"}</b> 다음 행동</span></div><div class="sim-feedback">${l.status === 401 ? "401은 미인증 요청일 수 있습니다. 상태 코드만으로 서버 장애라고 판단하지 않아요." : l.status >= 500 ? "같은 request_id의 예외 로그와 error_code를 읽고 원인을 좁힙니다." : "정상 요청의 INFO 로그도 도착하는지 확인하면 로그 경로가 살아 있는지 알 수 있어요."}</div>`;
  }
  function scrape() {
    root.innerHTML = `<p class="sim-intro">처음 읽은 누적값은 기준값입니다. 요청을 추가한 뒤 다시 수집해 증가분을 보세요.</p><div class="sim-controls">${button("add8", "요청 8건 추가")}${button("scrape", "60초 수집하기")}${button("scrape-reset", "처음부터")}</div><div class="scrape-grid">${metric("백엔드 누적 요청 수", state.total, "건")}<div class="scrape-arrow">→<small>cumulative<br>to delta</small></div>${metric("이번 전송 증가분", state.delta === null ? "—" : state.delta, "건")}</div><div class="scrape-timeline">${Array.from({ length: Math.min(state.scrapes, 8) }, (_, i) => `<span class="${i === 0 ? "baseline" : ""}">${i === 0 ? "기준값" : `${i}회 이후 수집`}</span>`).join("<i>→</i>") || "<span>아직 수집하지 않았어요</span>"}</div><div class="sim-feedback" role="status">${state.baseline === null ? "먼저 수집해서 기준값을 잡아 보세요." : state.delta === null ? `첫 누적값 ${state.baseline}건은 기준값으로 잡았습니다. 요청을 추가하고 다시 수집해 보세요.` : `직전 ${state.baseline - state.delta}건 → 현재 ${state.total}건. 증가분 ${state.delta}건을 전송하는 개념입니다. 실제 구성에서는 히스토그램을 변환합니다.`}</div>`;
  }
  function distribution() {
    const sets = {
      normal: Array.from({ length: 20 }, (_, i) => ({
        ms: 12 + (i % 5) * 4,
        status: 200,
      })),
      tail: [
        ...Array.from({ length: 18 }, (_, i) => ({
          ms: 12 + (i % 5) * 4,
          status: 200,
        })),
        { ms: 800, status: 200 },
        { ms: 1200, status: 500 },
      ],
      single: [{ ms: 20, status: 500 }],
      empty: [],
    };
    const samples = sets[state.preset],
      s = statistics(samples);
    const buckets = [30, 100, 500, 1000, Infinity],
      counts = buckets.map(
        (max, i) =>
          samples.filter((x) => x.ms > (i ? buckets[i - 1] : -1) && x.ms <= max)
            .length,
      );
    const max = Math.max(1, ...counts);
    root.innerHTML = `<p class="sim-intro">같은 요청 수라도 느린 꼬리가 다르면 p95가 달라집니다. 비율과 건수도 함께 보세요.</p><div class="sim-controls">${button("preset-normal", "빠른 요청 20건", state.preset === "normal")}${button("preset-tail", "느린 요청 섞기", state.preset === "tail")}${button("preset-single", "1건 중 1건 실패", state.preset === "single")}${button("preset-empty", "요청 없음", state.preset === "empty")}</div><div class="metrics-grid">${metric("요청 수", s.count, "건")}${metric("5xx 오류율", s.errorRate === null ? "—" : s.errorRate.toFixed(0), "%")}${metric("평균", s.mean === null ? "—" : s.mean.toFixed(0), "ms")}${metric("p95", s.p95 === null ? "—" : s.p95, "ms")}</div><div class="histogram"><div class="chart-title">응답 시간 분포 <span>표본을 구간별로 세기</span></div><div class="histogram-bars">${counts.map((n, i) => `<div class="histogram-column"><span>${n}건</span><div class="bar-space"><i style="height:${(n / max) * 100}%;min-height:${n ? 4 : 0}px" class="${i > 2 ? "slow" : ""}"></i></div><small>${["≤30", "30–100", "100–500", "500–1000", ">1000"][i]} ms</small></div>`).join("")}</div></div><div class="sim-feedback" role="status">${state.preset === "tail" ? "평균만 보면 느린 일부 요청을 놓칠 수 있어요. p95와 원인 로그를 함께 봅니다." : state.preset === "empty" ? "분모가 없으므로 오류율도 p95도 계산할 수 없어요. 정상 0%로 채우지 않습니다." : state.preset === "single" ? "오류율은 100%지만 요청은 1건입니다. 영향은 건수·사용자·지속 시간과 함께 판단해요." : "모든 요청이 빠르면 평균과 p95도 비슷해집니다. 느린 요청을 섞어 보세요."}</div><p class="sim-footnote">실습 p95는 원본 표본을 정렬한 경계값입니다. CloudWatch 히스토그램의 추정값과는 차이가 있어요.</p>`;
  }
  function alarm() {
    const labels = [
      "5xx 관측",
      "CloudWatch 평가",
      "SNS 발행",
      "Lambda 전송",
      "Discord 도착",
    ];
    root.innerHTML = `<p class="sim-intro">5xx를 추가하고 단계를 따라가세요. 경보 판단과 메시지 전달은 다른 단계입니다.</p><div class="sim-controls">${button("env-dev", "dev", state.env === "dev")}${button("env-prod", "prod", state.env === "prod")}${button("error", "5xx 1건 추가")}${button("alarm-next", "다음 단계 →")}${button("alarm-reset", "처음부터")}</div><div class="alarm-steps">${labels.map((label, i) => `<div class="${state.step > i ? "complete" : ""} ${state.step === i ? "current" : ""}"><span>${state.step > i ? "✓" : i + 1}</span><small>${label}</small></div>`).join("")}</div><label class="switch-label failure-switch"><input type="checkbox" data-sim="broken" ${state.broken ? "checked" : ""}>Lambda → Discord 전송 실패 상황</label><div class="discord-demo"><div class="discord-avatar">✦</div><div><b>project-monitoring <span>모의 메시지</span></b>${state.step >= 5 ? `<p>${state.env === "prod" ? '<strong class="mention">@backend 역할 멘션</strong><br>' : ""}[총총 CloudWatch 알림]<br>경보: chongchong-${state.env}-http-5xx<br>상태: ALARM<br>사유: 수집 구간 5xx ${state.errors}건</p>` : '<p class="muted">아직 도착한 메시지가 없어요.</p>'}</div></div><div class="sim-feedback" role="status">${state.step === 0 ? `이번 구간 5xx ${state.errors}건. ${state.errors ? "다음 단계에서 평가해 보세요." : "5xx가 없으면 경보 조건을 만족하지 않습니다."}` : state.step === 1 ? "CloudWatch가 1분 간격으로 조건을 평가합니다. 보류 0초이므로 조건 만족 시 ALARM 대상이 됩니다." : state.step === 2 ? "경보가 ALARM으로 전이됐습니다. 설정된 SNS 작업이 메시지를 발행합니다." : state.step === 3 ? "SNS chongchong-alerts가 구독된 Lambda를 호출하는 경로입니다." : state.step === 4 ? (state.broken ? "여기서 전송이 실패했어요. 경보는 ALARM이어도 Discord는 조용할 수 있습니다. Lambda 오류 로그를 봅니다." : "Lambda가 메시지를 만들고 Discord 웹훅으로 POST합니다. 다음 단계에서 수신을 확인하세요.") : `${state.env === "prod" ? "prod ALARM이므로 지정 역할을 멘션합니다." : "dev도 전송하지만 제공된 코드에서는 역할 멘션을 붙이지 않습니다."} 실제 검증에는 각 단계의 실행 기록이 필요해요.`}</div>`;
  }
  function diagnosis() {
    const c = cases[state.case];
    root.innerHTML = `<div class="sim-controls">${cases.map((_, i) => button(`case-${i}`, `상황 ${i + 1}`, state.case === i)).join("")}</div><div class="case-box"><span class="eyebrow">WHAT WOULD YOU CHECK FIRST?</span><h3>${c.title}</h3><p>${c.context}</p></div><div class="case-choices">${c.options.map((o, i) => `<button data-sim="choice-${i}" class="${state.choice === i ? (i === c.answer ? "correct" : "incorrect") : ""}"><span>${String.fromCharCode(65 + i)}</span>${o}${state.choice === i ? (i === c.answer ? " ✓" : " ↻") : ""}</button>`).join("")}</div>${state.choice !== null ? `<div class="sim-feedback ${state.choice === c.answer ? "success" : ""}" role="status"><b>${state.choice === c.answer ? "좋은 출발점이에요." : "다른 확인 지점부터 생각해 보세요."}</b><br>${c.why}</div>` : '<p class="sim-footnote">정답을 외우기보다, 이미 확인된 단계와 아직 모르는 단계를 구분해 보세요.</p>'}`;
  }
  const render = () =>
    (
      ({ pipeline, logs, scrape, distribution, alarm, diagnosis })[type] ??
      pipeline
    )();
  const click = (e) => {
    const el = e.target.closest("[data-sim]");
    if (!el || !root.contains(el)) return;
    const id = el.dataset.sim;
    if (el.type === "checkbox") return;
    if (id === "request") state.requests++;
    if (id === "collect" && state.collector && state.requests) state.scrapes++;
    if (id === "add8") state.total += 8;
    if (id === "scrape") {
      state.delta =
        state.baseline === null ? null : state.total - state.baseline;
      state.baseline = state.total;
      state.scrapes++;
    }
    if (id === "scrape-reset") {
      state.total = 100;
      state.baseline = null;
      state.delta = null;
      state.scrapes = 0;
    }
    if (id.startsWith("log-")) state.log = Number(id.slice(4));
    if (id.startsWith("preset-")) state.preset = id.slice(7);
    if (id.startsWith("env-")) {
      state.env = id.slice(4);
      state.step = 0;
    }
    if (id === "error") {
      state.errors++;
      state.step = 0;
    }
    if (id === "alarm-reset") {
      state.errors = 0;
      state.step = 0;
      state.broken = false;
    }
    if (
      id === "alarm-next" &&
      state.errors > 0 &&
      state.step < 5 &&
      !(state.broken && state.step === 4)
    )
      state.step++;
    if (id.startsWith("case-")) {
      state.case = Number(id.slice(5));
      state.choice = null;
    }
    if (id.startsWith("choice-")) state.choice = Number(id.slice(7));
    render();
  };
  const change = (e) => {
    const el = e.target.closest("[data-sim]");
    if (el?.dataset.sim === "collector") state.collector = el.checked;
    if (el?.dataset.sim === "broken") {
      state.broken = el.checked;
      if (state.broken && state.step >= 5) state.step = 4;
    }
    render();
  };
  root.addEventListener("click", click);
  root.addEventListener("change", change);
  render();
  return () => {
    root.removeEventListener("click", click);
    root.removeEventListener("change", change);
  };
}
