import type { APIRoute } from 'astro';
import { absoluteUrl, publicPages } from '../lib/paths';

export const GET: APIRoute = () => {
  const xmlEscape = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const entries = publicPages.map(page => absoluteUrl(page ? `/${page}/` : '/')).filter((url): url is string => Boolean(url));
  return new Response(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${entries.map(url => `\n  <url><loc>${xmlEscape(url)}</loc></url>`).join('')}\n</urlset>`, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
