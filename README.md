# Project Study

프로젝트에서 배운 것을 **Codex와 질문·답변 → 오개념 교정 → 실습·확인 → 학습 노트**로 쌓는 개인 학습 공간입니다.

[학습 사이트](https://project-study-seven.vercel.app) · [Codex 학습 시작 방법](https://project-study-seven.vercel.app/#/study)

첫 번째 챕터는 총총 프로젝트의 로깅·메트릭·알림입니다. 실제 프로젝트 구성을 바탕으로 만들었고, 사이트의 실습은 모의 데이터로 동작합니다.

## 시작하기

Node.js 22 이상이 필요합니다. CI에서는 24를 사용합니다.

```bash
git clone https://github.com/JYL35/project-study.git
cd project-study
npm ci
npm run context -- JYL35
```

Codex에서 **이 저장소 폴더**를 프로젝트로 열고 스킬 목록의 **Study**를 선택하거나 `$study` / **“공부 시작하자”**를 입력하세요. `@Study`라는 요청도 같은 학습으로 처리합니다. 스킬이 안 보이면 프로젝트를 다시 열거나 다음 문장을 입력합니다.

> .agents/skills/study/SKILL.md를 읽고 다음 주제 학습을 질문 하나부터 시작해 줘.

`context`는 Git에 저장된 학습 노트와 로컬 중간 기록을 읽습니다. 브라우저에서 직접 체크한 상태는 완료로 취급하지 않습니다. 처음에는 `overview`가 나오고, 확인을 통과하면 다음 주제로 넘어갑니다. 복습이 필요한 기록은 우선 다시 다룹니다.

사이트를 로컬에서 열 때는 `npm run dev`를 실행하고 `http://127.0.0.1:8787`에 접속합니다. 파일 수정 후 화면은 새로고침해 주세요.

```bash
npm run check   # 계산·기록 검증 테스트와 콘텐츠 검사
npm run build   # dist/ 생성
```

## 학습하는 방법

1. Codex가 다음 주제를 읽고 **진단 질문 하나**를 제시합니다.
2. 아는 만큼 내 말로 답합니다. 모르면 “모르겠어”, 막히면 “힌트”나 “더 쉽게 설명해 줘”라고 말합니다.
3. Codex가 맞는 부분·빠진 연결·오개념을 구분합니다. 필요한 부분을 풀어 설명하고, 바뀐 상황에서 다시 묻습니다.
4. 사이트 모의 실습에서 결과를 예측하고 관찰한 뒤 **왜 그렇게 됐는지** 설명합니다.
5. 다른 상황의 확인 질문에 도움 없이 답합니다. 모든 목표와 독립 답변 2개 이상을 확인해야 완료입니다. 부족하면 복습할 부분을 남깁니다.
6. Codex가 실제 답변에 근거한 **공개 정리본**을 작성·커밋·푸시합니다. 배포 뒤 사이트의 **학습 노트**, 완료 상태, 다음 주제가 바뀝니다. 원문 대화 전체는 공개하지 않습니다.

### 기록은 이렇게 보관합니다

| 기록                      | 보관 위치                        | 의미                                                   |
| ------------------------- | -------------------------------- | ------------------------------------------------------ |
| Codex 학습 노트·완료 판단 | `learning/JYL35/*.json` → 사이트 | 실제 대화에서 확인한 이해·교정·평가. 공개, 기기와 무관 |
| 중단한 대화의 체크포인트  | `.study/JYL35/session.json`      | 다음 대화에서 이어갈 로컬 기록. Git 제외               |
| 개인 메모·복습 체크       | 브라우저 `localStorage`          | 혼자 복습한 기록. Codex 완료 판단과 별개               |

개인 메모는 **개인 복습 기록**에서 JSON으로 백업·가져오기 할 수 있습니다. 원문 대화·인증 정보·운영 비밀을 공개 기록에 넣지 않습니다.

## Study 구성

- `.agents/skills/study/SKILL.md`: 대화·교정·실습·평가 진행 방식
- `content/tutoring/*.json`: 주제별 첫 질문, 오개념 진단, 실습, 확인 질문과 평가 기준
- `scripts/context.mjs`: 다음 주제·이전 교정·중간 기록 조회
- `learning/profile.json`: 현재 개인 학습자 `JYL35`와 배포 주소
- `learning/JYL35/*.json`: 학습을 마치고 저장하는 실제 결과. 첫 대화 전에는 비어 있습니다.

세션 결과 스키마는 [기록 안내](.agents/skills/study/references/recording.md)에 있습니다. Codex가 결과를 작성한 뒤 저장합니다.

```bash
npm run study:record -- --file .study/JYL35/result.json
npm run check
npm run build
```

새 id로 기록을 추가하고 기존 기록은 보존합니다. 같은 id의 다른 내용은 덮어쓰지 않습니다. 최신 기록이 다음 주제 선택과 완료 상태의 기준이며, 사이트는 모든 이력을 보여 줍니다. 별도 Firebase나 AI API는 필요 없습니다. 대화는 사용 중인 Codex에서 진행합니다.

## 내용 수정·추가하기

- 설명: `content/monitoring/*.md`
- 튜터 질문·평가 기준: `content/tutoring/*.json`
- 주제 이름·순서·목표·복습 질문·선행 관계: `content/curriculum.json`
- 모의 실습: `src/simulations.js`
- 화면: `src/app.js`, `src/styles.css`

새 주제를 추가하려면:

1. `content/monitoring/my-topic.md`를 만듭니다. `## 직접 확인`을 포함합니다.
2. `curriculum.json`의 `lessons`에 같은 `id`로 항목을 추가합니다.
3. `goals`, `requires`, `quiz`를 채웁니다. 질문은 두 개 이상 작성합니다.
4. 모의 실습이 없으면 `simulation`을 생략합니다. 기존 실습은 `pipeline`, `logs`, `scrape`, `distribution`, `alarm`, `diagnosis`입니다.
5. 같은 id로 `content/tutoring/<id>.json`을 추가합니다. 첫 질문·실습·오개념 후보·확인 질문 2개 이상·목표별 평가 기준이 필요합니다.
6. `npm run check`와 `npm run build`로 확인합니다.

```json
{
  "id": "my-topic",
  "title": "새로 배운 것",
  "subtitle": "핵심 개념 한 줄",
  "minutes": 5,
  "category": "주제",
  "requires": ["overview"],
  "lead": "어떤 문제에서 이 개념이 필요했을까?",
  "goals": ["내가 설명할 수 있어야 할 것"],
  "quiz": [
    { "q": "왜 필요한가?", "a": "내 말로 정리한 설명" },
    { "q": "어떻게 확인하는가?", "a": "직접 확인할 방법" }
  ]
}
```

`id`는 저장된 학습 기록의 키이므로 이미 사용한 ID는 유지하는 편이 좋습니다. 없는 선행 주제·중복 ID·순환 관계는 빌드에서 거부합니다. 현재 첫 챕터의 디렉터리와 소개는 로깅·모니터링 기준입니다. 다른 챕터로 넓힐 때 소개와 경로도 함께 바꿉니다.

## 배포

Vercel에서 이 저장소를 Import합니다. `vercel.json`에 설정이 들어 있습니다.

- Framework Preset: Other
- Build Command: `npm run build`
- Output Directory: `dist`
- 환경 변수: 없음
- Production Branch: `main`

GitHub 연동 후 `main`에 푸시하면 Vercel이 다시 배포합니다. `.github/workflows/ci.yml`은 별도로 테스트와 빌드를 검사합니다. Codex Sites용 정적 호스팅 설정은 `.openai/hosting.json`에 있습니다.

## 설계와 범위

- HTML·CSS·JavaScript + Markdown 빌드. 클라이언트 프레임워크 없이 정적으로 배포합니다.
- 실제 AWS, 서버, Discord를 호출하지 않습니다.
- 웹훅·토큰·계정 ARN·실제 서버 IP와 개인정보를 저장소에 올리지 않습니다.
- p95 실습은 원본 표본의 최근접 순위 경계값입니다. CloudWatch 히스토그램의 추정값과 다를 수 있습니다.
- 프로젝트 실습에서 관측한 구간값을 설명합니다. 일반적인 누적 Prometheus 지표에 같은 쿼리를 그대로 적용하지 않습니다.
- Discord 테스트 메시지는 전달 테스트입니다. 실제 장애부터 자동 경보까지 검증했다는 의미는 아닙니다.

## 참고

[acestudy](https://github.com/jihwankim128/acestudy)의 `context → Study 대화 → 학습 노트 → 배포` 흐름을 참고했습니다. 소스와 콘텐츠는 새로 작성했습니다. 개인 학습용이므로 팀 랜덤 배정·Firestore 동기화 대신 Git 기록으로 관리합니다.

Codex의 저장소 스킬과 호출 방식은 [공식 스킬 문서](https://learn.chatgpt.com/docs/build-skills)를 참고하세요.

개념을 더 확인할 때는 공식 문서를 참고하세요.

- [Spring Boot Actuator](https://docs.spring.io/spring-boot/reference/actuator/index.html)
- [AWS Distro for OpenTelemetry](https://aws-otel.github.io/)
- [CloudWatch OTel 메트릭](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/CloudWatch-OTLPMetrics.html)
- [Amazon SNS와 Lambda](https://docs.aws.amazon.com/lambda/latest/dg/with-sns.html)
- [Discord Webhooks](https://discord.com/developers/docs/resources/webhook)

코드 라이선스: MIT. 프로젝트 설정은 시간이 지나며 바뀔 수 있으므로 운영에 적용할 때 현재 설정을 함께 확인하세요.
