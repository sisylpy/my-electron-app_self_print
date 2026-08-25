import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveForecastDate } from './predictionDateSemantics.js';

test('forecast date follows server calendar date instead of the previous order business date', () => {
  assert.equal(resolveForecastDate({
    businessDate: '2026-08-24',
    forecastDate: '2026-08-25',
    serverNow: '2026-08-25T00:36:00+08:00[Asia/Shanghai]',
  }), '2026-08-25');
});

test('legacy catalog derives forecast date from serverNow without using businessDate', () => {
  assert.equal(resolveForecastDate({
    businessDate: '2026-08-24',
    serverNow: '2026-08-25T02:31:00+08:00[Asia/Shanghai]',
  }, new Date(2026, 7, 26)), '2026-08-25');
});

