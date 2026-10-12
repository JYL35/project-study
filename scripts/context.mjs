import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { loadStudy, latestSessions, selectNext, root } from "./lib/study.mjs";

const { course, profile, sessions } = await loadStudy();
const me = process.argv[2];
if (me !== profile.learner)
  throw new Error(
    `사용법: npm run context -- ${profile.learner} (현재 개인 학습자)`,
  );
let checkpoint = null;
try {
  checkpoint = JSON.parse(
    await readFile(resolve(root, `.study/${me}/session.json`), "utf8"),
  );
  if (
    checkpoint.learner !== me ||
    !course.lessons.some((l) => l.id === checkpoint.topic)
  )
    throw new Error("학습 중간 기록의 학습자/주제를 확인하세요.");
  if (sessions.some((s) => s.id === checkpoint.id)) checkpoint = null;
} catch (e) {
  if (e.code !== "ENOENT") throw e;
}
const latest = latestSessions(sessions);
const next = selectNext(course, sessions, checkpoint);
console.log(
  JSON.stringify(
    {
      me,
      source: "repository",
      site: profile.site,
      next: next
        ? {
            ...next,
            skill: ".agents/skills/study/SKILL.md",
            material: `content/monitoring/${next.id}.md`,
            tutor: `content/tutoring/${next.id}.json`,
          }
        : null,
      progress: {
        completed: Object.values(latest).filter((s) => s.status === "completed")
          .length,
        total: course.lessons.length,
      },
      resume: next?.id === checkpoint?.topic ? checkpoint : null,
      review: Object.values(latest)
        .filter((s) => s.status === "review-needed")
        .map((s) => ({ topic: s.topic, nextReview: s.nextReview })),
      studiedNotes: sessions.map(
        ({
          id,
          topic,
          date,
          status,
          summary,
          corrections,
          nextReview,
          connections,
        }) => ({
          id,
          topic,
          date,
          status,
          summary,
          corrections,
          nextReview,
          connections,
        }),
      ),
      allTopics: course.lessons.map((l) => ({
        id: l.id,
        title: l.title,
        requires: l.requires,
        status: latest[l.id]?.status ?? "not-started",
      })),
    },
    null,
    2,
  ),
);
