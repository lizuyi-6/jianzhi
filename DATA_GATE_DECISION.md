# DATA_GATE_DECISION（最终收口）

**状态：APPROVED（MVP 数据基线锁定）** —— 本文档正式关闭 M0 数据门的 PENDING 状态。

## 结论

1. **能力基线**：采用知乎官方搜索 API（official_api_search）作为唯一上游；本地 canonical 快照 184 条（answer/article）作为语料与降级底座。
2. **人工 E2/E3 标注**：原 M0-02 的 PENDING_MANUAL_E0_E3 由「抽取管线 + 人工复核规格」取代（见下）；13 条 Golden ExperienceRecord 全部通过逐字 Evidence 校验（E2/E3 级）。
3. **为何选择 SearchAdapter 而非全量抓取**：官方配额 1000 次/天，搜索 API 是赛事合规且可审计的唯一通道；全量抓取不可行也不合规。
4. **明确放弃的能力**：
   - 不做全文原始页面抓取（仅有检索片段，页面如实标注）；
   - 不做跨决策事件的纵向人生故事合并（每条记录绑定单一决策事件）；
   - 不承诺 outcome/结果数据的完备性（语料 outcomes 基本为空，why_read 文案不声称「结果与体会」）。

## Golden 语料重建（P0-02/03/04）

- 事件边界统一为「本科毕业季：直接工作 vs 继续读研」（含保研资格、考研出分/拟录取节点）。
- 旧语料中跨事件的记录（如「研究生毕业后选择工作」「工作多年后回校读研」）不再作为本问题的经验记录。
- 单值维度（family_financial_pressure 仅一个观测值）因违反 Variation 规则被算法自动排除，不再人工保留。

## 抽取管线（P0-07）

Qualification(E0-E3) -> LLM-1 Extraction（模型只给维度/取值/逐字引句）-> LLM-2 Normalization（受控本体归一）
-> Evidence Validator（本地定位偏移并三重校验 quote/start/end）-> Cache。

Golden = `data/extraction-cache.jsonl`（人工复核后的模型输出缓存，reviewed=true）+`npm run extract:replay` 走同一管线确定性重建。
