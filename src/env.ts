import { execSync } from "node:child_process";
import { basename } from "node:path";
import type { EnvInfo, TemplateVars } from "./types.js";

export function detectEnv(): EnvInfo {
  const cwd = process.cwd();

  let isGit = false;
  try {
    const result = execSync("git rev-parse --is-inside-work-tree 2>/dev/null", {
      encoding: "utf8",
      timeout: 5000,
    }).trim();
    isGit = result === "true";
  } catch {
    isGit = false;
  }

  let gitBranch: string | null = null;
  let gitStatus: string | null = null;
  let gitLog: string | null = null;

  if (isGit) {
    try {
      gitBranch = execSync("git branch --show-current", {
        encoding: "utf8",
        timeout: 5000,
      }).trim();
    } catch {
      gitBranch = null;
    }

    try {
      gitStatus = execSync("git status --short", {
        encoding: "utf8",
        timeout: 5000,
      }).trim();
    } catch {
      gitStatus = null;
    }

    try {
      gitLog = execSync("git log --oneline -5", {
        encoding: "utf8",
        timeout: 5000,
      }).trim();
    } catch {
      gitLog = null;
    }
  }

  const platform = execSync("uname -s", { encoding: "utf8", timeout: 5000 })
    .trim()
    .toLowerCase();

  const shell = basename(process.env.SHELL || "bash");

  const osVersion = execSync("uname -sr", { encoding: "utf8", timeout: 5000 }).trim();

  return { cwd, isGit, gitBranch, gitStatus, gitLog, platform, shell, osVersion };
}

// Hardcoded model info — update when Claude Code updates
const MODEL_NAME = "Claude Opus 4.6";
const MODEL_ID = "claude-opus-4-6";
const KNOWLEDGE_CUTOFF = "May 2025";

export function buildTemplateVars(env: EnvInfo): TemplateVars {
  let gitStatusBlock = "";
  if (env.isGit) {
    const parts: string[] = [];
    if (env.gitBranch) parts.push(`Current branch: ${env.gitBranch}`);
    if (env.gitStatus) {
      parts.push(`\nStatus:\n${env.gitStatus}`);
    } else {
      parts.push(`\nStatus:\n(clean)`);
    }
    if (env.gitLog) parts.push(`\nRecent commits:\n${env.gitLog}`);
    gitStatusBlock = parts.join("\n");
  }

  return {
    CWD: env.cwd,
    IS_GIT: env.isGit ? "true" : "false",
    PLATFORM: env.platform,
    SHELL: env.shell,
    OS_VERSION: env.osVersion,
    MODEL_NAME,
    MODEL_ID,
    KNOWLEDGE_CUTOFF,
    GIT_STATUS: gitStatusBlock,
  };
}
