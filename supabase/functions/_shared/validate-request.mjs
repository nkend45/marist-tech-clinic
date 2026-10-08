// Dependency-free: shared by the Deno Edge Function and Node's built-in tests.
export const ORGANIZATION_TYPES = Object.freeze([
  'Small business', 'Nonprofit', 'School / library', 'Government / public agency', 'Other',
]);
export const STAFF_OPTIONS = Object.freeze(['1-5', '6-15', '16-50', '50+']);
export const IT_SUPPORT_OPTIONS = Object.freeze([
  'Nobody in particular', 'A staff member', 'An outside IT company', 'Not sure',
]);
export const SERVICE_OPTIONS = Object.freeze([
  'Cybersecurity', 'Technology', 'Software Development', 'Data & Analytics', 'AI Enablement',
  'Not sure, start with the free assessment',
]);
export const LIMITS = Object.freeze({
  organization: 200, name: 120, role: 120, email: 254, phone: 40,
  organizationType: 80, town: 120, staff: 10, itSupport: 80,
  message: 5000, reachBy: 5, region: 120, website: 200,
});
const ALLOWED_KEYS = new Set(['kind', 'services', 'consent', ...Object.keys(LIMITS)]);
const EMAIL = /^[^\s@<>]+@[^\s@<>.]+(?:\.[^\s@<>.]+)+$/u;
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/u;

export function validateRequest(input) {
  const errors = {};
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, errors: { form: 'Expected a JSON object.' } };
  }
  if (Object.keys(input).some((key) => !ALLOWED_KEYS.has(key))) {
    errors.form = 'Unexpected form field.';
  }
  const data = { kind: input.kind };
  if (!['assessment', 'contact'].includes(input.kind)) errors.kind = 'Choose a valid request type.';
  for (const [key, limit] of Object.entries(LIMITS)) {
    const value = input[key] === undefined ? '' : input[key];
    if (typeof value !== 'string') {
      errors[key] = 'Must be text.';
      data[key] = '';
      continue;
    }
    // Check the untrimmed input so whitespace cannot bypass length limits.
    if ([...value].length > limit) errors[key] = `Use at most ${limit} characters.`;
    if (CONTROL.test(value) || (key !== 'message' && /[\r\n\t]/u.test(value))) {
      errors[key] = 'Contains unsupported characters.';
    }
    data[key] = value.trim();
  }
  // Even whitespace in the honeypot is rejected, never acknowledged as saved.
  if (input.website !== undefined && input.website !== '') errors.website = 'Unable to accept this submission.';
  delete data.website;
  for (const key of ['name', 'email']) if (!data[key]) errors[key] = 'This field is required.';
  if (data.email && !EMAIL.test(data.email)) errors.email = 'Enter a valid email address.';
  if (data.phone && (!/^[+\d().\s\-xext]+$/iu.test(data.phone) || data.phone.replace(/\D/gu, '').length < 7 || data.phone.replace(/\D/gu, '').length > 20)) {
    errors.phone = 'Enter a valid phone number, including an area code.';
  }
  for (const [key, options] of [
    ['organizationType', ORGANIZATION_TYPES], ['staff', STAFF_OPTIONS], ['itSupport', IT_SUPPORT_OPTIONS],
  ]) {
    if (data[key] && !options.includes(data[key])) errors[key] = 'Choose a listed option.';
  }
  data.reachBy ||= 'Email';
  if (!['Email', 'Phone'].includes(data.reachBy)) errors.reachBy = 'Choose Email or Phone.';
  data.consent = input.consent === undefined ? false : input.consent;
  if (typeof data.consent !== 'boolean') errors.consent = 'Must be true or false.';
  data.services = input.services === undefined ? [] : input.services;
  if (!Array.isArray(data.services) || data.services.length > SERVICE_OPTIONS.length || data.services.some((value) => typeof value !== 'string' || !SERVICE_OPTIONS.includes(value))) {
    errors.services = 'Choose only listed service areas.';
  } else {
    data.services = [...new Set(data.services)];
  }
  if (data.kind === 'assessment') {
    for (const key of ['organization', 'town']) if (!data[key]) errors[key] = 'This field is required.';
    if (data.consent !== true) errors.consent = 'Please acknowledge the assessment scope and student-led program.';
    if (data.reachBy === 'Phone' && !data.phone) errors.phone = 'Enter a phone number to request a call.';
  }
  if (data.kind === 'contact' && !data.message) errors.message = 'This field is required.';
  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, data };
}
