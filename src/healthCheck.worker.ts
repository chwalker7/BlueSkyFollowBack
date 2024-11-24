import { parentPort } from 'worker_threads'
import { BskyAgent } from '@atproto/api'
import * as dotenv from 'dotenv'

dotenv.config()

const HEALTH_CHECK_INTERVAL = 2000 // Check every 2 seconds

async function monitorApiHealth() {
  const agent = new BskyAgent({
    service: 'https://bsky.social'
  })

  // Login using credentials from parent thread
  parentPort?.once('message', async (credentials) => {
    try {
      await agent.login(credentials)
      
      while (true) {
        try {
          // Perform lightweight health check
          const response = await agent.getProfile({ actor: agent.session?.did || '' })
          const headers = response.headers as Record<string, string>
          
          const status = {
            healthy: true,
            remaining: parseInt(headers['x-ratelimit-remaining'] || '0'),
            reset: parseInt(headers['x-ratelimit-reset'] || '0'),
            timestamp: Date.now()
          }
          
          parentPort?.postMessage(status)
        } catch (err) {
          const isRateLimit = err instanceof Error && err.message.includes('Rate Limit')
          
          parentPort?.postMessage({
            healthy: false,
            isRateLimit,
            error: err instanceof Error ? err.message : 'Unknown error',
            timestamp: Date.now()
          })
        }
        
        // Wait before next check
        await new Promise(resolve => setTimeout(resolve, HEALTH_CHECK_INTERVAL))
      }
    } catch (err) {
      parentPort?.postMessage({
        healthy: false,
        error: err instanceof Error ? err.message : 'Failed to login',
        timestamp: Date.now()
      })
    }
  })
}

monitorApiHealth()
