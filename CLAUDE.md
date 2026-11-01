## Agent skills

### Issue tracker

Issues are tracked in GitHub Issues via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Default vocabulary: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `GLOSSARY.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.

## Implementing issues

Strict rules when asked to implement a GitHub issue with `/mattpocock-skills:implement`:

1. **Worktrees.** By default, work in the main worktree, one issue and one branch at a time. Before starting, check out `main` and pull it. Use one extra worktree per issue (created from an up-to-date `main`) when the user asks for several issues in parallel, or when it is clear from context that several issues must be worked on at the same time. Decide this yourself without asking the user. Never work on two issues in the same worktree, and remove each extra worktree once its PR is open.
2. **Branch per issue.** Create the branch from `main`: `<issue-number>-<short-kebab-slug>` (e.g. `12-parse-renfe-gtfs`). All work for the issue happens on that branch, in its own worktree if extra worktrees are in use.
3. **Commits via `/commit:commit`.** Make every commit with that skill. When it asks, choose **commit and push** yourself, without asking the user.
4. **Open a PR when done.** Use `gh pr create` against `main`. The PR body includes `Closes #<issue-number>` so merging the PR closes the issue automatically.

## Code conventions

- **Relative imports end in `.js`**, even though the files are `.ts` (`import { Hub } from './hub.js'`). The repo uses `module`/`moduleResolution: NodeNext` and ESM (`"type": "module"`), where TypeScript requires the extension (TS2835 without it) and Node needs it at runtime. TypeScript resolves `./hub.js` to `hub.ts`. Never write `.ts` or omit the extension.
