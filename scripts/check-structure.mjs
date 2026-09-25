#!/usr/bin/env node
/**
 * GLI Product Skill repository structure check (adapter, non-canonical).
 * Contract: skills/gli-product-system/skill-runtime/repo-structure.md
 *
 *   node check-structure.mjs [--root <project>] [--module-root <dir>]... [--since <git-ref>] [--ignore <dir>]...
 *
 * Modules default to the child folders of src/, apps/, and packages/ (else the
 * top-level code folders); --module-root replaces those defaults for other layouts.
 *
 * Verifies the target repository is the agents' system of record: an entry
 * file (AGENTS.md or CLAUDE.md) that says what the project is and how to run
 * and verify it, a doc next to every module, PROGRESS.md, and a Makefile with
 * setup/test/lint/check. With --since, warns when a module's code changed but
 * its doc did not. Exit 1 on any FAIL. Dependency-free; safe to vendor into a
 * project as scripts/check-structure.mjs (re-copy from the skill to update).
 */

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const ENTRY_MAX_LINES = 100;
const MODULE_DOCS = ["ARCHITECTURE.md", "CONSTRAINTS.md"];
const MAKE_TARGETS = ["setup", "test", "lint", "check"];
const SOURCE_EXT = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".vue", ".svelte", ".astro",
  ".css", ".scss", ".sass", ".less", ".html", ".py", ".go", ".rs", ".java",
  ".kt", ".cs", ".rb", ".php", ".swift", ".scala", ".c", ".cc", ".cpp", ".h", ".sql",
]);
// Generated, vendored, test, and static folders are not modules.
const NOT_MODULES = new Set([
  "node_modules", "dist", "build", "out", "coverage", "target", "vendor", "__pycache__",
  "venv", "__tests__", "__mocks__", "test", "tests", "e2e", "fixtures", "public",
  "static", "assets", "docs", "scripts",
]);
// English and Italian headings are both accepted.
const ENTRY_QUESTIONS = {
  "what this project is": /\b(what|overview|about|purpose)\b|cos['’]?\s?è|panoramica|scopo|progetto/i,
  "how to run it": /\b(run|running|setup|set up|start|install|develop)\b|avvi|esegu|installa|sviluppo/i,
  "how to verify it": /\b(verify|verification|test|tests|testing|check|checks|quality)\b|verific|controll/i,
};
const PROGRESS_SECTIONS = {
  Done: /^(done|completed|fatto|completato|completati)\b/i,
  "In progress": /^(in progress|doing|in corso)\b/i,
  Blocked: /^(blocked|bloccato|bloccati|bloccate)\b/i,
};

const args = parseArgs(process.argv.slice(2));
const root = path.resolve(args.root || ".");
const ignored = new Set(args.ignore.map((d) => d.replace(/\\/g, "/").replace(/\/+$/, "")));
const results = [];
const report = (level, area, message) => results.push({ level, area, message });

if (!isDir(root)) {
  console.error(`check-structure: --root is not a directory: ${root}`);
  process.exit(2);
}
for (const dir of args.moduleRoot) {
  if (!isDir(path.join(root, dir))) {
    console.error(`check-structure: --module-root is not a directory under --root: ${dir}`);
    process.exit(2);
  }
}

checkEntry();
checkProgress();
checkMakefile();
const modules = findModules();
checkModuleDocs(modules);
if (args.since) checkFreshness(modules, args.since);

let failures = 0;
let warnings = 0;
for (const r of results) {
  if (r.level === "FAIL") failures += 1;
  if (r.level === "WARN") warnings += 1;
  console.log(`REPO_STRUCTURE ${r.level} ${r.area}: ${r.message}`);
}
console.log(`REPO_STRUCTURE_RESULT ${failures ? "FAIL" : "PASS"} (${failures} failed, ${warnings} warning${warnings === 1 ? "" : "s"}, ${modules.length} modules)`);
process.exit(failures ? 1 : 0);

function checkEntry() {
  const agents = path.join(root, "AGENTS.md");
  const claude = path.join(root, "CLAUDE.md");
  if (!fs.existsSync(agents) && !fs.existsSync(claude)) {
    return report("FAIL", "entry", "add AGENTS.md at the repository root");
  }
  if (!fs.existsSync(agents) && /@AGENTS\.md\b/.test(read(claude))) {
    return report("FAIL", "entry", "CLAUDE.md points to AGENTS.md, which does not exist");
  }
  const entry = fs.existsSync(agents) ? agents : claude;
  const name = path.basename(entry);
  const text = read(entry);
  const lines = text.replace(/\n+$/, "").split("\n").length;
  if (lines > ENTRY_MAX_LINES) {
    report("FAIL", "entry", `${name} has ${lines} lines; keep it to ${ENTRY_MAX_LINES} and move detail into module docs`);
  }
  const headings = headingsOf(text);
  const missing = Object.entries(ENTRY_QUESTIONS).filter(([, rx]) => !headings.some((h) => rx.test(h))).map(([q]) => q);
  if (missing.length) {
    report("FAIL", "entry", `${name} needs a section answering: ${missing.join("; ")}`);
  } else if (lines <= ENTRY_MAX_LINES) {
    report("PASS", "entry", `${name} (${lines} lines)`);
  }
}

function checkProgress() {
  const file = path.join(root, "PROGRESS.md");
  if (!fs.existsSync(file)) return report("FAIL", "progress", "add PROGRESS.md with Done / In progress / Blocked");
  const headings = headingsOf(read(file));
  const missing = Object.entries(PROGRESS_SECTIONS).filter(([, rx]) => !headings.some((h) => rx.test(h))).map(([s]) => s);
  if (missing.length) return report("FAIL", "progress", `PROGRESS.md is missing: ${missing.join(", ")}`);
  report("PASS", "progress", "PROGRESS.md");
}

function checkMakefile() {
  const file = ["Makefile", "makefile", "GNUmakefile"].map((n) => path.join(root, n)).find((f) => fs.existsSync(f));
  if (!file) return report("FAIL", "commands", `add a Makefile with targets: ${MAKE_TARGETS.join(", ")}`);
  const targets = new Set();
  for (const line of read(file).split("\n")) {
    const m = line.match(/^([^\s:#=][^:#=]*?)\s*::?(?!=)/);
    if (m) for (const t of m[1].split(/\s+/)) if (!t.startsWith(".")) targets.add(t);
  }
  const missing = MAKE_TARGETS.filter((t) => !targets.has(t));
  if (missing.length) return report("FAIL", "commands", `Makefile is missing targets: ${missing.join(", ")}`);
  report("PASS", "commands", `Makefile (${MAKE_TARGETS.join(", ")})`);
}

// A module is a direct child folder (holding source files) of src/, apps/, or
// packages/ — or of each --module-root; with none of those, of the repository
// root. A root with source files but no child modules is itself the module.
function findModules() {
  const defaults = ["src", "apps", "packages"].filter((d) => isDir(path.join(root, d)));
  const roots = args.moduleRoot.length ? args.moduleRoot.map((d) => rel(path.join(root, d)) || ".") : defaults;
  const scanRoots = roots.length ? roots : ["."];
  const modules = [];
  for (const r of scanRoots) {
    const abs = path.join(root, r);
    const children = fs.readdirSync(abs, { withFileTypes: true })
      .filter((e) => e.isDirectory() && !e.name.startsWith(".") && !NOT_MODULES.has(e.name))
      .map((e) => rel(path.join(abs, e.name)))
      .filter((d) => !ignored.has(d) && hasSource(path.join(root, d)));
    if (children.length) modules.push(...children);
    else if (r !== "." && hasSource(abs)) modules.push(r);
  }
  return modules.sort();
}

function checkModuleDocs(modules) {
  if (!modules.length) return report("NOTE", "modules", "no module folders found; a flat project is covered by the entry file");
  const undocumented = modules.filter((m) => !MODULE_DOCS.some((d) => fs.existsSync(path.join(root, m, d))));
  for (const m of undocumented) report("FAIL", "modules", `${m}/ has no ${MODULE_DOCS.join(" or ")}`);
  if (!undocumented.length) report("PASS", "modules", `${modules.length} module docs present`);
}

// Principle 4: a reminder, not a failure; not every code change moves the doc.
function checkFreshness(modules, since) {
  const base = git(["merge-base", since, "HEAD"]);
  if (base === null) return report("NOTE", "docs", `git ref "${since}" not found; freshness reminder skipped`);
  const changed = new Set([
    ...lines(git(["diff", "--name-only", "--relative", base.trim()])),
    ...lines(git(["ls-files", "--others", "--exclude-standard"])),
  ]);
  for (const m of modules) {
    const inModule = [...changed].filter((f) => f === m || f.startsWith(`${m}/`));
    const code = inModule.filter((f) => SOURCE_EXT.has(path.extname(f).toLowerCase()));
    const doc = inModule.some((f) => MODULE_DOCS.includes(path.posix.basename(f)));
    if (code.length && !doc) report("WARN", "docs", `${m}/ code changed since ${since} but its doc did not; confirm it is still accurate`);
  }
}

function hasSource(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith(".")) continue;
    if (e.isFile() && SOURCE_EXT.has(path.extname(e.name).toLowerCase())) return true;
    if (e.isDirectory() && !NOT_MODULES.has(e.name) && hasSource(path.join(dir, e.name))) return true;
  }
  return false;
}

function headingsOf(text) {
  return text.replace(/```[\s\S]*?```/g, "").split("\n")
    .map((l) => l.match(/^#{1,6}\s+(.*?)\s*#*\s*$/)).filter(Boolean).map((m) => m[1]);
}

function git(argv) {
  const r = spawnSync("git", ["-c", "core.quotepath=off", ...argv], { cwd: root, encoding: "utf8" });
  return r.status === 0 ? r.stdout : null;
}

function lines(text) {
  return (text || "").split("\n").map((l) => l.trim()).filter(Boolean);
}

function read(file) {
  return fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n");
}

function isDir(p) {
  return fs.existsSync(p) && fs.statSync(p).isDirectory();
}

function rel(p) {
  return path.relative(root, p).split(path.sep).join("/");
}

function parseArgs(argv) {
  const out = { ignore: [], moduleRoot: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i].replace(/^--/, "");
    const value = argv[i + 1];
    if (!["root", "module-root", "since", "ignore"].includes(key) || value === undefined || value.startsWith("--")) {
      console.error("check-structure: usage: --root <dir> [--module-root <dir>]... [--since <git-ref>] [--ignore <dir>]...");
      process.exit(2);
    }
    if (key === "ignore") out.ignore.push(value);
    else if (key === "module-root") out.moduleRoot.push(value);
    else out[key] = value;
    i += 1;
  }
  return out;
}
