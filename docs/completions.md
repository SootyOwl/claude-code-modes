# Shell Completions

`claude-mode` includes shell completion scripts for bash, zsh, and fish. These provide tab completion for subcommands, presets, flags, and their values.

## Installation

### Bash

Add to your `~/.bashrc`:

```bash
eval "$(claude-mode completion bash)"
```

Or save the completion script to the bash completions directory:

```bash
claude-mode completion bash > /usr/local/etc/bash_completion.d/claude-mode
```

On Linux:

```bash
claude-mode completion bash | sudo tee /etc/bash_completion.d/claude-mode
```

### Zsh

Add to your `~/.zshrc`:

```zsh
eval "$(claude-mode completion zsh)"
```

Or save to a directory in your `$fpath` (check with `echo $fpath`):

```bash
claude-mode completion zsh > ~/.zsh/completions/_claude-mode
```

Make sure your `.zshrc` includes:

```zsh
autoload -Uz compinit && compinit
```

### Fish

Save the completion script to fish's completions directory:

```bash
claude-mode completion fish > ~/.config/fish/completions/claude-mode.fish
```

Fish will automatically load completions from this directory.

## What's Completed

The completions provide intelligent suggestions for:

- **Presets**: `create`, `extend`, `safe`, `refactor`, `explore`, `debug`, `methodical`, `director`, `none`
- **Subcommands**: `config`, `inspect`, `completion`
- **Config subcommands**: `show`, `init`, `add-default`, `remove-default`, `add-modifier`, etc.
- **Flags**: `--base`, `--agency`, `--quality`, `--scope`, `--modifier`, `--readonly`, etc.
- **Built-in values**:
  - Bases: `standard`, `chill`
  - Agency: `autonomous`, `collaborative`, `surgical`
  - Quality: `architect`, `pragmatic`, `minimal`
  - Scope: `unrestricted`, `adjacent`, `narrow`
- **File paths** for `--modifier`, `--append-system-prompt-file`, etc.

## Examples

After installing completions, try:

```bash
claude-mode <TAB>              # Shows presets and subcommands
claude-mode c<TAB>              # Completes to 'create' or 'config'
claude-mode create --<TAB>      # Shows available flags
claude-mode create --base <TAB> # Shows 'standard' and 'chill'
claude-mode config <TAB>        # Shows config subcommands
```
