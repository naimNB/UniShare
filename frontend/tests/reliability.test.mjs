import test from 'node:test';
import assert from 'node:assert/strict';
import { setImmediate } from 'node:timers/promises';
import { parseResourceParams, parseCourseParams, parsePositiveId } from '../src/utils/queryParams.ts';
import { formatApiError } from '../src/utils/apiErrors.ts';
import { getLibraryShortcuts } from '../src/utils/shortcuts.ts';
import { startRequest } from '../src/utils/asyncRequest.ts';

test('valid combined filters preserve values and trim search', () => {
  const result = parseResourceParams(new URLSearchParams('q= CSE 3101 &semester=5&course_id=9&category_id=2&limit=2&offset=4'));
  assert.equal(result.error, null);
  assert.deepEqual(result.filters, { q: 'CSE 3101', semester: 5, course_id: 9, category_id: 2, limit: 2, offset: 4 });
  assert.equal(parseResourceParams(new URLSearchParams()).filters.limit, 12);
});

for (const query of ['offset=bad', 'offset=-1', 'offset=1.5', 'limit=0', 'limit=101', 'course_id=2oops', 'category_id=0', 'semester=13', 'offset=', 'q=a&q=b', 'semester=1&semester=2', 'offset=9007199254740992']) {
  test(`invalid URL is rejected: ${query}`, () => {
    assert.ok(parseResourceParams(new URLSearchParams(query)).error);
  });
}

test('search length and course URL validation agree with supported limits', () => {
  assert.ok(parseResourceParams(new URLSearchParams({ q: 'a'.repeat(201) })).error);
  assert.equal(parseCourseParams(new URLSearchParams('semester=12')).error, null);
  assert.ok(parseCourseParams(new URLSearchParams('semester=0')).error);
  assert.equal(parsePositiveId('12'), 12);
  for (const id of ['12oops', '-1', '0', '1.2', '', undefined]) assert.equal(parsePositiveId(id), null);
});

test('FastAPI validation arrays produce readable messages, not objects or raw inputs', () => {
  const text = formatApiError({ detail: [{ loc: ['query', 'offset'], msg: 'Must be a whole number', input: 'private-input' }] });
  assert.equal(text, 'offset: Must be a whole number');
  assert.equal(formatApiError({ detail: 'Not found' }), 'Not found');
  assert.equal(formatApiError({ detail: [{ unknown: true }] }), undefined);
  assert.equal(formatApiError(null), undefined);
});

test('homepage shortcuts resolve current IDs instead of assuming seed order', () => {
  assert.deepEqual(getLibraryShortcuts([{ id: 72, name: 'Database Management Systems' }], [{ id: 91, name: 'Past Questions' }]), [
    { label: 'Database Systems', href: '/resources?course_id=72' },
    { label: 'Past Questions', href: '/resources?category_id=91' },
  ]);
  assert.deepEqual(getLibraryShortcuts([], []), []);
});

test('late results cannot overwrite the latest request even when loading ignores abort', async () => {
  const received = [];
  let resolveOld;
  const cancel = startRequest(() => new Promise((resolve) => { resolveOld = resolve; }), (value) => received.push(value), assert.fail);
  await setImmediate();
  cancel();
  startRequest(async () => 'current', (value) => received.push(value), assert.fail);
  await setImmediate();
  resolveOld('stale');
  await setImmediate();
  assert.deepEqual(received, ['current']);
});

test('cancelled request errors stay silent and cancellation aborts the signal', async () => {
  let signal;
  let reject;
  const cancel = startRequest((value) => {
    signal = value;
    return new Promise((_, fail) => { reject = fail; });
  }, assert.fail, assert.fail);
  await setImmediate();
  cancel();
  assert.equal(signal.aborted, true);
  reject(new Error('old request failed'));
  await setImmediate();
});

test('active failures surface and empty success remains a successful result', async () => {
  const errors = [];
  const values = [];
  startRequest(async () => { throw new Error('offline'); }, assert.fail, (error) => errors.push(error.message));
  startRequest(async () => [], (value) => values.push(value), assert.fail);
  await setImmediate();
  assert.deepEqual(errors, ['offline']);
  assert.deepEqual(values, [[]]);
});

test('immediate cancellation prevents the request from starting', async () => {
  const cancel = startRequest(assert.fail, assert.fail, assert.fail);
  cancel();
  await setImmediate();
});
