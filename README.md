# Project Study

프로젝트에서 배운 것을 **짧게 읽고 → 직접 확인하고 → 내 말로 설명하는** 개인 학습 공간입니다.

첫 번째 챕터는 총총 프로젝트의 로깅·메트릭·알림입니다. 실제 프로젝트 구성을 바탕으로 만들었고, 사이트의 실습은 모의 데이터로 동작합니다.

## 시작하기

Node.js 22 이상이 필요합니다. CI에서는 24를 사용합니다.

```bash
npm ci
npm run dev
```

브라우저에서 `http://127.0.0.1:8787`을 엽니다. 파일을 수정하면 자동으로 다시 빌드합니다. 화면은 새로고침해 주세요.

```bash
npm run check   # 계산·기록 검증 테스트와 콘텐츠 검사
npm run build   # dist/ 생성
```

## 학습하는 방법

1. **학습 홈**에서 주제를 고릅니다.
2. 모의 실습을 움직이고 짧은 설명을 읽습니다.
3. 실제 환경을 확인할 때는 각 주제의 **직접 확인**을 참고합니다.
4. 복습 질문에 먼저 답한 뒤 정답을 펼칩니다.
5. **읽음 / 직접 확인함 / 설명 가능**을 표시하고 메모를 남깁니다.
6. **개념 지도**로 주제의 연결을, **복습 카드**로 헷갈린 질문을 확인합니다.

진행 상태와 메모는 현재 브라우저의 `localStorage`에 저장됩니다. 로그인·서버 동기화는 없습니다. **학습 기록**에서 JSON 파일로 백업하고 다른 기기에서 가져올 수 있습니다. 가져오기는 적용 전 확인 화면을 거칩니다. 브라우저 데이터를 지우기 전에 백업해 주세요.

## 내용 수정·추가하기

- 설명: `content/monitoring/*.md`
- 주제 이름·순서·목표·복습 질문·선행 관계: `content/curriculum.json`
- 모의 실습: `src/simulations.js`
- 화면: `src/app.js`, `src/styles.css`

새 주제를 추가하려면:

1. `content/monitoring/my-topic.md`를 만듭니다. `## 직접 확인`을 포함합니다.
2. `curriculum.json`의 `lessons`에 같은 `id`로 항목을 추가합니다.
3. `goals`, `requires`, `quiz`를 채웁니다. 질문은 두 개 이상 작성합니다.
4. 모의 실습이 없으면 `simulation`을 생략합니다. 기존 실습은 `pipeline`, `logs`, `scrape`, `distribution`, `alarm`, `diagnosis`입니다.
5. `npm run check`와 `npm run build`로 확인합니다.

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

[acestudy](https://github.com/jihwankim128/acestudy)의 ‘학습 노트·시각화·복습’ 구성에서 아이디어를 얻었습니다. 소스와 콘텐츠는 새로 작성했습니다.

개념을 더 확인할 때는 공식 문서를 참고하세요.

- [Spring Boot Actuator](https://docs.spring.io/spring-boot/reference/actuator/index.html)
- [AWS Distro for OpenTelemetry](https://aws-otel.github.io/)
- [CloudWatch OTel 메트릭](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/CloudWatch-OTLPMetrics.html)
- [Amazon SNS와 Lambda](https://docs.aws.amazon.com/lambda/latest/dg/with-sns.html)
- [Discord Webhooks](https://discord.com/developers/docs/resources/webhook)

코드 라이선스: MIT. 프로젝트 설정은 시간이 지나며 바뀔 수 있으므로 운영에 적용할 때 현재 설정을 함께 확인하세요.
