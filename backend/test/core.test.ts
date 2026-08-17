import test from 'node:test';
import assert from 'node:assert/strict';
import { validateEvidenceSpan } from '../src/core/evidence.js';

test('accepts an exact evidence span', () => {
  assert.deepEqual(validateEvidenceSpan('hello world', 's1', { evidence_id: 'e1', source_id: 's1', quote: 'world', start: 6, end: 11, field: 'decision' }), []);
});

test('rejects a mismatched quote', () => {
  const issues = validateEvidenceSpan('hello world', 's1', { evidence_id: 'e1', source_id: 's1', quote: 'there', start: 6, end: 11, field: 'decision' });
  assert.equal(issues[0]?.code, 'QUOTE_MISMATCH');
});

test('rejects evidence from another source', () => {
  const issues = validateEvidenceSpan('hello world', 's1', { evidence_id: 'e1', source_id: 's2', quote: 'world', start: 6, end: 11, field: 'decision' });
  assert.equal(issues[0]?.code, 'SOURCE_MISMATCH');
});
