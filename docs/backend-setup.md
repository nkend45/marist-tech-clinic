# Part 1 Backend Setup

This is backend preparation only. No Supabase project, database migration, secrets, or Edge Function have been provisioned or deployed. The code has not been verified against a live Supabase project. Part 2 authentication, CRM tables, claiming leads, notifications, and email delivery are not implemented.

## Architecture And Permissions

- Browser -> `POST /functions/v1/submit-request` -> server-only `public.submit_inbound_request(jsonb, text)` RPC -> `private.inbound_requests`.
- Both assessments and contact messages go to the same private table. UUIDs come from PostgreSQL `gen_random_uuid()`, not the visitor. `source` is fixed to `Inbound form`, `inserted_by` to `system`, and `inserted_at` is a database timestamp. The honeypot and raw IP are not saved.
- Both private tables have forced row-level security and no policies. The schema and tables revoke access from `PUBLIC`, `anon`, `authenticated`, and `service_role`. Do not expose the `private` schema in Supabase API settings. Portal users intentionally cannot read or write these tables yet.
- The `SECURITY DEFINER` RPC has an empty search path and fully qualified table references. It runs as its migration owner (normally the Supabase `postgres` role, which can bypass RLS). Only `service_role` gets `EXECUTE`; `PUBLIC`, `anon`, and `authenticated` do not. Keep the owner privileged and do not grant browser roles access. Other unrelated existing Supabase tables/functions are not changed by this migration.
- The service role credential is read from `SUPABASE_SERVICE_ROLE_KEY` in the Edge runtime only. It is sent only to the project's PostgREST endpoint. The function never forwards a caller's Authorization header to the database. Never put service role credentials or `IP_HASH_SECRET` in any `PUBLIC_*` variable, browser bundle, repository, or public host configuration.
- The frontend must not insert into tables or call the RPC directly. Use only the Edge endpoint. A success response means the RPC returned a saved UUID. Rejected honeypots, rate limits, network errors, and database errors never return success.

## Later Manual Setup

These steps are instructions for the project owner, not actions already performed. A free Supabase project is sufficient for this design within its current quotas; pricing, project inactivity behavior, and quotas should be checked before deployment. There is no paid CAPTCHA or external rate-limit database.

1. Create a free Supabase project and retain its database password privately. Get the project reference, project URL, and publishable API key from project settings. Protect dashboard access with MFA.
2. Install the official Supabase CLI and, for local database testing, Docker and a PostgreSQL `psql` client. Node 20+ runs the dependency-free unit tests (verified here on Node 24.11.1).
3. From the project root, log in and link the correct project. Check the proposed migration before applying it. Do not run `supabase db reset` against a remote or non-disposable database.

```sh
cd "/Users/nick/Documents/Cherry Projects/marist-tech-clinic"
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase db push --dry-run
supabase db push
```

The migration is `supabase/migrations/20261007000100_private_inbound_requests.sql`. Keep `public` in the project's API exposed schemas so the service-only RPC is reachable; keep `private` out. Apply as the normal Supabase migration owner, not an anonymous/API user. The migration explicitly revokes RPC/table grants that Supabase defaults might otherwise give browser roles.

4. Generate a random HMAC secret (at least 32 characters, preferably 32 random bytes rendered as hex; for example, `openssl rand -hex 32`). Keep it private. Configure these **Edge Function secrets** through the Supabase dashboard or a local ignored secrets file via `supabase secrets set --env-file /absolute/path/to/private-file`. Never commit that file or paste actual secrets into documentation.

| Edge Variable | Meaning |
| --- | --- |
| `SUPABASE_URL` | Project URL; supplied automatically by hosted Supabase. |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only legacy service role JWT; supplied automatically by hosted Supabase. Not the publishable key. |
| `ALLOWED_ORIGINS` | Comma-separated exact frontend origins, such as `https://clinic.example.org,https://www.clinic.example.org`. No wildcard, path, trailing slash, or `null`. Local loopback HTTP origins such as `http://localhost:4321` are allowed for development. |
| `IP_HASH_SECRET` | Random server-only HMAC-SHA256 key, at least 32 characters. Stable across instances. Rotation resets practical IP quotas; plan rotation deliberately. |
| `TRUSTED_PROXY_HOPS` | Required positive integer (1-10); verified number of trusted rightmost `X-Forwarded-For` entries up to the original client. See the proxy prerequisite below. |

Missing or invalid settings fail closed with `503`, never a permissive fallback.

### Proxy Prerequisite

The limiter selects the entry `TRUSTED_PROXY_HOPS` positions from the **right** of `X-Forwarded-For`, validates it as an IP, canonicalizes IPv6 and IPv4-mapped IPv6, then HMAC-hashes it. A caller-supplied first entry is never trusted automatically. For a gateway that appends the actual remote client as the last entry, use `1`. A deployment with a trusted additional proxy may need `2` or another verified count.

Do not assume the hosted proxy behavior has been tested here. Before accepting public traffic, verify the documented/observed header rewriting for the deployment: requests from the same client with varying spoofed leading entries must consume the same quota, and distinct clients must not all resolve to an internal gateway address. The gateway must append or overwrite these entries with trustworthy values and the function must not be directly reachable around it. If this cannot be established, keep the function unavailable and adapt the IP extraction to a provider-guaranteed header. Missing/invalid IP metadata returns `503` and does not use an attacker-controlled fallback. Local `supabase functions serve` may not add this header; local test requests can supply it explicitly, which is a test fixture, not evidence of trusted production behavior.

5. Deploy the Edge Function with the public authentication choice below.

```sh
supabase functions deploy submit-request --project-ref YOUR_PROJECT_REF --no-verify-jwt
```

`supabase/config.toml` also sets `verify_jwt = false` for **this function only**. This is deliberate: neither form requires an account, and new `sb_publishable_...` keys are not user JWTs. Do not put a publishable key in `Authorization: Bearer ...` and expect legacy JWT verification to accept it. This implementation is an anonymous public endpoint; it does not claim a public API key authenticates a person. The browser sends its publishable key in `apikey` for project routing/SDK compatibility. The handler itself does not enforce that public key, because it is public and is not a meaningful anti-abuse boundary. Signed-in users are not required; browser database permissions remain denied regardless of this function's gateway setting.

CORS accepts only configured exact origins, rejects missing/`null` Origin, supports `POST`/`OPTIONS`, and never uses wildcard credentials. CORS is a browser boundary, not authentication: scripts can forge an Origin and publishable key. The size limits, honeypot, strict validation, and database quota reduce abuse but do not eliminate spam, botnets, IPv6 address rotation, or invocation-quota exhaustion. Add stronger abuse controls later if needed.

## Browser Contract

Set these public build variables for the future frontend deployment, using only the publishable key:

```dotenv
PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
```

They are intentionally public. There is no need for a browser service role or authenticated visitor. The canonical payload is:

```js
{
  kind: 'assessment', // or 'contact'
  organization: '',
  name: '',
  role: '',
  email: '',
  phone: '',
  organizationType: '',
  town: '',
  staff: '',
  itSupport: '',
  services: [],
  message: '',
  reachBy: 'Email', // or 'Phone'
  consent: false,
  region: '', // e.g. 'Newburgh' from the regional page; not an authorization claim
  website: '' // hidden honeypot, NOT an organization website field
}
```

Assessment requires `organization`, `name`, valid `email`, `town`, and `consent: true`. Choosing `reachBy: 'Phone'` additionally requires a valid phone. Contact requires only `name`, valid `email`, and nonempty `message`; assessment-only fields can be omitted, and consent defaults to `false`. Optional fields, if supplied, still must have the correct types and allowed values. No optional blank values should be sent as `null`.

| Dropdown/Checkbox | Exact Values (Blank/Omitted Also Allowed) |
| --- | --- |
| `organizationType` | `Small business`, `Nonprofit`, `School / library`, `Government / public agency`, `Other` |
| `staff` | `1-5`, `6-15`, `16-50`, `50+` |
| `itSupport` | `Nobody in particular`, `A staff member`, `An outside IT company`, `Not sure` |
| `services` | `Cybersecurity`, `Technology`, `Software Development`, `Data & Analytics`, `AI Enablement`, `Not sure, start with the free assessment` |

Services must be an array of at most six listed values; duplicates are deduplicated. Labels may differ visually, but option values must match exactly. Unknown properties, client-supplied IDs/source/audit fields, strings instead of booleans, non-string text, control characters, and any populated honeypot (even spaces) are rejected. Multiline text is allowed only in `message`. Email validation is syntactic, not an assertion of delivery or ownership. Phone validation permits common punctuation and extensions with 7-20 digits; it does not assert a working phone line.

Text limits (Unicode code points, checked before trimming): organization 200; name/role/town/region 120; email 254; phone 40; organizationType/itSupport 80; staff 10; message 5,000; reachBy 5; honeypot 200. Entire JSON body is capped at 24 KiB, including UTF-8 and JSON overhead, even without Content-Length. The byte limit can reject a form before an individual field's character limit. Do not ask for passwords, client records, network secrets, payment details, or financial information; plain text is stored and must be escaped on any future display, never rendered as HTML.

Example browser integration (adapt to the frontend's environment accessor; no frontend files are changed by this backend preparation):

```js
const response = await fetch(`${publicSupabaseUrl}/functions/v1/submit-request`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    apikey: publicSupabasePublishableKey,
  },
  body: JSON.stringify(payload),
});
const result = await response.json();
if (response.status === 201 && result.ok === true && result.requestId) {
  // Only now clear the form and show the approved thank-you copy.
} else {
  // Keep the entered values; show result.error/fields and honor Retry-After on 429.
}
```

Responses: `201 {ok:true, requestId}` only after a confirmed insert; `422 {ok:false,error,fields}` for invalid fields; `400` malformed JSON; `403` disallowed origin/preflight; `405` wrong method; `413` oversize body; `415` non-JSON; `429` rate limit with `Retry-After`; `503` configuration, IP metadata, or unconfirmed database/network failure. OPTIONS succeeds with `204` and never touches the database. Error bodies do not reveal database details or secrets. No application logging of payloads, emails, IPs, or credentials is performed; review the hosting provider's own request-log retention separately.

A lost response or timeout can happen after a committed insert. No automatic success is returned, but a retry may create a duplicate. Part 1 has no idempotency key and does not send confirmation emails or guarantee a team response. Use the brief's thank-you copy only when the clinic can actually honor its stated two-business-day follow-up.

## Rate Limits And Retention

One database RPC transaction enforces shared quotas across assessment/contact and all function instances: five saved requests per IP hash per fixed 15-minute UTC bucket, and twenty per fixed UTC day bucket. Atomic UPSERT row locks prevent simultaneous requests from exceeding a bucket's limit. Insert failures roll back both quota updates. A daily-denied attempt may consume a short-window hit, but never creates an inbound request. Retries and two genuine organizations sharing a NAT also share quotas. Fixed windows can allow bursts around a boundary; this is not a sliding-window or distributed-bot defense. Validation failures happen before quota consumption and still use Edge invocation resources.

Each rate bucket has an expiry; current-window keys ignore expired buckets. Each valid RPC removes up to 1,000 expired rows with `SKIP LOCKED`. Cleanup is opportunistic, not an automatic retention guarantee: when there is no new traffic, old hashes remain. An owner can periodically run `delete from private.inbound_rate_buckets where expires_at <= now();` through the private SQL editor or schedule approved database maintenance later. No cron job is provisioned here. Inbound requests have no automatic deletion; establish a contact-data retention/access policy before production and avoid collecting sensitive data. IP HMACs are pseudonymous identifiers, not a claim of irreversible anonymization.

The dashboard SQL editor, used only by an authorized project owner, can inspect records with `select * from private.inbound_requests order by inserted_at desc;`. There is no browser-accessible inbox or Part 2 admin login in this preparation. Never weaken RLS/grants to build a temporary public inbox.

## Local Verification

The dependency-free validator and handler tests use Node's built-in test runner and Web APIs. The Deno entry point imports the same `.mjs` modules and uses native fetch, avoiding SDK dependency installation.

```sh
cd "/Users/nick/Documents/Cherry Projects/marist-tech-clinic"
node --test supabase/tests/submit-request.test.mjs
```

Prepared SQL assertions can run against an empty disposable local Supabase database **after** applying migrations:

```sh
supabase start
supabase db reset
psql "$LOCAL_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/database.sql
```

Get the local PostgreSQL connection string from `supabase status` and assign it privately to `LOCAL_DATABASE_URL`. Confirm it is localhost, not the hosted project. The SQL script creates test requests inside a transaction and rolls back; it checks grants, forced RLS, audit defaults, rollback on invalid insert, both quotas, and expired-bucket cleanup. It intentionally requires an otherwise empty local test database and is not a concurrent stress test.

Verification performed during preparation: **16 Node tests passed** on Node 24.11.1, covering validation, all field lengths, honeypot, enums, consent, IP canonicalization/HMAC, spoofed leading proxy entries, exact CORS/preflight, method/content type, streamed byte caps, server-only RPC credentials, rate-limit responses, and fail-closed errors. These use a mocked database transport, not live Supabase. The SQL script, Deno runtime, deployment, actual gateway header behavior, real concurrency, live CORS, real persistence, and browser end-to-end submission have **not** been verified here. `supabase`, `deno`, and `psql` were unavailable in the preparation environment. Before enabling production traffic, run the SQL assertions, test parallel calls against local buckets, confirm anonymous/authenticated API attempts are denied, test both forms on the deployed allowlisted origin, and perform the proxy checks above. No promise of live verification is made.
