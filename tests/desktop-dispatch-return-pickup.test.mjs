import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  buildOrderCollections,
  isReturnPickupStop,
} from '../vue/src/modules/dispatch/services/readModel.js';
import { buildRouteEditConfirmPayload } from '../vue/src/modules/dispatch/services/writeContract.js';

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

test('编辑路线明确区分预览和保存且保存不会暗中重新计算', () => {
  const component = fs.readFileSync(
    path.join(root, 'vue/src/modules/dispatch/components/DispatchRouteEditDialog.vue'),
    'utf8'
  );
  assert.match(component, /:disabled="previewing \|\| saving \|\| closing"[\s\S]*@click\.stop="previewRoute\(\)"/);
  assert.match(component, /正在预览…' : '预览路线'/);
  assert.match(component, /class="primary"[\s\S]*:disabled="dirty \|\| !previewReady \|\| previewing \|\| saving \|\| closing"/);
  assert.match(component, /@click\.stop="previewRoute\(\)"/);
  assert.match(component, /saving \? '正在保存…' : '保存路线'/);
  assert.match(component, /if \(dirty\.value \|\| !previewReady\.value\) \{\s*messageTone\.value = 'warning';/);
  assert.doesNotMatch(component, /const previewed = await previewRoute\(\);\s*if \(!previewed\) return;\s*\}\s*saving\.value/);
});

test('调度工作台只在首次打开和用户操作后刷新，不定时或聚焦重算路线', () => {
  const component = fs.readFileSync(
    path.join(root, 'vue/src/modules/dispatch/views/DispatchWorkbench.vue'),
    'utf8'
  );
  assert.match(component, /@click="refresh"/);
  assert.match(component, /onMounted\(async \(\) => \{[\s\S]*await refresh\(\);[\s\S]*\}\);/);
  assert.doesNotMatch(component, /setInterval\(/);
  assert.doesNotMatch(component, /addEventListener\(['"]focus['"]/);
  assert.doesNotMatch(component, /refreshWhenVisible/);
});

test('编辑路线顶部承载紧凑统计且地图列收窄', () => {
  const component = fs.readFileSync(
    path.join(root, 'vue/src/modules/dispatch/components/DispatchRouteEditDialog.vue'),
    'utf8'
  );
  const header = component.match(/<header class="route-editor__header">([\s\S]*?)<\/header>/)?.[1] || '';
  assert.match(header, /class="route-editor__overview"/);
  assert.match(component, /grid-template-columns: minmax\(470px, \.88fr\) minmax\(640px, 1\.12fr\)/);
  assert.match(component, /text-overflow: ellipsis/);
  assert.match(component, /white-space: nowrap/);
});

test('编辑路线服务时长优先使用接口文本并兼容分钟数', () => {
  const component = fs.readFileSync(
    path.join(root, 'vue/src/modules/dispatch/components/DispatchRouteEditDialog.vue'),
    'utf8'
  );
  assert.match(component, /stopServiceDurationLabel\(stop\)/);
  assert.match(component, /stop\?\.serviceDurationLabel \|\| stop\?\.unloadDurationText/);
  assert.match(component, /stop\?\.serviceMinutes \?\? stop\?\.unloadDurationMinutes/);
  assert.match(component, /return '未设置'/);
});

test('保存路线原样提交预览接口返回的完整任务版本清单', () => {
  const expectedTaskVersions = [
    { taskId: 101, taskVersion: 3 },
    { taskId: 202, taskVersion: 7 },
  ];
  const payload = buildRouteEditConfirmPayload({
    route: {
      routeResourceType: 'FORMAL_DRIVER_ROUTE',
      driverUserId: 56,
      driverRouteId: 88,
      routeVersion: 4,
      _stops: [{ stopKey: 'dep:10', sandboxStopKey: 'dep:10', taskId: 101, taskVersion: 3 }],
    },
    stops: [{ stopKey: 'dep:10', sandboxStopKey: 'dep:10', taskId: 101, taskVersion: 3 }],
    stopKeys: ['dep:10'],
    routeDate: '2026-09-19',
    batchCode: 'MORNING',
    previewToken: 'preview-token',
    expectedTaskVersions,
  });
  assert.deepEqual(payload.expectedTaskVersions, expectedTaskVersions);
});
