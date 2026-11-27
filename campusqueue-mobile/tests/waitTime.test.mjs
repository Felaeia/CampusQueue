import assert from 'node:assert/strict';
import { test } from 'node:test';
import { calculateEstimatedWaitMinutes, normalizeActiveTicket } from '../src/utils/waitTime.ts';

test('preserves the backend queue position and estimate while someone is serving', () => {
  const ticket = { status: 'waiting', lifecycleStatus: 'waiting', aheadCount: 0, estWaitMins: 7,
    officeId: 'registrar', officeName: 'Registrar Office', nowServing: 'R-020', trackNodes: [],
  };
  const normalized = normalizeActiveTicket(ticket);
  assert.equal(normalized.status, 'waiting');
  assert.equal(normalized.aheadCount, 0);
  assert.equal(normalized.estWaitMins, 7);
  assert.deepEqual(normalized.trackNodes, []);
});

test('retains configured office estimates when the server provides none', () => {
  assert.equal(calculateEstimatedWaitMinutes({ officeId: 'accounting', peopleAhead: 2 }), 6);
  assert.equal(calculateEstimatedWaitMinutes({ officeId: 'registrar', peopleAhead: 2 }), 10);
  assert.equal(calculateEstimatedWaitMinutes({ officeId: 'registrar', peopleAhead: 2, backendEstimate: 3 }), 3);
});
