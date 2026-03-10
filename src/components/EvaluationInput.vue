<script setup>
import { ref, computed, watch } from 'vue'
import { splitTextByKeywords, getSplitPreview, calculateSplitStats } from '../utils/textSplitter'
import { splitTextByLLM, splitTextIntoChunks } from '../utils/llmSplitter'
import { getLLMConfigs } from '../utils/storage'
import { ElMessage } from 'element-plus'

const emit = defineEmits(['start-evaluation'])

const productContent = ref('')
const enableSplit = ref(false)
const splitMode = ref('keyword')
const isSplitting = ref(false)
const splitPreviewVisible = ref(false)
const splitChunks = ref({})
const splitStats = ref(null)
const splitProgress = ref({ current: 0, total: 0 })

const splitPreview = computed(() => {
  if (!splitChunks.value || Object.keys(splitChunks.value).length === 0) {
    return []
  }
  return getSplitPreview(splitChunks.value)
})

const handleEnableSplitChange = () => {
  splitChunks.value = {}
  splitStats.value = null
  splitPreviewVisible.value = false
}

watch(splitMode, () => {
  splitChunks.value = {}
  splitStats.value = null
  splitPreviewVisible.value = false
})

const handlePreviewSplit = async () => {
  if (!productContent.value.trim()) {
    ElMessage.warning('请先输入产品概念内容')
    return
  }

  if (splitMode.value === 'keyword') {
    splitChunks.value = splitTextByKeywords(productContent.value)
    splitStats.value = calculateSplitStats(productContent.value, splitChunks.value)
    splitPreviewVisible.value = true
    ElMessage.success('文本分割完成')
  } else {
    const llmConfigs = getLLMConfigs()
    if (llmConfigs.length === 0) {
      ElMessage.warning('请先配置LLM')
      return
    }
    
    isSplitting.value = true
    splitProgress.value = { current: 0, total: 0 }
    try {
      splitChunks.value = await splitTextByLLM(productContent.value, '', (current, total) => {
        splitProgress.value = { current, total }
      })
      splitStats.value = calculateSplitStats(productContent.value, splitChunks.value)
      splitPreviewVisible.value = true
      ElMessage.success('LLM智能分割完成')
    } catch (error) {
      ElMessage.error(`分割失败: ${error.message}`)
    } finally {
      isSplitting.value = false
    }
  }
}

const handleStartEvaluation = () => {
  emit('start-evaluation', {
    productContent: productContent.value,
    enableSplit: enableSplit.value,
    splitMode: splitMode.value,
    splitChunks: splitChunks.value,
    splitStats: splitStats.value
  })
}

const handleClearInput = () => {
  productContent.value = ''
}

const loadFromHistory = (data) => {
  productContent.value = data.productContent || ''
  enableSplit.value = data.enableSplit || false
  splitMode.value = data.splitMode || 'keyword'
  splitChunks.value = data.splitChunks || {}
  splitStats.value = data.splitStats || null
  splitPreviewVisible.value = !!(data.splitChunks && Object.keys(data.splitChunks).length > 0)
}

defineExpose({
  loadFromHistory,
  handleStartEvaluation
})
</script>

<template>
  <div class="evaluation-input">
    <el-card class="input-section">
      <template #header>
        <span class="section-title">产品概念/创业想法/商业提案输入：</span>
      </template>
      
      <div class="split-settings">
        <el-switch
          v-model="enableSplit"
          @change="handleEnableSplitChange"
          active-text="启用文本分割"
        />
        
        <div v-if="enableSplit" class="split-options">
          <el-radio-group v-model="splitMode">
            <el-radio value="keyword">基于关键词分割</el-radio>
            <el-radio value="llm">基于LLM智能分割</el-radio>
          </el-radio-group>
          
          <el-button 
            @click="handlePreviewSplit" 
            :loading="isSplitting"
            :disabled="!productContent.trim()"
            size="small"
          >
            预览分割
          </el-button>
          
          <el-progress 
            v-if="isSplitting && splitProgress.total > 0" 
            :percentage="Math.round((splitProgress.current / splitProgress.total) * 100)"
            :status="splitProgress.current === splitProgress.total ? 'success' : ''"
            :stroke-width="6"
            style="width: 150px;"
          />
        </div>
      </div>

      <el-input
        v-model="productContent"
        type="textarea"
        :rows="8"
        placeholder="粘贴你的产品PRD/BP内容..."
      />
      
      <div class="input-actions">
        <el-button type="primary" @click="handleStartEvaluation" :disabled="isSplitting">
          开始评估
        </el-button>
        <el-button @click="handleClearInput" :disabled="isSplitting">清空输入</el-button>
      </div>
    </el-card>

    <el-card v-if="splitPreviewVisible && splitPreview.length > 0" class="preview-section">
      <template #header>
        <span class="section-title">文本分割预览：</span>
      </template>
      <div class="split-stats" v-if="splitStats">
        <el-tag>总字符: {{ splitStats.totalChars }}</el-tag>
        <el-tag>段落数: {{ splitStats.paragraphs }}</el-tag>
        <el-tag type="info">分割模式: {{ splitMode === 'keyword' ? '关键词' : 'LLM' }}</el-tag>
      </div>
      <el-collapse>
        <el-collapse-item
          v-for="item in splitPreview"
          :key="item.agent"
          :title="`${item.agent} (${item.length}字符, ${item.wordCount}词)`"
        >
          <div class="preview-content">{{ item.content || '(空)' }}</div>
        </el-collapse-item>
      </el-collapse>
    </el-card>
  </div>
</template>

<style scoped>
.evaluation-input {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.section-title {
  font-weight: 600;
  color: #303133;
}

.split-settings {
  display: flex;
  align-items: center;
  gap: 24px;
  margin-bottom: 16px;
  padding: 12px;
  background: #f5f7fa;
  border-radius: 4px;
}

.split-options {
  display: flex;
  align-items: center;
  gap: 16px;
}

.input-actions {
  margin-top: 16px;
  display: flex;
  gap: 12px;
}

.split-stats {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.preview-content {
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 400px;
  overflow-y: auto;
  padding: 8px;
  background: #fafafa;
  border-radius: 4px;
  font-size: 13px;
  line-height: 1.6;
}
</style>
