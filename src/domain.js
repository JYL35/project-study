export function statistics(samples) {
  if (!samples.length)
    return { count: 0, errors: 0, errorRate: null, mean: null, p95: null };
  const times = samples.map((s) => s.ms).sort((a, b) => a - b);
  const errors = samples.filter((s) => s.status >= 500).length;
  return {
    count: samples.length,
    errors,
    errorRate: (errors / samples.length) * 100,
    mean: times.reduce((a, b) => a + b, 0) / times.length,
    p95: times[Math.ceil(times.length * 0.95) - 1],
  };
}
export function emptyProgress() {
  return { version: 1, lessons: {} };
}
export function transitionStage(current, clicked) {
  return clicked <= current ? clicked - 1 : clicked;
}
export function validateProgress(input, lessons) {
  if (
    !input ||
    input.version !== 1 ||
    !input.lessons ||
    typeof input.lessons !== "object" ||
    Array.isArray(input.lessons)
  )
    throw new Error("Project Study 학습 기록 파일이 아닙니다.");
  const result = emptyProgress();
  for (const lesson of lessons) {
    const item = input.lessons[lesson.id];
    if (!item) continue;
    if (
      !Number.isInteger(item.stage) ||
      item.stage < 0 ||
      item.stage > 3 ||
      typeof item.memo !== "string" ||
      item.memo.length > 4000 ||
      !Array.isArray(item.answers) ||
      item.answers.length !== lesson.quiz.length ||
      item.answers.some((a) => a !== true && a !== false && a !== null)
    )
      throw new Error(`${lesson.title}: 기록 형식이 올바르지 않습니다.`);
    result.lessons[lesson.id] = {
      stage: item.stage,
      memo: item.memo,
      answers: [...item.answers],
    };
  }
  return result;
}
