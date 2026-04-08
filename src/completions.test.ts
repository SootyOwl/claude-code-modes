import { describe, test, expect } from "bun:test";
import { generateBashCompletion, generateZshCompletion, generateFishCompletion } from "./completions.js";

describe("completions", () => {
  describe("generateBashCompletion", () => {
    test("generates valid bash completion script", () => {
      const result = generateBashCompletion();

      expect(result).toContain("_claude_mode_completion");
      expect(result).toContain("complete -F _claude_mode_completion claude-mode");

      // Check for presets
      expect(result).toContain("create");
      expect(result).toContain("explore");
      expect(result).toContain("debug");

      // Check for subcommands
      expect(result).toContain("config");
      expect(result).toContain("inspect");

      // Check for axis values
      expect(result).toContain("autonomous");
      expect(result).toContain("architect");
      expect(result).toContain("unrestricted");

      // Check for flags
      expect(result).toContain("--base");
      expect(result).toContain("--agency");
      expect(result).toContain("--quality");
      expect(result).toContain("--scope");
      expect(result).toContain("--readonly");
    });
  });

  describe("generateZshCompletion", () => {
    test("generates valid zsh completion script", () => {
      const result = generateZshCompletion();

      expect(result).toContain("#compdef claude-mode");
      expect(result).toContain("_claude_mode");

      // Check for presets with descriptions
      expect(result).toContain("'create:autonomous / architect / unrestricted'");
      expect(result).toContain("'explore:collaborative / architect / narrow (readonly)'");

      // Check for subcommands
      expect(result).toContain("'config:Manage configuration'");
      expect(result).toContain("'inspect:Show prompt assembly plan");

      // Check for options
      expect(result).toContain("'--base[Base prompt]");
      expect(result).toContain("'--agency[Agency level]");
      expect(result).toContain("'--quality[Quality level]");
      expect(result).toContain("'--scope[Scope level]");
    });
  });

  describe("generateFishCompletion", () => {
    test("generates valid fish completion script", () => {
      const result = generateFishCompletion();

      expect(result).toContain("complete -c claude-mode");

      // Check for presets
      expect(result).toContain('complete -c claude-mode -n "__fish_use_subcommand" -a "create"');
      expect(result).toContain('complete -c claude-mode -n "__fish_use_subcommand" -a "explore"');

      // Check for subcommands
      expect(result).toContain('complete -c claude-mode -n "__fish_use_subcommand" -a "config"');
      expect(result).toContain('complete -c claude-mode -n "__fish_use_subcommand" -a "inspect"');

      // Check for config subcommands
      expect(result).toContain('complete -c claude-mode -n "__fish_seen_subcommand_from config" -a "show"');
      expect(result).toContain('complete -c claude-mode -n "__fish_seen_subcommand_from config" -a "add-preset"');

      // Check for options
      expect(result).toContain("complete -c claude-mode -l base");
      expect(result).toContain("complete -c claude-mode -l agency");
      expect(result).toContain("complete -c claude-mode -l readonly");
    });
  });
});
