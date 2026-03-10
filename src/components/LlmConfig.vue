<script setup>
import { ref, onMounted, watch } from 'vue'
import { getLLMConfigs, saveLLMConfigs } from '../utils/storage'
import { ElMessage } from 'element-plus'

const props = defineProps({
  initialData: {
    type: Array,
    default: () => []
  }
})

const llmList = ref([])
const dialogVisible = ref(false)
const form = ref({
  name: '',
  baseUrl: '',
  apiKey: '',
  model: ''
})
const isEdit = ref(false)
const editId = ref(null)

onMounted(() => {
  if (props.initialData && props.initialData.length > 0) {
    llmList.value = props.initialData
  } else {
    llmList.value = getLLMConfigs()
  }
})

watch(() => props.initialData, (newVal) => {
  if (newVal && newVal.length > 0) {
    llmList.value = newVal
  }
}, { immediate: true })

const handleAdd = () => {
  form.value = { name: '', baseUrl: '', apiKey: '', model: '' }
  isEdit.value = false
  dialogVisible.value = true
}

const handleEdit = (row) => {
  form.value = { ...row }
  isEdit.value = true
  editId.value = row.id
  dialogVisible.value = true
}

const handleDelete = (row) => {
  llmList.value = llmList.value.filter(item => item.id !== row.id)
  saveLLMConfigs(llmList.value)
  ElMessage.success('删除成功')
}

const handleSave = () => {
  if (!form.value.name || !form.value.baseUrl || !form.value.apiKey || !form.value.model) {
    ElMessage.warning('请填写所有必填项')
    return
  }
  if (isEdit.value) {
    const idx = llmList.value.findIndex(item => item.id === editId.value)
    if (idx !== -1) {
      llmList.value[idx] = { ...form.value, id: editId.value }
    }
  } else {
    llmList.value.push({ ...form.value, id: Date.now() })
  }
  saveLLMConfigs(llmList.value)
  dialogVisible.value = false
  ElMessage.success('保存成功')
}

defineExpose({
  llmList
})
</script>

<template>
  <div class="llm-config">
    <div class="section-header">
      <h3>已配置的LLM列表：</h3>
      <el-button type="primary" @click="handleAdd">+ 添加新LLM</el-button>
    </div>

    <el-table :data="llmList" style="width: 100%" v-if="llmList.length > 0">
      <el-table-column prop="name" label="名称" width="120" />
      <el-table-column prop="model" label="模型" width="120" />
      <el-table-column prop="baseUrl" label="BaseURL" />
      <el-table-column label="操作" width="150">
        <template #default="scope">
          <el-button size="small" @click="handleEdit(scope.row)">编辑</el-button>
          <el-button size="small" type="danger" @click="handleDelete(scope.row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-empty v-else description="暂无配置的LLM，请添加" />

    <el-dialog v-model="dialogVisible" :title="isEdit ? '编辑LLM' : '添加LLM'" width="500px">
      <el-form :model="form" label-width="80px">
        <el-form-item label="LLM名称" required>
          <el-input v-model="form.name" placeholder="如：OpenAI" />
        </el-form-item>
        <el-form-item label="BaseURL" required>
          <el-input v-model="form.baseUrl" placeholder="如：https://api.openai.com/v1" />
        </el-form-item>
        <el-form-item label="API Key" required>
          <el-input v-model="form.apiKey" type="password" show-password placeholder="请输入API Key" />
        </el-form-item>
        <el-form-item label="模型名称" required>
          <el-input v-model="form.model" placeholder="如：gpt-4o" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSave">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.llm-config {
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

.section-header h3 {
  margin: 0;
  color: #303133;
  font-size: 15px;
}

.section-header :deep(.el-button) {
  padding: 8px 16px;
}

.llm-config :deep(.el-table) {
  font-size: 13px;
}

.llm-config :deep(.el-table__header th) {
  font-weight: 600;
}

@media (max-width: 768px) {
  .llm-config {
    padding: 12px 0;
  }

  .section-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .section-header h3 {
    font-size: 14px;
  }

  .llm-config :deep(.el-table) {
    font-size: 12px;
  }

  .llm-config :deep(.el-table .cell) {
    padding: 4px 8px;
  }

  .llm-config :deep(.el-dialog) {
    width: 90% !important;
    max-width: 500px;
    margin: 10px auto !important;
  }

  .llm-config :deep(.el-form-item__label) {
    font-size: 13px;
  }

  .llm-config :deep(.el-input) {
    font-size: 13px;
  }
}
</style>
