// HTTP Client - 已禁用，使用 LocalStorage 替代
// 保留此文件以兼容现有代码

export const http = {
  get: async <T>(_url: string, _config?: unknown): Promise<T> => {
    throw new Error('HTTP client disabled. Use localStorageApi instead.')
  },
  post: async <T>(_url: string, _data?: unknown, _config?: unknown): Promise<T> => {
    throw new Error('HTTP client disabled. Use localStorageApi instead.')
  },
  put: async <T>(_url: string, _data?: unknown, _config?: unknown): Promise<T> => {
    throw new Error('HTTP client disabled. Use localStorageApi instead.')
  },
  patch: async <T>(_url: string, _data?: unknown, _config?: unknown): Promise<T> => {
    throw new Error('HTTP client disabled. Use localStorageApi instead.')
  },
  delete: async <T>(_url: string, _config?: unknown): Promise<T> => {
    throw new Error('HTTP client disabled. Use localStorageApi instead.')
  },
}

export default http
