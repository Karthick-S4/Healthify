const SALT = 'healthify.pin.v1';

export function isPin(value: string): boolean {
  return /^\d{4}$/.test(value);
}

export async function hashPin(pin: string): Promise<string> {
  const encoded = new TextEncoder().encode(`${SALT}:${pin}`);
  const digest = await crypto.subtle.digest('SHA-256', encoded);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}
