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

async function main() {
  const redisConnected = await testRedisConnection()
  if (!redisConnected) {
    console.error('[TaskConsumer] Redis connection failed. Exiting.')
    process.exit(1)
  }

  const consumer = new TaskConsumer()

  process.on('SIGTERM', async () => {
    console.log('[TaskConsumer] Received SIGTERM, shutting down...')
    await consumer.stop()
    process.exit(0)
  })

  process.on('SIGINT', async () => {
    console.log('[TaskConsumer] Received SIGINT, shutting down...')
    await consumer.stop()
    process.exit(0)
  })

  await consumer.start()
}

main().catch((error) => {
  console.error('[TaskConsumer] Fatal error:', error)
  process.exit(1)
})
