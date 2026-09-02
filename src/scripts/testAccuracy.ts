import { spawn } from "child_process";

console.log("=================================================================");
console.log("JOB MAPPER — SECTION 40 DEDICATED DATA-QUALITY ACCURACY SUITE");
console.log("=================================================================\n");

const vitest = spawn("npx", ["vitest", "run", "tests/accuracy/accuracy.test.ts"], {
  stdio: "inherit",
  shell: true
});

vitest.on("exit", (code) => {
  process.exit(code || 0);
});
