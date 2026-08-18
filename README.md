# 知鉴 ZhiLens —— 把「过来人的经验」变成可验证的多元阅读集

知鉴不做建议系统。面对「计算机本科毕业，有不错的 Offer，直接工作还是读研」这类高经验依赖问题，
知鉴从知乎官方搜索 API 返回的真实内容中，抽取**同一决策阶段**的经验记录，提炼真正分歧的条件，
然后基于你的情况构造三类视角的阅读集：**A 可比较经验 / B 反向经验 / C 经典视角**。
每个结论都能回到原文 Evidence 逐字验证。

## 一键启动

```bash
# 后端（Fastify，:3001）
cd backend
npm install
npm run build:golden        # 生成 LLM 输出缓存 + question corpus（人工复核规格）
npm run extract:replay      # 通过真实管线（回放->归一化->证据校验）重建 experience-records.jsonl
npm run dev                 # http://localhost:3001

# 前端（Vite + React，:5173，代理 /api -> :3001）
cd frontend
npm install
npm run dev                 # http://localhost:5173
```

## 一键发布门禁（P2-04）

```bash
scripts/release-all.sh      # backend npm run check + frontend npm run release:gate
```

后端 `check` = typecheck + 数据校验 + golden 缓存构建 + replay 抽取 + 全部测试 + 生产构建；
前端 `release:gate` = 生产构建 + 标签完备检查 + **自起动态端口 preview**（绝不复用旧服务）+ 生产 Golden Flow E2E。

## 架构

```
知乎官方搜索 API ──> SourceService（缓存 / 限流 / 每日配额 / 快照降级）
                          │
                          ▼
     AI Pipeline（P0-07）：Qualification(E0-E3) -> LLM-1 Extraction -> LLM-2 Normalization
                          -> Evidence Validator（逐字引句定位） -> Cache（回放/实时）
                          ▼
                ExperienceStore（experience-records.jsonl，逐条证据校验）
                          ▼
     Contrast（P0-01）：values>=2、contrast/counterexample 分离、matched-pair gate
                          ▼
     Reading Set：A 可比较 / B 反向 / C 经典（公共质量信号）
                          ▼
     RenderPacket：双边差异 + 质量信号 + why_read 证据映射
                          ▼
     前端：条件抽屉（三态：不确定/都不像/自定义）-> 阅读集 -> 条件变化解释（P0-08 demo moment）
```

## Golden 语料（P0-02/03/04）

- 13 条 ExperienceRecord 全部绑定**同一决策事件**：本科毕业季「直接工作 vs 继续读研」（含保研资格、考研出分/拟录取节点）。
- 每条记录的 decision 与上下文维度都有逐字 Evidence（start/end/quote 三重校验）。
- 语料以计算机/互联网及相近工科背景为主；页面文案如实披露口径（「共 N 条来源，其中 M 条通过 Evidence 校验」）。
- 维度受控本体（P1-06）：current_opportunity / exam_outcome / study_motivation / school_level / family_financial_pressure 等，LLM 输出经归一化才能进入透镜。

## AI 在哪里（P0-07）

- `src/ai/model.ts`：ModelAdapter —— OpenAI 兼容实时调用（MODEL_BASE_URL/MODEL_API_KEY/MODEL_NAME）+ 离线回放（ReplayModel）。
- `src/ai/pipeline.ts`：Qualification -> Extraction -> Normalization -> Evidence Validator -> Cache，每个来源要么产出通过校验的记录，要么带阶段与原因被拒绝。
- `npm run extract -- --live` 真实调用模型；`--replay`（默认）离线确定性回放，Golden 即「模型输出缓存 + 人工复核」。

## 搜索配额防护（P0-10）

- 生产 strict CORS（CORS_ORIGIN 必须显式配置，通配即拒绝启动）；IP 滑动窗口限流 + 每日预算；客户端 refresh 默认忽略（SEARCH_ALLOW_REFRESH=1 才生效）；上游失败/超限自动降级本地快照检索。

## 部署（P0-12）

- 后端：`npm run build && npm run start:prod`（PORT/HOST 可配），需环境变量 CORS_ORIGIN（生产必填）、ZHIHU_ACCESS_SECRET、DATA_DIR。
- 前端：`npm run build` 产物为纯静态，交由任意静态服务/CDN，反代 `/api` 到后端。
- Health：`GET /health`（存活）与 `GET /ready`（数据就绪）供负载均衡探针使用。

## 测试与评估

- 后端：`npm test`（contrast 语义 / 抽取管线 / golden / retrieval / API 契约）。
- 前端：`npm run verify`（Golden Flow E2E，含条件变化断言）、`npm run verify:interactions`、`npm run check:labels`。
- 评估：`cd backend && npm run eval` 输出 eval/REPORT.md（Evidence Precision / Contrast Precision@3 / Demo Moment / Stability / Baseline）。

## 已知边界（P1-17）

Decision 枚举当前收敛在 career wedge（WORK/GRAD_SCHOOL）；这是 MVP 的刻意取舍，长期将切换为 Question-local position schema 以支持任意高经验依赖问题。
