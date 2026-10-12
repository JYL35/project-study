## 먼저 이것만

**계측**은 백엔드가 요청을 세는 일, **수집**은 ADOT이 그 값을 읽는 일, **저장**은 CloudWatch가 값을 보관하는 일이다.

Spring Boot의 Actuator·Micrometer가 `/actuator/prometheus`에 값을 노출한다. 각 EC2의 ADOT이 Docker 내부 주소 `backend:8080`에서 **60초마다** 읽는다. 이 엔드포인트는 외부 Nginx에 공개하지 않는다.

## 누적값을 구간값으로

백엔드의 요청 수가 100에서 108로 늘었다면 이번 수집 구간의 증가분은 **8건**이다. `cumulativetodelta`가 누적 히스토그램을 수집 간 증가분으로 바꾼다. 수집기를 새로 시작하면 첫 값은 기준값으로 사용돼 바로 그래프가 생기지 않을 수 있다.

ADOT은 HTTPS와 EC2 역할 인증으로 **CloudWatch OTel 메트릭**에 보낸다. Query Studio에서 `environment="dev"` 또는 `"prod"`, `service="chongchong-backend"`로 구분한다.

## 직접 확인

```bash
sudo docker inspect --format '{{.State.Status}} {{.RestartCount}} {{.State.OOMKilled}}' chongchong-metrics-collector
sudo docker logs --since 10m --tail 100 chongchong-metrics-collector
```

`running 0 false`는 컨테이너가 살아 있다는 뜻이다. **전송 성공은 Query Studio의 최신 데이터까지** 봐야 확인된다. 요청을 보내고 두 번 이상 수집될 시간을 준다.
