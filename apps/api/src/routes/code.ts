// Code 路由
import { Router } from 'express'
import {
  getFileList,
  getFileContent,
  updateFile,
  deleteFile,
  searchFiles,
  getRecentFiles,
  getWorkspaceFiles,
  getWorkspaceFileContent,
  saveWorkspaceFile,
  deleteWorkspaceFile,
} from '../controllers/code.js'

const router = Router()

// 原有端点（基于数据库）
router.get('/files', getFileList)
router.get('/files/*', getFileContent)
router.put('/files/*', updateFile)
router.delete('/files/*', deleteFile)
router.get('/search', searchFiles)
router.get('/recent', getRecentFiles)

// 新增：工作区文件操作（基于文件系统）
router.get('/workspace/files', getWorkspaceFiles)
router.get('/workspace/files/content', getWorkspaceFileContent)
router.post('/workspace/files/save', saveWorkspaceFile)
router.delete('/workspace/files', deleteWorkspaceFile)

export default router
