const base = import.meta.env.BASE_URL.replace(/\/$/, '');

/** Local pages, static assets, and fragment links share the configured deploy base. */
export function pathTo(path = '/') {
  if (/^(?:https?:|mailto:|tel:)/i.test(path)) return path;
  return `${base}/${path.replace(/^\/+/, '')}`;
}

export function absoluteUrl(path = '/') {
  const site = import.meta.env.PUBLIC_SITE_URL?.trim();
  return site ? new URL(pathTo(path), site).href : undefined;
}

export const publicPages = ['', 'services', 'who-we-help', 'newburgh', 'request', 'about', 'faq', 'contact'];

export function requestEndpoint() {
  const url = import.meta.env.PUBLIC_SUPABASE_URL?.trim().replace(/\/+$/, '');
  return url ? `${url}/functions/v1/submit-request` : '';
}
