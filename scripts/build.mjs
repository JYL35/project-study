import { readFile, writeFile, mkdir, cp, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { marked } from "marked";
import { loadStudy } from "./lib/study.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const curriculum = JSON.parse(
  await readFile(resolve(root, "content/curriculum.json"), "utf8"),
);
const ids = new Set(curriculum.lessons.map((l) => l.id));
if (ids.size !== curriculum.lessons.length)
  throw new Error("중복된 주제 ID가 있습니다.");
const visited = new Set(),
  visiting = new Set();
function visit(id) {
  if (visiting.has(id)) throw new Error("주제 연결에 순환이 있습니다.");
  if (visited.has(id)) return;
  visiting.add(id);
  const lesson = curriculum.lessons.find((l) => l.id === id);
  if (!Array.isArray(lesson?.requires))
    throw new Error(`${id}: requires 배열 필요`);
  for (const parent of lesson.requires) {
    if (!ids.has(parent)) throw new Error(`${id}: 없는 선행 주제 ${parent}`);
    visit(parent);
  }
  visiting.delete(id);
  visited.add(id);
}
for (const id of ids) visit(id);
const renderer = new marked.Renderer();
renderer.html = ({ text }) =>
  text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
const lessons = [];
for (const lesson of curriculum.lessons) {
  if (!/^[a-z][a-z0-9-]*$/.test(lesson.id))
    throw new Error("올바르지 않은 주제 ID");
  if (
    !lesson.title ||
    !Array.isArray(lesson.goals) ||
    !lesson.goals.length ||
    !Array.isArray(lesson.quiz) ||
    lesson.quiz.length < 2
  )
    throw new Error(`${lesson.id}: 목표와 질문 2개 이상 필요`);
  if (lesson.requires.some((id) => !ids.has(id) || id === lesson.id))
    throw new Error(`${lesson.id}: 연결된 주제 확인 필요`);
  const body = await readFile(
    resolve(root, `content/monitoring/${lesson.id}.md`),
    "utf8",
  );
  if (!body.includes("## 직접 확인") && lesson.id !== "diagnosis")
    throw new Error(`${lesson.id}: 실습 필요`);
  for (const q of lesson.quiz)
    if (!q.q || !q.a) throw new Error(`${lesson.id}: 빈 질문/답변`);
  const tutor = JSON.parse(
    await readFile(resolve(root, `content/tutoring/${lesson.id}.json`), "utf8"),
  );
  if (
    !tutor.opening ||
    !Array.isArray(tutor.exitQuestions) ||
    tutor.exitQuestions.length < 2 ||
    !Array.isArray(tutor.rubric) ||
    tutor.rubric.length !== lesson.goals.length ||
    !tutor.exercise?.route ||
    !Array.isArray(tutor.misconceptions)
  )
    throw new Error(
      `${lesson.id}: 튜터 진단·확인 질문·목표 기준이 필요합니다.`,
    );
  lessons.push({
    ...lesson,
    body,
    html: await marked.parse(body, { renderer }),
  });
}
const { profile, sessions } = await loadStudy(root);
// 노트의 HTML·위험한 링크는 실행하지 않는다. 학습 데이터도 공개 콘텐츠다.
const noteRenderer = new marked.Renderer();
noteRenderer.html = renderer.html;
const escapeHtml = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
noteRenderer.link = function ({ href, tokens }) {
  const label = this.parser.parseInline(tokens);
  return /^https:\/\//.test(href)
    ? `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${label}</a>`
    : label;
};
noteRenderer.image = ({ text }) => escapeHtml(text);
const study = {
  learner: profile.learner,
  sessions: await Promise.all(
    sessions.map(async (s) => ({
      ...s,
      html: await marked.parse(s.note, { renderer: noteRenderer }),
    })),
  ),
};
if (process.argv.includes("--check")) {
  console.log(
    `검증 완료: 주제 ${lessons.length}개 · 복습 질문 ${lessons.reduce((n, l) => n + l.quiz.length, 0)}개 · 연결 유효`,
  );
} else {
  const out = resolve(root, "dist");
  await rm(out, { recursive: true, force: true });
  await mkdir(out, { recursive: true });
  await cp(resolve(root, "src"), out, { recursive: true });
  await writeFile(
    resolve(out, "data.json"),
    JSON.stringify({ ...curriculum, lessons, study }),
  );
  console.log(`빌드 완료: dist/ · 주제 ${lessons.length}개`);
}
