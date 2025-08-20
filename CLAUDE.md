# Development Guidelines
## Interactive with me and code
- Respond and communicate in Traditional Chinese
- All code, comments, documentation, README files MUST be in English
## Philosophy
### Core Beliefs
- **Incremental progress over big bangs** - Small changes that compile and pass tests
- **Learning from existing code** - Study and plan before implementing
- **Pragmatic over dogmatic** - Adapt to project reality
- **Clear intent over clever code** - Be boring and obvious
### Simplicity Means
- Single responsibility per function/class
- Avoid premature abstractions
- No clever tricks - choose the boring solution
- If you need to explain it, it's too complex
## Process
### 1. Planning & Staging
- Break complex work into 3-5 stages by ultra think or `sequential-thinking` MCP
- Reference document in the followings:
  - all project steering documents under folder `.claude/steering/`
  - all design, technical and tasks documents under folder `.claude/specs/`
  - bugs tracking or issues documments are under folder `.claude/bugs/`
  - always follow the command `.claude/commands/bug-create.md` to create issue or bug.
  - Remove temporary debugging logs and test code added for bug investigation
- Update status as you progress
- Remove file when all stages are done
### 2. Implementation Flow
1. **Understand** - Study existing patterns in codebase
2. **Test** - Write test first (red)
3. **Implement** - Minimal code to pass (green)
4. **Refactor** - Clean up with tests passing
5. **Commit** - With clear message linking to plan by slash commit `/commit`
### 3. When Stuck (After 3 Attempts)
**CRITICAL**: Maximum 3 attempts per issue, then STOP.
1. **Document what failed**:
   - What you tried
   - Specific error messages
   - Why you think it failed
2. **Research alternatives**:
   - Find 2-3 similar implementations
   - Note different approaches used
3. **Question fundamentals**:
   - Is this the right abstraction level?
   - Can this be split into smaller problems?
   - Is there a simpler approach entirely?
4. **Try different angle**:
   - Different library/framework feature?
   - Different architectural pattern?
   - Remove abstraction instead of adding?
## Technical Standards
### Architecture Principles
- **Composition over inheritance** - Use dependency injection
- **Interfaces over singletons** - Enable testing and flexibility
- **Explicit over implicit** - Clear data flow and dependencies
- **Test-driven when possible** - Never disable tests, fix them
### Code Quality
- **Every commit must**:
  - Compile successfully
  - Pass all existing tests
  - Include tests for new functionality
  - Follow project formatting/linting
- **Before committing**:
  - Run formatters/linters
  - Self-review changes
  - Ensure commit message explains "why"
### Error Handling
- Fail fast with descriptive messages
- Include context for debugging
- Handle errors at appropriate level
- Never silently swallow exceptions
## Decision Framework
When multiple valid approaches exist, choose based on:
1. **Testability** - Can I easily test this?
2. **Readability** - Will someone understand this in 6 months?
3. **Consistency** - Does this match project patterns?
4. **Simplicity** - Is this the simplest solution that works?
5. **Reversibility** - How hard to change later?
## Project Integration
### Learning the Codebase
- Find 3 similar features/components
- Identify common patterns and conventions
- Use same libraries/utilities when possible
- Follow existing test patterns
### Tooling
- Use project's existing build system
- Use project's test framework
- Use project's formatter/linter settings
- If project doesn't specify it, use these modern alternatives by default:
  - **JS/TS**: `bun` > `pnpm` > `npm`, `bunx` > `pnpm exec` > `npx`
  - **Python**: `uv`/`uvx` > `pip`/`python -m`
  - **Containers**: podman > docker
  - **Rule of thumb:** Only use legacy tools if explicitly requested or if modern alternatives fail
- Only introduce new tools with strong justification
### MCP
- Use `sequential-thinking` MCP for Break complex problems
- Use `context7` MCP or `Web Search` tool when referencing code or follow best practices
### Command Preferences
Modern tools to prefer when available:
- **File search**: `fd` > `find`
- **Content search**: `rg` > `grep`
- **JSON processing**: `jq` (always prefer)
## Quality Gates
### Definition of Done
- [ ] Tests written and passing
- [ ] Code follows project conventions
- [ ] No linter/formatter warnings
- [ ] Commit messages are clear
- [ ] Implementation matches plan
- [ ] No TODOs without issue numbers
### Test Guidelines
- Test behavior, not implementation
- One assertion per test when possible
- Clear test names describing scenario
- Use existing test utilities/helpers
- Tests should be deterministic
## Important Reminders
**NEVER**:
- Use `--no-verify` to bypass commit hooks
- Disable tests instead of fixing them
- Commit code that doesn't compile
- Make assumptions - verify with existing code
**ALWAYS**:
- Commit working code incrementally
- Update plan documentation as you go
- Learn from existing implementations
- Stop after 3 failed attempts and reassess
