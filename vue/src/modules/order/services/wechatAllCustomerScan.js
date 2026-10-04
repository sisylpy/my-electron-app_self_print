function scanTitle(entry) {
  return String(entry?.title || '').trim();
}

/**
 * Read one bound conversation from the local WeChat database first.
 *
 * A complete payload proves that the Reader saw every referenced text/image
 * and that the server accepted the pending message fingerprints. Results
 * without a payload cannot prove that WeChat has hydrated the latest local
 * rows, so they must be verified by visibly opening the conversation and
 * reading the database again.
 */
export async function readWechatCustomerDatabaseFirst({
  readDatabase,
  focusConversation,
} = {}) {
  if (typeof readDatabase !== 'function') {
    throw new TypeError('readDatabase must be a function');
  }
  if (typeof focusConversation !== 'function') {
    throw new TypeError('focusConversation must be a function');
  }

  let databaseResult = null;
  let databaseError = null;
  try {
    databaseResult = await readDatabase({ mode: 'database' });
  } catch (error) {
    databaseError = error;
  }

  if (databaseResult?.payload) {
    return {
      result: databaseResult,
      mode: 'database',
      verifiedByConversation: false,
    };
  }

  await focusConversation({ databaseResult, databaseError });
  return {
    result: await readDatabase({ mode: 'conversation' }),
    mode: 'conversation',
    verifiedByConversation: true,
  };
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
  onResult = () => {},
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
      if (items.length) {
        imports.push(...items);
        onResult({
          ...progress,
          status: 'found',
          itemCount: items.length,
          message: `发现 ${items.length} 个订单任务`,
        });
      } else {
        emptyCount += 1;
        onResult({
          ...progress,
          status: 'empty',
          itemCount: 0,
          message: '没有未处理的新订单',
        });
      }
    } catch (error) {
      const failure = {
        title,
        message: error?.message || '巡查该微信会话失败',
      };
      failures.push(failure);
      onResult({
        ...progress,
        status: 'error',
        itemCount: 0,
        message: failure.message,
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
