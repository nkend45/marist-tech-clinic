# Marist Tech Clinic

Part 1 public website, prepared for GitHub Pages. The private CRM is a separate second stage. Real outreach records are never bundled into this site.

## Run locally

Requires Node.js 22.12+ and npm. Dependencies install inside this project only.

```sh
npm ci
npm run dev -- --host 127.0.0.1
```

Open `http://localhost:4321`. Without backend configuration, forms clearly report that submissions are unavailable. A preview is not an operating request service.

## Connect submissions

Follow `docs/backend-setup.md` to create your own free Supabase project, apply the migration and deploy its public submission endpoint. Copy `.env.example` to `.env` locally and set the project URL and **publishable** key. Never put a secret or service-role key in any `PUBLIC_` variable, browser file or GitHub repository. Restart the dev server after changing configuration.

Before launching, verify a real test assessment and contact submission in your database, anonymous read/update denial and rate limiting. Use fictitious test data. Delete test records through trusted administration only.

## Check the site

```sh
npm run build
node --test tests/static-site.mjs
```

Also build for a repository path:

```sh
PUBLIC_SITE_URL=https://example.github.io PUBLIC_BASE_PATH=/marist-tech-clinic npm run build
PUBLIC_BASE_PATH=/marist-tech-clinic node --test tests/static-site.mjs
```

These checks cover generated routes, internal links, service coverage and common private-data leaks. They do not substitute for live database-policy tests or browser accessibility review.

## Publish to GitHub Pages

Publishing requires approval. Nothing in this project creates a repository or pushes automatically. The included workflow is manual dispatch only.

1. Make sure `gh` is available and run `gh auth status`. If signed out, run `gh auth login` yourself. Do not share passwords or tokens.
2. After approving publication, create/use the intended repository and push only reviewed source files. `.gitignore` excludes local environments, spreadsheets, CSVs and QA output; still review the staged diff.
3. In repository Settings → Pages, choose **GitHub Actions**.
4. In Settings → Secrets and variables → Actions → Variables, set `PUBLIC_SUPABASE_URL` and `PUBLIC_SUPABASE_PUBLISHABLE_KEY` (only public configuration).
5. Run **Publish clinic website** under Actions. The workflow derives the site's origin and repository base path from Pages configuration.
6. Add the final site origin to the backend's allowed origins, verify its forms, direct page links and metadata at the actual deployment URL.

GitHub Free Pages uses a public repository. Private contact data, original workbooks, SQL dumps and backend secrets must stay outside it. The visible `/team` application in a future stage will enforce data privacy through the backend; static files themselves cannot be private on Pages.

## Content to finish before public launch

- Upload the approved catalog as `public/files/marist-tech-clinic-services.pdf` and enable its download link.
- Fill official clinic contact details, remaining team cards and approved imagery/branding when available.
- Confirm the promised two-business-day response can be staffed.
- Confirm faculty-supported wording and official institutional naming are approved.
- Keep client proof hidden until genuine approved material exists.

## Next: private outreach portal

Implement Part 2 only after Part 1 works. It includes authenticated Marist accounts, non-self-editable admin/member roles, database row-level security, workbook import, activity and audit history, follow-ups, mailto composition, pipeline, routes, dashboard and protected QR generation. Full requirements remain in Eagle's supplied brief; no real workbook data should be copied into public fixtures.

Supabase's default email service is restricted to project-team addresses and is unsuitable for general student login. Configure a suitable free SMTP service with a verified sender before deploying email authentication. Free database projects can pause after inactivity, so the $0 setup is subject to the provider's limits; no paid subscription is enabled by this project.
