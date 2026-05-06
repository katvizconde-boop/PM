import { describe, it, expect } from 'vitest';
import { decodeJwt } from '../contexts/AuthContext.jsx';

// JWT payloads aren't signed-verified client-side — we just decode them for UI gating.
// Backend remains the authority. So these tests cover the parser, not auth.
function makeJwt(payload) {
  const enc = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${enc({ alg: 'HS256', typ: 'JWT' })}.${enc(payload)}.signature-not-verified-clientside`;
}

describe('decodeJwt', () => {
  it('decodes a standard payload', () => {
    const token = makeJwt({ id: 1, email: 'a@b.com', role: 'admin', name: 'A' });
    expect(decodeJwt(token)).toEqual({ id: 1, email: 'a@b.com', role: 'admin', name: 'A' });
  });

  it('returns null for malformed tokens', () => {
    expect(decodeJwt('not-a-jwt')).toBeNull();
    expect(decodeJwt('')).toBeNull();
    expect(decodeJwt('a.b.c')).toBeNull(); // valid shape, garbage payload
  });

  it('handles base64url-encoded payloads (- and _ chars)', () => {
    // Construct a payload whose b64 encoding contains - or _ characters.
    const payload = { id: 1, weird: '???>>>>' };
    const token = makeJwt(payload);
    expect(decodeJwt(token)).toEqual(payload);
  });
});
