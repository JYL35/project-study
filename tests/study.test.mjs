import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdtemp,
  mkdir,
  writeFile,
  readFile,
  rm,
  cp,
  symlink,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import {
  root,
  validateSession,
  selectNext,
  saveSession,
  loadStudy,
} from "../scripts/lib/study.mjs";

const course = {
  lessons: [
    { id: "overview", goals: ["역할"], requires: [] },
    { id: "metrics", goals: ["수집"], requires: ["overview"] },
    { id: "reading", goals: ["해석"], requires: ["metrics"] },
  ],
};
function sample(topic = "overview", status = "completed") {
  return {
    version: 1,
    id: `${topic}-20261012-120000`,
    learner: "JYL35",
    topic,
    date: "2026-10-12",
    status,
    summary: "테스트 전용 학습 요약",
    initialUnderstanding: "테스트에서 만든 초기 이해",
    goals: course.lessons
      .find((l) => l.id === topic)
      .goals.map((goal) => ({
        goal,
        verdict: "met",
        evidence: "실제 답변을 대조한 판단 근거라는 테스트 값",
      })),
    checks: [
      {
        question: "첫 질문",
        answer: "첫 답변",
        feedback: "첫 확인",
        independent: true,
        passed: true,
      },
      {
        question: "새 상황 질문",
        answer: "새 상황 답변",
        feedback: "전이 확인",
        independent: true,
        passed: true,
      },
    ],
    corrections: [],
    exercise: {
      kind: "simulation",
      description: "가상 실습",
      result: "테스트 결과",
    },
    nextReview: status === "completed" ? [] : ["다시 확인할 부분"],
    connections: [],
    note: "## 배운 내용\n테스트 전용 기록",
    sources: [],
  };
}
test("힌트 받은 답변만으로는 완료 기록을 만들 수 없다", () => {
  const s = sample();
  s.checks[1].independent = false;
  assert.throws(() => validateSession(s, course, "JYL35"), /힌트 없는/);
  s.status = "review-needed";
  s.nextReview = ["다른 상황을 설명하기"];
  assert.equal(validateSession(s, course, "JYL35").status, "review-needed");
  s.goals[0].verdict = "review";
  s.status = "completed";
  assert.throws(() => validateSession(s, course, "JYL35"));
});
test("복습을 우선하고 선행 주제·중간 저장을 반영한다", () => {
  assert.equal(selectNext(course, []).id, "overview");
  assert.equal(
    selectNext(course, [], { topic: "reading", id: "open" }).id,
    "overview",
  );
  const done = sample();
  assert.equal(selectNext(course, [done]).id, "metrics");
  const review = sample("metrics", "review-needed");
  assert.equal(selectNext(course, [done, review]).id, "metrics");
  assert.equal(
    selectNext(course, [done], { topic: "metrics", id: "resume" }).id,
    "metrics",
  );
  assert.equal(
    selectNext(course, [done, sample("metrics"), sample("reading")]),
    null,
  );
});
test("다른 학습자·잘못된 주제·목표 누락·경로를 거부한다", () => {
  for (const patch of [
    { learner: "other" },
    { topic: "other" },
    { id: "../escape" },
    { date: "2026-02-30" },
    { goals: [] },
  ])
    assert.throws(() =>
      validateSession({ ...sample(), ...patch }, course, "JYL35"),
    );
});
test("기록을 재조회하고 동일 저장은 허용하되 다른 내용의 덮어쓰기는 거부한다", async () => {
  const base = await mkdtemp(resolve(tmpdir(), "study-record-test-"));
  try {
    await mkdir(resolve(base, "content"));
    await mkdir(resolve(base, "learning"));
    await writeFile(
      resolve(base, "content/curriculum.json"),
      JSON.stringify(course),
    );
    await writeFile(
      resolve(base, "learning/profile.json"),
      JSON.stringify({ learner: "JYL35" }),
    );
    const path = await saveSession(sample(), base);
    assert.equal(await saveSession(sample(), base), path);
    await assert.rejects(
      saveSession({ ...sample(), summary: "다른 내용" }, base),
      /새 id/,
    );
    const { sessions } = await loadStudy(base);
    assert.equal(sessions.length, 1);
    assert.equal(selectNext(course, sessions).id, "metrics");
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});
test("기록 저장→context→사이트 빌드 연결과 노트 HTML 안전성을 격리된 폴더에서 확인한다", async () => {
  const base = await mkdtemp(resolve(tmpdir(), "study-build-test-"));
  try {
    for (const dir of ["scripts", "content", "src", "learning"])
      await cp(resolve(root, dir), resolve(base, dir), { recursive: true });
    await writeFile(resolve(base, "package.json"), '{"type":"module"}');
    await symlink(resolve(root, "node_modules"), resolve(base, "node_modules"));
    const realCourse = JSON.parse(
      await readFile(resolve(base, "content/curriculum.json"), "utf8"),
    );
    const s = sample();
    s.goals = realCourse.lessons[0].goals.map((goal) => ({
      goal,
      verdict: "met",
      evidence: "통합 테스트 판단 근거",
    }));
    s.note =
      "## 배운 내용\n<script>alert(1)</script>\n[위험](javascript:alert%281%29)\n[출처](https://example.com)";
    await saveSession(s, base);
    const result = spawnSync(
      process.execPath,
      ["scripts/context.mjs", "JYL35"],
      { cwd: base, encoding: "utf8" },
    );
    assert.equal(result.status, 0, result.stderr);
    assert.equal(JSON.parse(result.stdout).next.id, "logging");
    const build = spawnSync(process.execPath, ["scripts/build.mjs"], {
      cwd: base,
      encoding: "utf8",
    });
    assert.equal(build.status, 0, build.stderr);
    const data = JSON.parse(
      await readFile(resolve(base, "dist/data.json"), "utf8"),
    );
    assert.equal(data.study.sessions[0].id, s.id);
    assert.equal(data.study.learner, "JYL35");
    assert.ok(!data.study.sessions[0].html.includes("<script>"));
    assert.ok(!data.study.sessions[0].html.includes('href="javascript:'));
    assert.ok(
      data.study.sessions[0].html.includes('href="https://example.com"'),
    );
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});
