# MEMORY.md

## Goal
- Ship a static professional portfolio with richer sample content, AI study resources, and an upgraded snake game, then redeploy to `https://twlee1.github.io/`.

## Scope / Out of Scope
- In: static HTML/CSS/JS, responsive navigation, sample profile media, sample experience/research copy, AI resource links, snake game guidance, ranking HUD, difficulty, power-up, sound toggle, background music, GitHub Pages redeploy prep.
- Out: backend, shared online ranking service, framework migration, unverified personal facts, secret exposure, deployment without approval.

## Execution
- Mode: CODEX_FALLBACK
- Claude model: unavailable in this environment
- Last test: PASS

## Current State
- State: DEPLOY_APPROVAL_REQUIRED
- Completed loop: Step 9 change-request loop 4
- Next loop: commit, push, redeploy after explicit user deployment request
- Retry: 0
- Fingerprint: none
- Blocker: none
- Current commit: `2921755` + uncommitted Step 9 loop 4 changes
- Git status: dirty workspace with user exercise files, local docs, updated `CHANGE_REQUEST.json`, and new reference-section content
- Rollback: return site files to deployed commit `1386f03` if approval is withdrawn
- Last good commit / URL: `1386f03` / `https://twlee1.github.io/`

## Acceptance
- Home, Games, About, Projects, Experience, Research, Resources, Contact render correctly.
- Games is the second navigation item and second main section after Home.
- 375px, 768px, and 1440px layouts remain readable.
- Snake game keeps start, movement, food, growth, score, collision, pause, restart, best score, reverse-block behavior, combo, difficulty, ranking board, power-up, sound toggle, multiple enemies, and now includes looping background music after user interaction.
- Local verification covers JS syntax, audio loop function presence, key UI presence, and local HTTP checks before redeploy.

## Guardrails
- Do not invent private personal information.
- Do not remove existing content without cause.
- Do not delete or weaken tests or acceptance criteria.
- Do not do broad rewrites outside approved static site files.
- Do not print, log, commit, or document tokens or secrets.

## Retry / HITL
- Maximum 3 retries per issue; stop on the same fingerprint twice.
- One retry may change only one cause and related files.
- HITL is required for deployment approval, unclear content ownership, music licensing, or online/shared ranking requirements.

## Recent Loops
| Loop | State | Mode / Model | Changed Files | Test Result | Retry | Next Action |
|---|---|---|---|---|---:|---|
| 9-4 | DEPLOY_APPROVAL_REQUIRED | CODEX_FALLBACK / unavailable | `CHANGE_REQUEST.json`, `CHANGE_REQUEST.md`, `index.html`, `styles.css`, `MEMORY.md`, `AORR_LOG.md` | PASS | 0 | Commit, push, redeploy |
| 9-3 | DEPLOY_APPROVAL_REQUIRED | CODEX_FALLBACK / unavailable | `script.js`, `MEMORY.md`, `AORR_LOG.md` | PASS | 0 | Wait for redeploy approval |
| 9-2 | DEPLOY_APPROVAL_REQUIRED | CODEX_FALLBACK / unavailable | `index.html`, `styles.css`, `script.js`, `MEMORY.md`, `AORR_LOG.md` | PASS | 0 | Extend audio scope |
