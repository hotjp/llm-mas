<script setup>
import { ref, onMounted, watch } from 'vue'
import { getAgentConfigs, saveAgentConfigs, getLLMConfigs } from '../utils/storage'
import { ElMessage } from 'element-plus'

const props = defineProps({
  initialData: {
    type: Array,
    default: () => []
  }
})

const agents = ref([])
const llmOptions = ref([])
const selectAll = ref(false)

onMounted(() => {
  loadData()
})

const loadData = () => {
  if (props.initialData && props.initialData.length > 0) {
    agents.value = props.initialData
  } else {
    agents.value = getAgentConfigs()
  }
  const llmList = getLLMConfigs()
  llmOptions.value = llmList.map(llm => ({
    label: `${llm.name} - ${llm.model}`,
    value: llm.id.toString()
  }))
}

watch(() => props.initialData, (newVal) => {
  if (newVal && newVal.length > 0) {
    agents.value = newVal
  }
}, { immediate: true })

const handleSelectAll = () => {
  if (llmOptions.value.length === 0) {
    ElMessage.warning('请先在LLM配置中添加LLM')
    selectAll.value = false
    return
  }
  const firstLlmId = llmOptions.value[0].value
  agents.value.forEach(agent => {
    agent.llmId = selectAll.value ? firstLlmId : ''
  })
}

const handleSave = () => {
  const unboundAgents = agents.value.filter(a => !a.llmId)
  if (unboundAgents.length > 0) {
    ElMessage.warning(`还有 ${unboundAgents.length} 个Agent未绑定LLM`)
  }
  saveAgentConfigs(agents.value)
  ElMessage.success('Agent配置已保存')
}

const handleReset = () => {
  agents.value = getAgentConfigs()
  ElMessage.info('已重置为默认提示词')
}

defineExpose({
  agents,
  loadData
})
</script>

<template>
  <div class="agent-config">
    <div class="section-header">
      <div class="header-left">
        <el-checkbox v-model="selectAll" @change="handleSelectAll">全选Agent</el-checkbox>
        <el-button size="small" @click="handleReset">重置提示词</el-button>
      </div>
      <el-button type="primary" @click="handleSave">保存Agent配置</el-button>
    </div>

    <el-empty v-if="llmOptions.length === 0" description="请先在LLM配置中添加LLM" />

    <div class="agent-list" v-else>
      <el-card v-for="(agent, index) in agents" :key="index" class="agent-card">
        <template #header>
          <span class="agent-name">{{ agent.name }}</span>
        </template>
        <el-form label-width="80px">
          <el-form-item label="绑定LLM">
            <el-select v-model="agent.llmId" placeholder="请选择LLM" style="width: 100%">
              <el-option
                v-for="llm in llmOptions"
                :key="llm.value"
                :label="llm.label"
                :value="llm.value"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="提示词">
            <el-input
              v-model="agent.prompt"
              type="textarea"
              :rows="6"
              placeholder="请输入提示词"
            />
          </el-form-item>
        </el-form>
      </el-card>
    </div>
  </div>
</template>

<style scoped>
.agent-config {
  padding: 16px 0;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  flex-wrap: wrap;
  gap: 12px;
}

.header-left {
  display: flex;
  gap: 12px;
  align-items: center;
  flex-wrap: wrap;
}

.agent-list {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}

.agent-card {
  margin-bottom: 0;
}

.agent-name {
  font-weight: 600;
  color: #303133;
}

.agent-card :deep(.el-form-item__label) {
  font-size: 13px;
}

.agent-card :deep(.el-textarea__inner) {
  font-size: 13px;
}

@media (max-width: 768px) {
  .agent-config {
    padding: 12px 0;
  }

  .section-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .header-left {
    width: 100%;
    justify-content: space-between;
  }

  .agent-list {
    grid-template-columns: 1fr;
    gap: 12px;
  }

  .agent-card :deep(.el-card__header) {
    padding: 12px;
  }

  .agent-card :deep(.el-card__body) {
    padding: 12px;
  }

  .agent-card :deep(.el-form-item) {
    margin-bottom: 12px;
  }

  .agent-card :deep(.el-form-item__label) {
    font-size: 12px;
  }

  .agent-card :deep(.el-textarea__inner) {
    font-size: 12px;
  }
}
</style>
