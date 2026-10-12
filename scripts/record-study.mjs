import { readFile } from "node:fs/promises";
import { saveSession } from "./lib/study.mjs";
const [flag, file, ...rest] = process.argv.slice(2);
if (flag !== "--file" || !file || rest.length)
  throw new Error(
    "사용법: npm run study:record -- --file /absolute/path/session.json",
  );
const session = JSON.parse(await readFile(file, "utf8"));
const path = await saveSession(session);
console.log(
  `학습 기록을 저장했습니다: ${path}\n사이트 반영: npm run check → npm run build → 이 기록을 커밋·푸시 → 배포 확인`,
);
