import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { codeApi } from '@/api/code'
import type { CodeFile } from '@/types'

export const useCodeStore = defineStore('code', () => {
  // State
  const files = ref<CodeFile[]>([])
  const currentFile = ref<CodeFile | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)
  const openFiles = ref<CodeFile[]>([])
  const recentFiles = ref<CodeFile[]>([])
  
  // Getters
  const fileTree = computed(() => {
    const root: CodeFile[] = []
    const map = new Map<string, CodeFile>()
    
    files.value.forEach(file => {
      const parts = file.path.split('/').filter(Boolean)
      let currentPath = ''
      
      parts.forEach((part, index) => {
        const isLast = index === parts.length - 1
        currentPath += '/' + part
        
        if (!map.has(currentPath)) {
          const node: CodeFile = {
            ...file,
            name: part,
            path: currentPath,
            isDirectory: !isLast,
          }
          map.set(currentPath, node)
          
          if (index === 0) {
            root.push(node)
          } else {
            const parentPath = currentPath.substring(0, currentPath.lastIndexOf('/'))
            const parent = map.get(parentPath)
            if (parent) {
              // 这里简化处理，实际应该维护 children 数组
            }
          }
        }
      })
    })
    
    return root
  })
  
  const getFileByPath = computed(() => (path: string) => 
    files.value.find(f => f.path === path)
  )
  
  // Actions
  const fetchFiles = async (path = '/') => {
    loading.value = true
    error.value = null
    try {
      const data = await codeApi.getFileList(path)
      files.value = data.files
      return data
    } catch (err) {
      error.value = err instanceof Error ? err.message : '获取文件列表失败'
      throw err
    } finally {
      loading.value = false
    }
  }
  
  const fetchFileContent = async (path: string) => {
    loading.value = true
    error.value = null
    try {
      const data = await codeApi.getFileContent(path)
      // 更新文件列表中的内容
      const index = files.value.findIndex(f => f.path === path)
      if (index !== -1) {
        files.value[index] = { ...files.value[index], content: data.content }
      }
      return data
    } catch (err) {
      error.value = err instanceof Error ? err.message : '获取文件内容失败'
      throw err
    } finally {
      loading.value = false
    }
  }
  
  const updateFile = async (path: string, content: string) => {
    const data = await codeApi.updateFile(path, content)
    const index = files.value.findIndex(f => f.path === path)
    if (index !== -1) {
      files.value[index] = { ...files.value[index], content: data.content, lastModified: data.lastModified }
    }
    if (currentFile.value?.path === path) {
      currentFile.value = { ...currentFile.value, content: data.content, lastModified: data.lastModified }
    }
    return data
  }
  
  const searchFiles = async (query: string) => {
    loading.value = true
    try {
      const data = await codeApi.searchFiles(query)
      return data
    } finally {
      loading.value = false
    }
  }
  
  const fetchRecentFiles = async (limit = 10) => {
    try {
      const data = await codeApi.getRecentFiles(limit)
      recentFiles.value = data.files
      return data
    } catch (err) {
      console.error('Failed to fetch recent files:', err)
    }
  }
  
  const selectFile = (file: CodeFile | null) => {
    currentFile.value = file
    if (file && !openFiles.value.find(f => f.path === file.path)) {
      openFiles.value.push(file)
      // 限制打开的文件数量
      if (openFiles.value.length > 10) {
        openFiles.value.shift()
      }
    }
  }
  
  const closeFile = (path: string) => {
    const index = openFiles.value.findIndex(f => f.path === path)
    if (index !== -1) {
      openFiles.value.splice(index, 1)
      if (currentFile.value?.path === path) {
        currentFile.value = openFiles.value.length > 0 ? openFiles.value[Math.min(index, openFiles.value.length - 1)] : null
      }
    }
  }
  
  const updateFileFromWebSocket = (file: CodeFile) => {
    const index = files.value.findIndex(f => f.path === file.path)
    if (index !== -1) {
      files.value[index] = file
    } else {
      files.value.push(file)
    }
    
    // 如果当前正在查看该文件，更新内容
    if (currentFile.value?.path === file.path) {
      currentFile.value = file
    }
    
    // 如果在打开的文件列表中，也更新
    const openIndex = openFiles.value.findIndex(f => f.path === file.path)
    if (openIndex !== -1) {
      openFiles.value[openIndex] = file
    }
  }
  
  const clearError = () => {
    error.value = null
  }
  
  return {
    // State
    files,
    currentFile,
    loading,
    error,
    openFiles,
    recentFiles,
    
    // Getters
    fileTree,
    getFileByPath,
    
    // Actions
    fetchFiles,
    fetchFileContent,
    updateFile,
    searchFiles,
    fetchRecentFiles,
    selectFile,
    closeFile,
    updateFileFromWebSocket,
    clearError,
  }
})
