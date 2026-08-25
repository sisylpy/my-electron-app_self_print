import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, '..');
const sourcePath = path.resolve(
  projectRoot,
  '../../../nongxinle-server/docs/ai/purchase-prediction/prediction-policy-engine-decision-replay.json',
);
const outputPath = path.resolve(
  projectRoot,
  'vue/src/modules/predictionLab/data/policyReplayFixture.json',
);
const EXPECTED_SOURCE_SHA256 = '4174879902a3e888fd2d2ab4437d691e79a126fede4c0ff624315abd27eb8ac3';
const selection = {
  distributerId: 56,
  departmentId: 120,
  customerLabel: '沛宜配送 / 王永',
  predictionDate: '2025-08-23',
  algorithmVersion: 'V8_REPLENISHMENT_STATE',
};

const raw = fs.readFileSync(sourcePath);
const digest = crypto.createHash('sha256').update(raw).digest('hex');
if (digest !== EXPECTED_SOURCE_SHA256) {
  throw new Error(`冻结策略回放哈希不匹配：${digest}`);
}

const source = JSON.parse(raw.toString('utf8'));
const items = source.events
  .filter((event) => (
    Number(event.distributerId) === selection.distributerId
    && Number(event.departmentId) === selection.departmentId
    && event.predictionDate === selection.predictionDate
  ))
  .map((event) => ({
    goodsId: event.goodsId,
    goodsName: event.goodsName,
    unit: event.unit,
    predictedQuantity: event.predictedQuantity,
    actualQuantity: event.actualQuantity,
    outcome: event.outcome,
    level: event.level,
    trustScorePercent: event.trustScorePercent,
    quantityComparable: event.quantityComparable,
    quantityAbsoluteError: event.quantityAbsoluteError,
    evidence: event.evidence,
    supportingReasons: event.explanation?.supportingReasons?.slice(0, 3) || [],
    riskReasons: event.explanation?.riskReasons?.slice(0, 2) || [],
  }));

const levelCounts = Object.fromEntries(['LEVEL_A', 'LEVEL_B', 'LEVEL_C'].map((level) => [
  level,
  items.filter((item) => item.level === level).length,
]));
if (items.length !== 28
    || levelCounts.LEVEL_A !== 5
    || levelCounts.LEVEL_B !== 14
    || levelCounts.LEVEL_C !== 9) {
  throw new Error(`冻结 UX 样本结构变化：${JSON.stringify(levelCounts)}`);
}

const fixture = {
  contract: 'prediction-policy-electron-fixture/v1',
  sourceContract: source.contract,
  sourceReplaySha256: digest,
  frozen: true,
  readOnly: true,
  purpose: 'DESKTOP_UX_VALIDATION_NOT_AGGREGATE_MODEL_EVALUATION',
  selectionReason: '真实饭馆、同一客户日同时包含 A/B/C，便于验证分组、数量复核和 C 级折叠交互',
  ...selection,
  levelCounts,
  items,
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(fixture, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ outputPath, sourceReplaySha256: digest, items: items.length, levelCounts }, null, 2));

