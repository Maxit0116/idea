# Function Map 功能规格

**文档版本**：v1.1  
**状态**：已拍板（开发参考）  
**更新日期**：2026-06-24  
**产品代号**：Project OS  
**关联文档**：
- [MVP-PRD.md](./MVP-PRD.md) — F2 功能地图、F3 节点 Context
- [Product-PRD.md](./Product-PRD.md) — 全可视化战略、UI 布局
- [Reference-Projects.md](./Reference-Projects.md) — React Flow、Stello、repowise、Node Context Pack
- [Team-Division.md](./Team-Division.md) — Terran / Ray 集成契约
- [tasks/Terran-Dev-Plan.md](./tasks/Terran-Dev-Plan.md) · [tasks/Ray-Dev-Plan.md](./tasks/Ray-Dev-Plan.md)

---

## 1. 一句话定义

> **Function Map 是面向用户的功能拓扑投影，不是文件目录的镜像。用户通过宏观功能节点理解项目、点选注入精准上下文进行 vibe coding；代码库是唯一真相，图在 AI 改码后增量同步更新。**

---

## 2. 核心原则

| # | 原则 | 说明 |
|---|------|------|
| 1 | **功能优先于架构** | 主编辑区展示产品语言的功能/页面关系，不直出技术依赖图、import 网 |
| 2 | **代码是真相** | `graph.json` 是投影层；用户改代码或 AI 执行变更后，图跟随更新 |
| 3 | **双图分离** | 用户见 Function Graph；引擎维护 Technical Index（`fileIndex` / `internalArchitecture`） |
| 4 | **点哪改哪** | 点节点 → Node Context Pack → Chat / 执行默认作用域，不全仓读 |
| 5 | **渐进展示** | 默认浅层（depth ≤ 1），点击展开子模块，避免信息过载 |
| 6 | **布局稳定** | 固定拓扑布局（同心圆环），位置不随每次分析漂移 |

---

## 3. Function Map 是什么 / 不是什么

### 3.1 是

- 用户能叫出名字的功能或页面（如「用户登录」「订单结算」）
- 功能之间的**从属**、**用户流**、**功能级依赖**
- 点选后展开关联文件、接口、逻辑的技术上下文（Inspector + Chat）
- AI 改码后的**活图**（节点增删、状态变更、关系更新）

### 3.2 不是

- File Tree 的树状投影
- 按 `src/` 目录一层一层对应的架构图
- 文件级 `import` 关系网（留在 Technical Index，不进主图）
- 类/函数级**技术依赖图**（import/call graph）不对用户展示
- **功能级 unit 节点**（代码段粒度）可存在于 graph，默认渐进展开后可见

### 3.3 典型反例 vs 正例

```
❌ 错误：每个目录一个节点          ✅ 正确：一个功能跨多个技术目录
   app/login/  → 节点                 [用户登录]
   lib/auth.ts → 节点                      ├ app/login/page.tsx
   components/ → 节点                      ├ lib/auth.ts
                                           └ app/api/auth/route.ts
```

---

## 4. 双图模型与数据流

```
┌─────────────────────────────────────────────────────────────────┐
│ Layer A — Function Graph（用户可见，Custom Editor 渲染）         │
│   节点 = 功能/页面  边 = 从属 | 用户流 | 功能依赖                 │
└───────────────────────────────┬─────────────────────────────────┘
                                │ 点击节点
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│ Layer C — Node Context Pack（按需组装，注入 Chat / 执行）         │
│   分级文件列表 + API/路由 + 摘要/snippet + 上下游功能             │
└───────────────────────────────┬─────────────────────────────────┘
                                │ 解析自
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│ Layer B — Technical Index（引擎内部，默认不展示为第二张图）       │
│   fileIndex、import 图、路由表、export 索引                       │
└─────────────────────────────────────────────────────────────────┘
```

### 4.1 分析流水线

| 阶段 | stage id | 内容 | 依赖 LLM |
|------|----------|------|----------|
| 1. 文件扫描 | `file_scan` | 文件树、package.json | 否 |
| 2. 路由 / 类型 | `route_detection` | 项目类型、Next.js 路由 | 否 |
| 3. 技术索引 | `import_analysis` | import 图、符号 outline | 否 |
| 4. 静态聚类 | `clustering` | quick 路径目录聚类（hint only） | 否 |
| 5. **入口发现** | `entry_discovery` | void：contrib/action/panel/IPC/service；Next.js：路由 | 否 |
| 6. **AI Pass1** | `ai_pass1` | 粗粒度产品功能树（10–25 节点，禁止目录名） | standard/deep |
| 7. **AI Pass2** | `ai_pass2` | deep 时对 top features 并行细化；standard 展开时 lazy | deep / lazy |
| 8. 锚点校验 | `anchor_validation` | path/line 存在性；无效降级 suggested | 否 |
| 9. lineage merge | `graph_merge` | 与旧 graph 合并 id aliases + changelog | 否 |
| 10. 拓扑 enrich | `finalize` | `sys_root`、**preserveHierarchy**（AI 路径）、depth、refs | 否 |
| 11. 持久化 | `finalize` | `graph.json` v0.3.0 + `analysisMeta` + changelog | 否 |

**档位语义（已拍板）**：

| 档位 | 行为 |
|------|------|
| **quick** | 技术模块图（目录聚类）+ 可选 AI 命名；`enrichTopology` 不 preserve |
| **standard** | entry 驱动 AI Pass1 功能树；展开节点时 Pass2 lazy |
| **deep** | Pass1 + 立即 Pass2 top-N features |

**无 API Key**：阶段 1–4、9–11；Dialog 默认不可选 standard/deep。

**有 API Key**：Dialog **默认 standard**；旧图（v0.2.0 或 >50% `mod_/static_/contrib_` id）显示重分析 banner。

**M0 验收（void + standard）**：

- `graph.json` → `version: 0.3.0`
- 节点 id 以 `feat_` 为主，非 `mod_contrib_*`
- 至少 1 个 `depth ≥ 2` 子节点（parent ≠ sys_root）
- 节点 `name` 为产品语言（如「功能地图」「AI 对话」）

### 4.2 节点边界算法（目标态，MVP 渐进落地）

对每个**入口锚点**（页面路由、顶层 page、命名 API 组）：

1. 创建候选功能节点  
2. `linkedFiles` = 从锚点出发的有界 import 闭包（`maxDepth` 建议 3）  
3. 为每个文件标注 `role`：`primary` | `core` | `supporting` | `api` | `config` | `test`  
4. 多个页面/路由簇可由 LLM **聚合**为同一功能节点（同一 `depth` 层展示，子节点在下一 depth）  
5. **共享文件**（多节点引用）：允许多归属（文件出现在多个节点的 `linkedFiles`）；执行时以**当前选中节点**为 primary scope

---

## 5. UI 布局（已拍板）

点击 Activity Bar 上的 **Function Map** 图标后，工作区布局如下：

```
┌────┬──────────────┬────────────────────────────┬─────────────────┐
│    │              │                            │                 │
│ A  │  Inspector   │   Custom Editor            │   AI Chat       │
│ c  │  Sidebar     │   （Function Map Tab）      │   Sidebar       │
│ t  │              │   React Flow 功能地图       │   Context +     │
│ i  │  节点详情     │   缩放/平移/搜索/展开       │   理解卡 + 输入  │
│ v  │  文件 chips  │                            │                 │
│ i  │  上下游列表   │                            │                 │
│ t  │              │                            │                 │
│ y  │              │                            │                 │
│    │              │                            │                 │
│ B  │              │                            │                 │
│ a  │              │                            │                 │
│ r  │              │                            │                 │
└────┴──────────────┴────────────────────────────┴─────────────────┘
```

| 区域 | 职责 |
|------|------|
| **Activity Bar** | 含 Function Map 入口图标；与 VS Code / Void fork 一致 |
| **Inspector Sidebar** | Activity Bar 右侧、Custom Editor 左侧；展示选中节点摘要、关联文件、上下游；文件 chip → Monaco |
| **Custom Editor** | 主编辑区 Function Map Tab；图谱交互主战场 |
| **AI Chat Sidebar** | 最右侧；随点选切换 Node / Project context |

**原则**：图上不堆 Chat 输入框；图负责定位，Inspector 负责详情，Chat 负责对话与执行。

### 5.1 主编辑区 Tab（MVP）

| Tab | 说明 |
|-----|------|
| **功能地图** | 本文档范围 |
| **代码** | Monaco；从 Inspector 文件 chip 跳转 |
| **Agent 流程** | MVP v0.5 只读时间线（见 MVP-PRD F4） |
| **File Tree** | MVP 方案二：左侧传统目录树，非语义树 |

---

## 6. 可视化规格

### 6.1 布局算法（已拍板：固定拓扑）

- 采用 **Stello 式 constellation layout**：`sys_root` 在中心，子节点按 `depth` 分布在同心圆环上  
- 实现参考：`topology-layout.ts` → `computeTopologyLayout`  
- **不采用**力导向布局（节点位置不稳定，不利于录屏与肌肉记忆）

布局只决定 **屏幕坐标**；节点语义由聚类 + LLM 决定，二者分离。

### 6.2 渐进展开（已拍板）

| 规则 | 说明 |
|------|------|
| **默认可见** | `depth ≤ 1` 的节点（根 + 一级功能模块） |
| **展开** | 点击功能节点 → 展开其 `children`（下一 depth 子模块或聚合前的子页面） |
| **折叠** | 再次点击或 Esc / 「收起」→ 回到默认浅层视图 |
| **搜索** | 命中节点时临时高亮并 `fitView`；可自动展开至命中节点路径 |

目的：中等项目默认 **10–25 个可见节点**，避免一屏上百节点。

### 6.3 节点粒度（已拍板）

- **宏观层**：多个相关 page/route **聚合**为一个功能节点展示（如「用户认证」包含 login、oauth callback）  
- **展开后**：见到下一 depth 的子功能节点，或该功能依赖的其他节点（只读 refs 可选虚线）  
- **Sweet spot**：用户能用一句话向非技术人员描述该节点  

### 6.4 节点视觉

| 元素 | 说明 |
|------|------|
| `sys_root` | 居中、圆形；显示项目名 + 模块/文件统计摘要 |
| 功能节点 | 中文名为主、`nameEn` 副标题、tags（page/api 等）、关联文件数 |
| 选中态 | 高亮边框 + 与 Inspector / Chat 联动 |
| 状态色 | `active` / `in_progress` / `error` / `suggested`（见 MVP-PRD F2.2.3） |

### 6.5 边的语义（主图仅展示功能级）

| `relation` | 用户可见文案 | 图上展示 |
|------------|--------------|----------|
| parent/child（拓扑） | 从属 | 实线树边 |
| `redirects_to` | 跳转到 | 实线 + 箭头 |
| `depends_on` | 依赖 | 实线（功能语义，非 import 计数） |
| `data_flows_to` | 数据流向 | 可选，P1 |
| `imports` | — | **不展示**（仅 Technical Index） |
| `refs`（跨簇技术引用） | — | MVP 默认隐藏；Phase 2 可 hover 虚线 |

**规则**：图上每条边，用户都能用一句话解释；说不清的不画。

### 6.6 基础交互（Demo + MVP）

| 交互 | 优先级 |
|------|--------|
| 缩放、平移 | P0 |
| 搜索定位 | P0 |
| 点击选中 → Inspector + Chat context | P0 |
| 渐进展开/折叠子模块 | P0 |
| MiniMap / Controls | P1 |
| 节点拖拽改位置 | ❌ MVP 不做（只读布局） |
| 手动 merge/重命名节点 | P1（准确率补偿，Phase 2 加强） |

---

## 7. `sys_root` 根节点（已拍板 + 建议）

**结论**：`sys_root` 作为整个项目架构图的根节点；**可点击**，且与功能节点享有不同的 context 级别。

| 项 | 规格 |
|----|------|
| **展示** | 图中心；名称建议为项目名称（非固定文案「项目架构」） |
| **点击行为** | 选中根节点 → 右侧 AI Chat 切换为 **项目级 context**（`buildProjectContext`） |
| **项目级 Chat 能力** | 新增最宏观功能（如「加一个支付模块」）、跨模块重构、全项目级 prompt |
| **Inspector** | 显示项目摘要：模块数、top 功能列表、最近变更；提供「重新分析」 |
| **执行边界** | 项目级执行范围宽于单节点，但仍走 Change Plan + git checkpoint；不全仓无差别改写 |

子功能节点点击 → **节点级** Node Context Pack（收窄文件范围）。

---

## 8. Node Context Pack 与 vibe coding

### 8.1 点选 → Context 切换

```
用户点击功能节点 N
    → Inspector 展示 N 的摘要、文件、上下游
    → Chat 标题/面包屑更新为 N
    → buildContext(N) 注入 Node Context Pack（目标 200ms 内切换）
```

### 8.2 Context Pack 结构（MVP 目标）

在 [Reference-Projects.md §8.3](./Reference-Projects.md) v0 schema 基础上扩展：

| 字段 | 用途 |
|------|------|
| `nodeId` / `name` / `definition` / `summary` | 用户可见 + 模型理解功能边界 |
| `linkedFiles[]` | 分级：`role` + `reason` + 可选 `snippet` |
| `apis` / `routes` | 接口与路由边界 |
| `upstream` / `downstream` | 功能级上下游（非 import） |
| `recentChanges` | Git 感知，M1+ |
| `openErrors` | 报错态，M3 |

### 8.3 Token 收束策略

| 层级 | 内容 | 加载时机 |
|------|------|----------|
| L0 | 节点定义 + 上下游功能名 | 点选即注入 Chat |
| L1 | 文件路径 + role 列表 | 点选即注入 |
| L2 | 核心文件结构摘要 / 签名 | `understand_prompt` 阶段 |
| L3 | 完整文件内容 | Agent `read_file` 按需读取 |

**禁止**点选时把全部 `linkedFiles` 全文塞进 Chat。

### 8.4 Prompt 精进 → 执行 → 图更新（MVP 主链）

```
用户输入 prompt（已选中节点 N）
    → understand_prompt → 理解反馈卡
    → 用户确认
    → execute_change（默认仅 N 的 primary/core ± 1 hop）
    → git checkpoint
    → 文件变更
    → scheduleReanalyze（debounce 5–15s）→ 图增量/全量更新
    → 节点状态 / 边 / 新增 suggested 节点 同步到 UI
```

执行保守策略见 MVP-PRD F3.3.6。

---

## 9. 活图更新（参考 Stello）

AI 改码或用户保存文件后，Function Map **在原有基础上变更**，而非整图闪烁重绘。

### 9.1 借鉴 Stello / Stello Board（轻集成，零 `@stello-ai/*` 依赖）

| Stello 概念 | Function Map 映射 |
|-------------|-------------------|
| Lifecycle 事件 | 分析 job、`execute_change` 完成 → 发 `graphUpdated` 事件 |
| `memory` 外部摘要 | 节点 `summary` / `description` 在 reanalyze 后 consolidate |
| stello-board 事件流 | UI 订阅 graph  diff：节点 status、`in_progress` 动画 |
| React Flow 节点样式 | 执行中节点高亮；完成变绿；失败标红 |

### 9.2 更新策略

| 触发 | 行为 |
|------|------|
| 文件 save（watcher） | debounce → `scheduleReanalyze` |
| `execute_change` 成功 | 优先增量更新受影响节点；必要时局部 re-cluster |
| 全量 reanalyze | 保留 `projectId`、用户展开状态（expandedNodeIds） |
| 不一致 | 节点标黄（MVP 不阻断）；Phase 2 架构 Warning |

### 9.3 UI 反馈

- Reanalyze 时：顶部 toast「同步结构中…」+ 相关节点 `in_progress` 态  
- 完成时：新增节点淡入；删除节点淡出；边 diff 最小化跳动（固定布局优势）  
- 更换分析模型后：见 §10

---

## 10. 分析与模型配置（已拍板）

| 场景 | 行为 |
|------|------|
| **无 API Key** | 仅静态聚类 + 拓扑；设置 / Welcome 说明「未启用 AI 语义命名」 |
| **有 API Key** | 静态聚类 + LLM enrich（命名、summary、补功能边） |
| **更换分析模型** | 弹出确认框：「分析模型已更改，是否重新分析项目？」→ 确认则 `analyze()` |
| **手动重新分析** | Inspector / 项目概览提供「↺ 重新分析」 |
| **打开项目** | 若存在 `.projectos/graph.json` 则加载；否则自动分析 |

分析模型可与 Chat 模型相同或独立配置（`functionMapUseChatModel` 开关，已实现）。

---

## 11. 数据与存储

### 11.1 主文件

路径：`<projectRoot>/.projectos/graph.json`  
Schema 版本：`0.3.0`（见 `projectOsTypes.ts`）

变更日志：`<projectRoot>/.projectos/graph-changelog.jsonl`

### 11.2 核心类型摘要（v0.3.0）

```typescript
interface CodeAnchor {
  path: string
  startLine: number
  endLine: number
  symbolName?: string
  role: FileRole
}

interface NodeLineage {
  slug: string
  aliases: string[]
  createdBy: 'static' | 'ai' | 'user'
}

interface FunctionalNode {
  id: string
  name: string
  granularity: 'project' | 'module' | 'feature' | 'subfeature' | 'unit'
  anchors: CodeAnchor[]
  lineage: NodeLineage
  crossRefs?: string[]
  linkedFiles: { path, role, summary? }[]
  parentId: string | null
  children: string[]
  depth: number
  upstream: string[]
  downstream: string[]
  status: 'active' | 'in_progress' | 'error' | 'suggested'
}

// FunctionalEdge（主图）
{
  source, target,
  relation: 'depends_on' | 'redirects_to' | 'data_flows_to' | ...
}
```

完整定义以代码 `projectOsTypes.ts` 为准；schema 变更须提前 24h 双方对齐（Team-Division §6）。

### 11.3 Source of Truth

| 真相 | 投影 |
|------|------|
| 代码库 | `graph.json` |
| `fileIndex` + import 图 | 节点 `linkedFiles`、Context Pack |
| 用户改代码 | 图跟随 |
| 用户经 Chat 改功能 | AI 写代码 → 图跟随 |

---

## 12. 集成 API（Terran ↔ Ray）

### 12.1 已有 / Demo

```
openProject(path)        → analyze(path) → jobId
getJobStatus(jobId)      → { progress, stage, status }
getGraph(projectId)      → GraphJSON
getNodeDetail(nodeId)    → Inspector 数据
onFileSaved              → scheduleReanalyze (debounced)
```

### 12.2 MVP 扩展

```
buildContext(nodeId?)    → NodeContext | ProjectContext（nodeId 空 = 项目级）
submitPrompt(nodeId, text)     → UnderstandingCard
confirmExecution(...)          → jobId → diff → graph update
getAgentFlowLog(jobId)         → v0.5 只读
```

契约详见 [Team-Division.md §4](./Team-Division.md)。

---

## 13. 分阶段交付对照

| 能力 | Demo（7/15） | MVP（10/31） |
|------|--------------|--------------|
| 固定拓扑布局 | ✅ | ✅ |
| 缩放/平移/搜索 | ✅ | ✅ |
| 渐进展开 depth≤1 | ⚠️ 基础展开 | ✅ 完整 |
| Inspector Sidebar 布局 | ✅ | ✅ |
| 静态聚类（无 Key） | ✅ | ✅ |
| LLM 语义命名 | ✅ | ✅ + merge 迭代 |
| 点 node → 静态 Inspector | ✅ | — |
| 点 node → Chat context | ❌ | ✅ M1 |
| Prompt 精进 + 执行 | ❌ | ✅ M2 |
| 活图 reanalyze | 可选 | ✅ debounce |
| 执行中节点状态 | ❌ | ✅ |
| 入口锚点 + import 闭包 | 部分 | ✅ 目标完整 |
| Agent 流程 Tab | ❌ | v0.5 只读 |

---

## 14. 成功标准（MVP）

| 指标 | 目标 |
|------|------|
| 功能节点识别准确率 | 60–75%（允许手动修正，P1） |
| 点选 → context 切换延迟 | < 200ms（Pack 元数据） |
| 可视化驱动编辑占比 | > 30% |
| 单节点 Context Pack 文件数 | 通常 5–15，极少超过 25 |
| 改码后图同步 | debounce 后 5–15s 内可见更新 |

---

## 15. 已拍板决策速查

| # | 议题 | 决定 |
|---|------|------|
| 1 | 布局算法 | **固定拓扑**（constellation / depth 圆环） |
| 2 | 更换分析模型 | **弹窗询问是否重新分析** |
| 3 | 无 API Key | **静态聚类**，明确提示 |
| 4 | 工作区布局 | Activity Bar → **Inspector** → Custom Editor → **AI Chat** |
| 5 | MVP 能力 | 缩放/平移/搜索 + **点 node 精准注入** + **执行后活图更新**（参考 Stello 事件模型） |
| 6 | `sys_root` | **可点击**；Chat 切换**项目级 context**，支持宏观新增/全项目编辑 |
| 7 | 图的信息密度 | **渐进展开**，默认 **depth ≤ 1** |
| 8 | 节点粒度 | **多 page 聚合为功能**；点击展开下一 depth |
| 9 | 共享文件 | **多归属**；执行以当前选中节点为 primary scope |
| 10 | 主图边 | 仅**功能级**；`imports` 不进主图 |
| 11 | 双图模型 | Function Graph（可见）+ Technical Index（内部） |
| 12 | Demo 图编辑 | **只读**；MVP P1 可支持 merge/重命名 |

---

## 16. 后续可拆 Issue 的技术项

1. **R-B**：入口锚点 + import 闭包聚类替换/增强目录聚类  
2. **R-B**：LLM merge 多簇为单功能节点 + `sourceClusterIds` 追溯  
3. **R-M103**：`buildContext` 分级 Pack + snippet  
4. **T-B**：渐进展开 UI 状态（`expandedNodeIds` 持久化）  
5. **T-B**：更换模型确认 Dialog  
6. **T+D**：`execute_change` 后 graph diff 动画（Stello 式事件）  
7. **schema**：`internalArchitecture` 字段正式写入 graph.json  

---

## 17. 修订记录

| 版本 | 日期 | 说明 |
|------|------|------|
| v1.1 | 2026-06-24 | AI 驱动功能树、schema 0.3.0、anchors/lineage、分析档位、Guard、changelog |
| v1.0 | 2026-06-24 | 初版：汇总 Function Map 产品/交互/技术拍板 |
