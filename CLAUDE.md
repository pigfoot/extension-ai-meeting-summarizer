# Claude.md - Project Guidelines

## Project Overview

This is a Chrome Extension v3 called "Meeting Summarizer" that automatically transcribes and summarizes SharePoint meeting recordings using AI. The extension detects SharePoint meeting pages, extracts video manifest URLs, and processes them through a backend API to generate intelligent summaries.

## Basic Configuration
- Respond and communicate in Traditional Chinese
- All code, comments, documentation, README files must be in English
- Follow all steering files under .claude/steering/ folder, bugs or issues are under .claude/bugs/ folder.
- Validate and mark tasks as complete after completion
- Using con-currency or high performance command line tools to run tools (like to use ripgrep instead of grep)

## Development and Toolchain Standards
- Always follow best practices from the community
- Always provide code diff for review before making any code modifications
- Always use pnpm instead of npm; pnpm exec instead of npx
- Always use Extensionless Imports: import from './module' instead of './module.js' or './module/index.js'

## GPG Signing for Commits
When you need to GPG sign commits:
1. Ask user for GPG passphrase first
2. Cache the passphrase: `echo "test" | gpg --batch --pinentry-mode loopback --passphrase "USER_PASSPHRASE" --clearsign >/dev/null 2>&1`
3. Then run git commit commands normally - GPG agent will use cached passphrase
4. Always add --signoff to commits: `git commit --signoff`

## Code Quality Standards
- NEVER provide untested code
- NEVER ignore build tools warnings
- NEVER ignore any lint warnings

## MCP Standards
- Use sequential-thinking MCP for complex reasoning
- Use context7 MCP or WebFetch tool when referencing code or follow best practices
