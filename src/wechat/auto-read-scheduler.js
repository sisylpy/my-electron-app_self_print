const fs = require('fs');
const path = require('path');

const DEFAULT_CONFIG = Object.freeze({
  version: 1,
  enabled: false,
  times: [],
  excludedCustomerKeys: [],
});

function normalizeTime(value) {
  const text = String(value || '').trim();
  const match = /^(\d{2}):(\d{2})$/.exec(text);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function normalizeTimes(values) {
  return Array.from(new Set((Array.isArray(values) ? values : [])
    .map(normalizeTime)
    .filter(Boolean)))
    .sort();
}

function normalizeId(value, label) {
  const text = String(value ?? '').trim();
  if (!/^[1-9]\d*$/.test(text)) throw new TypeError(`${label} 无效`);
  return text;
}

function customerKey(distributerId, customerId) {
  return `${normalizeId(distributerId, '配送商 ID')}:${normalizeId(customerId, '客户 ID')}`;
}

function normalizeConfig(value) {
  const input = value && typeof value === 'object' ? value : {};
  return {
    version: 1,
    enabled: input.enabled === true,
    times: normalizeTimes(input.times),
    excludedCustomerKeys: Array.from(new Set(
      (Array.isArray(input.excludedCustomerKeys) ? input.excludedCustomerKeys : [])
        .map(item => String(item || '').trim())
        .filter(item => /^\d+:\d+$/.test(item))
    )).sort(),
  };
}

function publicConfig(config) {
  return {
    enabled: config.enabled,
    times: config.times.slice(),
  };
}

function localMinute(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  return {
    time: `${hour}:${minute}`,
    key: `${year}-${month}-${day} ${hour}:${minute}`,
  };
}

function createWechatAutoReadScheduler({
  filePath,
  onTrigger,
  now = () => new Date(),
  intervalMs = 15 * 1000,
  setIntervalFn = setInterval,
  clearIntervalFn = clearInterval,
  logger = console,
} = {}) {
  if (!filePath) throw new TypeError('filePath is required');
  if (typeof onTrigger !== 'function') throw new TypeError('onTrigger is required');

  let config = { ...DEFAULT_CONFIG, times: [], excludedCustomerKeys: [] };
  let timer = null;
  let activeRun = null;
  let lastTriggeredMinute = '';
  let runSequence = 0;

  function read() {
    try {
      if (!fs.existsSync(filePath)) return config;
      config = normalizeConfig(JSON.parse(fs.readFileSync(filePath, 'utf8')));
    } catch (error) {
      logger.warn?.('[微信自动读取] 配置读取失败，使用默认设置:', error?.message || error);
      config = { ...DEFAULT_CONFIG, times: [], excludedCustomerKeys: [] };
    }
    return config;
  }

  function write() {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    const temporaryPath = `${filePath}.tmp`;
    fs.writeFileSync(temporaryPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
    fs.renameSync(temporaryPath, filePath);
  }

  function getConfig() {
    return publicConfig(config);
  }

  function setConfig(input) {
    const times = normalizeTimes(input?.times);
    if ((Array.isArray(input?.times) ? input.times : []).length !== times.length) {
      throw new TypeError('执行时间必须是有效且不重复的 HH:mm');
    }
    config = {
      ...config,
      enabled: input?.enabled === true,
      times,
    };
    write();
    return getConfig();
  }

  function getCustomerParticipation(distributerId, customerId) {
    const key = customerKey(distributerId, customerId);
    return !config.excludedCustomerKeys.includes(key);
  }

  function setCustomerParticipation(distributerId, customerId, participates) {
    const key = customerKey(distributerId, customerId);
    const excluded = new Set(config.excludedCustomerKeys);
    if (participates === false) excluded.add(key);
    else excluded.delete(key);
    config = { ...config, excludedCustomerKeys: Array.from(excluded).sort() };
    write();
    return participates !== false;
  }

  async function tick() {
    if (activeRun || !config.enabled || !config.times.length) return false;
    const current = localMinute(now());
    if (!config.times.includes(current.time) || lastTriggeredMinute === current.key) return false;

    const runId = `wechat-auto-${Date.now()}-${++runSequence}`;
    activeRun = { runId, minuteKey: current.key };
    let delivered = false;
    try {
      delivered = await onTrigger({
        runId,
        scheduledTime: current.time,
        excludedCustomerKeys: config.excludedCustomerKeys.slice(),
      }) === true;
    } catch (error) {
      logger.warn?.('[微信自动读取] 定时触发失败:', error?.message || error);
    }
    if (delivered) {
      lastTriggeredMinute = current.key;
    } else {
      activeRun = null;
    }
    return delivered;
  }

  function finish(runId) {
    if (!activeRun || activeRun.runId !== String(runId || '')) return false;
    activeRun = null;
    return true;
  }

  function cancelActiveRun() {
    activeRun = null;
  }

  function start() {
    if (timer) return;
    void tick();
    timer = setIntervalFn(() => void tick(), intervalMs);
  }

  function stop() {
    if (timer) clearIntervalFn(timer);
    timer = null;
    activeRun = null;
  }

  read();
  return {
    getConfig,
    setConfig,
    getCustomerParticipation,
    setCustomerParticipation,
    tick,
    finish,
    cancelActiveRun,
    start,
    stop,
  };
}

module.exports = {
  createWechatAutoReadScheduler,
  normalizeTime,
  normalizeTimes,
};
