// P1-06：受控维度本体。LLM/人工标注产出的 dimension 只有归一化到这里的受控 id 才能进入透镜，
// 避免「同一语义多种写法」造成的假维度与假分歧。value 同样走白名单归一化。
export interface DimensionMeta {
  id: string;
  label: string;
  family: string;
  answerable: boolean;
  aliases: string[];
}

export const DIMENSIONS: DimensionMeta[] = [
  { id: 'current_opportunity', label: '当前机会', family: 'OPPORTUNITY', answerable: true, aliases: ['offer', 'opportunity', 'current_job', '当前机会'] },
  { id: 'exam_outcome', label: '考研结果', family: 'EXAM', answerable: true, aliases: ['exam', 'exam_outcome', '考研结果', 'kaoyan'] },
  { id: 'study_motivation', label: '读研动机', family: 'MOTIVATION', answerable: true, aliases: ['motivation', 'study_goal', '读研动机', '读研目的'] },
  { id: 'school_level', label: '本科背景', family: 'BACKGROUND', answerable: true, aliases: ['school', 'education_background', '本科背景', '学历背景'] },
  { id: 'career_goal', label: '目标方向', family: 'GOAL', answerable: true, aliases: ['goal', 'career_direction', 'target_role', '目标方向'] },
  { id: 'family_financial_pressure', label: '经济压力', family: 'FAMILY', answerable: true, aliases: ['family_pressure', 'financial_pressure', '经济压力', '家庭压力'] },
  { id: 'time_constraint', label: '时间约束', family: 'TIME', answerable: true, aliases: ['time', '时间约束'] },
  { id: 'location', label: '地域条件', family: 'LOCATION', answerable: false, aliases: ['city', '地域条件'] },
];

const byId = new Map(DIMENSIONS.map((d) => [d.id, d]));
const byAlias = new Map<string, string>();
for (const dim of DIMENSIONS) {
  byAlias.set(dim.id.toLowerCase(), dim.id);
  for (const alias of dim.aliases) byAlias.set(alias.toLowerCase(), dim.id);
}

export function dimensionMeta(id: string): DimensionMeta | undefined { return byId.get(id); }

export function normalizeDimensionId(raw: string): string | null {
  return byAlias.get(raw.trim().toLowerCase()) ?? null;
}

export function isAnswerableDimension(id: string): boolean { return byId.get(id)?.answerable ?? false; }

export function dimensionLabel(id: string): string { return byId.get(id)?.label ?? id; }

// 受控取值表：归一化别名 -> 规范 value code（前端据此准备完整中文文案，P1-13）
export const VALUE_ALIASES: Record<string, string> = {
  // current_opportunity
  has_offer: 'HAS_OFFER', offer_in_hand: 'HAS_OFFER', 已有offer: 'HAS_OFFER', 已有满意offer: 'HAS_OFFER', offer: 'HAS_OFFER',
  no_satisfied_offer: 'NO_SATISFIED_OFFER', no_offer: 'NO_SATISFIED_OFFER', 没有offer: 'NO_SATISFIED_OFFER', 未拿到offer: 'NO_SATISFIED_OFFER',
  stable_current_job: 'STABLE_CURRENT_JOB', 已有稳定工作: 'STABLE_CURRENT_JOB',
  // exam_outcome
  exam_failed: 'EXAM_FAILED', 考研失利: 'EXAM_FAILED', 考研失败: 'EXAM_FAILED',
  exam_passed: 'EXAM_ADMITTED', admitted: 'EXAM_ADMITTED', 拟录取: 'EXAM_ADMITTED', 考上: 'EXAM_ADMITTED', 上岸: 'EXAM_ADMITTED',
  // study_motivation
  research_platform: 'RESEARCH_PLATFORM', platform_degree: 'RESEARCH_PLATFORM', 为平台深造: 'RESEARCH_PLATFORM', 学历投资: 'RESEARCH_PLATFORM',
  practical_first: 'PRACTICAL_FIRST', practice_oriented: 'PRACTICAL_FIRST', 实践优先: 'PRACTICAL_FIRST', 工程实践: 'PRACTICAL_FIRST',
  learning_driven: 'LEARNING_DRIVEN', not_research_driven: 'NOT_RESEARCH_DRIVEN',
  // school_level
  target_211_985: 'TARGET_211_985', 211: 'TARGET_211_985', 985: 'TARGET_211_985', 211_985: 'TARGET_211_985', 重点本科: 'TARGET_211_985',
  double_non_or_weaker: 'DOUBLE_NON_OR_WEAKER', 双非: 'DOUBLE_NON_OR_WEAKER', 二本: 'DOUBLE_NON_OR_WEAKER', 普通本科: 'DOUBLE_NON_OR_WEAKER',
  // career_goal
  practical_work: 'PRACTICAL_WORK', cross_major_design: 'CROSS_MAJOR_DESIGN', engineering: 'ENGINEERING', research: 'RESEARCH',
  // family_financial_pressure
  need_income: 'NEED_INCOME', family_pressure: 'NEED_INCOME', 经济压力大: 'NEED_INCOME', 需要挣钱: 'NEED_INCOME',
  no_urgency: 'NO_URGENCY', 家里可支持: 'NO_URGENCY',
  // legacy values（旧 corpus），保留映射避免历史缓存失效
  worked_6_years: 'WORKED_6_YEARS',
};

export function normalizeValue(raw: string): string {
  const key = raw.trim();
  return VALUE_ALIASES[key.toLowerCase()] ?? VALUE_ALIASES[key] ?? key;
}
