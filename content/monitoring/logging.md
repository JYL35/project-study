## 먼저 이것만

총총은 요청마다 **request_id**를 남기고 응답 헤더 **X-Request-Id**에도 같은 값을 넣는다. 여러 요청이 섞여 있어도 이 값으로 내 요청을 찾을 수 있다.

**route**는 `/api/studies/{studyId}` 같은 경로 패턴, **status**는 HTTP 상태, **duration_ms**는 처리 시간, **error_code**는 실패 원인을 좁히는 단서다. 원본 URI·쿼리 문자열은 남기지 않는다.

## 총총에서 확인

CloudWatch **Logs Insights**에서 서울 리전과 로그 그룹을 선택한다. dev는 `/chongchong/dev/backend`, prod는 `/chongchong/prod/backend`다. 시간 범위를 요청 전후로 좁힌다.

```sql
fields @timestamp, request_id, method, route, status, duration_ms, error_code
| filter request_id = "응답에서-받은-ID"
| sort @timestamp asc
```

5xx만 찾으려면 필터를 `status >= 500`으로 바꾼다. 로그가 없으면 **환경·리전·시간 범위**부터 확인한다.

## 직접 확인

dev 사이트에서 평범한 API 요청을 보낸다. 응답의 X-Request-Id로 로그를 찾고 상태·시간·경로가 맞는지 읽는다. 한 요청에 요청 로그와 예외 로그가 함께 생길 수 있으므로 **로그 줄 수를 요청 수로 세지 않는다.**
