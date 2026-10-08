export const organizationTypes = ['Small business', 'Nonprofit', 'School / library', 'Government / public agency', 'Other'];
export const staffOptions = ['1-5', '6-15', '16-50', '50+'];
export const itOptions = ['Nobody in particular', 'A staff member', 'An outside IT company', 'Not sure'];
export const serviceOptions = ['Cybersecurity', 'Technology', 'Software Development', 'Data & Analytics', 'AI Enablement', 'Not sure, start with the free assessment'];
export const fieldLimits: Record<string, number> = { organization: 200, name: 120, role: 120, email: 254, phone: 40, town: 120, region: 120, message: 5000, website: 200 };

export interface RequestPayload {
  kind: 'assessment' | 'contact'; organization: string; name: string; role: string;
  email: string; phone: string; organizationType: string; town: string; staff: string;
  itSupport: string; services: string[]; message: string; reachBy: 'Email' | 'Phone';
  consent: boolean; region: string; website: string;
}

export function validateRequest(payload: RequestPayload): Record<string, string> {
  const errors: Record<string, string> = {};
  const required = payload.kind === 'assessment' ? ['organization', 'name', 'email', 'town'] : ['name', 'email', 'message'];
  const labels: Record<string, string> = { organization: 'your organization name', name: 'your name', email: 'your email address', town: 'your town or city', message: 'a message' };
  for (const field of required) if (!String(payload[field as keyof RequestPayload] || '').trim()) errors[field] = `Enter ${labels[field]}.`;
  for (const [field, max] of Object.entries(fieldLimits)) {
    if (String(payload[field as keyof RequestPayload] || '').length > max) errors[field] = `Use ${max} characters or fewer.`;
  }
  if (payload.email && !/^[^\s@<>]+@[^\s@<>.]+(?:\.[^\s@<>.]+)+$/u.test(payload.email)) errors.email = 'Enter a valid email address.';
  if (payload.phone) {
    const digits = payload.phone.replace(/\D/g, '');
    if (!/^[+\d().\s\-xext]+$/iu.test(payload.phone) || digits.length < 7 || digits.length > 20) errors.phone = 'Enter a valid phone number with 7 to 20 digits.';
  }
  if (payload.reachBy === 'Phone' && !payload.phone) errors.phone = 'Enter a phone number so we can call you.';
  for (const [field, values] of [['organizationType', organizationTypes], ['staff', staffOptions], ['itSupport', itOptions]] as const) {
    const value = payload[field];
    if (value && !values.includes(value)) errors[field] = 'Choose one of the listed options.';
  }
  if (payload.services.some(service => !serviceOptions.includes(service))) errors.services = 'Choose one of the listed service areas.';
  if (payload.kind === 'assessment' && !payload.consent) errors.consent = 'Please confirm that you understand the assessment process.';
  return errors;
}
