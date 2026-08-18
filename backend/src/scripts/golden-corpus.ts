// Golden corpus 规格：每条记录必须绑定同一决策事件（本科毕业季：直接工作 vs 继续读研，P0-03），
// 引句用「锚点正则」在原始片段上定位，绝不手抄文本（避免空白差异导致证据失配）。
// 该规格既是人工复核结论，也是 LLM 输出缓存（data/extraction-cache.jsonl）的生成来源（P0-07）。
export interface GoldenFactSpec { dimension_id: string; value: string; anchor: RegExp }
export interface GoldenRecordSpec {
  source_id: string;
  event_note: string;
  knowledge_types: Array<'EXPERIENCE' | 'OUTCOME' | 'REFLECTION' | 'ANALYSIS' | 'GENERAL_OPINION'>;
  decision: { value: 'WORK' | 'GRAD_SCHOOL' | 'CONDITIONAL' | 'NO_CLEAR_DECISION'; anchor: RegExp };
  facts: GoldenFactSpec[];
  reflection_anchor?: RegExp;
}

export const GOLDEN_QUESTION_KEY = 'golden-cs-offer-work-or-grad';
export const GOLDEN_TITLE = '计算机本科毕业，有不错的 Offer，应该直接工作还是读研？';
export const GOLDEN_DECISION_EVENT = '本科毕业季的同一决策事件：直接工作 vs 继续读研（含保研资格、考研出分/拟录取节点）';

export const GOLDEN_RECORDS: GoldenRecordSpec[] = [
  {
    source_id: '-7611233884072227932',
    event_note: '计算机方向本科生，拿到意料之外的 Offer 且可转正，倾向放弃读研',
    knowledge_types: ['EXPERIENCE'],
    decision: { value: 'WORK', anchor: /我为什么要读研呢？/ },
    facts: [
      { dimension_id: 'current_opportunity', value: 'HAS_OFFER', anchor: /拿到我意料之外的 Offer/ },
      { dimension_id: 'study_motivation', value: 'PRACTICAL_FIRST', anchor: /我学习到的就业技能，几乎全部是自己捣鼓项目得到的/ },
    ],
  },
  {
    source_id: '4421177228336309838',
    event_note: '211 材料本科，大四同时拿到保研资格与华为 offer，最终读研',
    knowledge_types: ['EXPERIENCE'],
    decision: { value: 'GRAD_SCHOOL', anchor: /最终选择读研/ },
    facts: [
      { dimension_id: 'current_opportunity', value: 'HAS_OFFER', anchor: /大四同时拿到了保送资格和华为offer/ },
      { dimension_id: 'school_level', value: 'TARGET_211_985', anchor: /本人本科211材料专业/ },
    ],
  },
  {
    source_id: '-9094217579494263010',
    event_note: '父亲病重后本科毕业只能直接工作（多年后回校读研属于后续事件，不混入本决策）',
    knowledge_types: ['EXPERIENCE'],
    decision: { value: 'WORK', anchor: /大学毕业只能直接工作/ },
    facts: [
      { dimension_id: 'family_financial_pressure', value: 'NEED_INCOME', anchor: /我就再也没有向家里要过一分钱/ },
    ],
    reflection_anchor: /我时常都在后悔，怎么没有早一点考研读研/,
  },
  {
    source_id: '-3119679167619528177',
    event_note: '211 计算机应届生，一战考研失利后在春招拿 4 个 offer 选择工作',
    knowledge_types: ['EXPERIENCE'],
    decision: { value: 'WORK', anchor: /我是22春招通过校招找到的工作/ },
    facts: [
      { dimension_id: 'exam_outcome', value: 'EXAM_FAILED', anchor: /在考研失败的当口/ },
      { dimension_id: 'school_level', value: 'TARGET_211_985', anchor: /我是科班211出身/ },
      { dimension_id: 'current_opportunity', value: 'HAS_OFFER', anchor: /2022的3月，拿到4个offer/ },
    ],
  },
  {
    source_id: '8236910145783495805',
    event_note: '考研失利后转春招，浪潮 offer 签约保底，最终走向工作',
    knowledge_types: ['EXPERIENCE'],
    decision: { value: 'WORK', anchor: /于是签约当保底用/ },
    facts: [
      { dimension_id: 'exam_outcome', value: 'EXAM_FAILED', anchor: /我是考研失败之后找工作的/ },
      { dimension_id: 'current_opportunity', value: 'HAS_OFFER', anchor: /10月中旬拿到offer/ },
    ],
  },
  {
    source_id: '-3889156560973784320',
    event_note: '法学应届生，一志愿失利后拿到国企 offer，最终选择调剂读研',
    knowledge_types: ['EXPERIENCE'],
    decision: { value: 'GRAD_SCHOOL', anchor: /最后选择调剂上岸继续深造/ },
    facts: [
      { dimension_id: 'exam_outcome', value: 'EXAM_FAILED', anchor: /考场上发挥并不理想/ },
      { dimension_id: 'current_opportunity', value: 'HAS_OFFER', anchor: /并幸运地拿到了offer/ },
      { dimension_id: 'school_level', value: 'DOUBLE_NON_OR_WEAKER', anchor: /本科双非五院/ },
    ],
  },
  {
    source_id: '4305676158201919820',
    event_note: '2003 届毕业生为军工企业的「好工作」放弃读研机会（本科毕业节点）',
    knowledge_types: ['EXPERIENCE'],
    decision: { value: 'WORK', anchor: /我当时为了工作，错过了春招，还有读研的机会/ },
    facts: [
      { dimension_id: 'current_opportunity', value: 'HAS_OFFER', anchor: /我来到了一家颇有名气的军工企业实习/ },
    ],
  },
  {
    source_id: '-309170380631065643',
    event_note: '本科毕业手握 500 强 offer，因更看重学历平台而放弃 offer 读研',
    knowledge_types: ['EXPERIENCE'],
    decision: { value: 'GRAD_SCHOOL', anchor: /最终还是放弃了offer去读研/ },
    facts: [
      { dimension_id: 'current_opportunity', value: 'HAS_OFFER', anchor: /通过实习拿到了500强的offer/ },
      { dimension_id: 'study_motivation', value: 'RESEARCH_PLATFORM', anchor: /但当时看到很多前辈有着更高的学历背景/ },
    ],
  },
  {
    source_id: '-8469662639018218598',
    event_note: '考研与老家事业编同时上岸，选择读研以走人才引进平台',
    knowledge_types: ['EXPERIENCE'],
    decision: { value: 'GRAD_SCHOOL', anchor: /我觉得可以读研/ },
    facts: [
      { dimension_id: 'current_opportunity', value: 'HAS_OFFER', anchor: /当时也是考研和工作（老家事业编）都考上了/ },
      { dimension_id: 'study_motivation', value: 'RESEARCH_PLATFORM', anchor: /有硕士学历可以进行人才引进，获得更好的福利和工作平台/ },
    ],
  },
  {
    source_id: '-3414391023492202102',
    event_note: '农村家庭当事人保研资格稳拿，为减轻家庭负担选择大厂转正 offer',
    knowledge_types: ['EXPERIENCE'],
    decision: { value: 'WORK', anchor: /但最终选了某大厂的转正offer/ },
    facts: [
      { dimension_id: 'family_financial_pressure', value: 'NEED_INCOME', anchor: /我爸妈供我读到本科已经拼尽全力了/ },
    ],
  },
  {
    source_id: '2054129373221350485',
    event_note: '拟录取公示后拿到 offer，放弃读研名额选择工作',
    knowledge_types: ['EXPERIENCE'],
    decision: { value: 'WORK', anchor: /不打算读研了/ },
    facts: [
      { dimension_id: 'exam_outcome', value: 'EXAM_ADMITTED', anchor: /录取名额截止只到L/ },
      { dimension_id: 'current_opportunity', value: 'HAS_OFFER', anchor: /L说已经拿到offer/ },
    ],
  },
  {
    source_id: '-4457959125945548477',
    event_note: '本科背景一般、未能拿到头部公司 offer，转向更好的学校读研',
    knowledge_types: ['EXPERIENCE'],
    decision: { value: 'GRAD_SCHOOL', anchor: /然后就选择去了一个更好点的学校读研/ },
    facts: [
      { dimension_id: 'current_opportunity', value: 'NO_SATISFIED_OFFER', anchor: /竞争行业头部公司的offer时，没拿到/ },
    ],
  },
  {
    source_id: '-6739369412971843936',
    event_note: '央企 offer 与考研复试之间持续纠结（写作时未定，CONDITIONAL）',
    knowledge_types: ['EXPERIENCE'],
    decision: { value: 'CONDITIONAL', anchor: /工作和读研都是不可多得的机会，我一直纠结到去复试前/ },
    facts: [
      { dimension_id: 'current_opportunity', value: 'HAS_OFFER', anchor: /结果考研前一天，我收到了offer/ },
      { dimension_id: 'school_level', value: 'TARGET_211_985', anchor: /进了北京的一所垫底211/ },
    ],
  },
];
