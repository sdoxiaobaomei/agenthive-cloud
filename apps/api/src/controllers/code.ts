// Code 控制器
import type { Request, Response } from 'express'
import { codeDb, delay } from '../utils/database.js'

/**
 * 获取文件列表
 * GET /api/code/files
 */
export const getFileList = async (req: Request, res: Response) => {
  try {
    await delay(300)
    
    const { path = '/' } = req.query
    
    const files = codeDb.findAll()
    
    res.json({
      success: true,
      data: {
        files,
        total: files.length,
        path: path as string,
      },
    })
  } catch (error) {
    console.error('Get file list error:', error)
    res.status(500).json({
      success: false,
      error: '获取文件列表失败',
    })
  }
}

/**
 * 获取文件内容
 * GET /api/code/files/:path
 */
export const getFileContent = async (req: Request, res: Response) => {
  try {
    await delay(300)
    
    const filePath = '/' + req.params[0]
    
    const file = codeDb.findByPath(filePath)
    
    if (!file) {
      return res.status(404).json({
        success: false,
        error: '文件不存在',
      })
    }
    
    res.json({
      success: true,
      data: {
        path: file.path,
        content: file.content,
        language: file.language,
        lastModified: file.lastModified,
      },
    })
  } catch (error) {
    console.error('Get file content error:', error)
    res.status(500).json({
      success: false,
      error: '获取文件内容失败',
    })
  }
}

/**
 * 更新文件
 * PUT /api/code/files/:path
 */
export const updateFile = async (req: Request, res: Response) => {
  try {
    await delay(300)
    
    const filePath = '/' + req.params[0]
    const { content } = req.body
    
    if (content === undefined) {
      return res.status(400).json({
        success: false,
        error: '文件内容不能为空',
      })
    }
    
    // 检查文件是否存在
    const existingFile = codeDb.findByPath(filePath)
    
    let file
    if (existingFile) {
      file = codeDb.update(filePath, content)
    } else {
      // 创建新文件
      const fileName = filePath.split('/').pop() || 'untitled'
      const language = getLanguageFromFilename(fileName)
      file = codeDb.create({
        path: filePath,
        name: fileName,
        content,
        language,
      })
    }
    
    res.json({
      success: true,
      data: {
        path: file!.path,
        content: file!.content,
        language: file!.language,
        lastModified: file!.lastModified,
      },
    })
  } catch (error) {
    console.error('Update file error:', error)
    res.status(500).json({
      success: false,
      error: '更新文件失败',
    })
  }
}

/**
 * 删除文件
 * DELETE /api/code/files/:path
 */
export const deleteFile = async (req: Request, res: Response) => {
  try {
    await delay(300)
    
    const filePath = '/' + req.params[0]
    
    const file = codeDb.findByPath(filePath)
    if (!file) {
      return res.status(404).json({
        success: false,
        error: '文件不存在',
      })
    }
    
    codeDb.delete(filePath)
    
    res.json({
      success: true,
      message: '文件已删除',
    })
  } catch (error) {
    console.error('Delete file error:', error)
    res.status(500).json({
      success: false,
      error: '删除文件失败',
    })
  }
}

/**
 * 搜索文件
 * GET /api/code/search
 */
export const searchFiles = async (req: Request, res: Response) => {
  try {
    await delay(500) // 搜索稍微慢一点
    
    const { query } = req.query
    
    if (!query) {
      return res.status(400).json({
        success: false,
        error: '搜索关键词不能为空',
      })
    }
    
    const files = codeDb.search(query as string)
    
    res.json({
      success: true,
      data: {
        files,
        total: files.length,
        query: query as string,
      },
    })
  } catch (error) {
    console.error('Search files error:', error)
    res.status(500).json({
      success: false,
      error: '搜索文件失败',
    })
  }
}

/**
 * 获取最近文件
 * GET /api/code/recent
 */
export const getRecentFiles = async (req: Request, res: Response) => {
  try {
    await delay(300)
    
    const limit = parseInt(req.query.limit as string) || 10
    
    const files = codeDb.getRecent(limit)
    
    res.json({
      success: true,
      data: {
        files,
        total: files.length,
      },
    })
  } catch (error) {
    console.error('Get recent files error:', error)
    res.status(500).json({
      success: false,
      error: '获取最近文件失败',
    })
  }
}

// 辅助函数：根据文件名获取语言
function getLanguageFromFilename(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase()
  
  const languageMap: Record<string, string> = {
    'js': 'javascript',
    'ts': 'typescript',
    'jsx': 'javascript',
    'tsx': 'typescript',
    'vue': 'vue',
    'go': 'go',
    'py': 'python',
    'java': 'java',
    'rb': 'ruby',
    'php': 'php',
    'rs': 'rust',
    'cpp': 'cpp',
    'c': 'c',
    'h': 'c',
    'hpp': 'cpp',
    'cs': 'csharp',
    'swift': 'swift',
    'kt': 'kotlin',
    'scala': 'scala',
    'html': 'html',
    'css': 'css',
    'scss': 'scss',
    'less': 'less',
    'json': 'json',
    'yaml': 'yaml',
    'yml': 'yaml',
    'xml': 'xml',
    'md': 'markdown',
    'sql': 'sql',
    'sh': 'bash',
    'bash': 'bash',
    'zsh': 'bash',
    'dockerfile': 'dockerfile',
    'makefile': 'makefile',
  }
  
  return languageMap[ext || ''] || 'text'
}
