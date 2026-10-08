# Implementation status

This file distinguishes local work from live operational readiness. Update it with actual test results before handoff.

| Area | Current boundary |
| --- | --- |
| Public pages | Eight pages built; Astro check clean; 20 static/backend tests pass; 32 responsive page checks and mocked form interactions pass. Desktop home and mobile request screenshots reviewed. Live backend remains unverified. |
| Database | Live on Supabase project `cvzrtdnkvzpcpyqqrpgk` (free). Migration applied 2026-10-08 via SQL editor; `private` schema not exposed |
| Real form submissions | Verified 2026-10-08 from the live site: assessment saved with region Newburgh, services and consent; invalid input rejected (422); anonymous REST read and direct RPC denied; rate limit returns 429 on the 6th request in 15 min with `TRUSTED_PROXY_HOPS=2` (`1` did not limit). Test rows are marked TEST |
| GitHub Pages | Published at https://nkend45.github.io/marist-tech-clinic/ from `nkend45/marist-tech-clinic` (Actions workflow, manual dispatch) |
| GitHub CLI | `gh` was not found on the current shell PATH |
| Team portal | Part 2, after Part 1 works |
| Real outreach workbook | Private source attachment; not bundled or uploaded |
| Service PDF | Added at `public/files/marist-tech-clinic-services.pdf`; download link enabled |
| Official clinic contacts | Awaiting approved details |
| Email login | Requires production-capable SMTP configuration before Part 2 rollout |

No subscription or paid service has been enabled. Edge function `submit-request` deployed from the dashboard editor as a single-file bundle of `supabase/functions`; JWT verification off; secrets ALLOWED_ORIGINS, IP_HASH_SECRET, TRUSTED_PROXY_HOPS set. Not yet verified: that two different visitors get separate rate-limit quotas.
