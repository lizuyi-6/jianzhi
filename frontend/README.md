# 知鉴 ZhiLens 前端

按照视效图实现的知鉴 Web 前端，对接 backend 的 HTTP API。前端只消费后端下发的
RenderPacket / Lens / Source，不复制任何比较、检索或事实推断逻辑。

## 技术栈

- Vite 5 + React 18 + TypeScript（strict）
- react-router-dom 6
- 手写 CSS（无 UI 框架），设计 token 见 src/styles.css 顶部

## 启动

~~~bash
cd frontend
npm install
npm run dev        # http://localhost:5173，/api 代理到 localhost:3001
~~~

需要先启动后端（见 backend/README.md）。

## 页面

| 路由 | 页面 | 对应视效图 |
| --- | --- | --- |
| / | 问题页：来源信息流 + AI 透镜入口 | 图 1 |
| 抽屉 | 主要分歧条件 + 你的情况选择 | 图 4 |
| /reading-set | 先看这几篇：A 可比较经验 / B 反向经验 / C 经典视角 | 图 3 |
| /read/:role | 阅读视图：原文 + Evidence 高亮 + 为什么这么说面板 | 图 2 |

## 产品不变量在前端的落实

- 不输出唯一结论：阅读集三卡只承担不同角色，没有总榜排序。
- 每条事实都带 Evidence：阅读视图只高亮 start/end 与 quote 精确匹配的证据，
  不匹配的证据在右侧面板标注"引用与原文位置不符"，不强行渲染。
- Unknown 不做推测：未知维度明确展示"原文未提及，不做推测"。
- B 位允许为空：空位展示真实的空缺说明，绝不伪造反向经验。
- provenance 常驻：页面保留"知乎官方搜索 API（official_api_search）"标识。
- 作者背景不补全：API 未返回作者名时显示"知乎用户"，不生成头像外的任何身份信息。

## 本地化

后端只下发结构化 code（维度 id、观测值、why_read_codes），前端在
src/i18n/labels.ts 中翻译为中文文案；未知 code 走 humanize 兜底，不编造含义。

## 验证

~~~bash
npm run build                # tsc -b && vite build

# 端到端验证（需先启动 backend dev 与 frontend dev）：
npm run verify               # Golden Flow：问题页 → 分歧条件抽屉 → 阅读集 → 阅读视图
npm run verify:interactions  # 交互覆盖：关注/收藏/历史/搜索/分页/通知
npm run verify:all           # 两个套件一起跑
~~~

verify 套件断言产品不变量：judge 路径无绕过入口、Golden 三角色齐备、
Evidence 高亮数与原文依据一一对应、无失效引用、控制台零错误。
