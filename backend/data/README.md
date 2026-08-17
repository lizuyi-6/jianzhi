# Backend Data Provenance

## Canonical files

- source-documents.jsonl: 184 个去重后的知乎官方搜索结果。
- experience-records.jsonl: 7 个经过人工选择、精确 Evidence Span 校验的 ExperienceRecord。

## Source mode

所有生产样本的 source_mode 均为 official_api_search，使用参赛 Access Secret 调用知乎开放平台 zhihu_search 接口获得。Secret 不在数据文件中。

## Golden query family

数据来自“读研还是工作”“有 Offer 是否读研”“工作后决定读研”“考研失败直接工作”等相关查询。原始响应保留在 .analysis/data-gate/m0-02、m0-04 和 m0-05。

## Inclusion rule

ExperienceRecord 仅在文本明确表达以下内容时建立：

1. 真人经历或明确第一人称处境。
2. 决策前已经存在的条件。
3. 明确选择或条件选择。
4. 每个字段的 quote、start、end 都能在 SourceDocument.text 中精确匹配。

观点文、泛化建议、第三方推测和缺失条件不进入 ExperienceRecord。

## Golden flow

question_key: golden-read-work

提交 family_pressure=FAMILY_PRESSURE 时，当前 canonical 数据能稳定产生 A/B/C 三席，其中 A 与 B 是相同家庭压力下的不同选择，C 提供公共质量坐标。

## Limitations

搜索接口返回的是官方搜索片段，不宣称是同一 Question 的完整 Answers 集合。前端必须展示原始 URL 和 Evidence quote，并保留 source_mode。
