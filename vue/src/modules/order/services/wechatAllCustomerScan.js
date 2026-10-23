function scanTitle(entry) {
  return String(entry?.title || '').trim();
}

export function customerParticipatesInAutoRead(distributerId, customerId, excludedCustomerKeys) {
  const key = `${String(distributerId || '').trim()}:${String(customerId || '').trim()}`;
  const excluded = excludedCustomerKeys instanceof Set
    ? excludedCustomerKeys
    : new Set(Array.isArray(excludedCustomerKeys) ? excludedCustomerKeys : []);
  return !excluded.has(key);
}

/**
 * Read one bound conversation from the local WeChat database first.
 *
 * A complete payload proves that the Reader saw every referenced text/image
 * and that the server accepted the pending message fingerprints. A result
 * without a payload may also be trusted when SessionTable's newest activity
 * is covered by the message snapshot. Otherwise the conversation is visibly
 * opened and read again so speed never weakens completeness.
 */
export async function readWechatCustomerDatabaseFirst({
  readDatabase,
  focusConversation,
  canTrustDatabaseResult = () => false,
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

  // Even a complete payload must pass the caller's binding/title validation.
  // A renamed WeChat group keeps the same stable fingerprint, so reading by
  // fingerprint alone would otherwise create an order under its stale name.
  const databaseResultTrusted = await canTrustDatabaseResult(databaseResult);
  if (databaseResult?.payload || databaseResultTrusted) {
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

export function databaseResultCoversConversation(databaseResult, conversationSnapshot) {
  if (databaseResult?.payload) return true;
  if (!['current', 'duplicate', 'empty'].includes(databaseResult?.status)) return false;
  if (!conversationSnapshot?.available || conversationSnapshot.exists !== true) return false;

  const lastMessageTimeMs = Number(conversationSnapshot.lastMessageTimeMs);
  const latestObservedMessageTimeMs = Number(databaseResult.latestObservedMessageTimeMs);
  const queryStartTimeMs = Number(databaseResult.queryStartTimeMs);
  if (!Number.isFinite(lastMessageTimeMs) || lastMessageTimeMs <= 0) return false;

  // SessionTable is WeChat's conversation-list freshness marker. If the
  // message shard contains that same newest timestamp, the local Reader has
  // already caught up and opening/searching the chat cannot reveal a later
  // message. An older session also proves the configured query window is empty.
  return (
    Number.isFinite(latestObservedMessageTimeMs)
      && latestObservedMessageTimeMs >= lastMessageTimeMs
  ) || (
    Number.isFinite(queryStartTimeMs)
      && lastMessageTimeMs < queryStartTimeMs
  );
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
  const warnings = [];
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
      const items = Array.isArray(result)
        ? result
        : Array.isArray(result?.items) ? result.items : [];
      const warning = Array.isArray(result) ? '' : String(result?.warning || '').trim();
      if (warning) warnings.push({ title, message: warning });
      if (items.length) {
        imports.push(...items);
        onResult({
          ...progress,
          status: 'found',
          itemCount: items.length,
          items,
          message: `发现 ${items.length} 个订单任务${warning ? `；${warning}` : ''}`,
        });
      } else if (warning) {
        onResult({
          ...progress,
          status: 'warning',
          itemCount: 0,
          message: warning,
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
      if (error?.code === 'SERVER_AUTH_FAILED') throw error;
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
    warnings,
  };
}
