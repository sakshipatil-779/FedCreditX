/**
 * Frontend Unit Tests for Unified API Client (src/lib/api.ts)
 *
 * Verifies PART D requirements:
 * 1. A 502 with an HTML body returns kind 'proxy_unavailable' (never calling .json())
 * 2. A JSON 401 returns kind 'unauthorized'
 * 3. A JSON 200 parses correctly
 * 4. A network failure returns kind 'network'
 */

import test from 'node:test';
import assert from 'node:assert/strict';

// Test implementation directly with standard Web APIs (fetch, Response, Headers)
import { apiFetch, getOfficerErrorMessage } from '../src/lib/api.ts';

test('1. A 502 with an HTML body returns kind "proxy_unavailable"', async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async (url, options) => {
      return new Response(
        '<!DOCTYPE html><html><head><title>502 Bad Gateway</title></head><body><h1>Bad Gateway</h1></body></html>',
        {
          status: 502,
          statusText: 'Bad Gateway',
          headers: { 'Content-Type': 'text/html; charset=UTF-8' },
        }
      );
    };

    const res = await apiFetch('/api/cases?lender_id=lender_a');
    assert.equal(res.ok, false);
    assert.equal(res.kind, 'proxy_unavailable');
    assert.equal(res.error?.kind, 'proxy_unavailable');
    assert.equal(res.status, 502);
    assert.ok(res.error?.officerMessage.includes('server is waking up'));
    assert.equal(res.data, null);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('2. A JSON 401 returns kind "unauthorized"', async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async (url, options) => {
      return new Response(
        JSON.stringify({ detail: 'Authentication required. Please sign in.' }),
        {
          status: 401,
          statusText: 'Unauthorized',
          headers: { 'Content-Type': 'application/json' },
        }
      );
    };

    const res = await apiFetch('/api/cases?lender_id=lender_a');
    assert.equal(res.ok, false);
    assert.equal(res.kind, 'unauthorized');
    assert.equal(res.error?.kind, 'unauthorized');
    assert.equal(res.status, 401);
    assert.ok(res.error?.message.includes('Authentication required'));
    assert.equal(res.data, null);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('3. A JSON 200 parses correctly', async () => {
  const originalFetch = globalThis.fetch;
  try {
    const mockCases = [
      { case_id: 'DEMO-A-001', lender_id: 'lender_a', applicant_id: 'APP-1001' },
      { case_id: 'DEMO-A-002', lender_id: 'lender_a', applicant_id: 'APP-1002' },
    ];

    globalThis.fetch = async (url, options) => {
      return new Response(JSON.stringify(mockCases), {
        status: 200,
        statusText: 'OK',
        headers: { 'Content-Type': 'application/json' },
      });
    };

    const res = await apiFetch('/api/cases?lender_id=lender_a');
    assert.equal(res.ok, true);
    assert.equal(res.status, 200);
    assert.equal(res.error, null);
    assert.equal(res.data.length, 2);
    assert.equal(res.data[0].case_id, 'DEMO-A-001');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('4. A network failure returns kind "network"', async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async (url, options) => {
      throw new TypeError('Failed to fetch (DNS lookup or network dropped)');
    };

    const res = await apiFetch('/api/cases?lender_id=lender_a');
    assert.equal(res.ok, false);
    assert.equal(res.kind, 'network');
    assert.equal(res.error?.kind, 'network');
    assert.equal(res.status, 0);
    assert.ok(res.error?.officerMessage.includes('server is waking up'));
    assert.equal(res.data, null);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
