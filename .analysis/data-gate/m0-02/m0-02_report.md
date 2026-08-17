# M0-02 数据采集与处理报告

## 采集范围

- 入口：知乎官方 zhihu_search API。
- Query：10 个职业选择相关查询，见 queries.txt。
- 每个 Query：Count=10，串行请求，间隔约 1 秒。
- 原始结果：100 条。
- 去重键：ContentID。
- 采集时间和 HTTP 状态：见 request_log.jsonl 和 collection_summary.json。

## 处理结果

- 唯一来源：94 条。
- 重复召回：6 条。
- 无效响应：0 条。
- Answer：70 条；Article：24 条。
- 文本长度：最短 53，最长 1,219，平均 704 字符。
- 自动质量分桶：REVIEW 55，PARTIAL 33，INSUFFICIENT 6。
- 关键词预筛选：HIGH_REVIEW 39、MEDIUM_REVIEW 38、LOW_REVIEW 17。
- 规范化结果：source_documents.json 和 source_documents.jsonl。
- 人工标注队列：annotation_queue.jsonl。
- 关键词预筛选：pretriage.jsonl，仅用于排序，不是最终标签。

## Gate 结论

当前结论：PENDING_MANUAL_E0_E3。

鉴权、调用、JSON 结构和样本去重已通过；Evidence-backed extraction 尚未通过。原因是当前接口返回的是搜索结果片段，且没有在这一步证明完整 Question Answers 或稳定原文回溯能力。

不得根据当前数据直接宣称：
- 这些结果是同一个 Question 的完整回答集合。
- 每个片段都能支持经验结构化。
- ContentText 一定是完整正文。
- 模型可以补足缺失的作者背景或决策条件。

## 下一步

1. 按 annotation_guide.md 对 94 个唯一来源做 E0-E3 人工标注。
2. 对 E2/E3 样本逐条记录 pre-decision Context、Decision 和原文 Span。
3. 运行 quote 精确定位校验。
4. 计算 E2/E3 比例和每类 Query 的强经验数量。
5. 再决定 M0-03：通过、条件通过、切合法 SearchAdapter 降级，或 Pivot。

在 M0-03 结论前，不创建正式 UI，不接入自由文本 Renderer，不生成最终建议。
