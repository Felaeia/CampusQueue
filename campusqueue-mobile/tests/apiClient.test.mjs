import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ApiResponseError, apiOrigin, createApiClient } from '../src/context/apiClient.ts';

test('requires a valid backend origin and only allows HTTP in development', () => {
  assert.equal(apiOrigin(' https://api.example.test/ '), 'https://api.example.test');
  assert.equal(apiOrigin('http://localhost:3000', true), 'http://localhost:3000');
  for (const value of [undefined, 'http://localhost:3000', 'https://user@host.test', 'https://host.test/api']) {
    assert.throws(() => apiOrigin(value), ApiResponseError);
  }
});

test('serializes the body and sends the bearer token', async () => {
  const api = createApiClient('https://api.example.test', false, async (url, options) => {
    assert.equal(url, 'https://api.example.test/api/student');
    assert.equal(options?.method, 'POST');
    assert.equal(new Headers(options?.headers).get('authorization'), 'Bearer sample');
    assert.equal(options?.body, '{"action":"cancel"}');
    return Response.json({ success: true });
  });
  assert.deepEqual(await api('student', { data: { action: 'cancel' }, token: 'sample' }), { success: true });
});

test('rejects HTML and malformed responses and hides server internals', async () => {
  for (const response of [new Response('<html>'), new Response('{', {
    headers: { 'Content-Type': 'application/json' },
  })]) {
    const api = createApiClient('https://api.example.test', false, async () => response);
    await assert.rejects(api('auth'), /unexpected response/);
  }
  const api = createApiClient('https://api.example.test', false, async () =>
    Response.json({ error: 'Sensitive internal details' }, { status: 500 }));
  await assert.rejects(api('auth'), /temporarily unavailable/);
});

test('reports offline and timeout errors', async () => {
  const offline = createApiClient('https://api.example.test', false, async () => {
    throw new TypeError('fetch failed');
  });
  await assert.rejects(offline('auth'), /Check your connection/);
  const timeout = createApiClient('https://api.example.test', false, (_, options) => new Promise((_, reject) => {
    options?.signal?.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
  }), 5);
  await assert.rejects(timeout('auth'), /timed out/);
});
