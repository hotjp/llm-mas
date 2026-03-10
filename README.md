# LLM-MAS 新产品概念评估系统

基于多智能体（Agent）的新产品概念智能评估工具，前端直连LLM完成评估。

## 核心特性

- **多LLM支持**：支持 OpenAI、智谱AI、Anthropic、Moonshot、DeepSeek 等多种LLM
- **8维Agent评估**：技术可行性（研发总监、IP专家、技术专家、研发工程师）+ 市场可行性（商业规划师、客户代表、市场分析师、风险经理）
- **本地存储**：配置保存在浏览器localStorage，无需后端
- **文本分割**（可选）：支持关键词分割和LLM智能分割，各Agent只处理相关文本块

## 技术栈

- Vue 3 + Vite
- Element Plus
- Axios

## 快速开始

```bash
cd llm-mas
npm install
npm run dev
```

## 功能模块

### 1. LLM配置
- 添加/编辑/删除LLM配置
- 支持自定义BaseURL、API Key、模型名称

### 2. Agent配置
- 预设8个专业Agent
- 为每个Agent绑定指定LLM
- 支持自定义提示词

### 3. 评估执行
- 输入产品PRD/BP内容
- 8个Agent并行评估
- 实时显示评估进度
- 支持中断评估

### 4. 结果展示
- 整体评分汇总
- 各Agent详细评分
- 支持复制/导出报告
- 评分颜色分级（优秀/良好/一般/较差）

### 5. 文本分割（可选）
- 默认关闭，开启后可选：
  - **基于关键词分割**：按语义关键词自动分配文本块
  - **基于LLM分割**：调用LLM智能分割

## 项目结构

```
llm-mas/
├── src/
│   ├── components/
│   │   ├── LlmConfig.vue      # LLM配置组件
│   │   ├── AgentConfig.vue    # Agent配置组件
│   │   └── Evaluation.vue     # 评估执行/结果组件
│   ├── utils/
│   │   ├── storage.js         # 本地存储管理
│   │   ├── llmRequest.js      # LLM API调用
│   │   ├── textSplitter.js    # 关键词文本分割
│   │   └── llmSplitter.js     # LLM智能分割
│   ├── App.vue               # 主页面
│   └── main.js               # 入口文件
├── docs/                    # 项目文档
└── package.json
```

## 论文参考

本项目基于论文 [2603.05980v1](init/2603.05980v1.pdf) 实现，验证了多智能体评估产品概念的核心逻辑。

## License

MIT
