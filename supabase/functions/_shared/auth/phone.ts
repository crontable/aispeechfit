import { parsePhoneNumberFromString } from 'libphonenumber-js/max';

export class KakaoVerificationError extends Error {
  code: 'provider_unavailable' | 'account_mismatch' | 'app_mismatch' | 'phone_consent_required' | 'phone_missing' | 'phone_invalid' | 'session_expired';
  constructor(code: KakaoVerificationError['code']) {
    super(code);
    this.code = code;
  }
}

function object(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : {};
}

function subject(value: unknown) {
  if (typeof value === 'string' && /^\d+$/.test(value)) return value;
  if (typeof value === 'number' && Number.isSafeInteger(value) && value > 0) return String(value);
  return null;
}

export function verifyKakaoProfile(tokenInfo: unknown, profile: unknown, expected: { appId: string; subject: string }) {
  const token = object(tokenInfo);
  const user = object(profile);
  if (subject(token.app_id) !== expected.appId) throw new KakaoVerificationError('app_mismatch');
  if (subject(token.id) !== expected.subject || subject(user.id) !== expected.subject) {
    throw new KakaoVerificationError('account_mismatch');
  }
  const account = object(user.kakao_account);
  if (account.phone_number_needs_agreement === true) throw new KakaoVerificationError('phone_consent_required');
  if (typeof account.phone_number !== 'string' || !account.phone_number.trim()) throw new KakaoVerificationError('phone_missing');
  if (account.phone_number_needs_agreement !== false || account.has_phone_number === false) {
    throw new KakaoVerificationError('phone_consent_required');
  }
  const phone = parsePhoneNumberFromString(account.phone_number);
  if (!phone?.isValid() || phone.ext) throw new KakaoVerificationError('phone_invalid');
  return phone.number;
}

export function maskPhone(phone: string | null) {
  return phone ? `•••• ${phone.slice(-4)}` : null;
}
