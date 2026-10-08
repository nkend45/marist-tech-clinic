import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';

const origin = process.env.TEST_ORIGIN || 'http://localhost:4321';
const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
await mkdir('qa', { recursive: true });
const pages = ['', 'services/', 'who-we-help/', 'newburgh/', 'request/', 'about/', 'faq/', 'contact/'];
const errors = [];
try {
  for (const width of [320, 390, 768, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
    page.on('pageerror', e => errors.push(String(e)));
    for (const path of pages) {
      await page.goto(`${origin}/${path}`, { waitUntil: 'networkidle' });
      assert.equal(await page.locator('main h1').count(), 1, `${width} ${path}: h1`);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
      assert.equal(overflow, false, `${width} ${path}: horizontal overflow`);
      if (path === '' && [390, 1440].includes(width)) await page.screenshot({ path: `qa/home-${width}.png`, fullPage: true });
      if (path === 'request/' && width === 390) {
        assert.equal(await page.getByRole('button', { name: 'Request a free assessment', exact: true }).isDisabled(), true);
        assert.equal(await page.locator('[data-form-success]').isVisible(), false);
        await page.screenshot({ path: 'qa/request-390.png', fullPage: true });
      }
    }
    await page.goto(origin, { waitUntil: 'networkidle' });
    if (width < 1000) {
      const menu = page.getByRole('button', { name: /Menu/ });
      await menu.click();
      assert.equal(await menu.getAttribute('aria-expanded'), 'true');
      await page.keyboard.press('Escape');
      assert.equal(await menu.getAttribute('aria-expanded'), 'false');
    }
    await page.goto(`${origin}/faq/`, { waitUntil: 'networkidle' });
    const first = page.locator('summary').first();
    await first.focus();
    await page.keyboard.press('Enter');
    assert.equal(await page.locator('details').first().getAttribute('open'), '');
    await page.close();
  }

  // Inject public endpoint configuration only into this test page; requests are intercepted locally.
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.on('pageerror', e => errors.push(String(e)));
  let reply = { status: 503, body: { ok: false, error: 'Unavailable' } };
  let requests = 0;
  let payload;
  await page.route('**/functions/v1/submit-request', async route => {
    requests++;
    payload = route.request().postDataJSON();
    await route.fulfill({ status: reply.status, contentType: 'application/json', body: JSON.stringify(reply.body), headers: { 'access-control-allow-origin': '*' } });
  });
  await page.route('**/newburgh/', async route => {
    const response = await route.fetch();
    const html = (await response.text()).replace(/data-endpoint(?:="[^"]*")?/, 'data-endpoint="http://localhost:4322/functions/v1/submit-request"').replace(/data-publishable-key(?:="[^"]*")?/, 'data-publishable-key="test-public-key"').replace(/ disabled(?:="[^"]*")?(?=[\s>])/g, '');
    await route.fulfill({ response, body: html });
  });
  await page.goto(`${origin}/newburgh/`, { waitUntil: 'networkidle' });
  const form = page.locator('[data-request-form]');
  const submit = form.getByRole('button', { name: 'Request a free assessment', exact: true });
  await submit.click();
  assert.equal(requests, 0);
  assert.equal(await form.locator('[name=organization]').getAttribute('aria-invalid'), 'true');
  for (const [name, value] of Object.entries({ organization: 'DEMO test organization', name: 'Test Student', email: 'demo@example.org', town: 'Newburgh' })) await form.locator(`[name=${name}]`).fill(value);
  await form.locator('[name=consent]').check();
  await form.locator('[name=services]').first().check();
  await submit.click();
  await page.waitForFunction(() => document.querySelector('[data-form-status]').textContent.includes('could not confirm'));
  assert.equal(await form.locator('[name=organization]').inputValue(), 'DEMO test organization');
  assert.equal(await page.locator('[data-form-success]').isVisible(), false);
  assert.equal(payload.region, 'Newburgh');
  assert.deepEqual(payload.services, ['Cybersecurity']);
  reply = { status: 422, body: { ok: false, error: 'Invalid', fields: { email: 'Enter a valid email address.' } } };
  await submit.click();
  await page.waitForFunction(() => document.querySelector('[data-error=email]').textContent.length > 0);
  assert.equal(await form.locator('[name=email]').getAttribute('aria-invalid'), 'true');
  reply = { status: 201, body: { ok: true, requestId: '12345678-1234-4123-8123-123456789abc' } };
  await submit.click();
  await page.locator('[data-form-success]').waitFor({ state: 'visible' });
  assert.equal(await form.isVisible(), false);
  assert.ok((await page.locator('[data-form-success]').textContent()).includes('2 business days'));
  assert.deepEqual(errors, [], 'Browser JS errors');
  console.log('PASS: 32 responsive page checks, mobile menu, keyboard FAQ, preview disabled, validation, failure preservation, server field errors, Newburgh payload and mocked confirmed success.');
  console.log('Mocked submission test is NOT live Supabase persistence verification. Screenshots saved in qa/.');
} finally {
  await browser.close();
}
