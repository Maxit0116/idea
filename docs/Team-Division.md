# Project OS — 团队分工总览

**文档版本**：v1.0  
**更新日期**：2026-06-21  
**成员**：Terran（产品 / UI / IDE 壳）、Ray（系统 / AI / 结构引擎）  
**关联文档**：
- [Terran 开发任务](./tasks/Terran-Dev-Plan.md)
- [Ray 开发任务](./tasks/Ray-Dev-Plan.md)
- [MVP PRD](./MVP-PRD.md)

---

## 1. 已确认决策

| 事项 | 决定 |
|------|------|
| Demo 截止 | **2026-07-15**（dev 可跑 + 录屏，不要求 .app 安装包） |
| Demo 范围 | 主线 **A（IDE 壳）+ B（功能结构可视化）** |
| Demo 右侧面板 | **纯静态 Node Inspector**（摘要 + 关联文件，无真实 AI 对话）；有余力再升级 |
| MVP 截止 | **2026-10 月** |
| E/F 招聘 | **暂缓**；采用 **方案二** 裁剪（见 §3） |
| 技术栈 | Electron；Demo/MVP 首发 **macOS** |
| Demo 后端 | 纯本地 + 直连 LLM（分析用） |
| MVP 后端 | 云端后端（Ray 主导） |
| 8 月 Terran 开发时间 | 名义 80h/周，**扣除学习后实际开发约 40h/周** |
| Ray 投入 | **30h/周**（Demo + MVP 全程） |
| 验证重心 | 功能地图 + 点 node + Prompt 精进 + AI 改代码 |
| 产品决策 | Terran |
| 技术架构决策 | Ray |
| Code Review | 互相 review；**Ray review Terran 为主** |
| 协作 | 微信每 2 天对齐；Remote；重叠窗口联调 ~3h/天 |
| 任务管理 | GitHub Issues（开发）+ Notion（文档） |

---

## 2. 主线 Ownership

| 主线 | 内容 | Demo | MVP Primary | MVP Secondary |
|------|------|------|-------------|---------------|
| **A** | Electron 壳、布局、Monaco、Terminal、Git UI | Terran | **Terran** | Ray |
| **B** | 静态分析、LLM 功能拆解、功能地图数据 | Ray | **Ray** | Terran（渲染） |
| **C** | Agent 流程可视化 | — | **Ray**（v0.5 只读） | Terran（UI） |
| **D** | AI Agent、Prompt 精进、执行、云端 | — | **Ray** | Terran（Chat UI） |
| **E** | File Tree 语义树 | — | **暂缓** → 传统目录 | Terran 维护 |
| **F** | Debug Harness 完整版 | — | **暂缓** → 简版 | Ray + Terran |

---

## 3. MVP 方案二裁剪（E/F 暂缓）

| 原 P0 能力 | MVP 10 月交付 |
|------------|---------------|
| 软件结构可视化（功能地图） | ✅ 完整 |
| 点 node → context → Prompt 精进 → AI 执行 | ✅ 完整（验证主链） |
| Agent 流程可视化 | ⚠️ **v0.5 只读**（日志流/步骤列表，不可步骤纠错） |
| File Tree 语义树 | ⚠️ **传统目录树**（Demo 已有，不升级语义聚合） |
| Debug Harness | ⚠️ **简版**：debug / business **context 分离**；**不做**补丁检测拦截 |
| 云端后端 | ✅ v1（auth + LLM 代理 + 用量） |
| 新手指导 | P1，时间不足可砍 |

---

## 4. 集成契约（两人必须遵守）

### 4.1 Demo / MVP 共用 API

```
Terran (Renderer)                  Ray (Local Engine)
─────────────────                  ───────────────────
openProject(path)        ────────► analyze(path) → jobId
getJobStatus(jobId)      ◄──────── { progress, status, error? }
getGraph(projectId)      ◄──────── GraphJSON
getNodeDetail(nodeId)    ◄──────── { name, summary, files[], upstream[], downstream[] }
onFileSaved(path)        ────────► scheduleReanalyze(projectId)  [debounced]
```

### 4.2 MVP 扩展 API（Ray → Terran）

```
submitPrompt(nodeId, text)         ──► understand_prompt → UnderstandingCard JSON
confirmExecution(nodeId, cardId) ──► execute_change → jobId
getExecutionStatus(jobId)        ◄── { agentSteps[], status, diff?, error? }
getAgentFlowLog(jobId)           ◄── AgentFlowLog[]  (v0.5 只读)
reportError(terminalOutput)      ──► classify → { debugContext, businessNodeId? }
```

### 4.3 数据格式

- 功能图：`/.projectos/graph.json`（Ray 定义 schema，Terran 只读渲染）
- Graph / Node ID 全局唯一，Agent 流程日志引用同一 `nodeId`

---

## 5. 里程碑日历

| 里程碑 | 日期 | 标志 |
|--------|------|------|
| **Demo 冻结** | **2026-07-15** | 录屏脚本跑通；Terran + Ray 联调完成 |
| **M1** | 2026-08-15 | 四 Tab 壳 + 真 Chat 侧栏 + context 切换 + Ray context 组装 |
| **M2** | 2026-09-15 | Prompt 精进 + AI 执行 v1 + Agent 流程 v0.5 只读 |
| **M3** | 2026-10-15 | debug/business 分离 + 云端 v1 + 主链稳定 |
| **MVP 发布** | **2026-10-31** | 内部 Beta / 早期付费就绪 |

---

## 6. 联调节奏

| 类型 | 频率 | 负责人 |
|------|------|--------|
| 微信进度同步 | 每 2 天 | 双方 |
| 重叠窗口 standup（15min） | 工作日 1 次 | 双方 |
| 集成联调 | Demo：7/10、7/13；MVP：每 milestone 前 3 天 | Terran 发起 |
| 架构/schema 变更 | 提前 24h 通知 | Ray |
| UI/交互变更 | 提前 24h 通知 | Terran |

---

## 7. GitHub Issues 标签

`demo` `milestone-M1` `milestone-M2` `milestone-M3`  
`A-shell` `B-graph` `C-agent-flow` `D-ai` `integration` `design` `bug`

---

## 8. Demo 录屏脚本（1 分钟）

1. 启动 dev：`npm run dev`
2. File → Open Project → 选择 Next.js 示例 repo
3. 等待进度条（静态分析 → 功能推断）
4. 功能地图 Tab：展示节点与连线
5. 点击「用户登录」节点 → 右侧静态 Inspector 显示摘要 + 文件列表
6. 点击 `auth.ts` chip → Monaco 打开文件
7. （可选）切换 Terminal 展示项目可运行

---

## 9. 风险与预案

| 风险 | 预案 |
|------|------|
| Demo 3.5 周不够 | 砍 Terminal、砍增量 re-index；右侧面板保持纯静态 |
| Ray B+D 过载 | Agent 流程维持 v0.5；Harness 不做了补丁检测 |
| Terran 8 月有效工时减半 | M1 任务拆到 7 月下 + 9 月；UI 组件优先用 shadcn 等 |
| 模型 API 未定的 | Demo 仅 B 分析用 1 个模型；8/1 前 Ray 定 MVP 方案 |

---

## 10. 文档维护

- 任务 DDL 以各自 Dev Plan 为准；变更在 Notion 记一笔并在 Issues 更新 milestone。
- 本文档随 Demo 结束（7/15）做一次回顾修订。
