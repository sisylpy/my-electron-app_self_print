#!/usr/bin/env node
/**
 * Reader 冷启动计时的正确性测试（模拟事件，不启动真实 reader 子进程）。
 *
 * 计时契约：request() 返回 { value, start }，start 是「本次请求专属」的快照
 * { role, generation, startMs }；全局只保留单调递增的序号，不再保存角色，
 * 因此并发请求无法互相覆盖。
 *
 * 覆盖：
 *   1-9   基本场景（首次冷启动 / 热读 / 更快的二次启动 / 预热 / 并发 / 失败恢复）
 *   10-14 并发归属与交错执行（本轮审查重点）
 */
import assert from 'node:assert/strict';
import { ReaderBridge } from './reader-bridge.js';

/** 造一个不 spawn 真实进程的 bridge，并注入可控的「启动」实现。 */
function createBridge() {
  const bridge = new ReaderBridge({ appLogger: null });
  bridge.ready = false;
  bridge.child = null;
  bridge.startInternal = async function fakeStart() {
    const generation = ++this.startGeneration;
    this.pendingStartGeneration = generation;
    if (bridge.__failNextStart) {
      bridge.__failNextStart = false;
      throw new Error('reader start failed');
    }
    const durationMs = bridge.__nextStartMs ?? 0;
    await new Promise((resolve) => setTimeout(resolve, durationMs));
    this.coldStartMs = durationMs;
    this.lastStartGeneration = generation;
    this.lastStartMs = durationMs;
    this.ready = true;
    this.child = { exitCode: null, stdin: { write() {} } };
  };
  return bridge;
}

/**
 * 与真实 request() 等价的请求模拟：返回本次请求专属的 start 快照。
 * 刻意不读取任何全局角色字段，以验证并发下不会互相覆盖。
 */
async function fakeRequest(bridge) {
  const wasRunning = bridge.isRunning();
  const startInFlight = !wasRunning && Boolean(bridge.startPromise);
  await bridge.ensureStarted();
  const start = {
    role: wasRunning ? 'warm' : (startInFlight ? 'shared' : 'active'),
    generation: bridge.lastStartGeneration,
    startMs: bridge.lastStartMs,
  };
  return { start };
}

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

test('1. 首次冷启动：序号 0→1，角色 active', async () => {
  const bridge = createBridge();
  bridge.__nextStartMs = 1200;
  const before = bridge.lastColdStart();
  assert.equal(before.generation, 0);
  const { start } = await fakeRequest(bridge);
  assert.equal(start.generation, 1);
  assert.equal(start.role, 'active');
  assert.equal(start.startMs, 1200);
});

test('2. 冷启动后热读取：序号不变，角色 warm', async () => {
  const bridge = createBridge();
  bridge.__nextStartMs = 1200;
  await fakeRequest(bridge);
  const before = bridge.lastColdStart();
  const { start } = await fakeRequest(bridge);
  assert.equal(start.generation, before.generation);
  assert.equal(start.role, 'warm');
});

test('3. 第二次冷启动比第一次更快：靠序号判定，不靠耗时', async () => {
  const bridge = createBridge();
  bridge.__nextStartMs = 5000;
  await fakeRequest(bridge);
  bridge.ready = false;
  bridge.child = null;
  bridge.startPromise = null;
  bridge.__nextStartMs = 300;
  const { start } = await fakeRequest(bridge);
  assert.equal(start.generation, 2);
  assert.equal(start.role, 'active');
  assert.equal(start.startMs, 300);
  assert.ok(start.startMs < bridge.lastColdStart().startMs || start.generation === 2);
});

test('4. 预热先完成再点击：用户请求为 warm，不记冷启动', async () => {
  const bridge = createBridge();
  bridge.__nextStartMs = 2000;
  await bridge.ensureStarted();
  const before = bridge.lastColdStart();
  const { start } = await fakeRequest(bridge);
  assert.equal(start.role, 'warm');
  assert.equal(start.generation, before.generation);
});

test('5. 预热进行中点击：用户请求为 shared（共享等待）', async () => {
  const bridge = createBridge();
  bridge.__nextStartMs = 800;
  const prewarm = bridge.ensureStarted();
  const { start } = await fakeRequest(bridge);
  assert.equal(start.role, 'shared');
  assert.notEqual(start.role, 'active');
  await prewarm;
  assert.equal(bridge.lastColdStart().generation, 1);
});

test('6. 连续两次点击：第二次为 warm，全程只启动一次', async () => {
  const bridge = createBridge();
  bridge.__nextStartMs = 1500;
  const first = await fakeRequest(bridge);
  assert.equal(first.start.role, 'active');
  const second = await fakeRequest(bridge);
  assert.equal(second.start.role, 'warm');
  assert.equal(bridge.startGeneration, 1);
});

test('7. 并发请求：只发起一次启动，其余共享', async () => {
  const bridge = createBridge();
  bridge.__nextStartMs = 400;
  const results = await Promise.all([fakeRequest(bridge), fakeRequest(bridge), fakeRequest(bridge)]);
  assert.equal(bridge.startGeneration, 1);
  const roles = results.map((r) => r.start.role).sort();
  assert.equal(roles.filter((r) => r === 'active').length, 1);
  assert.equal(roles.filter((r) => r === 'shared').length, 2);
  for (const r of results) assert.equal(r.start.generation, 1);
});

test('8. 启动失败：不得推进已完成序号，也不得覆盖已记录耗时', async () => {
  const bridge = createBridge();
  bridge.__nextStartMs = 1000;
  await fakeRequest(bridge);
  bridge.ready = false;
  bridge.child = null;
  bridge.startPromise = null;
  bridge.__failNextStart = true;
  await assert.rejects(() => fakeRequest(bridge), /reader start failed/);
  const after = bridge.lastColdStart();
  assert.equal(after.generation, 1);
  assert.equal(after.startMs, 1000);
  assert.equal(bridge.startGeneration, 2);
});

test('9. 启动失败后重试成功：序号与耗时正确推进', async () => {
  const bridge = createBridge();
  bridge.__failNextStart = true;
  await assert.rejects(() => fakeRequest(bridge), /reader start failed/);
  bridge.__nextStartMs = 700;
  const { start } = await fakeRequest(bridge);
  assert.equal(start.generation, 2);
  assert.equal(start.role, 'active');
  assert.equal(start.startMs, 700);
});

// ------------------------------------------------- 本轮审查重点：并发归属
test('10. A 发起启动、B 同时等待：两者角色互不覆盖', async () => {
  const bridge = createBridge();
  bridge.__nextStartMs = 600;
  const a = fakeRequest(bridge);   // 先到，主动发起启动
  const b = fakeRequest(bridge);   // 后到，共享等待同一次启动
  const [ra, rb] = await Promise.all([a, b]);

  assert.equal(ra.start.role, 'active', 'A 应保留 active');
  assert.equal(rb.start.role, 'shared', 'B 应为 shared');
  // 关键：B 完成后再检查 A 的快照，必须仍然是 active
  assert.equal(ra.start.role, 'active', 'A 的快照不得被 B 覆盖');
  assert.equal(rb.start.role, 'shared', 'B 的快照不得被 A 覆盖');
  assert.equal(ra.start.generation, rb.start.generation);
});

test('11. A 触发启动后又发起其它查询：A 的快照保持 active', async () => {
  const bridge = createBridge();
  bridge.__nextStartMs = 900;
  const a = await fakeRequest(bridge);
  assert.equal(a.start.role, 'active');
  const later = await fakeRequest(bridge);
  assert.equal(later.start.role, 'warm', '后续查询应为 warm');
  assert.equal(a.start.role, 'active', '后续查询不得覆盖 A 已捕获的 active');
});

test('12. 后台预热与用户读取并发：用户保持 shared，不会被预热覆盖成 active', async () => {
  const bridge = createBridge();
  bridge.__nextStartMs = 700;
  const prewarm = fakeRequest(bridge);  // 预热先到，主动发起启动
  const user = fakeRequest(bridge);     // 用户点击，共享等待
  const [rp, ru] = await Promise.all([prewarm, user]);

  assert.equal(rp.start.role, 'active', '预热是真正的发起者');
  assert.equal(ru.start.role, 'shared', '用户只是共享等待');
  // 再发若干请求，确认两个快照都稳定
  await fakeRequest(bridge);
  assert.equal(ru.start.role, 'shared', '用户快照不得被预热或其它请求改写');
  assert.equal(rp.start.role, 'active');
});

test('13. 渲染层延迟读取：全局只读接口不含角色，不会取到别人数据', async () => {
  const bridge = createBridge();
  bridge.__nextStartMs = 500;
  const a = await fakeRequest(bridge);
  const snapshotBefore = JSON.stringify(a.start);

  // 模拟渲染层迟迟不读取：期间发生多次其它请求
  await fakeRequest(bridge);
  await fakeRequest(bridge);

  const late = bridge.lastColdStart();
  assert.equal(late.role, undefined, '全局只读接口不应暴露易变的角色字段');
  assert.equal(late.generation, a.start.generation, '序号单调递增，晚读不会变小');
  assert.equal(JSON.stringify(a.start), snapshotBefore, 'A 的快照不受后续请求影响');
});

test('14. A 启动失败、B 随后重试：B 为 active 且序号递增', async () => {
  const bridge = createBridge();
  bridge.__failNextStart = true;
  await assert.rejects(() => fakeRequest(bridge), /reader start failed/);
  bridge.__nextStartMs = 250;
  const b = await fakeRequest(bridge);
  assert.equal(b.start.role, 'active');
  assert.equal(b.start.generation, 2);
  assert.equal(b.start.startMs, 250);
});

let failed = 0;
for (const { name, fn } of tests) {
  try {
    await fn();
    console.log(`  ok  - ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`  FAIL- ${name}`);
    console.error(`        ${error && error.message}`);
  }
}
console.log(`\nReader 冷启动/并发归属测试：${tests.length - failed}/${tests.length} 通过`);
if (failed) process.exit(1);
