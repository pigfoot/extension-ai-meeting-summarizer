---
description: "Creates well-formatted commits with conventional commit messages and emoji"
allowed-tools:
  [
    "Bash(git add:*)",
    "Bash(git status:*)",
    "Bash(git commit:*)",
    "Bash(git diff:*)",
    "Bash(git log:*)",
  ]
---

# Claude Command: Commit

Creates well-formatted commits with conventional commit messages and emoji.

## Usage

```
/commit
/commit --no-verify
```

## Process
1. Check if environ vironment $GPG_PASSPHRASE is set
2. if sign is yes, then commit with gpg-sign by cache the passphrase first: `gpg --batch --pinentry-mode loopback --passphrase-file <(echo "$GPG_PASSPHRASE") --clearsign >/dev/null 2>&1 <<< "test"`
   otherwise commit without gpg-sign
3. Check staged files, commit only staged files if any exist
4. Analyze diff for multiple logical changes
5. Suggest splitting if needed
6. Create commit with emoji conventional format
7. Husky handles pre-commit hooks automatically
8. Always use --signoff

## Commit Format

`<emoji> <type>: <description>`

**Types:**

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `style`: Formatting
- `refactor`: Code restructuring
- `perf`: Performance
- `test`: Tests
- `chore`: Build/tools

**Rules:**

- Imperative mood ("add" not "added")
- First line <72 chars
- Atomic commits (single purpose)
- Split unrelated changes

## Emoji Map

✨ feat | 🐛 fix | 📝 docs | 💄 style | ♻️ refactor | ⚡ perf | ✅ test | 🔧 chore | 🚀 ci | 🚨 warnings | 🔒️ security | 🚚 move | 🏗️ architecture | ➕ add-dep | ➖ remove-dep | 🌱 seed | 🧑‍💻 dx | 🏷️ types | 👔 business | 🚸 ux | 🩹 minor-fix | 🥅 errors | 🔥 remove | 🎨 structure | 🚑️ hotfix | 🎉 init | 🔖 release | 🚧 wip | 💚 ci-fix | 📌 pin-deps | 👷 ci-build | 📈 analytics | ✏️ typos | ⏪️ revert | 📄 license | 💥 breaking | 🍱 assets | ♿️ accessibility | 💡 comments | 🗃️ db | 🔊 logs | 🔇 remove-logs | 🙈 gitignore | 📸 snapshots | ⚗️ experiment | 🚩 flags | 💫 animations | ⚰️ dead-code | 🦺 validation | ✈️ offline

## Split Criteria

Different concerns | Mixed types | File patterns | Large changes

## Options

`--no-verify`: Skip Husky hooks

## Notes

- Husky handles pre-commit checks
- Only commit staged files if any exist
- Analyze diff for splitting suggestions
- **NEVER add Claude signature to commits**
