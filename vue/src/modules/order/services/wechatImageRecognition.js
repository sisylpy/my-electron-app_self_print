const PRODUCT_CHARACTER = /[\p{Script=Han}A-Za-z]/u;
const QUANTITY = /^(?:\d+(?:\.\d+)?|[零〇一二三四五六七八九十百千万两半]+)$/u;
const ORDER_UNIT = /^(?:斤|两|个|件|袋|包|盒|瓶|把|条|箱|份|根|棵|只|串|筐|盆|粒|块|张|桶|杯|支|卷|片|捆|朵|枚|头|组|台|打|碗|盘)$/u;

function cleanValue(value) {
  return String(value ?? '')
    .replace(/[\u0000-\u001F\u007F-\u009F\uFFFD]/gu, '')
    .trim();
}

function productCharacterCount(value) {
  return Array.from(cleanValue(value)).filter(character => PRODUCT_CHARACTER.test(character)).length;
}

function hasSingleCharacterOrderAmount(quantity, unit) {
  return QUANTITY.test(cleanValue(quantity)) && ORDER_UNIT.test(cleanValue(unit));
}

/**
 * OCR occasionally returns page marks such as "-", a page number such as
 * "17", or one isolated character. They must not become editable order text.
 * A one-character product is still allowed when it carries a complete amount
 * and unit (for example "葱 5斤").
 */
export function isMeaningfulWechatImageOrderName(name, { quantity = '', unit = '' } = {}) {
  const count = productCharacterCount(name);
  if (count >= 2) return true;
  return count === 1 && hasSingleCharacterOrderAmount(quantity, unit);
}

function rawLineHasOrderAmount(line) {
  const match = cleanValue(line).match(/(?:\d+(?:\.\d+)?|[零〇一二三四五六七八九十百千万两半]+)\s*(斤|两|个|件|袋|包|盒|瓶|把|条|箱|份|根|棵|只|串|筐|盆|粒|块|张|桶|杯|支|卷|片|捆|朵|枚|头|组|台|打|碗|盘)/u);
  return Boolean(match);
}

/** Keep only raw OCR lines that can plausibly be an order, not page noise. */
export function filterWechatImageOcrText(value) {
  return String(value ?? '')
    .replace(/\r\n?/gu, '\n')
    .split('\n')
    .map(cleanValue)
    .filter((line) => {
      const count = productCharacterCount(line);
      return count >= 2 || (count === 1 && rawLineHasOrderAmount(line));
    })
    .join('\n');
}

/**
 * Prefer the server's structured OCR rows, but reject obviously invalid rows.
 * If those rows are unusable, fall back to individually filtered raw OCR text.
 */
export function formatWechatImageRecognition(data) {
  const items = Array.isArray(data?.items) ? data.items : [];
  const itemLines = items.map((item) => {
    const name = cleanValue(item?.name || item?.rawName);
    const quantity = cleanValue(item?.quantity ?? item?.qty);
    const unit = cleanValue(item?.spec || item?.unit);
    const note = cleanValue(item?.note || item?.remark);
    if (!isMeaningfulWechatImageOrderName(name, { quantity, unit })) return '';
    const displayName = note ? `${name}(${note})` : name;
    return [displayName, `${quantity}${unit}`.trim()].filter(Boolean).join(' ');
  }).filter(Boolean);

  return itemLines.length ? itemLines.join('\n') : filterWechatImageOcrText(data?.ocrText);
}
