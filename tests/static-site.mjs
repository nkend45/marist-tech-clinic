import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve('dist');
const base = (process.env.PUBLIC_BASE_PATH || '').replace(/\/$/, '');
const pages = ['', 'services', 'who-we-help', 'hudson-valley', 'request', 'about', 'faq', 'contact'];
const read = async p => readFile(resolve(root, p), 'utf8');

test('all eight pages contain unique titles and descriptions', async () => {
  const titles = new Set();
  const descriptions = new Set();
  for (const page of pages) {
    const html = await read(`${page ? page + '/' : ''}index.html`);
    const title = html.match(/<title>(.*?)<\/title>/s)?.[1];
    const description = html.match(/<meta\s+name="description"\s+content="([^"]+)"/i)?.[1];
    assert.ok(title, `Missing title: ${page}`);
    assert.ok(description, `Missing description: ${page}`);
    titles.add(title);
    descriptions.add(description);
    assert.match(html, /<html[^>]+lang="en"/);
    assert.match(html, /<main[\s>]/);
  }
  assert.equal(titles.size, pages.length);
  assert.equal(descriptions.size, pages.length);
});

test('local page and asset links resolve with configured repository base', async () => {
  for (const page of pages) {
    const html = await read(`${page ? page + '/' : ''}index.html`);
    for (const match of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
      const url = match[1];
      if (!url.startsWith('/') || url.startsWith('//')) continue;
      assert.ok(!base || url === base || url.startsWith(base + '/'), `${page}: link escapes base ${url}`);
      let path = url.slice(base.length).split(/[?#]/)[0];
      if (!path || path.endsWith('/')) path += 'index.html';
      else if (!path.split('/').at(-1).includes('.')) path += '/index.html';
      await access(resolve(root, '.' + path));
    }
  }
});

test('service catalog contains every requested service', async () => {
  const html = (await read('services/index.html')).replaceAll('&amp;', '&');
  for (const service of [
    'Initial Technology & Security Assessment', 'Compliance Assessment',
    'Cybersecurity Risk Assessment', 'Incident Response & Recovery Planning',
    'Employee Cybersecurity Training & Awareness', 'Infrastructure & Cloud Design + AI',
    'Network & Device Health Check', 'Software & Vendor Selection',
    'Website & App Usability Review', 'Website Build or Refresh',
    'Custom Application Development', 'Data Cleanup & Organization',
    'Data Insights & Dashboarding', 'Data Architecture Review',
    'AI for Small Business Workshop', 'Workflow Automation', 'AI Model Customization',
  ]) assert.ok(html.includes(service), `Missing ${service}`);
});

test('public output excludes spreadsheet files and privileged credentials', async () => {
  async function walk(dir) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const file = resolve(dir, entry.name);
      if (entry.isDirectory()) await walk(file);
      else {
        assert.ok(!/\.(xlsx|csv)$/i.test(entry.name), `Private data artifact ${file}`);
        if (/\.(html|js|json|xml|txt)$/i.test(entry.name)) {
          const text = await readFile(file, 'utf8');
          assert.ok(!text.includes('SUPABASE_SERVICE_ROLE_KEY'), `Privileged config in ${file}`);
          assert.ok(!text.includes('sb_secret_'), `Secret key in ${file}`);
        }
      }
    }
  }
  await walk(root);
});
