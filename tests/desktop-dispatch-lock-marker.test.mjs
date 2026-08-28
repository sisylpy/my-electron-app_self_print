import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  decorateRoutesWithPlanningLocks,
  decorateStopsWithPlanningLocks,
} from '../vue/src/modules/dispatch/services/planningLocks.js';
import { buildOrderCollections } from '../vue/src/modules/dispatch/services/readModel.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('桌面沙箱只按Server stopLocks标记锁定客户', () => {
  const pageViewModel = {
    planning: {
      stopLocks: [{ depFatherId: 201, driverUserId: 56, driverName: '56司机' }],
    },
  };
  const routes = [{
    driverUserId: 56,
    _stops: [
      { depFatherId: 201, customerName: '送单味百味-1' },
      { depFatherId: 202, customerName: '普通客户' },
    ],
  }];

  const decorated = decorateRoutesWithPlanningLocks(routes, pageViewModel);
  assert.equal(decorated[0]._stops[0].driverLocked, true);
  assert.equal(decorated[0]._stops[0].lockedDriverUserId, 56);
  assert.equal(decorated[0]._stops[0].driverLockLabel, '已锁定给 56司机');
  assert.equal(decorated[0]._stops[1].driverLocked, undefined,
    '不能因为客户位于56司机路线就推断为锁定');
  assert.equal(routes[0]._stops[0].driverLocked, undefined,
    '展示装饰不能回写Server原始对象');
});

test('锁定客户即使暂时位于待分配区也显示锁定事实', () => {
  const pageViewModel = {
    planning: {
      stopLocks: [{ depFatherId: 201, driverUserId: 56, driverName: '56司机' }],
    },
  };
  const stops = decorateStopsWithPlanningLocks(
    [{ departmentId: 201, customerName: '送单味百味-1' }],
    pageViewModel
  );
  assert.equal(stops[0].driverLocked, true);
  assert.equal(stops[0].driverLockLabel, '已锁定给 56司机');
});

test('桌面工作台读模型把dispatch planning锁映射到真实路线站点', () => {
  const pageViewModel = {
    planning: {
      stopLocks: [{ depFatherId: 201, driverUserId: 56, driverName: '56司机' }],
    },
    sections: [{
      cards: [{
        cardType: 'DRIVER_ROUTE',
        driverUserId: 56,
        driverName: '56司机',
        timeline: [
          { type: 'stop', depFatherId: 201, customerName: '送单味百味-1' },
          { type: 'stop', depFatherId: 202, customerName: '普通客户' },
        ],
      }],
    }],
  };
  const collections = buildOrderCollections({
    dispatch: { pageViewModel },
    loading: { pageViewModel: { sections: [] } },
    delivery: { pageViewModel: { sections: [] } },
  }, null);

  assert.equal(collections.routes.dispatch[0]._stops[0].driverLocked, true);
  assert.equal(collections.routes.dispatch[0]._stops[0].driverLockLabel, '已锁定给 56司机');
  assert.equal(collections.routes.dispatch[0]._stops[1].driverLocked, undefined);
});

test('桌面路线列表渲染与Boss一致的醒目锁定标识', () => {
  const component = fs.readFileSync(
    path.join(root, 'vue/src/modules/dispatch/components/DispatchControlPanel.vue'),
    'utf8'
  );
  assert.match(component, /'is-driver-locked': stop\.driverLocked/);
  assert.match(component, /class="driver-lock-badge"/);
  assert.match(component, /🔒 \{\{ stop\.driverLockLabel \|\| '已锁定司机' \}\}/);
  assert.match(component, /\.stop-list li\.is-driver-locked/);
  assert.match(component, /border-left: 5px solid #f0a020/);
});
