# GitHub Publication Guide — DoDE Expert

What belongs in the public repo, what doesn't, and how to enforce it.

---

## 1. What belongs in the repo

These are the files that make the Foundry system work. All of them should be tracked:

| Path | Purpose |
|------|---------|
| `system.json` | System manifest — Foundry reads this to load everything else |
| `scripts/**/*.mjs` | All game logic (data models, sheets, rolls, helpers, apps) |
| `templates/**/*.hbs` | Handlebars UI templates |
| `lang/*.json` | Localization (`sv.json` is the primary) |
| `styles/dode.css` | System stylesheet |
| `assets/**` | Images and icons shipped with the system (tokens, backgrounds, niva icons) |
| `packs/*/` | Compiled LevelDB compendium files (Foundry reads these directly) |
| `packs/*/_source/*.json` | Compendium source data (human-editable, git-diffable) |
| `LICENSE` | MIT license |
| `README.md` | Project landing page |
| `package.json` | Declares the `@foundryvtt/foundryvtt-cli` build dependency |
| `package-lock.json` | Lockfile for reproducible installs |

**Not tracked but notable:** This project has no `template.json` by design — actor/item types are declared in `system.json` `documentTypes` and bound via `CONFIG.Actor.dataModels` in code. This is the correct modern Foundry pattern (v12+).

---

## 2. What should be in `.gitignore`

### Current state

The existing `.gitignore` already covers the basics (`.DS_Store`, `Thumbs.db`, `node_modules/`, `.claude/`, LevelDB lock/log files, and root-level `*.md` except `README.md`). That root-level `*.md` rule is the mechanism that keeps AI working files (`ACTIVE_TASK.md`, `CLAUDE.md`, `memory.md`, `PLAN_*.md`) out of the repo while allowing `README.md` through.

### Recommended `.gitignore`

See Section 4 for the complete file. Key additions beyond what's already there:

- **`docs/ARCHITECTURE_RULE_AUDIT.md`** and **`docs/FOUNDRY_MIGRATION_PLAN.md`** — these are currently tracked. They should be removed from tracking and gitignored (see Section 3 for rationale).
- **`.vscode/`** — editor config is personal preference; don't impose it on contributors.
- **`*.log`** — catch any stray log files.

---

## 3. The `docs/` directory: what stays, what goes

This is the real question. Here's the ruling, with reasoning.

### Category A — Keep in repo

| File | Verdict | Why |
|------|---------|-----|
| `README.md` (root) | **Keep** | GitHub landing page. Users and contributors see this first. |
| Future `docs/` player/GM guides | **Keep** | "How to install", "how to create a character", etc. — these serve the end user. |
| `docs/GITHUB_PUBLICATION_GUIDE.md` (this file) | **Keep** | Maintainer reference. Small, stable, rarely changes. |

### Category B — Remove from repo

| File | Verdict | Why |
|------|---------|-----|
| `docs/ARCHITECTURE_RULE_AUDIT.md` | **Remove** | See below. |
| `docs/FOUNDRY_MIGRATION_PLAN.md` | **Remove** | See below. |

**The case against audit docs and migration plans in the repo:**

Johan's instinct is right. These documents share three problems:

1. **They're snapshots, not living documents.** The audit describes the codebase as of 2026-07-21. The migration plan describes what *should* be done. Neither updates itself when the code changes. Within weeks they'll describe a codebase that no longer exists.

2. **They're AI working documents, not deliverables.** They were generated to guide the AI agent's next session, not to document the system for contributors. A contributor reading `FOUNDRY_MIGRATION_PLAN.md` can't tell which migrations have been done, which were abandoned, and which are still planned — because the document doesn't track that. `ACTIVE_TASK.md` does, but that's (correctly) not in the repo.

3. **They create a false sense of documentation.** Having a 35KB audit doc in `docs/` signals "we document our architecture here." But if the doc drifts from reality — and it will — it's worse than having no doc at all, because contributors will trust it.

**The argument for keeping them:** institutional memory. "Why did we choose this approach?" But that information belongs in commit messages and PR descriptions, not in stale planning docs. If a design decision is important enough to document permanently, write a short `docs/DESIGN_DECISIONS.md` that's manually maintained — not an AI-generated audit dump.

**Recommendation:** Remove both from git tracking. Keep them locally for the AI agent to read (they're useful working context). The `.gitignore` rules below handle this.

### Category C — Should never enter the repo

| Pattern | Why |
|---------|-----|
| OCR extracts of source books | Copyright. These are copyrighted game books. |
| AI session transcripts | Noise. No value to contributors. |
| `PLAN_*.md`, `ACTIVE_TASK.md`, `CLAUDE.md`, `memory.md` | AI agent working files. Already gitignored via the `/*.md` root rule. |
| Generated images not used in the system UI | If an image isn't referenced by a sheet, template, or CSS, it doesn't ship. |

---

## 4. Recommended `.gitignore`

Replace the current `.gitignore` with this:

```gitignore
# === OS / Editor ===
.DS_Store
Thumbs.db
*.swp
*.swo
*~
.vscode/

# === Node / Build ===
node_modules/
.npm/
*.log

# === Foundry runtime (LevelDB noise) ===
packs/*/LOCK
packs/*/LOG
packs/*/LOG.old

# === AI agent working files ===
# CLAUDE.md, ACTIVE_TASK.md, memory.md, PLAN_*.md live at the repo root.
# They're essential for the AI agent but not part of the published system.
# The wildcard catches all root .md files; README.md is explicitly allowed.
/*.md
!/README.md

# === Docs: AI-generated analysis (not maintained, will go stale) ===
docs/ARCHITECTURE_RULE_AUDIT.md
docs/FOUNDRY_MIGRATION_PLAN.md

# === Claude Code internals ===
.claude/
```

### After updating `.gitignore`: remove the two docs from tracking

The files are currently tracked. Adding them to `.gitignore` alone won't untrack them. Run:

```bash
git rm --cached docs/ARCHITECTURE_RULE_AUDIT.md docs/FOUNDRY_MIGRATION_PLAN.md
```

This removes them from git's index without deleting the local files. They'll still exist on disk for the AI agent to read, but won't appear in future commits or on GitHub.

---

## 5. Pre-publish checklist (README and docs)

**When to update `README.md`:**

- New feature shipped that users/GMs need to know about (e.g. character wizard changes, new compendium content)
- System version bump
- Any change to installation or compatibility requirements

**When to update architectural docs:**

- `DESIGN_DECISIONS.md` (when it exists): update whenever a significant implementation choice is made that isn't obvious from reading the code — e.g. "why we use ActiveEffects for age modifiers instead of direct mutation"
- Do NOT update migration plans or audit docs after the fact — these are snapshots; once executed they serve no purpose in the repo

**Pre-push checklist (manual, run before every significant commit):**

- [ ] Does `README.md` reflect the current feature set?
- [ ] Is `system.json` version number bumped if this is a release?
- [ ] Are any new compendium source files in `packs/*/_source/` committed alongside their LevelDB?
- [ ] Are AI working files excluded (no `PLAN_*.md`, no `docs/extracts/`, no session notes)?
- [ ] Does `.gitignore` cover any new file types introduced in this commit?

---

## 6. CI pipeline

A GitHub Actions pipeline is worth having but should stay minimal. Foundry systems have no compilation step (pure ES modules), so the value is in catching mistakes before they reach users:

- **Lint JS/MJS** — ESLint with Foundry globals. Catches typos, undefined references, forgotten `await`. Low effort, high value.
- **Validate `system.json`** — check it parses as JSON, required fields exist, version matches tag. Prevents broken releases.
- **Validate compendium sources** — check every `packs/*/_source/*.json` parses as JSON. Prevents broken compendium packs.
- **No test suite yet** — automated testing of Foundry systems requires a Foundry server mock (e.g. `@phalcode/foundry-vtt-types` + Quench), which is heavy setup for a small project. Add it when the system has enough logic to justify the investment.

One workflow file, triggered on push and PR, running `eslint` and a small JSON-validation script, is the right starting point. No need to build this now — set it up when the repo goes public.
