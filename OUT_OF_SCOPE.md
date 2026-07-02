# Out of Scope

Features Git Light deliberately does **not** plan to implement. This list reflects product direction: a focused local Git client for repositories you already have on disk — not a full replacement for commercial Git clients with hosting, onboarding, or enterprise collaboration layers.

For what **is** planned, see [README.md](README.md).

---

## Onboarding & repository acquisition

| Feature | Rationale |
|---------|-----------|
| **Clone repository** | Users clone with `git clone` (or their host's UI) and open the folder in Git Light. In-app clone adds auth, progress UX, and path picking that duplicate the shell and hosting clients. |
| Init new repository UI | Creating a repo is a one-line `git init`; open-folder covers the common path. |

**In scope instead:** startup screen with recent repositories and open-folder dialog.

---

## Hosting & account integrations

| Feature | Rationale |
|---------|-----------|
| OAuth sign-in (GitHub, GitLab, Bitbucket, Azure DevOps) | Large maintenance surface; API churn; account/token storage. |
| Pull request creation or management | Requires deep host APIs and workflow UI beyond local Git. |
| Issue tracker links | Host-specific; low value without OAuth. |
| CI pipeline status on commits | Requires host APIs (GitHub Actions, GitLab CI, etc.), polling or webhooks, and auth — same surface as OAuth integrations. |
| Multi-account / multi-org profiles | Enterprise multi-account territory. |
| Avatars or metadata from hosting APIs | Gravatar from commit email is sufficient for local work. |

**In scope instead:** parse `remote -v` for basic “open on GitHub” (or equivalent) deep links where possible.

---

## Enterprise & team collaboration

| Feature | Rationale |
|---------|-----------|
| Cloud patches / shared team workflows | Not a local-first Git client concern. |
| Conflict prevention (pre-merge policy checks) | Enterprise feature; depends on host integration. |
| AI-assisted conflict resolution | Paid-tier commercial feature; heavy ML/product coupling. |

---

## Power-user & niche Git surfaces

| Feature | Rationale |
|---------|-----------|
| Git LFS UI | Niche; large implementation for file-pointer workflows. |
| Submodule management UI | Parser awareness only; full UI is a separate product surface. |
| Bisect UI | Rare workflow; CLI remains the right tool. |
| Command palette | Toolbar, context menus, and shortcuts cover core actions; a global searchable launcher is large UX infrastructure for marginal gain in a focused client. |
| Multi-repo tabs | Complicates shell, state, and memory; one repo per window is the model. |

---

## AI & automation

| Feature | Rationale |
|---------|-----------|
| AI-generated commit messages | Out of product scope; optional editor/CLI tools exist. |

---

## Explicit non-goals

- **Not a full commercial Git client clone** — core local workflows only; intentional scope, not a backlog to close entirely.
- **Not a hosting client** — no substitute for github.com, GitLab, or desktop auth flows.
- **Not an IDE** — no built-in editor, terminal replacement, command palette, or CI dashboard.

---

## Review

Revisit this list when scope changes. Anything removed here should gain a milestone or README entry before implementation starts.
