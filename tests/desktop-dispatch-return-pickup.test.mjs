import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  buildOrderCollections,
  isReturnPickupStop,
} from '../vue/src/modules/dispatch/services/readModel.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function snapshotsWithStop(stop) {
  return {
    dispatch: {
      pageViewModel: {
        sections: [{
          cards: [{
            cardType: 'DRIVER_ROUTE',
            driverUserId: 1,
            driverName: '测试司机',
            timeline: [{ type: 'stop', customerName: '测试客户', ...stop }],
          }],
        }],
      },
    },
    loading: { pageViewModel: { sections: [] } },
    delivery: { pageViewModel: { sections: [] } },
  };
}

test('桌面读模型按任务类型和退货站点编号恢复退货取货标识', () => {
  assert.equal(isReturnPickupStop({ taskType: 'RETURN_PICKUP' }), true);
  assert.equal(isReturnPickupStop({ sandboxStopKey: 'return-pickup:88' }), true);

  const byTaskType = buildOrderCollections(snapshotsWithStop({ taskType: 'RETURN_PICKUP' }), null);
  assert.equal(byTaskType.routes.dispatch[0]._stops[0].isReturnPickup, true);
  assert.equal(byTaskType.routes.dispatch[0]._stops[0].taskType, 'RETURN_PICKUP');

  const byStopKey = buildOrderCollections(snapshotsWithStop({ cardKey: 'return-pickup:99' }), null);
  assert.equal(byStopKey.routes.dispatch[0]._stops[0].isReturnPickup, true);
  assert.equal(byStopKey.routes.dispatch[0]._stops[0].taskType, 'RETURN_PICKUP');
});

test('桌面路线表同步小程序的退货名称和取货提醒', () => {
  const component = fs.readFileSync(
    path.join(root, 'vue/src/modules/dispatch/components/DispatchControlPanel.vue'),
    'utf8'
  );
  assert.match(component, /class="return-pickup-name-tag">（退货）/);
  assert.match(component, /↩ 退货取货/);
  assert.match(component, /到店拿回商品，无需装货/);
  assert.match(component, /'is-return-pickup': isReturnPickup\(stop\)/);
  assert.match(component, /\.stop-list__return-reminder/);
});

test('编辑路线弹窗保留退货站点身份并显示取货说明', () => {
  const component = fs.readFileSync(
    path.join(root, 'vue/src/modules/dispatch/components/DispatchRouteEditDialog.vue'),
    'utf8'
  );
  assert.match(component, /isReturnPickupStop/);
  assert.match(component, /'is-return-pickup': stop\.isReturnPickup/);
  assert.match(component, /class="route-editor__return-name-tag">（退货）/);
  assert.match(component, /class="route-editor__return-reminder"/);
  assert.match(component, /↩ 退货取货/);
  assert.match(component, /到店拿回商品，无需装货/);
  assert.match(component, /stop\.isReturnPickup \? '取货' : '服务'/);
});

test('编辑路线试算和保存不会被无关后台状态永久锁死', () => {
  const component = fs.readFileSync(
    path.join(root, 'vue/src/modules/dispatch/components/DispatchRouteEditDialog.vue'),
    'utf8'
  );
  assert.match(component, /:disabled="previewing \|\| saving \|\| closing"[\s\S]*@click\.stop="previewRoute\(\)"/);
  assert.match(component, /class="primary"[\s\S]*:disabled="previewing \|\| saving \|\| closing"/);
  assert.match(component, /@click\.stop="previewRoute\(\)"/);
  assert.match(component, /dirty \|\| !previewReady \? '重新计算并保存'/);
  assert.match(component, /if \(dirty\.value \|\| !previewReady\.value\) \{\s*const previewed = await previewRoute\(\);/);
});
