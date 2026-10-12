import { readFile, readdir, mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const root = fileURLToPath(new URL("../../", import.meta.url));
const safeId = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,79}$/;
function text(value, name, max = 4000) {
  if (typeof value !== "string" || !value.trim() || value.length > max)
    throw new Error(
      `${name}: 비어 있지 않은 ${max}자 이하 문자열이 필요합니다.`,
    );
}
function array(value, name, max = 20) {
  if (!Array.isArray(value) || value.length > max)
    throw new Error(`${name}: ${max}개 이하 배열이 필요합니다.`);
}
export function validateSession(s, course, learner) {
  if (!s || s.version !== 1 || !safeId.test(s.id ?? ""))
    throw new Error("학습 기록 version/id 확인이 필요합니다.");
  if (s.learner !== learner)
    throw new Error("학습자와 기록의 learner가 다릅니다.");
  const lesson = course.lessons.find((l) => l.id === s.topic);
  if (!lesson) throw new Error("없는 학습 주제입니다.");
  if (!["completed", "review-needed"].includes(s.status))
    throw new Error("status는 completed 또는 review-needed여야 합니다.");
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(s.date ?? "") ||
    Number.isNaN(Date.parse(s.date)) ||
    new Date(s.date).toISOString().slice(0, 10) !== s.date
  )
    throw new Error("실제 학습 날짜(YYYY-MM-DD)가 필요합니다.");
  for (const key of ["summary", "initialUnderstanding"]) text(s[key], key);
  text(s.note, "note", 12000);
  array(s.goals, "goals");
  if (
    s.goals.length !== lesson.goals.length ||
    new Set(s.goals.map((g) => g.goal)).size !== lesson.goals.length
  )
    throw new Error("모든 학습 목표를 중복 없이 평가해야 합니다.");
  for (const g of s.goals) {
    if (
      !lesson.goals.includes(g.goal) ||
      !["met", "review"].includes(g.verdict)
    )
      throw new Error("목표 또는 목표 평가 값이 올바르지 않습니다.");
    text(g.evidence, "목표 판단 근거");
  }
  array(s.checks, "checks");
  for (const c of s.checks) {
    for (const key of ["question", "answer", "feedback"])
      text(c[key], `checks.${key}`);
    if (typeof c.independent !== "boolean" || typeof c.passed !== "boolean")
      throw new Error("확인 질문의 독립 답변 여부와 통과 여부가 필요합니다.");
  }
  array(s.corrections, "corrections");
  for (const c of s.corrections)
    for (const key of ["before", "after", "evidence"])
      text(c[key], `corrections.${key}`);
  if (!["simulation", "dev", "explanation"].includes(s.exercise?.kind))
    throw new Error(
      "실습 종류를 simulation/dev/explanation으로 구분해야 합니다.",
    );
  text(s.exercise.description, "실습 설명");
  text(s.exercise.result, "실제로 확인한 결과");
  array(s.nextReview, "nextReview");
  s.nextReview.forEach((v) => text(v, "복습할 내용"));
  array(s.connections, "connections");
  for (const c of s.connections) {
    if (c.topic === s.topic || !course.lessons.some((l) => l.id === c.topic))
      throw new Error("연결할 주제가 없거나 자기 자신입니다.");
    text(c.reason, "연결 이유");
  }
  array(s.sources, "sources");
  for (const source of s.sources) {
    text(source.title, "출처 제목");
    if (!/^https:\/\//.test(source.url ?? ""))
      throw new Error("출처는 HTTPS URL이어야 합니다.");
    new URL(source.url);
  }
  if (
    s.status === "completed" &&
    (s.goals.some((g) => g.verdict !== "met") ||
      s.checks.filter((c) => c.independent && c.passed).length < 2)
  )
    throw new Error(
      "완료에는 모든 목표 충족과 힌트 없는 확인 답변 2개 이상이 필요합니다.",
    );
  if (s.status === "review-needed" && !s.nextReview.length)
    throw new Error(
      "복습이 필요하면 nextReview에 확인할 내용을 남겨야 합니다.",
    );
  return s;
}

export async function loadStudy(base = root) {
  const [course, profile] = await Promise.all([
    readFile(resolve(base, "content/curriculum.json"), "utf8").then(JSON.parse),
    readFile(resolve(base, "learning/profile.json"), "utf8").then(JSON.parse),
  ]);
  if (!safeId.test(profile.learner ?? ""))
    throw new Error("학습자 ID가 올바르지 않습니다.");
  const dir = resolve(base, "learning", profile.learner);
  const files = await readdir(dir).catch((e) => {
    if (e.code === "ENOENT") return [];
    throw e;
  });
  const sessions = [];
  for (const file of files.sort()) {
    if (!file.endsWith(".json")) continue;
    const s = validateSession(
      JSON.parse(await readFile(resolve(dir, file), "utf8")),
      course,
      profile.learner,
    );
    if (file !== `${s.id}.json`)
      throw new Error(`${file}: 파일명과 기록 id가 다릅니다.`);
    if (sessions.some((item) => item.id === s.id))
      throw new Error("중복된 학습 기록입니다.");
    sessions.push(s);
  }
  return { course, profile, sessions };
}
export function latestSessions(sessions) {
  const latest = {};
  for (const session of [...sessions].sort(
    (a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id),
  ))
    latest[session.topic] = session;
  return latest;
}
export function selectNext(course, sessions, checkpoint) {
  const latest = latestSessions(sessions);
  const available = (l) =>
    l.requires.every((id) => latest[id]?.status === "completed");
  if (checkpoint && !sessions.some((s) => s.id === checkpoint.id)) {
    const current = course.lessons.find((l) => l.id === checkpoint.topic);
    if (current && available(current)) return current;
  }
  return (
    course.lessons.find(
      (l) => available(l) && latest[l.id]?.status === "review-needed",
    ) ??
    course.lessons.find(
      (l) => available(l) && latest[l.id]?.status !== "completed",
    ) ??
    null
  );
}
export async function saveSession(session, base = root) {
  const { course, profile } = await loadStudy(base);
  validateSession(session, course, profile.learner);
  const dir = resolve(base, "learning", profile.learner);
  await mkdir(dir, { recursive: true });
  const path = resolve(dir, `${session.id}.json`);
  const data = JSON.stringify(session, null, 2) + "\n";
  try {
    await writeFile(path, data, { flag: "wx" });
  } catch (e) {
    if (e.code !== "EEXIST") throw e;
    if ((await readFile(path, "utf8")) !== data)
      throw new Error(
        "같은 id의 기록이 있습니다. 기존 기록을 바꾸지 않고 새 id로 저장하세요.",
      );
  }
  return path;
}
