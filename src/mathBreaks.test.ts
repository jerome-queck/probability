import assert from 'node:assert/strict';
import test from 'node:test';
import { keepShortTail } from './mathBreaks.ts';

test('a tiny last piece is joined to the piece before it', () => {
  assert.equal(
    keepShortTail('\\binom{12}{2}=3\\cdot 22=66'),
    '\\binom{12}{2}={3\\cdot 22=66}',
  );
  assert.equal(keepShortTail('x=1'), '{x=1}');
  assert.equal(keepShortTail('a\\le b'), '{a\\le b}');
});

test('long tails, no relations and relations inside braces are left alone', () => {
  assert.equal(keepShortTail('a+b'), 'a+b');
  assert.equal(
    keepShortTail('P(E)=\\frac{|E|}{|S|}+\\sum_{i=1}^{n} q_i'),
    'P(E)=\\frac{|E|}{|S|}+\\sum_{i=1}^{n} q_i',
  );
  assert.equal(keepShortTail('f_{x=1}'), 'f_{x=1}');
});
