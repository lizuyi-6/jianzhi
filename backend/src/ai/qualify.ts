import { SourceDocument } from '../core/contracts.js';

// 数据门（Data Gate）的 E0-E3 资格判定在代码里落地，而非只存在于文档：
//  E0 文本过短/不可用；E1 泛观点无个人决策事件；E2 有个人经历与决策阶段；E3 有明确可定位的选择陈述。
export type QualityLabel = 'E0' | 'E1' | 'E2' | 'E3';
export interface Qualification { label: QualityLabel; reasons: string[] }

const FIRST_PERSON = /我/;
const DECISION_STAGE = /(毕业|大四|应届|考研|读研|保研|拟录取|工作|offer|Offer)/;
const EXPERIENCE_SIGNAL = /(我(当时|当年|那(时|年)|选择|决定|最后|最终|签|上岸|考(上|研))|亲身|亲身经历)/;
const EXPLICIT_DECISION = /(选择了|选择工作|选择读研|最终选|最后选|放弃了|签约|上岸|去工作|去读研|不打算读研|只能直接工作|错过)/;

export function qualifySource(source: SourceDocument): Qualification {
  const text = source.text.trim();
  const reasons: string[] = [];
  if (text.length < 160) return { label: 'E0', reasons: ['INSUFFICIENT_TEXT: length=' + text.length] };
  if (!FIRST_PERSON.test(text)) reasons.push('NO_FIRST_PERSON');
  if (!DECISION_STAGE.test(text)) reasons.push('NO_DECISION_STAGE');
  if (!EXPERIENCE_SIGNAL.test(text)) reasons.push('NO_EXPERIENCE_SIGNAL');
  if (reasons.length >= 2) return { label: 'E1', reasons };
  if (!EXPLICIT_DECISION.test(text)) return { label: 'E2', reasons: ['NO_EXPLICIT_DECISION_STATEMENT'] };
  return { label: 'E3', reasons: [] };
}
