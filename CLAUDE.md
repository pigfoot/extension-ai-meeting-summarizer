# Claude.md - Project Guidelines

## Project Overview

This is a Chrome Extension v3 called "Meeting Summarizer" that automatically transcribes and summarizes SharePoint meeting recordings using AI. The extension detects SharePoint meeting pages, extracts video manifest URLs, and processes them through a backend API to generate intelligent summaries.

## Basic Configuration
- Respond and communicate in Traditional Chinese
- All code, comments, documentation, README files MUST be in English
- SHOULD reference the following documents when to plan or design:
  - all project steering documents under folder `.claude/steering/`
  - all design, technical and tasks documents under folder `.claude/specs/`
  - bugs tracking or issues documments are under folder `.claude/bugs/`
- Always update tasks after fix compilation errors and validate build works

## Development and Toolchain Standards
- Always follow best practices from the community
- Always provide code diff for review before making any code modifications
- Always use pnpm instead of npm; pnpm exec instead of npx

### TypeScript & Import Standards
- **Extensionless Imports**: Use `import from './module'` instead of `'./module.js'` (exceptions: Node.js runtime packages use .js)
- **Strict Types**: Use `exactOptionalPropertyTypes: true` - optional properties must include `| undefined`
- **Union Types**: Use `type Status = 'active' | 'inactive'` instead of enums
- **Import Types**: Use `import type` only for types never used as runtime values
- Check `.claude/steering/tech.md` for complete module import strategy and package configurations

## Code Quality Standards
- NEVER provide untested code
- NEVER ignore build tools warnings
- NEVER ignore any lint warnings

## MCP Standards
- Use `sequential-thinking` MCP for complex reasoning
- Use `context7` MCP or `Web Search` tool when referencing code or follow best practices
