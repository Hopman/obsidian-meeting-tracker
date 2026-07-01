# Obsidian Meeting Tracker

Automatically generates and maintains a daily checklist of meetings in your daily note.

## How it works

The plugin scans your vault for notes with `type: Meeting` in the frontmatter and injects a checklist into today's daily note. The checklist reflects whether each meeting has been processed.

```markdown
### Meetings

<!-- meetings:start -->
- [ ] [[2026-06-30 - Standup]]
- [/] [[2026-06-30 - Quarterly Review]]
<!-- meetings:end -->
```

The daily note is a read-only projection — edits inside the markers are overwritten. The source of truth is always the meeting note's frontmatter.

## Requirements

### Meeting notes

A note is treated as a meeting when its frontmatter contains:

```yaml
---
type: Meeting
date: 2026-06-30
Processed: false
---
```

### Daily notes

Daily notes must follow this path structure:

```
YYYY/MM/ww/YYYY-MM-DD.md
```

Where `ww` is the ISO 8601 week number, zero-padded (e.g. `26`).

The `### Meetings` heading and markers are expected to be present via your Templater template. If they are missing, the plugin prepends the block at the top of the file.

## Checklist states

| `Processed` value | Checklist item |
| ----------------- | -------------- |
| `false`           | `- [ ]`        |
| `true`            | `- [/]`        |

Meetings are ordered by file creation time (ascending).

## Triggers

The checklist is updated automatically on:

- Obsidian startup
- Opening today's daily note
- Any change to a meeting note's frontmatter

All triggers are debounced by 1 second. A manual trigger is also available via the command palette.

## Commands

| Command                  | Description                        |
| ------------------------ | ---------------------------------- |
| Update Today's Meetings  | Manually sync the meeting checklist |

## Installation

1. Run `npm install && npm run build`
2. Copy `main.js` and `manifest.json` to your vault at:
   ```
   .obsidian/plugins/daily-meetings-tracker/
   ```
3. Enable the plugin in Obsidian under Settings → Community Plugins

## Development

```bash
npm install
npm run dev     # watch mode
npm run build   # production build
```
