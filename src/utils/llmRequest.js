import axios from 'axios'

export async function callLLMApi(llmConfig, prompt) {
  const requestConfig = {
    baseURL: llmConfig.baseUrl,
    headers: {
      'Content-Type': 'application/json'
    },
    timeout: 60000
  }

  let endpoint = '/chat/completions'
  let requestBody = {
    model: llmConfig.model,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.3,
    max_tokens: 3000
  }

  if (llmConfig.baseUrl.includes('openai') || llmConfig.baseUrl.includes('ai.xiaojing')) {
    requestConfig.headers['Authorization'] = `Bearer ${llmConfig.apiKey}`
  } else if (llmConfig.baseUrl.includes('zhipu') || llmConfig.baseUrl.includes('bigmodel')) {
    requestConfig.headers['Authorization'] = `Bearer ${llmConfig.apiKey}`
  } else if (llmConfig.baseUrl.includes('anthropic')) {
    requestConfig.headers['x-api-key'] = llmConfig.apiKey
    requestConfig.headers['anthropic-version'] = '2023-06-01'
    endpoint = '/messages'
    requestBody = {
      model: llmConfig.model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 3000
    }
  } else if (llmConfig.baseUrl.includes('moonshot')) {
    requestConfig.headers['Authorization'] = `Bearer ${llmConfig.apiKey}`
  } else if (llmConfig.baseUrl.includes('deepseek')) {
    requestConfig.headers['Authorization'] = `Bearer ${llmConfig.apiKey}`
  } else if (llmConfig.baseUrl.includes('minimax') || llmConfig.baseUrl.includes('minimaxi')) {
    requestConfig.headers['Authorization'] = `Bearer ${llmConfig.apiKey}`
    endpoint = '/v1/text/chatcompletion_v2'
    requestBody = {
      model: llmConfig.model,
      messages: [
        { role: 'system', name: 'MiniMax AI' },
        { role: 'user', content: prompt, name: '用户' }
      ],
      temperature: 0.3,
      max_tokens: 3000
    }
  }

  try {
    const response = await axios.post(endpoint, requestBody, requestConfig)
    
    if (llmConfig.baseUrl.includes('anthropic')) {
      return response.data.content[0].text
    }
    
    if (llmConfig.baseUrl.includes('minimax') || llmConfig.baseUrl.includes('minimaxi')) {
      return response.data.choices[0].message.content
    }
    
    return response.data.choices[0].message.content
  } catch (error) {
    console.error('LLM API调用失败:', error)
    throw new Error(error.response?.data?.error?.message || error.message || 'LLM API调用失败')
  }
}

export function parseEvaluationResult(text) {
  const scoreMatch = text.match(/评分[：:]\s*(\d+(?:\.\d+)?)\s*\/?\s*10/)
  const score = scoreMatch ? parseFloat(scoreMatch[1]) : null
  
  let analysis = text
  if (scoreMatch) {
    analysis = text.replace(scoreMatch[0], '').trim()
  }
  
  return {
    score: score || 0,
    analysis: analysis
  }
}
