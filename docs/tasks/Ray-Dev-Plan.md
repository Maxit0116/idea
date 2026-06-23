# Ray 开发任务计划

**角色**：技术负责人 / 系统 / AI / 结构引擎（主线 B；MVP 扩展 C、D）  
**投入**：**30h/周**（Demo + MVP 全程）  
**Review**：**Terran** review 较少；Ray **主 review Terran** 的 A/UI PR  
**关联**：[Team-Division.md](../Team-Division.md) · [Terran-Dev-Plan.md](./Terran-Dev-Plan.md)

---

## 阶段一：Demo（2026-06-21 → 2026-07-15）

**目标**：本地 Engine 分析 Next.js repo → 输出 `GraphJSON` + 节点详情 API；供 Terran 渲染。  
**不做**：Chat、Prompt 精进、Agent 流程、Harness、云端。

### 任务清单

| ID | 任务 | 优先级 | DDL | 依赖 | 交付物 |
|----|------|--------|-----|------|--------|
| R-D01 | 定义 `graph.json` v0 schema + TS 类型 | P0 | **06-23** | — | 文档 + types |
| R-D02 | 本地 Engine 进程架构（Electron main / sidecar） | P0 | **06-24** | — | IPC 或 HTTP localhost |
| R-D03 | Next.js 静态分析：文件树、App/Pages 路由、package.json | P0 | **06-27** | R-D02 | 原始结构 JSON |
| R-D04 | import 依赖图（TS/JS 相对路径） | P0 | **06-29** | R-D03 | 依赖边 |
| R-D05 | LLM 语义聚类：文件 → 功能节点（产品语言命名） | P0 | **07-02** | R-D03 | 节点列表 |
| R-D06 | 功能关系边推断（跳转/依赖，简化规则 + LLM 可选） | P1 | **07-04** | R-D05 | GraphJSON 边 |
| R-D07 | 合并输出 `GraphJSON` 写入 `.projectos/graph.json` | P0 | **07-04** | R-D05, R-D06 | 持久化 |
| R-D08 | API: `analyze(path)` → jobId；`getJobStatus` 含 progress | P0 | **07-05** | R-D07 | Terran 可调 |
| R-D09 | API: `getNodeDetail(nodeId)` → summary + files + 上下游 | P0 | **07-07** | R-D07 | Inspector 数据 |
| R-D10 | 节点 ↔ 文件映射（一对多） | P0 | **07-07** | R-D05 | 跳转用 |
| R-D11 | file save debounce 全量 re-analyze（Demo 简化版） | P2 | **07-11** | R-D08 | 可选 |
| R-D12 | 分析失败/空 repo 错误码与 message | P1 | **07-08** | R-D08 | 错误处理 |
| R-D13 | Demo 联调 support + bugfix | P0 | **07-13** | Terran T-D15 | 联调通过 |
| R-D14 | Demo 数据：准备 2 个标准测试 repo 路径说明 | P1 | **07-12** | — | README |

### Demo 周计划

| 周 | 日期 | 焦点 |
|----|------|------|
| W1 | 06-21 ~ 06-27 | R-D01 ~ R-D04 |
| W2 | 06-28 ~ 07-04 | R-D05 ~ R-D08；**07-01** 提供 mock GraphJSON |
| W3 | 07-05 ~ 07-11 | R-D09 ~ R-D12；**07-10** 真数据联调 |
| W4 | 07-12 ~ 07-15 | R-D13 ~ R-D14；**07-13** 冻结 |

### Demo 技术说明

- LLM：Demo 阶段任选 1 家 API（OpenAI/Anthropic/其他），**07-01 前**至少定一个能用的 key
- 首期只保证 **Next.js 14+ App Router** 或 Pages Router 二选一（文档写明）

---

## 阶段二：MVP（2026-07-16 → 2026-10-31）

**目标**：点 node → context 组装 → Prompt 精进 → AI 执行改代码；Agent 流程 **v0.5 只读日志**；debug/business **context 分离（简版）**；**云端 v1**。  
**方案二**：不做语义 File Tree 引擎、不做 Patch Detector。

### M1：Context + 索引增强（07-16 → 08-15）

| ID | 任务 | 优先级 | DDL | 依赖 | 交付物 |
|----|------|--------|-----|------|--------|
| R-M101 | 功能拆解 v2：增量 re-index（debounce 5–15s 目标） | P0 | **07-25** | Demo B | 增量 pipeline |
| R-M102 | 节点 summary 质量迭代（描述、关联文件摘要） | P1 | **07-30** | R-M101 | 更好 Inspector |
| R-M103 | API: `buildContext(nodeId)` → Chat 注入 payload | P0 | **08-03** | R-M101 | Terran T-M103 |
| R-M104 | 项目级 context（无 node 选中） | P1 | **08-06** | R-M103 | 全局 Chat |
| R-M105 | 建议节点（灰色虚线）检测规则 v1 | P2 | **08-10** | R-M101 | 可选 |
| R-M106 | File Watcher 事件 → scheduleReanalyze | P1 | **08-08** | R-M101 | Terran T-M105 |
| R-M107 | git checkpoint：自动 branch / stash 策略 | P0 | **08-12** | — | 执行前回滚 |
| R-M108 | **M1 联调** | P0 | **08-15** | 上列 | M1 sign-off |

### M2：Prompt 精进 + 执行 + Agent 只读（08-16 → 09-15）

| ID | 任务 | 优先级 | DDL | 依赖 | 交付物 |
|----|------|--------|-----|------|--------|
| R-M201 | Skill: `understand_prompt` → UnderstandingCard JSON schema | P0 | **08-22** | R-M103 | 精进 API |
| R-M202 | Skill: `execute_change` → 内部 Change Plan → unified diff | P0 | **09-01** | R-M107 | 执行 API |
| R-M203 | `AgentFlowTracker`：每 step 写日志（理解/检索/分析/生成/应用/验证） | P0 | **09-08** | R-M202 | v0.5 只读 |
| R-M204 | API: `getAgentFlowLog(jobId)` 供 Terran 时间线 UI | P0 | **09-10** | R-M203 | Terran T-M204 |
| R-M205 | 执行保守策略：仅改当前 node ± 1 hop 关联文件 | P0 | **09-05** | R-M202 | 范围控制 |
| R-M206 | 执行结果摘要：files changed + node status 更新 | P0 | **09-05** | R-M202 | 反馈 JSON |
| R-M207 | Prompt 简单模式快速通道（跳过精进 heuristic） | P1 | **09-12** | R-M201 | 少打断 |
| R-M208 | **AI 模型 & 云端架构选型文档** | P0 | **08-01** | — | ADR |
| R-M209 | **M2 联调**：点 node → 精进 → 执行 → 地图更新 | P0 | **09-15** | 上列 | 主链 sign-off |

### M3：Debug 简版 + 云端 + 稳定（09-16 → 10-31）

| ID | 任务 | 优先级 | DDL | 依赖 | 交付物 |
|----|------|--------|-----|------|--------|
| R-M301 | 终端/编译错误解析 → 关联 nodeId + 文件 | P0 | **09-22** | R-M101 | 错误映射 |
| R-M302 | API: `buildDebugContext(error)` vs `buildBusinessContext(nodeId)` 分离 | P0 | **09-28** | R-M301 | Terran T-M302 |
| R-M303 | Skill: `fix_bug` 简版（基于 debug context 一次性 patch，**无 Harness 拦截**） | P0 | **10-05** | R-M302 | 修 Bug v1 |
| R-M304 | 修 Bug 后 resync graph 节点状态 | P1 | **10-08** | R-M303 | 状态同步 |
| R-M401 | 云端 v1：auth（JWT/session） | P0 | **10-01** | R-M208 | 登录 API |
| R-M402 | 云端 v1：LLM 代理 + 用量计数 | P0 | **10-08** | R-M401 | 替代直连 |
| R-M403 | 云端 v1：项目元数据同步（可选，本地为主） | P2 | **10-15** | R-M401 | 备份 |
| R-M404 | Electron 客户端接云端 auth + API routing | P0 | **10-12** | R-M401 | Terran 协作 |
| R-M405 | 稳定性：错误重试、超时、rate limit | P1 | **10-20** | R-M402 | 生产就绪 |
| R-M406 | **M3 联调** + P0 bugfix | P0 | **10-28** | 上列 | 发布候选 |
| R-M407 | MVP 发布支持（Ray 侧重后端） | P0 | **10-31** | — | GA |

### MVP 明确不做（方案二）

| 能力 | 状态 |
|------|------|
| File Tree 语义聚合引擎 | ❌ 暂缓 |
| Agent 流程步骤纠错 / FlowCorrection | ❌ v0.5 不做 |
| Patch Detector / 补丁拦截 | ❌ 不做 |
| Harness 五段完整流程 | ❌ 不做 |
| RAG / 记忆合作伙伴 | ❌ 不做 |

---

## 工时粗算

| 阶段 | 周数 | h/周 | 合计约 |
|------|------|------|--------|
| Demo | 3.5 | 30 | ~105h |
| MVP | 15 | 30 | ~450h |
| **合计** | | | **~555h** |

---

## 与 Terran 的协作检查点

| 日期 | Ray 交付 | Terran 依赖 |
|------|----------|-------------|
| 06-23 | graph.json schema | T-D08 开发 |
| 07-01 | mock GraphJSON 文件 | T-D08 联调 |
| 07-07 | getNodeDetail API | T-D10 Inspector |
| 07-13 | Demo 冻结 | T-D15 |
| 08-03 | buildContext API | T-M103 |
| 08-15 | M1 | T-M107 |
| 09-01 | execute_change | T-M202 |
| 09-10 | getAgentFlowLog | T-M204 |
| 09-15 | M2 主链 | T-M207 |
| 09-28 | debug/business context API | T-M302 |
| 10-08 | 云端 auth + LLM 代理 | T-M304 |
| 10-31 | MVP GA | T-M311 |

---

## 架构 Deliverables（Ray 独有）

| ID | 文档/产出 | DDL |
|----|-----------|-----|
| R-ADR01 | Local Engine IPC/API 规范 | 06-26 |
| R-ADR02 | graph.json v0 正式版 | 06-23 |
| R-ADR03 | Context / UnderstandingCard / AgentFlowLog JSON schema | 08-20 |
| R-ADR04 | 云端架构 + 模型选型 ADR | 08-01 |
| R-ADR05 | MVP API 一览（OpenAPI 或 Markdown） | 10-01 |

---

## 我不负责（明确边界）

- Electron 布局、Monaco、React 组件、Figma → **Terran**
- Landing、用户测试组织、录屏剪辑 → **Terran**
- 产品优先级拍板 → **Terran**（Ray 可提技术意见）

---

## 负载提示（给 Terran / Ray 共同知晓）

MVP 阶段 Ray 单人覆盖 **B + C(v0.5) + D + 云端 + Debug 简版**，约 **555h** 量级。若 9 月主链联调延期：

1. 先砍 R-M105 建议节点、R-M403 云同步、R-M207 快速通道  
2. Agent 流程降为纯文本 log（不做时间线 UI 数据 enrich）  
3. 云端可 Demo 期继续直连 LLM，**10-01 后再切代理**
