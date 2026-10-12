## 세 숫자의 뜻

- **요청 수:** 이 수집 구간에 관측된 요청 건수. 앱 시작 이후 누적 총합이 아니다.
- **5xx 오류율:** 5xx 건수 ÷ 전체 요청 수 × 100. 요청이 없거나 데이터가 없으면 정상 0%라고 단정하지 않는다.
- **p95:** 약 95%의 응답이 이 경계 이하였다는 추정값. `0.03`초는 **30ms**다. 적은 표본과 히스토그램 버킷의 오차를 고려한다.

## 총총에서 확인

CloudWatch 대시보드 **DASHBOARD-chongchong-dev**와 **DASHBOARD-chongchong-prod**에 요청 수·상태별 요청 수·p95·5xx 오류율 패널이 있다.

Query Studio의 dev 요청 수:

```promql
sum(histogram_count(http_server_requests_seconds{environment="dev",service="chongchong-backend",uri!~"/actuator/.*"}))
```

dev p95, 단위는 초:

```promql
histogram_quantile(0.95, sum(http_server_requests_seconds{environment="dev",service="chongchong-backend",uri!~"/actuator/.*"}))
```

prod에서는 환경 필터를 바꾼다. `/actuator/*`는 사용자 요청을 읽을 때 제외한다. 누적값을 delta로 바꾼 현재 구성에 일반 Prometheus의 `rate()` 예제를 그대로 대입하지 않는다.

## 직접 확인

위 실습에서 느린 요청을 섞어 평균과 p95를 비교한다. 이 실습은 원본 표본을 정렬해 경계를 구하며, **CloudWatch의 히스토그램 추정 방식과는 차이**가 있다.
