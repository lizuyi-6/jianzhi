// 维度 / 取值 / 理由码的前端本地化字典。
// 后端只下发结构化 code，前端负责翻译为可读文案；未知 code 走兜底，绝不编造含义。

const DIMENSION_LABELS: Record<string, string> = {
  current_opportunity: '当前机会',
  career_goal: '目标方向',
  exam_outcome: '考研结果',
  family_pressure: '家庭压力',
  prior_work_experience: '先前工作经历',
  decision: '最终选择',
};

const VALUE_LABELS: Record<string, string> = {
  HAS_OFFER: '已有满意 Offer',
  STABLE_CURRENT_JOB: '已有稳定工作',
  PRACTICAL_WORK: '工程 / 实践方向',
  CROSS_MAJOR_DESIGN: '跨专业（设计方向）',
  EXAM_FAILED: '考研失利',
  FAMILY_PRESSURE: '希望尽快经济独立',
  WORK: '先工作',
  GRAD_SCHOOL: '读研',
  CONDITIONAL: '视情况而定',
  NO_CLEAR_DECISION: '没有明确选择',
};

const WHY_READ_LABELS: Record<string, string> = {
  HAS_COMPARABLE_EXPERIENCE: '条件高度可比，参考价值高',
  EVIDENCE_BACKED_CONTEXT: '真实经历明确，可回到原文验证',
  SIMILAR_CONTEXT_DIFFERENT_DECISION: '相似条件下的另一种关键选择',
  COUNTER_EXPERIENCE: '看到不同路径带来的结果与体会',
  PUBLIC_QUALITY_COORDINATE: '结构完整，适合作为决策参考基线',
};

const WARNING_LABELS: Record<string, string> = {
  NO_COMPARABLE_EXPERIENCE: '暂时没有与你条件足够相似的经验，已保留其他视角',
  NO_COUNTER_EXPERIENCE: '当前条件下没有找到可靠的反向经验，B 位为空',
  USER_CONDITION_UNCOVERED: '你的部分条件在现有经验中尚未被覆盖',
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

export function whyReadLabel(code: string): string {
  return WHY_READ_LABELS[code] ?? humanize(code);
}

export function warningLabel(code: string): string {
  return WARNING_LABELS[code] ?? humanize(code);
}

export const ROLE_META: Record<'COMPARABLE' | 'COUNTER_EXPERIENCE' | 'CLASSIC', {
  letter: string;
  name: string;
  headline: string;
  accent: string;
}> = {
  COMPARABLE: { letter: 'A', name: '可比较经验', headline: '和你很像的经历', accent: 'violet' },
  COUNTER_EXPERIENCE: { letter: 'B', name: '反向经验', headline: '相似处境，另一种选择', accent: 'green' },
  CLASSIC: { letter: 'C', name: '经典视角', headline: '值得看的经典回答', accent: 'blue' },
};
