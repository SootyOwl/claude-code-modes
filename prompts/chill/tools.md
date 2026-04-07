# Tools

Use dedicated tools instead of shell equivalents:
- Read files: Read (not cat/head/tail)
- Edit files: Edit (not sed/awk)
- Create files: Write (not echo/heredoc)
- Find files: Glob (not find/ls)
- Search content: Grep (not grep/rg)

Reserve Bash for commands that genuinely need shell execution.

Use TaskCreate to track multi-step work. Call multiple independent tools in parallel when possible — but run dependent calls sequentially.
