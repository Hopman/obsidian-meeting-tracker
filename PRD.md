# Obsidian Plugin PRD — Daily Meetings Tracker

## 1. Purpose

Automatically generate and maintain a daily checklist of meetings inside the user's daily note.

The checklist is a **read-only projection** of meeting notes for the day.

---

## 2. Core Concept

The plugin builds a derived view:

> "What meetings do I have today, and are they processed?"

---

## 3. Data Model

### Meeting Note

A note is considered a meeting if its frontmatter contains:

```yaml
type: Meeting
date: YYYY-MM-DD
Processed: boolean
```

No other fields matter. Meeting notes may live anywhere in the vault.

---

### Daily Note

Location:

```
YYYY/MM/ww/YYYY-MM-DD.md
```

`ww` is the ISO 8601 week number, zero-padded, no prefix (e.g. `26`).

---

## 4. Output Structure (Daily Note)

The `### Meetings` heading is inserted by the Templater template when the daily note is created. The plugin owns all content between `### Meetings` and the next heading of equal or higher level (or end of file).

```markdown
### Meetings

- [ ] [[2026-05-30 - Refinement]]
- [/] [[2026-05-30 - Kwartaalreview]]
```

No HTML comment markers. The heading itself is the boundary.

### Mapping rules

| Meeting state      | Rendered as |
| ------------------ | ----------- |
| `Processed: false` | `- [ ]`     |
| `Processed: true`  | `- [/]`     |

---

## 5. Ordering Rule

Meetings are sorted by:

> file creation time (ascending)

---

## 6. Scope Rules

Include only meetings where:

```text
type === "Meeting"
AND
date === today
```

Scan the entire vault. No exceptions.

---

## 7. Sync Strategy

### Source of truth

* Meeting note frontmatter (`Processed`)

### Derived artifact

* Daily note checklist

---

## 8. Sync Behavior

### Mode: One-way sync

* Meeting → Daily note
* Any content between `### Meetings` and the next heading is owned by the plugin and will be overwritten

---

## 9. Update Triggers

Plugin runs on:

1. Obsidian startup
2. Opening today's daily note
3. Any meeting note change (frontmatter via `metadataCache`)
4. Manual command: "Update Today's Meetings"

All triggers are debounced at **1 second**.

---

## 10. File Handling

If the daily note does not exist:

* Create folder structure recursively if missing
* Create file with `### Meetings` heading and the list at the top

If `### Meetings` is missing from an existing daily note:

* Prepend the heading and list at the top of the file

---

## 12. Optimization

Before writing:

* Compare generated block vs existing block
* Only write the file if content differs

---

## 13. UX Requirements

* No settings UI
* Command palette entry: "Update Today's Meetings" (supports hotkey binding)
* Fully automatic — enabled by default on startup

---

## 14. Implementation

| Item            | Value                                    |
| --------------- | ---------------------------------------- |
| Plugin ID       | `daily-meetings-tracker`                 |
| Display name    | Daily Meetings Tracker                   |
| Min app version | 1.7.0                                    |
| Language        | TypeScript                               |
| Bundler         | esbuild                                  |
| Entry point     | `src/main.ts`                            |
| Output          | `main.js` (CJS, ES2022 target)           |
| API             | Obsidian 1.13.1                          |
