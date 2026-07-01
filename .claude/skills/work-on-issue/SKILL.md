---
name: work-on-issue
description: Fetch a GitHub issue, clarify with the user, implement the fix, verify the build and logic, get user approval, then commit and close. Use when the user provides a GitHub issue URL and wants to implement it for the obsidian-meeting-tracker project.
---

# Work on Issue

## Quick start

```
/work-on-issue https://github.com/Hopman/obsidian-meeting-tracker/issues/1
```

## Workflow

### 1. Fetch the issue

```bash
gh issue view <url> --json title,body,comments
```

Read the issue title, description, and any comments in full.

### 2. Clarify before starting

Identify anything ambiguous in the issue — edge cases, scope, preferred approach — and ask the user in a single message before touching any code. Do not start implementing until the user has answered.

### 3. Implement

- Main source: `src/main.ts`
- Keep changes focused on what the issue describes; no unrelated cleanup

### 4. Verify

Run the build (type-check + bundle):

```bash
export NVM_DIR="$HOME/.nvm" && . "$NVM_DIR/nvm.sh" && nvm use v24 && npm run build
```

Then self-review the changed code:
- Does the logic match the issue requirements?
- Are edge cases handled?
- No regressions introduced?

Fix any build errors or logic issues before proceeding.

### 5. Confirm with user

Show a concise summary:
- What changed and why
- Any edge cases or tradeoffs worth noting

Ask: "Does this look good to commit?"

### 6. Commit and close

On approval:

```bash
git add <changed files>
git commit -m "<message>\n\nCloses #<issue-number>\n\nCo-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
gh issue close <url>
```

Use a commit message that explains *why*, not just what.
