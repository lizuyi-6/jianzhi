# 知鉴 Gold Eval 报告

运行方式：cd backend && npm run extract -- --replay && npm run eval

| 指标 | 值 | 说明 |
| --- | --- | --- |
| Evidence Precision（语料证据可回放率） | 1.00 | 13 条记录全部通过 validateExperienceEvidence |
| Contrast Precision@3（透镜维度真实分歧率） | 1.00 | current_opportunity, study_motivation, exam_outcome, school_level |
| Retrieval Invariants（三槽齐备 + B≠A） | 1.00 | A/B/C 角色约束 |
| Demo Moment（条件变化 Slot 变化率） | 1.00 | -7611233884072227932 -> -3119679167619528177 |
| Stability（确定性） | 1.00 | 同输入两次运行一致 |
| Baseline A/B（算法 vs 随机同维数） | 2 vs 1.5 | 算法 A 位命中相同条件维度数 |

## 用例明细

### A 基线条件：三槽齐备，B 与 A 选择不同 PASS
- [x] slot_a 存在（-7611233884072227932）
- [x] slot_b 存在且与 A 不同来源
- [x] 无空位警告

### B 条件变化：至少一个 Slot 换人（F-009 demo moment） PASS
- [x] A 位来源变化（-7611233884072227932 -> -3119679167619528177）
- [x] 变化后仍有完整三槽

### C 未拿到满意 Offer：A 位切换为同条件经验 PASS
- [x] A 位切换（-4457959125945548477）
