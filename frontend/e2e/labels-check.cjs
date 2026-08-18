#!/usr/bin/env node
/**
 * P1-13：标签完备性检查。
 * 语料（experience-records.jsonl）中出现的一切 dimension/value code，
 * 前端 i18n/labels.ts 必须有中文文案，否则生产 UI 会出现未翻译的英文 code。
 */
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const recordsPath = path.join(root, '..', 'backend', 'data', 'experience-records.jsonl');
const labelsPath = path.join(root, 'src', 'i18n', 'labels.ts');

if (!fs.existsSync(recordsPath)) {
  console.error('FAIL  语料文件不存在：' + recordsPath + '（先在 backend 运行 npm run extract:replay）');
  process.exit(2);
}
const labels = fs.readFileSync(labelsPath, 'utf8');
const dimSection = labels.slice(labels.indexOf('DIMENSION_LABELS'), labels.indexOf('VALUE_LABELS'));
const dimLabels = new Set([...dimSection.matchAll(/^\s{2}([a-z_]+):/gm)].map((m) => m[1]));
const valueSection = labels.slice(labels.indexOf('VALUE_LABELS'), labels.indexOf('WHY_READ_LABELS'));
const valueLabels = new Set([...valueSection.matchAll(/^\s{2}([A-Z0-9_]+):/gm)].map((m) => m[1]));

const dimensionIds = new Set();
const valueCodes = new Set();
for (const line of fs.readFileSync(recordsPath, 'utf8').split(/\r?\n/)) {
  if (!line.trim()) continue;
  const record = JSON.parse(line);
  if (record.decision && record.decision.value) valueCodes.add(record.decision.value);
  for (const fact of record.pre_decision_context || []) {
    dimensionIds.add(fact.dimension_id);
    valueCodes.add(fact.value);
  }
}

const missingDims = [...dimensionIds].filter((id) => !dimLabels.has(id));
const missingValues = [...valueCodes].filter((code) => !valueLabels.has(code));

let failed = missingDims.length + missingValues.length > 0;
for (const id of missingDims) console.log('FAIL  维度缺中文标签：' + id);
for (const code of missingValues) console.log('FAIL  取值缺中文标签：' + code);

// 反向检查：label 文案本身不允许仍是 code 形态
for (const [, code, text] of valueSection.matchAll(/^\s{2}([A-Z0-9_]+):\s*'([^']*)'/gm)) {
  if (/^[A-Z_\d]+$/.test(text)) { console.log('FAIL  取值文案未翻译：' + code + ' -> ' + text); failed = true; }
}

if (!failed) {
  console.log('PASS  ' + dimensionIds.size + ' 个维度、' + valueCodes.size + ' 个取值全部有中文标签');
  process.exit(0);
}
process.exit(1);
