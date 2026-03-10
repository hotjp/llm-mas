import { callLLMApi } from './llmRequest'
import { getLLMConfigs } from './storage'
import { AGENT_NAMES } from './textSplitter'

const CHUNK_SIZE = 500

const LLM_SPLIT_SYSTEM_PROMPT = `你是一个文本分割专家。你的任务是将用户提供的产品描述文本分割成多个部分，每个部分分配给一个专业的评估角色。

评估角色及其职责：
1. 研发总监 - 评估技术可行性和资源需求
2. IP专家 - 评估知识产权和法律合规
3. 技术专家 - 评估技术成熟度和壁垒
4. 研发工程师 - 评估实现复杂度和开发周期
5. 商业规划师 - 评估商业模式和盈利潜力
6. 客户代表 - 评估用户需求和体验
7. 市场分析师 - 评估市场潜力和机会
8. 风险经理 - 评估市场风险和运营风险

请严格按照以下JSON格式输出，不要添加任何其他内容：
{
  "研发总监": "分配给研发总监的文本内容",
  "IP专家": "分配给IP专家的文本内容",
  "技术专家": "分配给技术专家的文本内容",
  "研发工程师": "分配给研发工程师的文本内容",
  "商业规划师": "分配给商业规划师的文本内容",
  "客户代表": "分配给客户代表的文本内容",
  "市场分析师": "分配给市场分析师的文本内容",
  "风险经理": "分配给风险经理的文本内容"
}

要求：
1. 每个角色的文本应该只包含与其职责相关的内容
2. 文本要保持完整性，不要截断句子
3. 如果某些内容不适合某个角色，该角色的文本可以为空字符串
4. 输出必须是有效的JSON格式`

export function splitTextIntoChunks(text, chunkSize) {
  const paragraphs = text.split(/\n+/).filter(p => p.trim())
  const chunks = []
  let currentChunk = ''
  
  for (const para of paragraphs) {
    if (currentChunk.length + para.length > chunkSize && currentChunk.length > 0) {
      chunks.push(currentChunk)
      currentChunk = para
    } else {
      currentChunk += (currentChunk ? '\n\n' : '') + para
    }
  }
  
  if (currentChunk) {
    chunks.push(currentChunk)
  }
  
  return chunks
}

const CONCURRENCY = 5

async function processChunksWithConcurrency(textChunks, targetLlm, onProgress) {
  const mergedChunks = {}
  for (const agent of AGENT_NAMES) {
    mergedChunks[agent] = []
  }

  const totalChunks = textChunks.length
  let completedChunks = 0
  let running = 0
  let chunkIndex = 0
  let finishPromise = null
  let finishResolve = null

  const processNext = async () => {
    if (chunkIndex >= textChunks.length) {
      if (--running === 0 && finishResolve) {
        finishResolve()
      }
      return
    }

    const currentIndex = chunkIndex++
    const chunk = textChunks[currentIndex]
    const prompt = `${LLM_SPLIT_SYSTEM_PROMPT}\n\n【产品描述文本（第${currentIndex + 1}/${totalChunks}部分）】\n${chunk}`
    
    try {
      const response = await callLLMApi(targetLlm, prompt)
      const parsed = parseLLMSplitResult(response)
      
      for (const agent of AGENT_NAMES) {
        if (parsed[agent] && parsed[agent].trim()) {
          mergedChunks[agent].push(parsed[agent])
        }
      }
    } catch (error) {
      console.error(`LLM分割第${currentIndex + 1}块失败:`, error)
    }

    completedChunks++
    if (onProgress) {
      onProgress(completedChunks, totalChunks)
    }

    if (chunkIndex < textChunks.length) {
      processNext()
    } else if (--running === 0 && finishResolve) {
      finishResolve()
    }
  }

  const promises = []
  for (let i = 0; i < Math.min(CONCURRENCY, textChunks.length); i++) {
    running++
    promises.push(processNext())
  }

  finishPromise = new Promise(resolve => {
    finishResolve = resolve
  })

  await Promise.all(promises)
  await finishPromise

  const result = {}
  for (const agent of AGENT_NAMES) {
    result[agent] = mergedChunks[agent].join('\n\n')
  }

  return result
}

export async function splitTextByLLM(text, agentName, onProgress) {
  const llmConfigs = getLLMConfigs()
  
  if (llmConfigs.length === 0) {
    throw new Error('请先配置LLM')
  }

  const llmConfig = llmConfigs.find(llm => llm.id.toString() === agentName)
  const targetLlm = llmConfig || llmConfigs[0]

  const textChunks = splitTextIntoChunks(text, CHUNK_SIZE)
  
  if (textChunks.length === 1) {
    const prompt = `${LLM_SPLIT_SYSTEM_PROMPT}\n\n【产品描述文本】\n${text}`
    
    try {
      const response = await callLLMApi(targetLlm, prompt)
      const parsed = parseLLMSplitResult(response)
      return parsed
    } catch (error) {
      console.error('LLM分割失败:', error)
      throw new Error(`LLM分割失败: ${error.message}`)
    }
  }

  try {
    return await processChunksWithConcurrency(textChunks, targetLlm, onProgress)
  } catch (error) {
    console.error('LLM分割失败:', error)
    throw new Error(`LLM分割失败: ${error.message}`)
  }
}

function parseLLMSplitResult(text) {
  let jsonText = text.trim()
  
  jsonText = jsonText.replace(/^```json\s*/i, '').replace(/\s*```$/i, '')
  jsonText = jsonText.replace(/^```\s*/i, '').replace(/\s*```$/i, '')
  
  const jsonStart = jsonText.indexOf('{')
  if (jsonStart === -1) {
    console.error('LLM返回的原始内容:', text)
    throw new Error('无法解析LLM返回的JSON结果')
  }
  
  let jsonEnd = findJsonEnd(jsonText, jsonStart)
  
  if (jsonEnd === -1) {
    jsonEnd = jsonText.lastIndexOf('}')
  }
  
  if (jsonEnd < jsonStart) {
    console.error('LLM返回的原始内容:', text)
    throw new Error('无法解析LLM返回的JSON结果')
  }
  
  let jsonString = jsonText.slice(jsonStart, jsonEnd + 1)
  
  jsonString = fixTruncatedJson(jsonString)
  jsonString = fixUnescapedQuotes(jsonString)

  try {
    const result = JSON.parse(jsonString)
    
    const chunks = {}
    for (const agent of AGENT_NAMES) {
      chunks[agent] = result[agent] || ''
    }
    
    return chunks
  } catch (error) {
    console.error('JSON解析失败:', error)
    console.error('尝试解析的内容:', jsonString)
    throw new Error('LLM返回的JSON格式不正确')
  }
}

function findJsonEnd(text, start) {
  let braceCount = 0
  let inString = false
  let escape = false
  
  for (let i = start; i < text.length; i++) {
    const char = text[i]
    
    if (escape) {
      escape = false
      continue
    }
    
    if (char === '\\') {
      escape = true
      continue
    }
    
    if (char === '"') {
      inString = !inString
      continue
    }
    
    if (inString) continue
    
    if (char === '{') {
      braceCount++
    } else if (char === '}') {
      braceCount--
      if (braceCount === 0) {
        return i
      }
    }
  }
  
  return -1
}

function fixTruncatedJson(jsonString) {
  let fixed = jsonString
  
  const lastColon = fixed.lastIndexOf(':')
  const lastComma = fixed.lastIndexOf(',')
  const lastBrace = fixed.lastIndexOf('}')
  
  if (lastBrace === -1) {
    fixed += '}'
  }
  
  if (lastColon > lastBrace && lastComma > lastBrace) {
    const lastKeyMatch = fixed.match(/"([^"]+)"\s*:\s*"[^"]*$/s)
    if (lastKeyMatch) {
      fixed = fixed.slice(0, lastKeyMatch.index + lastKeyMatch[0].length) + '" }'
    }
  }
  
  let openQuotes = (fixed.match(/"[^"\\]*(?:\\.[^"\\]*)*"/g) || []).length
  if (openQuotes % 2 !== 0) {
    const lastUnclosedQuote = fixed.lastIndexOf('"')
    if (lastUnclosedQuote > fixed.lastIndexOf('}')) {
      fixed = fixed.slice(0, lastUnclosedQuote + 1) + '" }'.slice(1)
    }
  }
  
  return fixed
}

function fixUnescapedQuotes(jsonString) {
  let fixed = jsonString
  let iterations = 0
  const maxIterations = 10
  
  while (iterations < maxIterations) {
    try {
      JSON.parse(fixed)
      return fixed
    } catch (e) {
      const match = e.message.match(/position (\d+)/)
      if (!match) {
        break
      }
      
      const errorPos = parseInt(match[1])
      const beforeError = fixed.slice(0, errorPos)
      const afterError = fixed.slice(errorPos)
      
      const lastUnescapedQuote = beforeError.lastIndexOf('"')
      if (lastUnescapedQuote === -1) {
        break
      }
      
      const beforeQuote = beforeError.slice(0, lastUnescapedQuote)
      const afterQuote = beforeError.slice(lastUnescapedQuote + 1)
      
      if (afterQuote.includes(':') || afterQuote.includes(',')) {
        break
      }
      
      fixed = beforeQuote + '\\"' + afterQuote + afterError
      iterations++
    }
  }
  
  return fixed
}

export function validateLLMSplitResult(chunks) {
  if (!chunks || typeof chunks !== 'object') {
    return { valid: false, error: '结果必须是对象' }
  }

  for (const agent of AGENT_NAMES) {
    if (!(agent in chunks)) {
      return { valid: false, error: `缺少 ${agent} 的分割结果` }
    }
    if (typeof chunks[agent] !== 'string') {
      return { valid: false, error: `${agent} 的分割结果必须是字符串` }
    }
  }

  const totalChars = Object.values(chunks).reduce((sum, str) => sum + str.length, 0)
  if (totalChars === 0) {
    return { valid: false, error: '分割结果不能为空' }
  }

  return { valid: true }
}
