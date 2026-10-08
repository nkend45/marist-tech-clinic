# Part 1 launch checks

Complete these against the connected project before treating the website as an operating clinic service. Local build checks cannot prove live Supabase access rules.

## Submission service

Use fictitious organizations and your own test email, not the attached outreach directory.

- Submit a valid assessment. The response succeeds only after a corresponding row is saved. Confirm consent, all selected areas and region survive.
- Submit a valid contact message; verify its separate kind and message fields.
- Submit Newburgh's form and verify the stored region is Newburgh.
- Reject missing consent, invalid email, blank required fields, oversized text and unsupported choice values at the endpoint, even if browser validation is bypassed.
- Fill the honeypot directly; verify no record is stored.
- Simulate endpoint failure. The page preserves entries, announces the failure and does not display the thank-you message.
- Verify anonymous clients cannot SELECT, UPDATE or DELETE requests, including through the database REST API.
- Verify rate limiting works at the deployed edge with concurrent requests and the trusted client-IP header. CORS alone is not an anti-spam control.
- Verify timestamps and source are server-controlled and no privileged key is in the generated browser assets.

## Public pages

- Open every direct URL from a fresh browser tab under the real Pages repository prefix.
- Test keyboard-only header/menu, FAQ, links, validation focus and form completion.
- Test narrow mobile widths, 200% zoom and reduced motion; check horizontal overflow.
- Confirm official contact details, institutional wording and response-time promise with the clinic.
- Supply the real service PDF before enabling its download.
- Keep client names, results, logos and testimonials hidden until approved real material is provided.
- Check final canonical URLs, Open Graph URLs, sitemap and robots against the actual deployment origin.

## Start Part 2 after Part 1

The backend is the boundary for privacy. A hidden link or a client-side email suffix check cannot protect CRM records. Test anonymous, non-Marist, member and admin permissions independently before importing the real workbook. Never put the workbook in `public/` or a public GitHub repository.

The eventual QR should contain the actual published `/newburgh/` URL including the repository prefix. Generate it in the protected admin interface after that URL is known.
