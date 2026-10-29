# AGENTS.md

## Agent skills

### Issue tracker

Issues are tracked in GitHub Issues on `ecarlste/get-a-job-dude` via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Default vocabulary: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one root `GLOSSARY.md` plus `docs/adr/`. See `docs/agents/domain.md`.

## Commits

[Conventional Commits](https://www.conventionalcommits.org/), enforced by commitlint (`commitlint.config.js`) on the `commit-msg` hook (`lefthook.yml`) and in CI. When a commit implements an issue, reference it in the footer (`Refs #12` / `Closes #12`) so `/code-review` can find the spec.
