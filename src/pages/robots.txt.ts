import type { APIRoute } from 'astro';
import { absoluteUrl } from '../lib/paths';

export const GET: APIRoute = () => {
  const sitemap = absoluteUrl('/sitemap.xml');
  return new Response(`User-agent: *\nAllow: /\n${sitemap ? `Sitemap: ${sitemap}\n` : ''}`, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
