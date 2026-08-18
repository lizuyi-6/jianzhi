// 维度 / 取值 / 理由码的前端本地化字典。
// 后端只下发结构化 code，前端负责翻译为可读文案；未知 code 走兜底，绝不编造含义。
// P1-13：本字典必须覆盖语料中出现的全部 value code，由 e2e/labels-check.cjs 强制校验。

const DIMENSION_LABELS: Record<string, string> = {
  current_opportunity: '当前机会',
  career_goal: '目标方向',
  exam_outcome: '考研结果',
  study_motivation: '读研动机',
  school_level: '本科背景',
  family_financial_pressure: '经济压力',
  family_pressure: '经济压力',
  prior_work_experience: '先前工作经历',
  time_constraint: '时间约束',
  location: '地域条件',
  decision: '最终选择',
};

const VALUE_LABELS: Record<string, string> = {
  // current_opportunity
  HAS_OFFER: '已有满意 Offer / 入职机会',
  NO_SATISFIED_OFFER: '没有满意 Offer',
  STABLE_CURRENT_JOB: '已有稳定工作',
  // exam_outcome
  EXAM_FAILED: '考研失利',
  EXAM_ADMITTED: '考研上岸 / 拟录取',
  // study_motivation
  RESEARCH_PLATFORM: '为平台 / 学历深造',
  PRACTICAL_FIRST: '实践与就业优先',
  LEARNING_DRIVEN: '为深入学习而读研',
  NOT_RESEARCH_DRIVEN: '不走科研路线',
  // school_level
  TARGET_211_985: '211 / 985 本科',
  DOUBLE_NON_OR_WEAKER: '双非 / 普通本科',
  // career_goal
  PRACTICAL_WORK: '工程 / 实践方向',
  CROSS_MAJOR_DESIGN: '跨专业（设计方向）',
  ENGINEERING: '工程方向',
  RESEARCH: '研究方向',
  // family_financial_pressure
  NEED_INCOME: '需要尽快经济独立',
  NO_URGENCY: '家里可以支持',
  FAMILY_PRESSURE: '需要尽快经济独立',
  WORKED_6_YEARS: '已工作多年',
  // decisions
  WORK: '先工作',
  GRAD_SCHOOL: '读研',
  CONDITIONAL: '视情况而定',
  NO_CLEAR_DECISION: '没有明确选择',
};

// P1-10：why_read 文案严格贴合算法实际规则，不声称未证明的内容（如「结果与体会」「结构完整」）。
const WHY_READ_LABELS: Record<string, string> = {
  HAS_COMPARABLE_EXPERIENCE: '公开条件可比较：与你已回答的条件相同',
  EVIDENCE_BACKED_CONTEXT: '上下文有原文 Evidence 支撑，可回到出处验证',
  SIMILAR_CONTEXT_DIFFERENT_DECISION: '相近条件下做出了另一种关键选择',
  COUNTER_EXPERIENCE: '保留与你相似但选择不同的真人经验，不替你下结论',
  PUBLIC_QUALITY_COORDINATE: '公共质量信号更高（赞同 / 评论 / 认证），作为公共坐标',
};

const WARNING_LABELS: Record<string, string> = {
  NO_COMPARABLE_EXPERIENCE: '暂时没有与你条件足够相似的经验，已保留其他视角',
  NO_COUNTER_EXPERIENCE: '当前条件下没有找到可靠的反向经验，B 位为空',
  NO_CLASSIC_SOURCE: '暂无满足公共质量门槛的经典来源',
  USER_CONDITION_UNCOVERED: '你的部分条件在现有经验中尚未被覆盖，已按未知处理',
  INSUFFICIENT_TEXT: '部分来源文本过短，未能提取可靠经验',
};

function humanize(code: string): string {
  return code.replace(/_/g, ' ').toLowerCase();
}

export function dimensionLabel(id: string, backendLabel?: string): string {
  if (DIMENSION_LABELS[id]) return DIMENSION_LABELS[id];
  // 后端 label 若仍是 code 形态则走本地化兜底；已是中文 label 则直接使用
  if (backendLabel && !/^[A-Z_]+$/.test(backendLabel) && /[\u4e00-\u9fff]/.test(backendLabel)) return backendLabel;
  return humanize(id);
}

export function valueLabel(code: string): string {
  return VALUE_LABELS[code] ?? humanize(code);
}

export function isKnownValue(code: string): boolean {
  return Boolean(VALUE_LABELS[code]);
}

export function whyReadLabel(code: string): string {
  return WHY_READ_LABELS[code] ?? humanize(code);
}

export function warningLabel(code: string): string {
  return WARNING_LABELS[code] ?? humanize(code);
}

export function authorityLabel(authority: string | number | null | undefined): string | null {
  if (authority === null || authority === undefined) return null;
  const level = String(authority);
  const names: Record<string, string> = { '1': '初级认证', '2': '中级认证', '3': '高级认证', '4': '优秀答主', '5': '杰出答主' };
  return names[level] ?? '平台认证 Lv' + level;
}

export const ROLE_META: Record<'COMPARABLE' | 'COUNTER_EXPERIENCE' | 'CLASSIC', {
  letter: string;
  name: string;
  headline: string;
  accent: string;
}> = {
  COMPARABLE: { letter: 'A', name: '可比较经验', headline: '和你很像的经历', accent: 'violet' },
  COUNTER_EXPERIENCE: { letter: 'B', name: '反向经验', headline: '相似处境，另一种选择', accent: 'green' },
  CLASSIC: { letter: 'C', name: '经典视角', headline: '公共质量更高的经典内容', accent: 'blue' },
};
