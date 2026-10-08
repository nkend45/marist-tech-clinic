import { defineConfig } from 'astro/config';

const configuredBase = process.env.PUBLIC_BASE_PATH || '/';
const base = `/${configuredBase.split('/').filter(Boolean).join('/')}`;
const configuredSite = process.env.PUBLIC_SITE_URL?.trim();

export default defineConfig({
  output: 'static',
  build: { format: 'directory' },
  trailingSlash: 'always',
  base: base === '/' ? '/' : `${base}/`,
  ...(configuredSite ? { site: configuredSite } : {}),
});
