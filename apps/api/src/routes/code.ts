// Code 路由
import { Router } from 'express'
import {
  getWorkspaceFiles,
  getWorkspaceFileContent,
  saveWorkspaceFile,
  deleteWorkspaceFile,
  mkdirWorkspace,
  renameWorkspace,
  moveWorkspace,
  uploadWorkspaceFiles,
  downloadWorkspaceFile,
  batchDeleteWorkspaceFiles,
  batchMoveWorkspaceFiles,
  searchWorkspaceFiles,
  getWorkspaceGitStatus,
  upload,
} from '../controllers/code.js'

const router = Router()

// 工作区文件操作（基于文件系统）
router.get('/workspace/files', getWorkspaceFiles)
router.get('/workspace/files/content', getWorkspaceFileContent)
router.post('/workspace/files/save', saveWorkspaceFile)
router.delete('/workspace/files', deleteWorkspaceFile)

// FEAT-002a: 目录操作与文件上传下载
router.post('/workspace/files/mkdir', mkdirWorkspace)
router.post('/workspace/files/rename', renameWorkspace)
router.post('/workspace/files/move', moveWorkspace)
router.post('/workspace/files/upload', upload.array('files', 5), uploadWorkspaceFiles)
router.get('/workspace/files/download', downloadWorkspaceFile)

// FEAT-002b: 批量操作与搜索
router.post('/workspace/files/batch-delete', batchDeleteWorkspaceFiles)
router.post('/workspace/files/batch-move', batchMoveWorkspaceFiles)
router.get('/workspace/files/search', searchWorkspaceFiles)

// FEAT-002c: Git 状态查询
router.get('/workspace/git-status', getWorkspaceGitStatus)

export default router
