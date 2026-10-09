// Public demo helper (nginx on port 80 + Cloudflare quick tunnel). Works the same in cmd, PowerShell and bash.
//   node scripts/demo.mjs build   build the site in demo mode (browser reaches Supabase through the same origin)
//   node scripts/demo.mjs up      start nginx + tunnel and print the public URL
//   node scripts/demo.mjs url     print the public URL again
//   node scripts/demo.mjs down    stop nginx + tunnel
import { execSync, spawnSync } from "node:child_process";

const compose = "docker compose -f demo/docker-compose.yml";
const cmd = process.argv[2];

function run(command, env = {}) {
  const r = spawnSync(command, { stdio: "inherit", shell: true, env: { ...process.env, ...env } });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

function tunnelUrl() {
  for (let i = 0; i < 30; i++) {
    const logs = execSync(`${compose} logs tunnel`, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    const m = logs.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/g);
    if (m) return m[m.length - 1];
    execSync(process.platform === "win32" ? "ping -n 3 127.0.0.1 >NUL" : "sleep 2", { shell: true });
  }
  return null;
}

switch (cmd) {
  case "build":
    run("npm --prefix web run build", { NEXT_PUBLIC_SUPABASE_SAME_ORIGIN: "1" });
    break;
  case "up": {
    run(`${compose} up -d`);
    const url = tunnelUrl();
    console.log(url ? `\nПубличен адрес: ${url}\nЛокално: http://localhost:${process.env.DEMO_PORT ?? 8080}` : "\nТунелът още няма адрес. Опитай: npm run demo:url");
    break;
  }
  case "url":
    console.log(tunnelUrl() ?? "Тунелът не е пуснат или още няма адрес.");
    break;
  case "down":
    run(`${compose} down`);
    break;
  default:
    console.log("Употреба: node scripts/demo.mjs build | up | url | down");
    process.exit(1);
}
