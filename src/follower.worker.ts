import { parentPort, workerData } from 'worker_threads'
import { BskyAgent } from '@atproto/api'
import * as dotenv from 'dotenv'

dotenv.config()

interface FollowTask {
  did: string
  handle: string
}

async function followUsers() {
  const agent = new BskyAgent({
    service: 'https://bsky.social'
  })

  let paused = false
  let followInterval = 2000 // Start with 2 second interval
  const minInterval = 1000
  const maxInterval = 10000
  let consecutiveSuccesses = 0
  let consecutiveFailures = 0

  // Handle pause/resume signals from main thread
  parentPort?.on('message', (message) => {
    if (message.type === 'pause') {
      paused = true
      console.log('Worker paused due to rate limit')
    } else if (message.type === 'resume') {
      paused = false
      console.log('Worker resumed')
    }
  })

  // Login using credentials from parent
  parentPort?.once('message', async (credentials) => {
    if (credentials.type === 'credentials') {
      try {
        await agent.login(credentials)
        
        while (true) {
          // Wait if paused
          while (paused) {
            await new Promise(resolve => setTimeout(resolve, 1000))
          }
          
          // Get next task from parent
          parentPort?.postMessage({ type: 'ready' })
          
          const task: FollowTask = await new Promise((resolve) => {
            parentPort?.once('message', (message) => {
              if (message.type === 'task') resolve(message.task)
            })
          })
          
          try {
            // Wait based on dynamic timing
            await new Promise(resolve => setTimeout(resolve, followInterval))
            
            // Attempt follow
            await agent.follow(task.did)
            consecutiveSuccesses++
            consecutiveFailures = 0
            
            // Adjust timing on success
            if (consecutiveSuccesses >= 5) {
              followInterval = Math.max(minInterval, followInterval * 0.8)
              consecutiveSuccesses = 0
            }
            
            parentPort?.postMessage({
              type: 'result',
              success: true,
              handle: task.handle
            })
            
          } catch (err) {
            consecutiveFailures++
            consecutiveSuccesses = 0
            
            // Exponential backoff on failure
            followInterval = Math.min(maxInterval, followInterval * (1 + (consecutiveFailures * 0.5)))
            
            const isRateLimit = err instanceof Error && err.message.includes('Rate Limit')
            const alreadyFollowing = err instanceof Error && err.message.includes('already following')
            
            parentPort?.postMessage({
              type: 'result',
              success: alreadyFollowing,
              error: err instanceof Error ? err.message : 'Unknown error',
              isRateLimit,
              handle: task.handle
            })
          }
        }
      } catch (err) {
        parentPort?.postMessage({
          type: 'error',
          error: err instanceof Error ? err.message : 'Failed to login'
        })
      }
    }
  })
}

followUsers()
