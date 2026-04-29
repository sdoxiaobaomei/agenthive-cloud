#!/usr/bin/env node
/**
 * Agent Task Consumer Entry Point
 * 独立进程启动：pnpm consumer
 */
import dotenv from 'dotenv'
dotenv.config({ path: '.env' })
import '../telemetry.js'
import { TaskConsumer } from '../services/TaskConsumer.js'
import { testRedisConnection } from '../config/redis.js'
import logger from '../utils/logger.js'

async function main() {
  const redisConnected = await testRedisConnection()
  if (!redisConnected) {
    logger.error('[TaskConsumer] Redis connection failed. Exiting.')
    process.exit(1)
  }

  const consumer = new TaskConsumer()

  process.on('SIGTERM', async () => {
    logger.info('[TaskConsumer] Received SIGTERM, shutting down...')
    await consumer.stop()
    process.exit(0)
  })

  process.on('SIGINT', async () => {
    logger.info('[TaskConsumer] Received SIGINT, shutting down...')
    await consumer.stop()
    process.exit(0)
  })

  await consumer.start()
}

main().catch((error) => {
  logger.error('[TaskConsumer] Fatal error', error)
  process.exit(1)
})
