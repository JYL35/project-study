import test from "node:test";
import assert from "node:assert/strict";
import {
  statistics,
  validateProgress,
  transitionStage,
} from "../src/domain.js";
test("무트래픽은 오류율 0%나 p95 0ms로 표시하지 않는다", () => {
  assert.equal(statistics([]).errorRate, null);
  assert.equal(statistics([]).p95, null);
});
test("느린 꼬리와 요청 실패를 실제 표본에서 구분한다", () => {
  const result = statistics([
    ...Array.from({ length: 18 }, () => ({ ms: 10, status: 200 })),
    { ms: 1000, status: 200 },
    { ms: 2000, status: 500 },
  ]);
  assert.equal(result.p95, 1000);
  assert.equal(result.errorRate, 5);
  assert.equal(result.count, 20);
});
test("기록 가져오기는 알려진 주제만 남기고 잘못된 상태와 답변을 거부한다", () => {
  const lessons = [{ id: "logging", title: "로그", quiz: [{}, {}] }];
  const data = {
    version: 1,
    lessons: {
      logging: { stage: 2, memo: "다시 읽기", answers: [true, null] },
      other: { stage: 3 },
    },
  };
  assert.deepEqual(Object.keys(validateProgress(data, lessons).lessons), [
    "logging",
  ]);
  assert.throws(() => validateProgress({ ...data, version: 2 }, lessons));
  assert.throws(() =>
    validateProgress(
      { version: 1, lessons: { logging: { stage: 9, memo: "", answers: [] } } },
      lessons,
    ),
  );
});
test("설명 가능 표시를 취소하면 실습 완료 단계로 돌아온다", () => {
  assert.equal(transitionStage(3, 3), 2);
  assert.equal(transitionStage(0, 2), 2);
  assert.equal(transitionStage(2, 1), 0);
});
