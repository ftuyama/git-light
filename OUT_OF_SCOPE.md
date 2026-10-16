# Out of Scope

Features Git Light deliberately does **not** plan to implement. This list reflects product direction: a focused local Git client for repositories you already have on disk — not a full replacement for commercial Git clients with hosting, onboarding, or enterprise collaboration layers.

For what **is** planned, see [README.md](README.md).

---

## Onboarding & repository acquisition

| Feature | Rationale |
|---------|-----------|
| In-app clone with hosting auth (OAuth token flows, private-host browsing) | Users authenticate with SSH keys or their system credential manager; in-app OAuth adds account/token storage and API churn that duplicate the host UI. |

**In scope:** startup screen with recent repositories, open-folder dialog, `git clone` into a chosen folder (SSH/credential-manager auth, progress + cancel), `git init` for new repositories, and folder discovery (open a subfolder resolves to the repo root; scanning a parent folder lists nested repositories).

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
| Submodule management UI | Parser awareness only; full UI is a separate product surface. |

---

## AI & automation

| Feature | Rationale |
|---------|-----------|
| AI-generated commit messages | Out of product scope; optional editor/CLI tools exist. |

---

## Explicit non-goals

- **Not a full commercial Git client clone** — core local workflows only; intentional scope, not a backlog to close entirely.
- **Not a hosting client** — no substitute for github.com, GitLab, or desktop auth flows.
- **Not an IDE** — no built-in editor or CI dashboard. (External terminal launcher via `git_open_terminal_external` is in scope; it opens the system terminal, it does not embed one.)

---

## Review

Revisit this list when scope changes. Anything removed here should gain a milestone or README entry before implementation starts.
