function scanTitle(entry) {
  return String(entry?.title || '').trim();
}

/**
 * WeChat is one visible window, so conversation switching must remain strictly
 * sequential. Keeping that invariant here prevents a later UI change from
 * starting overlapping searches while still allowing customer bindings to be
 * prefetched before this runner starts.
 */
export async function scanAllBoundWechatCustomers({
  entries,
  scanEntry,
  onProgress = () => {},
} = {}) {
  if (typeof scanEntry !== 'function') {
    throw new TypeError('scanEntry must be a function');
  }

  const queue = (Array.isArray(entries) ? entries : [])
    .filter(entry => scanTitle(entry));
  const imports = [];
  const failures = [];
  let emptyCount = 0;

  for (let index = 0; index < queue.length; index += 1) {
    const entry = queue[index];
    const title = scanTitle(entry);
    const progress = {
      current: index + 1,
      total: queue.length,
      title,
    };
    onProgress(progress);
    try {
      const result = await scanEntry(entry, progress);
      const items = Array.isArray(result) ? result : [];
      if (items.length) imports.push(...items);
      else emptyCount += 1;
    } catch (error) {
      failures.push({
        title,
        message: error?.message || '巡查该微信会话失败',
      });
    }
  }

  return {
    checkedCount: queue.length,
    successCount: queue.length - failures.length,
    emptyCount,
    imports,
    failures,
  };
}
