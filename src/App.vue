<script setup>
import { ref, onMounted } from 'vue'
import LlmConfig from './components/LlmConfig.vue'
import AgentConfig from './components/AgentConfig.vue'
import EvaluationInput from './components/EvaluationInput.vue'
import EvaluationResults from './components/EvaluationResults.vue'
import { resetAllConfigs, getLLMConfigs, getAgentConfigs } from './utils/storage'
import { ElMessage, ElMessageBox } from 'element-plus'

const activeTab = ref('llm')
const llmConfigRef = ref(null)
const agentConfigRef = ref(null)
const evaluationInputRef = ref(null)
const evaluationResultsRef = ref(null)
const initialLlmList = ref([])
const initialAgentList = ref([])

onMounted(() => {
  initialLlmList.value = getLLMConfigs()
  initialAgentList.value = getAgentConfigs()
})

const handleReset = async () => {
  try {
    await ElMessageBox.confirm('确定要重置所有配置吗？', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
    resetAllConfigs()
    if (llmConfigRef.value) {
      llmConfigRef.value.llmList = []
    }
    if (agentConfigRef.value) {
      agentConfigRef.value.loadData()
    }
    ElMessage.success('配置已重置')
  } catch {
    // 用户取消
  }
}

const handleTabChange = (tab) => {
  if (tab === 'agent' && agentConfigRef.value) {
    agentConfigRef.value.loadData()
  }
}

const handleStartEvaluation = (data) => {
  if (evaluationResultsRef.value) {
    evaluationResultsRef.value.handleStartEvaluation(data)
  }
  activeTab.value = 'results'
}
</script>

<template>
  <div class="app-container">
    <header class="app-header">
      <h1>LLM-MAS 新产品概念评估系统</h1>
      <div class="header-actions">
        <el-button>帮助</el-button>
        <el-button type="danger" @click="handleReset">重置</el-button>
      </div>
    </header>

    <main class="app-main">
      <el-tabs v-model="activeTab" type="border-card" class="main-tabs" @tab-change="handleTabChange">
        <el-tab-pane label="1. LLM配置" name="llm">
          <LlmConfig ref="llmConfigRef" :initial-data="initialLlmList" />
        </el-tab-pane>
        <el-tab-pane label="2. Agent配置" name="agent">
          <AgentConfig ref="agentConfigRef" :initial-data="initialAgentList" />
        </el-tab-pane>
        <el-tab-pane label="3. 评估内容" name="evaluation">
          <EvaluationInput ref="evaluationInputRef" @start-evaluation="handleStartEvaluation" />
        </el-tab-pane>
        <el-tab-pane label="4. 评估结果" name="results">
          <EvaluationResults ref="evaluationResultsRef" />
        </el-tab-pane>
      </el-tabs>
    </main>
  </div>
</template>

<style scoped>
.app-container {
  min-height: 100vh;
  background: #f5f7fa;
}

.app-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: #fff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  flex-wrap: wrap;
  gap: 12px;
}

.app-header h1 {
  margin: 0;
  font-size: 18px;
  color: #303133;
  flex: 1;
  min-width: 200px;
}

.header-actions {
  display: flex;
  gap: 8px;
}

.header-actions :deep(.el-button) {
  padding: 8px 12px;
  font-size: 14px;
}

.app-main {
  padding: 16px;
}

.main-tabs {
  max-width: 1200px;
  margin: 0 auto;
}

@media (max-width: 768px) {
  .app-header {
    padding: 10px 12px;
  }

  .app-header h1 {
    font-size: 16px;
  }

  .header-actions :deep(.el-button) {
    padding: 6px 10px;
    font-size: 12px;
  }

  .app-main {
    padding: 12px 8px;
  }

  .main-tabs :deep(.el-tabs__header) {
    margin-bottom: 12px;
  }

  .main-tabs :deep(.el-tabs__item) {
    padding: 0 12px !important;
    font-size: 13px;
  }
}
</style>
