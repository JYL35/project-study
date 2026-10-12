# 학습 결과 기록

`learning/profile.json`의 학습자와 저장소를 사용한다. 입력 JSON은 `.study/JYL35/result.json`에 작성하고 다음을 실행한다.

```bash
npm run study:record -- --file .study/JYL35/result.json
npm run check
npm run build
```

명령은 `learning/JYL35/<id>.json`을 생성한다. 같은 id·같은 내용은 재실행 가능하고, 같은 id의 다른 내용은 기존 기록 보존을 위해 거부한다. 재학습은 새 id로 추가한다. 날짜와 id 순으로 마지막 기록이 현재 상태이며, 이전 기록도 남는다.

## 필드 (version 1)

| 필드                       | 내용                                                                                                                            |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `version`                  | `1`                                                                                                                             |
| `id`                       | `<topic>-YYYYMMDD-HHmmss`, 실제 세션 고유 id                                                                                    |
| `learner`, `topic`, `date` | `JYL35`, 커리큘럼 주제 id, 실제 현지 날짜 `YYYY-MM-DD`                                                                          |
| `status`                   | `completed` 또는 `review-needed`                                                                                                |
| `summary`                  | 이번에 이해한 핵심을 1~3문장으로                                                                                                |
| `initialUnderstanding`     | 첫 답변에서 확인한 이해 수준. 사용자 원문 전체 대신 개념만 정리                                                                 |
| `goals`                    | 모든 목표를 `{goal, verdict: "met" 또는 "review", evidence}`로 평가. goal은 커리큘럼 원문                                       |
| `checks`                   | `{question, answer, feedback, independent: boolean, passed: boolean}` 배열. answer는 실제 사용자 답변의 개념 요약               |
| `corrections`              | `{before, after, evidence}` 배열. 없으면 `[]`. 근거 없이 오개념·교정 성공을 만들지 않는다                                       |
| `exercise`                 | `{kind: "simulation" 또는 "dev" 또는 "explanation", description, result}`. 실제 관측만 기록                                     |
| `nextReview`               | 다시 확인할 질문 문자열 배열. 복습 상태이면 1개 이상                                                                            |
| `connections`              | `{topic, reason}` 배열. 커리큘럼의 다른 주제와 이번에 확인한 연결 근거                                                          |
| `note`                     | 학습자가 이해한 방식으로 요약한 Markdown. 핵심 원리, 헷갈렸던 흐름, 실습 결과, 연결 이유. 장황한 교과서 대신 세션에서 배운 내용 |
| `sources`                  | `{title, url}` 배열. 실제 확인한 공식 문서 또는 공개 프로젝트 파일의 HTTPS 주소                                                 |

완료에는 모든 목표 `met`, 힌트 없는 통과 답변 2개 이상이 필요하다. 스크립트는 형식과 이 최소 조건을 검사하고, 답의 의미와 교정 성공 여부는 튜터가 실제 대화로 판단한다.

## 중단·복습과 게시

- 도중에 멈추면 `.study/` 체크포인트만 저장하고 재개 위치를 알려 준다. 끝내겠다면 지금까지 확인한 범위를 `review-needed`로 남길 수 있다.
- 완료 노트와 미완료 노트를 명확히 구분한다. 다음 `context`는 선행 주제를 충족한 복습 대상을 우선한다.
- 공개에는 토큰, 웹훅, 실제 계정 ARN/IP, 고객 데이터, 원문 대화 로그를 넣지 않는다. 사용자 답변은 교육 목적의 개념 정리로 남긴다.
- Git 작업 전 status와 remote를 확인한다. `main`을 강제로 덮어쓰거나 다른 변경을 묶지 않는다. 로컬 수정이 남아 있으면 해당 파일만 커밋하며, 병합 충돌 시 학습 결과를 보존한다.
- 이 프로젝트는 Vercel Git 연동으로 배포한다. Study 기록은 정적 데이터이므로 웹 API 키·Firebase·추가 유료 서비스가 필요 없다.
