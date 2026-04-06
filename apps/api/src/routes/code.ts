// Code 路由
import { Router } from 'express'
import {
  getFileList,
  getFileContent,
  updateFile,
  deleteFile,
  searchFiles,
  getRecentFiles,
} from '../controllers/code.js'

const router = Router()

router.get('/files', getFileList)
router.get('/files/*', getFileContent)
router.put('/files/*', updateFile)
router.delete('/files/*', deleteFile)
router.get('/search', searchFiles)
router.get('/recent', getRecentFiles)

export default router
