const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  createWechatAutoReadScheduler,
} = require('../src/wechat/auto-read-scheduler');

async function main() {
  const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'grain-wechat-auto-read-'));
  const configPath = path.join(temporaryDirectory, 'wechat-auto-read.json');
  let currentTime = new Date(2026, 9, 16, 5, 50, 5);
  const triggers = [];

  try {
  const scheduler = createWechatAutoReadScheduler({
    filePath: configPath,
    now: () => currentTime,
    onTrigger: async trigger => {
      triggers.push(trigger);
      return true;
    },
  });

  assert.deepStrictEqual(scheduler.getConfig(), { enabled: false, times: [] });
  assert.deepStrictEqual(
    scheduler.setConfig({ enabled: true, times: ['22:00', '05:50', '15:00'] }),
    { enabled: true, times: ['05:50', '15:00', '22:00'] },
  );
  assert.strictEqual(scheduler.setCustomerParticipation(7, 20, false), false);
  assert.strictEqual(scheduler.getCustomerParticipation(7, 20), false);
  assert.strictEqual(scheduler.getCustomerParticipation(7, 21), true);

  assert.strictEqual(await scheduler.tick(), true);
  assert.strictEqual(triggers.length, 1);
  assert.deepStrictEqual(triggers[0].excludedCustomerKeys, ['7:20']);
  assert.strictEqual(await scheduler.tick(), false, 'active run must block duplicate starts');
  assert.strictEqual(scheduler.finish(triggers[0].runId), true);
  assert.strictEqual(await scheduler.tick(), false, 'same minute must only trigger once');

  currentTime = new Date(2026, 9, 16, 15, 0, 2);
  assert.strictEqual(await scheduler.tick(), true);
  assert.strictEqual(triggers.length, 2);
  scheduler.finish(triggers[1].runId);

  const restored = createWechatAutoReadScheduler({
    filePath: configPath,
    now: () => currentTime,
    onTrigger: async () => true,
  });
  assert.deepStrictEqual(restored.getConfig(), {
    enabled: true,
    times: ['05:50', '15:00', '22:00'],
  });
  assert.strictEqual(restored.getCustomerParticipation(7, 20), false);
  assert.strictEqual(restored.setCustomerParticipation(7, 20, true), true);
  assert.strictEqual(restored.getCustomerParticipation(7, 20), true);

    console.log('wechat auto-read scheduler smoke: ok');
  } finally {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
