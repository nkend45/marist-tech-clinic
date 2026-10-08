import { validateRequest, type RequestPayload } from './form-contract';

for (const form of document.querySelectorAll<HTMLFormElement>('[data-request-form]')) {
  const button = form.querySelector<HTMLButtonElement>('[data-submit]')!;
  const status = form.querySelector<HTMLElement>('[data-form-status]')!;
  const success = form.parentElement!.querySelector<HTMLElement>('[data-form-success]')!;
  const endpoint = form.dataset.endpoint || '';
  const key = form.dataset.publishableKey || '';
  const initialLabel = button.textContent;
  let pending = false;

  const clearErrors = () => {
    for (const element of form.querySelectorAll<HTMLElement>('[data-error]')) element.textContent = '';
    for (const element of form.querySelectorAll<HTMLElement>('[aria-invalid]')) {
      element.removeAttribute('aria-invalid');
      const descriptions = element.getAttribute('aria-describedby')?.split(' ').filter(id => !id.endsWith('-error'));
      if (descriptions?.length) element.setAttribute('aria-describedby', descriptions.join(' '));
      else element.removeAttribute('aria-describedby');
    }
    status.textContent = '';
    status.classList.remove('error');
  };

  const showErrors = (errors: Record<string, string>, message = 'Please check the highlighted fields. Your information has not been sent.') => {
    let first: HTMLElement | undefined;
    for (const [name, error] of Object.entries(errors)) {
      const holder = Array.from(form.querySelectorAll<HTMLElement>('[data-error]')).find(element => element.dataset.error === name);
      if (holder) holder.textContent = error;
      const controls = Array.from(form.elements).filter(control => (control as HTMLInputElement).name === name) as HTMLElement[];
      for (const control of controls) {
        control.setAttribute('aria-invalid', 'true');
        if (holder?.id) control.setAttribute('aria-describedby', [...new Set([...(control.getAttribute('aria-describedby') || '').split(' ').filter(Boolean), holder.id])].join(' '));
      }
      first ||= controls[0];
    }
    status.textContent = message;
    status.classList.add('error');
    (first || status).focus();
  };

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (pending) return;
    clearErrors();
    if (!endpoint || !key) {
      showErrors({}, 'Local preview: submissions are unavailable. The request service has not been connected. No information was sent.');
      return;
    }
    const data = new FormData(form);
    const text = (name: string) => String(data.get(name) || '').trim();
    const payload: RequestPayload = {
      kind: form.dataset.kind === 'contact' ? 'contact' : 'assessment',
      organization: text('organization'), name: text('name'), role: text('role'), email: text('email'), phone: text('phone'),
      organizationType: text('organizationType'), town: text('town'), staff: text('staff'), itSupport: text('itSupport'),
      services: data.getAll('services').map(String), message: text('message'), reachBy: text('reachBy') === 'Phone' ? 'Phone' : 'Email',
      consent: data.get('consent') === 'on', region: text('region'), website: text('website'),
    };
    const errors = validateRequest(payload);
    if (Object.keys(errors).length) { showErrors(errors); return; }
    pending = true;
    button.disabled = true;
    button.textContent = 'Sending…';
    form.setAttribute('aria-busy', 'true');
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 20000);
    try {
      const response = await fetch(endpoint, {
        method: 'POST', headers: { 'Content-Type': 'application/json', apikey: key },
        body: JSON.stringify(payload), signal: controller.signal,
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || result?.ok !== true) {
        const fieldErrors = result?.fields && typeof result.fields === 'object' && !Array.isArray(result.fields)
          ? Object.fromEntries(Object.entries(result.fields).filter(([,value]) => typeof value === 'string')) as Record<string, string> : {};
        const message = response.status === 429 ? 'Too many requests were sent. Please wait a few minutes and try again. Your entries have been kept.'
          : Object.keys(fieldErrors).length ? 'Please check the highlighted fields. Your entries have been kept.'
          : 'We could not confirm your submission. Your entries have been kept. Please try again later.';
        showErrors(fieldErrors, message);
        return;
      }
      form.hidden = true;
      success.hidden = false;
      success.focus();
    } catch {
      showErrors({}, 'We could not confirm your submission. Check your connection and try again later. Your entries have been kept.');
    } finally {
      window.clearTimeout(timer);
      pending = false;
      button.disabled = false;
      button.textContent = initialLabel;
      form.removeAttribute('aria-busy');
    }
  });
}
