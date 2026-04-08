import { PRESET_NAMES, BUILTIN_BASE_NAMES, AGENCY_VALUES, QUALITY_VALUES, SCOPE_VALUES } from "./types.js";

const SUBCOMMANDS = ["config", "inspect", "completion"];
const CONFIG_SUBCOMMANDS = [
  "show", "init", "add-default", "remove-default",
  "add-modifier", "remove-modifier", "add-axis", "remove-axis",
  "add-preset", "remove-preset", "help"
];
const AXES = ["agency", "quality", "scope"];

export function generateBashCompletion(): string {
  const presets = PRESET_NAMES.join(" ");
  const bases = BUILTIN_BASE_NAMES.join(" ");
  const agencies = AGENCY_VALUES.join(" ");
  const qualities = QUALITY_VALUES.join(" ");
  const scopes = SCOPE_VALUES.join(" ");
  const subcommands = SUBCOMMANDS.join(" ");
  const configSubcommands = CONFIG_SUBCOMMANDS.join(" ");
  const axes = AXES.join(" ");

  return `# bash completion for claude-mode

_claude_mode_completion() {
    local cur prev words cword
    _init_completion || return

    # Handle config subcommand
    if [[ \${words[1]} == "config" ]] && [[ \$cword -ge 2 ]]; then
        # Complete --global flag anywhere in config
        if [[ \$cur == -* ]]; then
            COMPREPLY=( $(compgen -W "--global" -- "\$cur") )
            return
        fi
        if [[ \$cword -eq 2 ]] || [[ \${words[2]} == "--global" && \$cword -eq 3 ]]; then
            COMPREPLY=( $(compgen -W "${configSubcommands}" -- "\$cur") )
            return
        fi
        # Determine actual subcommand position (accounting for --global)
        local subcmd_idx=2
        if [[ \${words[2]} == "--global" ]]; then
            subcmd_idx=3
        fi
        case "\${words[\$subcmd_idx]}" in
            add-axis)
                if [[ \$cword -eq \$((subcmd_idx + 1)) ]]; then
                    COMPREPLY=( $(compgen -W "${axes}" -- "\$cur") )
                elif [[ \$cword -eq \$((subcmd_idx + 3)) ]]; then
                    COMPREPLY=( $(compgen -f -- "\$cur") )
                fi
                return
                ;;
            remove-axis)
                if [[ \$cword -eq \$((subcmd_idx + 1)) ]]; then
                    COMPREPLY=( $(compgen -W "${axes}" -- "\$cur") )
                fi
                return
                ;;
            add-modifier|remove-modifier|add-default|remove-default|remove-preset)
                # These take name arguments - no completion
                return
                ;;
            add-preset)
                # Handle preset flags
                if [[ \$cur == -* ]]; then
                    local preset_opts="--agency --quality --scope --modifier --readonly --context-pacing"
                    COMPREPLY=( $(compgen -W "\$preset_opts" -- "\$cur") )
                    return
                fi
                case "\$prev" in
                    --agency)
                        COMPREPLY=( $(compgen -W "${agencies}" -- "\$cur") )
                        return
                        ;;
                    --quality)
                        COMPREPLY=( $(compgen -W "${qualities}" -- "\$cur") )
                        return
                        ;;
                    --scope)
                        COMPREPLY=( $(compgen -W "${scopes}" -- "\$cur") )
                        return
                        ;;
                    --modifier)
                        COMPREPLY=( $(compgen -f -- "\$cur") )
                        return
                        ;;
                esac
                ;;
        esac
        return
    fi

    # Handle inspect subcommand
    if [[ \${words[1]} == "inspect" ]]; then
        if [[ \$cur == -* ]]; then
            local opts="--base --agency --quality --scope --modifier --readonly --context-pacing --print --append-system-prompt --append-system-prompt-file --help"
            COMPREPLY=( $(compgen -W "\$opts" -- "\$cur") )
            return
        fi
        # Also handle option values for inspect
        case "\$prev" in
            --base)
                COMPREPLY=( $(compgen -W "${bases}" -f -- "\$cur") )
                return
                ;;
            --agency)
                COMPREPLY=( $(compgen -W "${agencies}" -f -- "\$cur") )
                return
                ;;
            --quality)
                COMPREPLY=( $(compgen -W "${qualities}" -f -- "\$cur") )
                return
                ;;
            --scope)
                COMPREPLY=( $(compgen -W "${scopes}" -f -- "\$cur") )
                return
                ;;
            --modifier|--append-system-prompt-file)
                COMPREPLY=( $(compgen -f -- "\$cur") )
                return
                ;;
        esac
        return
    fi

    # Handle completion subcommand
    if [[ \${words[1]} == "completion" ]]; then
        if [[ \$cword -eq 2 ]]; then
            COMPREPLY=( $(compgen -W "bash zsh fish" -- "\$cur") )
        fi
        return
    fi

    # Complete option values
    case "\$prev" in
        --base)
            COMPREPLY=( $(compgen -W "${bases}" -f -- "\$cur") )
            return
            ;;
        --agency)
            COMPREPLY=( $(compgen -W "${agencies}" -f -- "\$cur") )
            return
            ;;
        --quality)
            COMPREPLY=( $(compgen -W "${qualities}" -f -- "\$cur") )
            return
            ;;
        --scope)
            COMPREPLY=( $(compgen -W "${scopes}" -f -- "\$cur") )
            return
            ;;
        --modifier|--append-system-prompt-file)
            COMPREPLY=( $(compgen -f -- "\$cur") )
            return
            ;;
        --append-system-prompt)
            # No completion for text input
            return
            ;;
    esac

    # Complete flags
    if [[ \$cur == -* ]]; then
        local opts="--base --agency --quality --scope --modifier --readonly --context-pacing --print --append-system-prompt --append-system-prompt-file --help"
        COMPREPLY=( $(compgen -W "\$opts" -- "\$cur") )
        return
    fi

    # Complete first positional: presets or subcommands
    if [[ \$cword -eq 1 ]]; then
        COMPREPLY=( $(compgen -W "${presets} ${subcommands}" -- "\$cur") )
        return
    fi
}

complete -F _claude_mode_completion claude-mode
`;
}

export function generateZshCompletion(): string {
  const presets = PRESET_NAMES.map(p => `'${p}:${getPresetDescription(p)}'`).join(" ");
  const bases = BUILTIN_BASE_NAMES.map(b => `'${b}'`).join(" ");
  const agencies = AGENCY_VALUES.map(a => `'${a}'`).join(" ");
  const qualities = QUALITY_VALUES.map(q => `'${q}'`).join(" ");
  const scopes = SCOPE_VALUES.map(s => `'${s}'`).join(" ");

  return `#compdef claude-mode

_claude_mode() {
    local -a presets subcommands config_subcommands axes

    presets=(
        ${PRESET_NAMES.map(p => `'${p}:${getPresetDescription(p)}'`).join("\n        ")}
    )

    subcommands=(
        'config:Manage configuration'
        'inspect:Show prompt assembly plan with provenance and warnings'
        'completion:Generate shell completion script'
    )

    config_subcommands=(
        'show:Print current config'
        'init:Create scaffold'
        'add-default:Add to defaultModifiers'
        'remove-default:Remove from defaultModifiers'
        'add-modifier:Register named modifier'
        'remove-modifier:Unregister named modifier'
        'add-axis:Register custom axis value'
        'remove-axis:Unregister custom axis value'
        'add-preset:Create custom preset'
        'remove-preset:Remove custom preset'
        'help:Show config help'
    )

    axes=(
        'agency'
        'quality'
        'scope'
    )

    _arguments -C \\
        '1: :->preset_or_subcommand' \\
        '--base[Base prompt]:base:(${bases} _files)' \\
        '--agency[Agency level]:agency:(${agencies} _files)' \\
        '--quality[Quality level]:quality:(${qualities} _files)' \\
        '--scope[Scope level]:scope:(${scopes} _files)' \\
        '--modifier[Custom modifier]:file:_files' \\
        '--readonly[Prevent file modifications]' \\
        '--context-pacing[Include context pacing prompt]' \\
        '--print[Print assembled prompt instead of launching claude]' \\
        '--append-system-prompt[Append text to system prompt]:text:' \\
        '--append-system-prompt-file[Append file to system prompt]:file:_files' \\
        '--help[Show help]' \\
        '*::arg:->args'

    case \$state in
        preset_or_subcommand)
            _alternative \\
                'presets:preset:(\$presets)' \\
                'subcommands:subcommand:(\$subcommands)'
            ;;
        args)
            case \$words[1] in
                config)
                    _arguments \\
                        '1: :(\$config_subcommands)' \\
                        '--global[Use global config]' \\
                        '*::arg:->config_args'

                    case \$words[2] in
                        add-axis)
                            _arguments \\
                                '1: :(\$axes)' \\
                                '2: :' \\
                                '3: :_files' \\
                                '--global[Use global config]'
                            ;;
                        remove-axis)
                            _arguments \\
                                '1: :(\$axes)' \\
                                '2: :' \\
                                '--global[Use global config]'
                            ;;
                        add-preset)
                            _arguments \\
                                '1: :' \\
                                '--agency:agency:(${agencies})' \\
                                '--quality:quality:(${qualities})' \\
                                '--scope:scope:(${scopes})' \\
                                '--modifier:modifier:' \\
                                '--readonly[Prevent file modifications]' \\
                                '--context-pacing[Include context pacing prompt]' \\
                                '--global[Use global config]'
                            ;;
                    esac
                    ;;
                inspect)
                    _arguments \\
                        '--base[Base prompt]:base:(${bases} _files)' \\
                        '--agency[Agency level]:agency:(${agencies} _files)' \\
                        '--quality[Quality level]:quality:(${qualities} _files)' \\
                        '--scope[Scope level]:scope:(${scopes} _files)' \\
                        '--modifier[Custom modifier]:file:_files' \\
                        '--readonly[Prevent file modifications]' \\
                        '--context-pacing[Include context pacing prompt]' \\
                        '--print[Print assembled prompt instead of launching claude]' \\
                        '--append-system-prompt[Append text to system prompt]:text:' \\
                        '--append-system-prompt-file[Append file to system prompt]:file:_files' \\
                        '--help[Show help]'
                    ;;
                completion)
                    _arguments \\
                        '1: :(bash zsh fish)'
                    ;;
            esac
            ;;
    esac
}

_claude_mode "$@"
`;
}

export function generateFishCompletion(): string {
  const presets = PRESET_NAMES.map(p => `complete -c claude-mode -n "__fish_use_subcommand" -a "${p}" -d "${getPresetDescription(p)}"`).join("\n");
  const bases = BUILTIN_BASE_NAMES.map(b => `complete -c claude-mode -n "__fish_seen_argument -l base" -a "${b}"`).join("\n");
  const agencies = AGENCY_VALUES.map(a => `complete -c claude-mode -n "__fish_seen_argument -l agency" -a "${a}"`).join("\n");
  const qualities = QUALITY_VALUES.map(q => `complete -c claude-mode -n "__fish_seen_argument -l quality" -a "${q}"`).join("\n");
  const scopes = SCOPE_VALUES.map(s => `complete -c claude-mode -n "__fish_seen_argument -l scope" -a "${s}"`).join("\n");

  return `# fish completion for claude-mode

# Disable file completion by default
complete -c claude-mode -f

# Subcommands
complete -c claude-mode -n "__fish_use_subcommand" -a "config" -d "Manage configuration"
complete -c claude-mode -n "__fish_use_subcommand" -a "inspect" -d "Show prompt assembly plan"
complete -c claude-mode -n "__fish_use_subcommand" -a "completion" -d "Generate shell completions"

# Presets
${presets}

# Completion subcommand shells
complete -c claude-mode -n "__fish_seen_subcommand_from completion" -a "bash" -d "Generate Bash completions"
complete -c claude-mode -n "__fish_seen_subcommand_from completion" -a "zsh" -d "Generate Zsh completions"
complete -c claude-mode -n "__fish_seen_subcommand_from completion" -a "fish" -d "Generate Fish completions"

# Config subcommands
complete -c claude-mode -n "__fish_seen_subcommand_from config" -a "show" -d "Print current config"
complete -c claude-mode -n "__fish_seen_subcommand_from config" -a "init" -d "Create scaffold"
complete -c claude-mode -n "__fish_seen_subcommand_from config" -a "add-default" -d "Add to defaultModifiers"
complete -c claude-mode -n "__fish_seen_subcommand_from config" -a "remove-default" -d "Remove from defaultModifiers"
complete -c claude-mode -n "__fish_seen_subcommand_from config" -a "add-modifier" -d "Register named modifier"
complete -c claude-mode -n "__fish_seen_subcommand_from config" -a "remove-modifier" -d "Unregister named modifier"
complete -c claude-mode -n "__fish_seen_subcommand_from config" -a "add-axis" -d "Register custom axis value"
complete -c claude-mode -n "__fish_seen_subcommand_from config" -a "remove-axis" -d "Unregister custom axis value"
complete -c claude-mode -n "__fish_seen_subcommand_from config" -a "add-preset" -d "Create custom preset"
complete -c claude-mode -n "__fish_seen_subcommand_from config" -a "remove-preset" -d "Remove custom preset"
complete -c claude-mode -n "__fish_seen_subcommand_from config" -a "help" -d "Show config help"

# Config global flag
complete -c claude-mode -n "__fish_seen_subcommand_from config" -l global -d "Use global config"

# Inspect options (all main flags plus --print)
complete -c claude-mode -n "__fish_seen_subcommand_from inspect" -l base -d "Base prompt" -r
complete -c claude-mode -n "__fish_seen_subcommand_from inspect" -l agency -d "Agency level" -r
complete -c claude-mode -n "__fish_seen_subcommand_from inspect" -l quality -d "Quality level" -r
complete -c claude-mode -n "__fish_seen_subcommand_from inspect" -l scope -d "Scope level" -r
complete -c claude-mode -n "__fish_seen_subcommand_from inspect" -l modifier -d "Custom modifier" -r -F
complete -c claude-mode -n "__fish_seen_subcommand_from inspect" -l readonly -d "Prevent file modifications"
complete -c claude-mode -n "__fish_seen_subcommand_from inspect" -l context-pacing -d "Include context pacing prompt"
complete -c claude-mode -n "__fish_seen_subcommand_from inspect" -l print -d "Print the prompt"
complete -c claude-mode -n "__fish_seen_subcommand_from inspect" -l append-system-prompt -d "Append text to system prompt" -r
complete -c claude-mode -n "__fish_seen_subcommand_from inspect" -l append-system-prompt-file -d "Append file to system prompt" -r -F
complete -c claude-mode -n "__fish_seen_subcommand_from inspect" -l help -d "Show help"

# Main options
complete -c claude-mode -l base -d "Base prompt" -r
complete -c claude-mode -l agency -d "Agency level" -r
complete -c claude-mode -l quality -d "Quality level" -r
complete -c claude-mode -l scope -d "Scope level" -r
complete -c claude-mode -l modifier -d "Custom modifier" -r -F
complete -c claude-mode -l readonly -d "Prevent file modifications"
complete -c claude-mode -l context-pacing -d "Include context pacing prompt"
complete -c claude-mode -l print -d "Print assembled prompt"
complete -c claude-mode -l append-system-prompt -d "Append text to system prompt" -r
complete -c claude-mode -l append-system-prompt-file -d "Append file to system prompt" -r -F
complete -c claude-mode -l help -d "Show help"

# Base values
${bases}

# Agency values
${agencies}

# Quality values
${qualities}

# Scope values
${scopes}

# Axis completions for config add-axis
complete -c claude-mode -n "__fish_seen_subcommand_from config; and __fish_seen_subcommand_from add-axis" -a "agency quality scope"
complete -c claude-mode -n "__fish_seen_subcommand_from config; and __fish_seen_subcommand_from remove-axis" -a "agency quality scope"
`;
}

function getPresetDescription(preset: typeof PRESET_NAMES[number]): string {
  const descriptions: Record<typeof PRESET_NAMES[number], string> = {
    create: "autonomous / architect / unrestricted",
    extend: "autonomous / pragmatic / adjacent",
    safe: "collaborative / minimal / narrow",
    refactor: "autonomous / pragmatic / unrestricted",
    explore: "collaborative / architect / narrow (readonly)",
    none: "no behavioral instructions",
    debug: "collaborative / pragmatic / narrow (investigation mode)",
    methodical: "surgical / architect / narrow (step-by-step)",
    director: "collaborative / architect / unrestricted (agent delegation)",
  };
  return descriptions[preset];
}

export function printCompletions(shell: "bash" | "zsh" | "fish"): void {
  let output: string;
  switch (shell) {
    case "bash":
      output = generateBashCompletion();
      break;
    case "zsh":
      output = generateZshCompletion();
      break;
    case "fish":
      output = generateFishCompletion();
      break;
  }
  process.stdout.write(output);
}
