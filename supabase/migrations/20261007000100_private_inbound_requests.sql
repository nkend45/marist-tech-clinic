-- Part 1 only. Apply with Supabase migrations; creates no CRM or public table policies.
begin;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated, service_role;

create table private.inbound_requests (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('assessment', 'contact')),
  organization text not null default '' check (char_length(organization) <= 200),
  name text not null check (char_length(btrim(name)) between 1 and 120),
  role text not null default '' check (char_length(role) <= 120),
  email text not null check (char_length(email) between 3 and 254 and email ~ '^[^[:space:]@<>]+@[^[:space:]@<>.]+(\.[^[:space:]@<>.]+)+$'),
  phone text not null default '' check (char_length(phone) <= 40),
  organization_type text not null default '' check (organization_type in ('', 'Small business', 'Nonprofit', 'School / library', 'Government / public agency', 'Other')),
  town text not null default '' check (char_length(town) <= 120),
  staff text not null default '' check (staff in ('', '1-5', '6-15', '16-50', '50+')),
  it_support text not null default '' check (it_support in ('', 'Nobody in particular', 'A staff member', 'An outside IT company', 'Not sure')),
  services text[] not null default '{}' check (
    cardinality(services) <= 6 and array_position(services, null) is null and
    services <@ array['Cybersecurity', 'Technology', 'Software Development', 'Data & Analytics', 'AI Enablement', 'Not sure, start with the free assessment']::text[]
  ),
  message text not null default '' check (char_length(message) <= 5000),
  reach_by text not null default 'Email' check (reach_by in ('Email', 'Phone')),
  consent boolean not null default false,
  region text not null default '' check (char_length(region) <= 120),
  source text not null default 'Inbound form' check (source = 'Inbound form'),
  inserted_at timestamptz not null default clock_timestamp(),
  inserted_by text not null default 'system' check (inserted_by = 'system'),
  check (kind <> 'assessment' or (btrim(organization) <> '' and btrim(town) <> '' and consent and (reach_by <> 'Phone' or btrim(phone) <> ''))),
  check (kind <> 'contact' or btrim(message) <> '')
);
create index inbound_requests_inserted_at_idx on private.inbound_requests (inserted_at desc);

-- HMAC digest only: no raw client IP or request content is retained here.
create table private.inbound_rate_buckets (
  ip_hash text not null check (ip_hash ~ '^[0-9a-f]{64}$'),
  window_seconds integer not null check (window_seconds in (900, 86400)),
  bucket_start timestamptz not null,
  expires_at timestamptz not null,
  hits integer not null check (hits between 1 and 20),
  primary key (ip_hash, window_seconds, bucket_start),
  check (expires_at = bucket_start + window_seconds * interval '1 second')
);
create index inbound_rate_buckets_expiry_idx on private.inbound_rate_buckets (expires_at);

alter table private.inbound_requests enable row level security;
alter table private.inbound_requests force row level security;
alter table private.inbound_rate_buckets enable row level security;
alter table private.inbound_rate_buckets force row level security;
-- Intentionally no policies, including for authenticated users. Part 2 needs a separate design.
revoke all on private.inbound_requests, private.inbound_rate_buckets from public, anon, authenticated, service_role;

-- The only exposed RPC. service_role may execute; the definer owns the private tables.
-- PostgREST executes this function in a single transaction: a failed insert rolls back counters.
create function public.submit_inbound_request(p_payload jsonb, p_ip_hash text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_now timestamptz := clock_timestamp();
  v_window integer;
  v_limit integer;
  v_start timestamptz;
  v_hits integer;
  v_id uuid;
  v_services text[];
begin
  if p_ip_hash is null or p_ip_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid rate limit key' using errcode = '22023';
  end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'Invalid request' using errcode = '22023';
  end if;
  -- Bounded opportunistic cleanup; expired buckets never affect a current window.
  delete from private.inbound_rate_buckets b
  where (b.ip_hash, b.window_seconds, b.bucket_start) in (
    select old.ip_hash, old.window_seconds, old.bucket_start
    from private.inbound_rate_buckets old
    where old.expires_at <= v_now
    order by old.expires_at
    limit 1000
    for update skip locked
  );

  -- Always lock in the same order. ON CONFLICT locks the bucket row, preventing races.
  foreach v_window in array array[900, 86400] loop
    v_limit := case when v_window = 900 then 5 else 20 end;
    v_start := to_timestamp(floor(extract(epoch from v_now) / v_window) * v_window);
    v_hits := null;
    insert into private.inbound_rate_buckets as b (ip_hash, window_seconds, bucket_start, expires_at, hits)
    values (p_ip_hash, v_window, v_start, v_start + v_window * interval '1 second', 1)
    on conflict (ip_hash, window_seconds, bucket_start) do update
      set hits = b.hits + 1
      where b.hits < v_limit
    returning hits into v_hits;
    if v_hits is null then
      return jsonb_build_object('saved', false, 'retry_after', greatest(1, ceil(extract(epoch from (v_start + v_window * interval '1 second' - v_now)))::integer));
    end if;
  end loop;

  select coalesce(array_agg(value), '{}'::text[]) into v_services
    from jsonb_array_elements_text(p_payload -> 'services');
  insert into private.inbound_requests (
    kind, organization, name, role, email, phone, organization_type, town,
    staff, it_support, services, message, reach_by, consent, region
  ) values (
    p_payload ->> 'kind', p_payload ->> 'organization', p_payload ->> 'name',
    p_payload ->> 'role', p_payload ->> 'email', p_payload ->> 'phone',
    p_payload ->> 'organizationType', p_payload ->> 'town', p_payload ->> 'staff',
    p_payload ->> 'itSupport', v_services, p_payload ->> 'message',
    p_payload ->> 'reachBy', (p_payload ->> 'consent')::boolean, p_payload ->> 'region'
  ) returning id into v_id;
  return jsonb_build_object('saved', true, 'request_id', v_id);
end;
$function$;

revoke all on function public.submit_inbound_request(jsonb, text) from public, anon, authenticated;
grant execute on function public.submit_inbound_request(jsonb, text) to service_role;
comment on function public.submit_inbound_request(jsonb, text) is 'Server-only atomic rate limit and inbound form insert. Never grant to anon or authenticated.';

commit;
