const DB_NAME = 'llm-mas'
const DB_VERSION = 1
const STORE_NAME = 'evaluations'

let db = null

export function initDB() {
  return new Promise((resolve, reject) => {
    if (db) {
      resolve(db)
      return
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => {
      console.error('IndexedDB open error:', request.error)
      reject(request.error)
    }

    request.onsuccess = () => {
      db = request.result
      resolve(db)
    }

    request.onupgradeneeded = (event) => {
      const database = event.target.result
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true })
        store.createIndex('timestamp', 'timestamp', { unique: false })
      }
    }
  })
}

export async function saveEvaluation(evaluationData) {
  const database = await initDB()
  
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_NAME], 'readwrite')
    const store = transaction.objectStore(STORE_NAME)
    
    const data = {
      ...evaluationData,
      timestamp: Date.now()
    }
    
    const request = store.add(data)
    
    request.onsuccess = () => {
      resolve(request.result)
    }
    
    request.onerror = () => {
      reject(request.error)
    }
  })
}

export async function getLatestEvaluation() {
  const database = await initDB()
  
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_NAME], 'readonly')
    const store = transaction.objectStore(STORE_NAME)
    const index = store.index('timestamp')
    
    const request = index.openCursor(null, 'prev')
    
    let result = null
    request.onsuccess = (event) => {
      const cursor = event.target.result
      if (cursor) {
        result = cursor.primaryKey
      }
    }
    
    transaction.oncomplete = () => {
      if (result) {
        const getTransaction = database.transaction([STORE_NAME], 'readonly')
        const getStore = getTransaction.objectStore(STORE_NAME)
        const getRequest = getStore.get(result)
        
        getRequest.onsuccess = () => {
          resolve(getRequest.result)
        }
        
        getRequest.onerror = () => {
          reject(getRequest.error)
        }
      } else {
        resolve(null)
      }
    }
  })
}

export async function getAllEvaluations() {
  const database = await initDB()
  
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_NAME], 'readonly')
    const store = transaction.objectStore(STORE_NAME)
    
    const request = store.openCursor(null, 'prev')
    
    const results = []
    request.onsuccess = (event) => {
      const cursor = event.target.result
      if (cursor) {
        results.push({ ...cursor.value, id: cursor.primaryKey })
        cursor.continue()
      }
    }
    
    transaction.oncomplete = () => {
      resolve(results)
    }
    
    transaction.onerror = () => {
      reject(transaction.error)
    }
  })
}

export async function deleteEvaluation(id) {
  const database = await initDB()
  
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_NAME], 'readwrite')
    const store = transaction.objectStore(STORE_NAME)
    
    const request = store.delete(id)
    
    request.onsuccess = () => {
      setTimeout(() => resolve(), 100)
    }
    
    request.onerror = () => {
      reject(request.error)
    }
  })
}
