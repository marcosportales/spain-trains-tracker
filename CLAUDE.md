## Agent skills

### Issue tracker

Issues are tracked in GitHub Issues via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Default vocabulary: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `GLOSSARY.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.

## Implementing issues

Strict rules when asked to implement a GitHub issue with `/mattpocock-skills:implement`:

1. **Single worktree.** Work in the main worktree, one branch at a time. Before starting, check out `main` and pull it.
2. **Branch per issue.** Create the branch from `main`: `<issue-number>-<short-kebab-slug>` (e.g. `12-parse-renfe-gtfs`). All work for the issue happens on that branch.
3. **Commits via `/commit:commit`.** Make every commit with that skill. When it asks, choose **commit and push** yourself, without asking the user.
4. **Open a PR when done.** Use `gh pr create` against `main`. The PR body includes `Closes #<issue-number>` so merging the PR closes the issue automatically.
