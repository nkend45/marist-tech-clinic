import { createSubmitHandler } from '../_shared/submit-handler.mjs';

// Credentials are read only in the server runtime. Never import this entry point in the website.
Deno.serve(createSubmitHandler({
  supabaseUrl: Deno.env.get('SUPABASE_URL'),
  serviceRoleKey: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
  allowedOrigins: Deno.env.get('ALLOWED_ORIGINS'),
  ipHashSecret: Deno.env.get('IP_HASH_SECRET'),
  trustedProxyHops: Number(Deno.env.get('TRUSTED_PROXY_HOPS')),
}));
