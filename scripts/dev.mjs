import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { watch } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { resolve, extname, sep } from "node:path";
const root = fileURLToPath(new URL("../", import.meta.url));
const dist = resolve(root, "dist");
const build = () =>
  spawnSync(process.execPath, ["scripts/build.mjs"], {
    cwd: root,
    stdio: "inherit",
  }).status === 0;
if (!build()) process.exit(1);
const mime = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
};
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost");
    const path = resolve(
      dist,
      "." +
        decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname),
    );
    if (!path.startsWith(dist + sep) || !(await stat(path)).isFile())
      throw new Error("not found");
    res.writeHead(200, {
      "Content-Type": `${mime[extname(path)] ?? "application/octet-stream"}; charset=utf-8`,
      "Cache-Control": "no-store",
    });
    res.end(await readFile(path));
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
});
const port = Number(process.env.PORT || 8787);
server.listen(port, "127.0.0.1", () =>
  console.log(`Local: http://127.0.0.1:${port}`),
);
let timer;
for (const dir of ["content", "src"])
  watch(resolve(root, dir), { recursive: true }, () => {
    clearTimeout(timer);
    timer = setTimeout(build, 150);
  });
