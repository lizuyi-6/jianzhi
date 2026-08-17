# M0-02 人工标注说明

本目录数据来自知乎官方搜索 API。

## 标注原则

- 只依据 text 中明确表达的内容。
- 关键词预筛选只用于排序，不能作为最终标签。
- 没有明确原文片段的字段留空或标为 Unknown。
- 不推断作者人格、家庭阶层、隐含动机、收入和未公开背景。

## 字段

- quality：E0/E1/E2/E3。
- knowledge_types：EXPERIENCE、OUTCOME、REFLECTION、ANALYSIS、GENERAL_OPINION。
- has_explicit_experience：是否明确讲述亲身经历。
- has_pre_decision_context：是否有决策前已经存在的条件。
- has_explicit_decision：是否明确表达选择、决定或条件选择。
- has_outcome_or_reflection：是否有结果或事后反思。
- evidence_spans：每个可见事实的原文 quote、start、end、field。

## E0-E3

- E0：标题或极短摘要，无法判断经历。
- E1：有观点或建议，但没有明确亲历、条件和选择。
- E2：明确亲历、至少一个决策前条件、明确选择，并可定位片段。
- E3：E2 基础上还有多个决策前条件，以及结果或反思，证据清晰。

## 处理要求

标注完成后，先用 Evidence Validator 检查 quote 是否能在 text 中精确定位，再统计 E2/E3。未通过 validator 的字段不能进入用户可见层。
