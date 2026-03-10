<script setup>
import { ref, computed, onMounted } from 'vue'
import { getLLMConfigs, getAgentConfigs } from '../utils/storage'
import { callLLMApi, parseEvaluationResult } from '../utils/llmRequest'
import { splitTextByKeywords, getSplitPreview, calculateSplitStats, AGENT_NAMES } from '../utils/textSplitter'
import { splitTextByLLM, splitTextIntoChunks } from '../utils/llmSplitter'
import { initDB, saveEvaluation, getLatestEvaluation, getAllEvaluations, deleteEvaluation } from '../utils/db'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Clock, Delete } from '@element-plus/icons-vue'

const EVAL_CONCURRENCY = 5

const props = defineProps({
  evaluationData: {
    type: Object,
    default: null
  }
})

const productContent = ref('')
const enableSplit = ref(false)
const splitMode = ref('keyword')
const splitChunks = ref({})
const splitStats = ref(null)
const splitPreviewVisible = ref(false)

const isEvaluating = ref(false)
const isSplitting = ref(false)
const evaluationProgress = ref({ current: 0, total: 0 })
const evaluationResults = ref([])
const overallScore = ref(0)
const abortController = ref(null)

const evaluationHistory = ref([])
const selectedHistory = ref(null)

const isEvaluatingOrSplitting = computed(() => isEvaluating.value || isSplitting.value)

const currentEvaluationItem = computed(() => {
  if (!isEvaluatingOrSplitting.value) return null
  return {
    id: 'current',
    isCurrent: true,
    timestamp: Date.now(),
    overallScore: overallScore.value,
    status: 'evaluating',
    progress: totalProgress.value
  }
})

const agentStatus = ref([
  { name: '研发总监', status: 'pending' },
  { name: 'IP专家', status: 'pending' },
  { name: '技术专家', status: 'pending' },
  { name: '研发工程师', status: 'pending' },
  { name: '商业规划师', status: 'pending' },
  { name: '客户代表', status: 'pending' },
  { name: '市场分析师', status: 'pending' },
  { name: '风险经理', status: 'pending' }
])

const historyDrawerVisible = ref(false)

const totalProgress = computed(() => {
  if (isSplitting.value && evaluationProgress.value.total > 0) {
    return evaluationProgress.value
  }
  if (isEvaluating.value && evaluationProgress.value.total > 0) {
    return evaluationProgress.value
  }
  return { current: 0, total: 0 }
})

const splitPreview = computed(() => {
  if (!splitChunks.value || Object.keys(splitChunks.value).length === 0) {
    return []
  }
  return getSplitPreview(splitChunks.value)
})

onMounted(async () => {
  try {
    await initDB()
    await loadEvaluationHistory()
    
    const latestEval = await getLatestEvaluation()
    if (latestEval) {
      loadFromHistory(latestEval)
    }
  } catch (error) {
    console.error('初始化失败:', error)
  }
})

const loadEvaluationHistory = async () => {
  try {
    const history = await getAllEvaluations()
    console.log('加载历史记录, 原始数据:', history)
    evaluationHistory.value = history.map(item => ({
      id: item.id,
      timestamp: item.timestamp,
      overallScore: item.overallScore,
      agentCount: item.evaluationResults?.length || 0,
      productContent: item.productContent,
      evaluationResults: item.evaluationResults,
      enableSplit: item.enableSplit,
      splitMode: item.splitMode,
      splitChunks: item.splitChunks,
      splitStats: item.splitStats
    }))
    console.log('处理后数据:', evaluationHistory.value)
  } catch (error) {
    console.error('加载历史记录失败:', error)
  }
}

const loadFromHistory = (data) => {
  if (!data) {
    return
  }
  try {
    productContent.value = data.productContent || ''
    enableSplit.value = data.enableSplit || false
    splitMode.value = data.splitMode || 'keyword'
    splitChunks.value = data.splitChunks || {}
    splitStats.value = data.splitStats || null
    evaluationResults.value = Array.isArray(data.evaluationResults) ? data.evaluationResults : []
    
    const score = Number(data.overallScore)
    overallScore.value = isNaN(score) ? 0 : score
    
    splitPreviewVisible.value = !!(data.splitChunks && typeof data.splitChunks === 'object' && Object.keys(data.splitChunks).length > 0)
    
    agentStatus.value.forEach(a => {
      const result = evaluationResults.value.find(r => r && r.agent === a.name)
      if (result && typeof result.score === 'number' && result.score > 0) {
        a.status = 'completed'
      } else {
        a.status = 'pending'
      }
    })
  } catch (error) {
    console.error('加载历史数据失败:', error)
  }
}

const selectHistory = (item) => {
  selectedHistory.value = item
  if (item && item.isCurrent) {
    return
  }
  loadFromHistory(item)
}

const selectCurrentEvaluation = () => {
  selectedHistory.value = currentEvaluationItem.value
}

const clearCurrentResult = () => {
  productContent.value = ''
  enableSplit.value = false
  splitMode.value = 'keyword'
  splitChunks.value = {}
  splitStats.value = null
  evaluationResults.value = []
  overallScore.value = 0
  splitPreviewVisible.value = false
  agentStatus.value.forEach(a => {
    a.status = 'pending'
  })
}

const handleDeleteHistory = async (item, event) => {
  event.stopPropagation()
  const isSelected = selectedHistory.value && selectedHistory.value.id === item.id
  try {
    await ElMessageBox.confirm(
      `确定要删除 ${formatDate(item.timestamp)} 的评估记录吗？`,
      '删除确认',
      {
        confirmButtonText: '删除',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    await deleteEvaluation(item.id)
    await loadEvaluationHistory()
    if (isSelected) {
      selectedHistory.value = null
      clearCurrentResult()
    }
    ElMessage.success('删除成功')
  } catch (error) {
    if (error !== 'cancel') {
      console.error('删除历史记录失败:', error)
      ElMessage.error('删除失败')
    }
  }
}

const formatDate = (timestamp) => {
  return new Date(timestamp).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const getScoreColor = (score) => {
  if (score >= 8) return '#67c23a'
  if (score >= 6) return '#409eff'
  if (score >= 4) return '#e6a23c'
  return '#f56c6c'
}

const getScoreLevel = (score) => {
  if (score >= 8) return '优秀'
  if (score >= 6) return '良好'
  if (score >= 4) return '一般'
  return '较差'
}

const getStatusIcon = (status) => {
  if (status === 'completed') return '✓'
  if (status === 'failed') return '✗'
  if (status === 'loading') return '⟳'
  return '○'
}

const handleStartEvaluation = async (data) => {
  if (data) {
    productContent.value = data.productContent || ''
    enableSplit.value = data.enableSplit || false
    splitMode.value = data.splitMode || 'keyword'
    splitChunks.value = data.splitChunks || {}
    splitStats.value = data.splitStats || null
  }
  
  if (!productContent.value.trim()) {
    ElMessage.warning('请输入产品概念内容')
    return
  }

  const llmConfigs = getLLMConfigs()
  if (llmConfigs.length === 0) {
    ElMessage.warning('请先配置LLM')
    return
  }

  const agentConfigs = getAgentConfigs().filter(a => a.enabled !== false && a.llmId)
  if (agentConfigs.length === 0) {
    ElMessage.warning('没有可用的Agent配置，请先配置Agent并绑定LLM')
    return
  }

  evaluationResults.value = []
  overallScore.value = 0
  agentStatus.value.forEach(a => a.status = 'pending')

  isEvaluating.value = true
  isSplitting.value = true
  abortController.value = new AbortController()

  const totalAgentCount = agentConfigs.length
  let textChunks = null
  
  if (enableSplit.value) {
    if (splitMode.value === 'keyword') {
      textChunks = splitChunks.value
      splitStats.value = calculateSplitStats(productContent.value, textChunks)
      splitPreviewVisible.value = true
      evaluationProgress.value = { current: 0, total: totalAgentCount }
    } else {
      const hasExistingChunks = splitChunks.value && 
        typeof splitChunks.value === 'object' && 
        Object.keys(splitChunks.value).length > 0 &&
        Object.values(splitChunks.value).some(v => v && v.trim().length > 0)
      
      if (hasExistingChunks) {
        textChunks = splitChunks.value
        splitPreviewVisible.value = true
        evaluationProgress.value = { current: 0, total: totalAgentCount }
      } else {
        const preChunks = splitTextIntoChunks(productContent.value, 500)
        const splitChunkCount = preChunks.length
        evaluationProgress.value = { current: 0, total: splitChunkCount + totalAgentCount }
        
        try {
          textChunks = await splitTextByLLM(productContent.value, '', (current, total) => {
            evaluationProgress.value = { current, total: splitChunkCount + totalAgentCount }
          })
          splitChunks.value = textChunks
          splitStats.value = calculateSplitStats(productContent.value, textChunks)
          splitPreviewVisible.value = true
        } catch (error) {
          ElMessage.error(`分割失败: ${error.message}`)
          isEvaluating.value = false
          isSplitting.value = false
          return
        }
      }
    }
  }

  evaluationProgress.value = { current: 0, total: totalAgentCount }
  isSplitting.value = false

  agentStatus.value.forEach(a => a.status = 'pending')

  const results = []
  let totalScore = 0
  let completedCount = 0

  const evaluateAgent = async (agent) => {
    const statusItem = agentStatus.value.find(s => s.name === agent.name)
    statusItem.status = 'loading'
    
    try {
      const llmConfig = llmConfigs.find(llm => llm.id.toString() === agent.llmId)
      if (!llmConfig) {
        throw new Error('未找到对应的LLM配置')
      }

      let promptContent = productContent.value
      if (enableSplit.value && textChunks) {
        promptContent = textChunks[agent.name] || productContent.value
      }

      const fullPrompt = `${agent.prompt}\n\n【产品概念内容】\n${promptContent}`
      
      const responseText = await callLLMApi(llmConfig, fullPrompt)
      const parsed = parseEvaluationResult(responseText)
      
      statusItem.status = 'completed'
      
      return {
        agent: agent.name,
        score: parsed.score,
        analysis: parsed.analysis,
        chunkLength: promptContent.length
      }
      
    } catch (error) {
      console.error(`Agent ${agent.name} 评估失败:`, error)
      statusItem.status = 'failed'
      return {
        agent: agent.name,
        score: 0,
        analysis: `评估失败: ${error.message}`,
        chunkLength: 0
      }
    }
  }

  let agentIndex = 0

  const processNext = async () => {
    if (agentIndex >= agentConfigs.length) return

    const currentIndex = agentIndex++
    const agent = agentConfigs[currentIndex]

    const result = await evaluateAgent(agent)
    results.push(result)
    
    if (result.score > 0) {
      totalScore += result.score
      completedCount++
    }
    
    evaluationProgress.value.current = results.length
    overallScore.value = completedCount > 0 ? (totalScore / completedCount).toFixed(1) : 0
    evaluationResults.value = [...results]

    if (agentIndex < agentConfigs.length) {
      processNext()
    }
  }

  const promises = []
  for (let i = 0; i < Math.min(EVAL_CONCURRENCY, agentConfigs.length); i++) {
    promises.push(processNext())
  }

  await Promise.all(promises)

  if (results.length < agentConfigs.length) {
    console.warn(`评估未完成: 已完成 ${results.length}/${agentConfigs.length}`)
  }

  isEvaluating.value = false
  
  const savedAgentConfigs = getAgentConfigs().map(a => ({
    id: a.id,
    name: a.name,
    prompt: a.prompt,
    llmId: a.llmId,
    enabled: a.enabled
  }))
  
  const sanitizeData = (data) => {
    if (data === null || data === undefined) {
      return null
    }
    if (typeof data === 'function') {
      return undefined
    }
    if (typeof data === 'string' || typeof data === 'number' || typeof data === 'boolean') {
      return data
    }
    if (Array.isArray(data)) {
      return data.map(item => sanitizeData(item)).filter(item => item !== undefined)
    }
    if (typeof data === 'object') {
      const result = {}
      for (const key in data) {
        const value = sanitizeData(data[key])
        if (value !== undefined) {
          result[key] = value
        }
      }
      return result
    }
    return undefined
  }
  
  const allAgentNames = ['研发总监', 'IP专家', '技术专家', '研发工程师', '商业规划师', '客户代表', '市场分析师', '风险经理']
  const existingResults = evaluationResults.value
  const completedAgents = new Set(existingResults.map(r => r.agent))
  const completeResults = allAgentNames.map(name => {
    const existing = existingResults.find(r => r.agent === name)
    if (existing) {
      return existing
    }
    return {
      agent: name,
      score: 0,
      analysis: '未评估',
      chunkLength: 0
    }
  })
  
  const saveData = sanitizeData({
    productContent: productContent.value,
    enableSplit: enableSplit.value,
    splitMode: splitMode.value,
    splitChunks: splitChunks.value,
    splitStats: splitStats.value,
    agentConfigs: savedAgentConfigs,
    evaluationResults: completeResults,
    overallScore: overallScore.value,
    timestamp: Date.now()
  })
  
  try {
    await saveEvaluation(saveData)
    await loadEvaluationHistory()
    console.log('评估结果已保存到IndexedDB')
  } catch (error) {
    console.error('保存评估结果失败:', error)
  }
  
  ElMessage.success('评估完成')
}

const handleStopEvaluation = () => {
  if (abortController.value) {
    abortController.value.abort()
  }
  isEvaluating.value = false
  isSplitting.value = false
}

const handleCopyResult = async (result) => {
  const text = `【${result.agent}】评分：${result.score}/10\n\n${result.analysis}`
  try {
    await navigator.clipboard.writeText(text)
    ElMessage.success('复制成功')
  } catch {
    ElMessage.error('复制失败')
  }
}

const handleCopyAllResults = async () => {
  let text = `整体评分：${overallScore.value}/10\n\n`
  evaluationResults.value.forEach(result => {
    text += `【${result.agent}】评分：${result.score}/10\n${result.analysis}\n\n`
  })
  try {
    await navigator.clipboard.writeText(text)
    ElMessage.success('全部结果已复制')
  } catch {
    ElMessage.error('复制失败')
  }
}

const handleExportResults = () => {
  let text = `评估报告\n日期：${new Date().toLocaleString()}\n整体评分：${overallScore.value}/10\n\n`
  
  evaluationResults.value.forEach(result => {
    text += `【${result.agent}】评分：${result.score}/10`
    if (enableSplit.value) {
      text += ` (文本块长度: ${result.chunkLength}字符)`
    }
    text += `\n${result.analysis}\n\n`
  })
  
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `评估报告_${new Date().toISOString().slice(0,10)}.txt`
  a.click()
  URL.revokeObjectURL(url)
  ElMessage.success('导出成功')
}

defineExpose({
  handleStartEvaluation,
  loadFromHistory
})
</script>

<template>
  <div class="evaluation-results">
    <div class="results-layout">
      <div class="results-main">
        <el-card class="progress-section">
          <template #header>
            <span class="section-title">评估进度：</span>
          </template>
          <div class="progress-info" v-if="(isEvaluating || isSplitting) && totalProgress.total > 0">
            <el-progress 
              :percentage="Math.round((totalProgress.current / totalProgress.total) * 100)"
              :status="totalProgress.current === totalProgress.total ? 'success' : ''"
              :stroke-width="12"
              style="width: 300px;"
            />
            <span class="progress-text">{{ totalProgress.current }} / {{ totalProgress.total }}</span>
          </div>
          <div class="status-list">
            <el-tag
              v-for="agent in agentStatus"
              :key="agent.name"
              :type="agent.status === 'completed' ? 'success' : agent.status === 'failed' ? 'danger' : agent.status === 'loading' ? 'warning' : 'info'"
              class="status-tag"
            >
              {{ getStatusIcon(agent.status) }} {{ agent.name }}
            </el-tag>
          </div>
        </el-card>
        
        <el-card class="result-section" v-if="evaluationResults.length > 0">
          <template #header>
            <span class="section-title">评估结果汇总：</span>
          </template>
          <div class="result-header">
            <div class="overall-result">
              <span class="score-label">整体评分：</span>
              <span class="score-value" :style="{ color: getScoreColor(overallScore) }">
                {{ overallScore }}/10
              </span>
              <el-tag :color="getScoreColor(overallScore)" effect="dark">{{ getScoreLevel(overallScore) }}</el-tag>
              <el-tag v-if="enableSplit" type="info">已分割</el-tag>
            </div>
            <div class="result-actions">
              <el-button size="small" @click="handleCopyAllResults">复制全部</el-button>
              <el-button size="small" type="primary" @click="handleExportResults">导出报告</el-button>
            </div>
          </div>
        </el-card>

        <el-card class="detail-section" v-if="evaluationResults.length > 0">
          <template #header>
            <span class="section-title">各Agent详细结果：</span>
          </template>
          <el-collapse>
            <el-collapse-item
              v-for="(result, index) in evaluationResults"
              :key="index"
              :name="index"
            >
              <template #title>
                <div class="result-item-title">
                  <span>{{ result.agent }}</span>
                  <el-tag :color="getScoreColor(result.score)" effect="dark" size="small">
                    {{ result.score }}/10
                  </el-tag>
                  <el-tag v-if="enableSplit && result.chunkLength" size="small" type="info">
                    {{ result.chunkLength }}字符
                  </el-tag>
                </div>
              </template>
              <div class="result-content">
                <div class="result-actions">
                  <el-button size="small" @click="handleCopyResult(result)">复制</el-button>
                </div>
                <p><strong>评分：</strong><span :style="{ color: getScoreColor(result.score) }">{{ result.score }}/10 ({{ getScoreLevel(result.score) }})</span></p>
                <p><strong>评估分析：</strong></p>
                <div class="analysis-text">{{ result.analysis }}</div>
              </div>
            </el-collapse-item>
          </el-collapse>
        </el-card>
        
        <el-empty v-if="evaluationResults.length === 0" description="暂无评估结果，请先执行评估" />
      </div>
      
      <div class="results-sidebar">
        <el-card class="history-section">
          <template #header>
            <span class="section-title">历史评估记录</span>
          </template>
          <div class="history-list">
            <div 
              v-if="isEvaluatingOrSplitting"
              class="history-item current-evaluation"
              :class="{ active: selectedHistory && selectedHistory.isCurrent }"
              @click="selectCurrentEvaluation"
            >
              <div class="history-score" style="color: #409eff;">
                评估中
              </div>
              <div class="history-meta">
                <el-progress 
                  :percentage="Math.round((totalProgress.current / totalProgress.total) * 100)"
                  :stroke-width="4"
                  style="width: 100%;"
                />
                <div class="history-date">{{ totalProgress.current }} / {{ totalProgress.total }}</div>
              </div>
            </div>
            
            <div 
              v-for="item in evaluationHistory" 
              :key="item.id"
              class="history-item"
              :class="{ active: selectedHistory && selectedHistory.id === item.id && !selectedHistory.isCurrent }"
              @click="selectHistory(item)"
            >
              <div class="history-score" :style="(selectedHistory && selectedHistory.id === item.id && !selectedHistory.isCurrent) ? {} : { color: getScoreColor(item.overallScore) }">
                {{ item.overallScore }}/10
              </div>
              <div class="history-meta">
                <div class="history-date">{{ formatDate(item.timestamp) }}</div>
                <div class="history-agents">{{ item.agentCount }}个Agent</div>
              </div>
              <el-button 
                class="history-delete-btn" 
                type="danger" 
                size="small" 
                circle 
                @click="handleDeleteHistory(item, $event)"
              >
                <el-icon><Delete /></el-icon>
              </el-button>
            </div>
          </div>
          <el-empty v-if="evaluationHistory.length === 0 && !isEvaluatingOrSplitting" description="暂无历史记录" :image-size="60" />
        </el-card>
      </div>
    </div>
    
    <el-button class="history-btn-mobile" type="primary" circle @click="historyDrawerVisible = true">
      <el-icon><Clock /></el-icon>
    </el-button>
    
    <el-drawer v-model="historyDrawerVisible" title="历史评估记录" direction="rtl" size="80%">
      <div class="history-list-mobile">
        <div 
          v-if="isEvaluatingOrSplitting"
          class="history-item current-evaluation"
          :class="{ active: selectedHistory && selectedHistory.isCurrent }"
          @click="selectCurrentEvaluation(); historyDrawerVisible = false"
        >
          <div class="history-score" style="color: #409eff;">
            评估中
          </div>
          <div class="history-meta">
            <el-progress 
              :percentage="Math.round((totalProgress.current / totalProgress.total) * 100)"
              :stroke-width="4"
              style="width: 100%;"
            />
            <div class="history-date">{{ totalProgress.current }} / {{ totalProgress.total }}</div>
          </div>
        </div>
        
        <div 
          v-for="item in evaluationHistory" 
          :key="item.id"
          class="history-item"
          :class="{ active: selectedHistory && selectedHistory.id === item.id && !selectedHistory.isCurrent }"
          @click="selectHistory(item); historyDrawerVisible = false"
        >
          <div class="history-score" :style="(selectedHistory && selectedHistory.id === item.id && !selectedHistory.isCurrent) ? {} : { color: getScoreColor(item.overallScore) }">
            {{ item.overallScore }}/10
          </div>
          <div class="history-meta">
            <div class="history-date">{{ formatDate(item.timestamp) }}</div>
            <div class="history-agents">{{ item.agentCount }}个Agent</div>
          </div>
          <el-button 
            class="history-delete-btn" 
            type="danger" 
            size="small" 
            circle 
            @click="handleDeleteHistory(item, $event)"
          >
            <el-icon><Delete /></el-icon>
          </el-button>
        </div>
        <el-empty v-if="evaluationHistory.length === 0" description="暂无历史记录" />
      </div>
    </el-drawer>
  </div>
</template>

<style scoped>
.evaluation-results {
  padding: 16px 0;
}

.evaluation-results :deep(.el-card) {
  margin-bottom: 10px;
}

.results-layout {
  display: flex;
  gap: 16px;
}

.results-main {
  flex: 1;
  min-width: 0;
}

.results-sidebar {
  width: 280px;
  flex-shrink: 0;
}

.history-section {
  position: sticky;
  top: 16px;
}

.history-btn-mobile {
  display: none;
  position: fixed;
  right: 16px;
  bottom: 80px;
  z-index: 100;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

@media (max-width: 768px) {
  .results-layout {
    flex-direction: column;
  }
  
  .results-sidebar {
    display: none;
  }
  
  .history-btn-mobile {
    display: block;
  }
  
  .results-main {
    width: 100%;
  }
  
  .history-list-mobile {
    padding: 8px;
  }
  
  .history-list-mobile .history-item {
    margin-bottom: 12px;
  }
  
  .history-list-mobile .history-delete-btn {
    opacity: 1;
  }
}

.history-item.current-evaluation {
  border-left: 3px solid #409eff;
  background: #ecf5ff;
}

.history-item.current-evaluation.active {
  background: #409eff;
}

.history-item.current-evaluation .history-score {
  font-size: 16px;
}

.history-list {
  max-height: calc(100vh - 400px);
  overflow-y: auto;
}

.history-item {
  padding: 12px;
  border-radius: 4px;
  cursor: pointer;
  margin-bottom: 8px;
  background: #f5f7fa;
  transition: all 0.2s;
  position: relative;
}

.history-item:hover {
  background: #ecf5ff;
}

.history-item.active {
  background: #409eff;
  color: white;
}

.history-delete-btn {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  opacity: 0;
  transition: opacity 0.2s;
}

.history-item:hover .history-delete-btn {
  opacity: 1;
}

.history-item.active .history-delete-btn {
  opacity: 1;
}

.history-item.active .history-score {
  color: white;
}

.history-item.active .history-meta {
  color: rgba(255, 255, 255, 0.8);
}

.history-score {
  font-size: 24px;
  font-weight: 600;
  margin-bottom: 4px;
}

.history-meta {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: #909399;
}

.section-title {
  font-weight: 600;
  color: #303133;
}

.progress-info {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 16px;
}

.progress-text {
  font-size: 14px;
  color: #606266;
}

.status-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.status-tag {
  padding: 8px 12px;
}

.overall-result {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.result-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
}

.result-actions {
  display: flex;
  gap: 8px;
}

.result-item-title {
  display: flex;
  align-items: center;
  gap: 8px;
}

.result-content {
  padding: 12px;
}

.analysis-text {
  white-space: pre-wrap;
  word-break: break-word;
  line-height: 1.6;
}
</style>
