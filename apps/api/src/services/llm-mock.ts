// Mock 版本的 LLM 服务，用于快速体验 K8s
// 实际项目中应该使用真实的 @agenthive/agent-runtime

import logger from '../utils/logger.js'

export class LLMService {
  async generateResponse(prompt: string): Promise<string> {
    // Mock 实现
    logger.info('Mock LLM called', { prompt });
    return `[Mock Response] You asked: ${prompt}`;
  }
}

export default new LLMService();
