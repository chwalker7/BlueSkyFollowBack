import { parentPort } from 'worker_threads'
import { BlueskyClient } from '../lib/bluesky-client'
import * as dotenv from 'dotenv'

dotenv.config()

async function monitorFollowers() {
  const client = new BlueskyClient()
  let paused = false
  const checkInterval = 5 * 60 * 1000 // Check every 5 minutes

  // Handle pause/resume signals from main thread
  parentPort?.on('message', (message) => {
    if (message.type === 'pause') {
      paused = true
      console.log('🔷 Follower monitor paused')
    } else if (message.type === 'resume') {
      paused = false
      console.log('🔷 Follower monitor resumed')
    }
  })

  // Login using credentials from parent
  parentPort?.once('message', async (credentials) => {
    if (credentials.type === 'credentials') {
      try {
        await client.login(credentials.username, credentials.password)
        
        // Initialize follower list
        await client.initializeFollowerList()
        
        while (true) {
          if (!paused) {
            try {
              // Check for new followers
              const newFollowers = await client.checkNewFollowers()
              
              // Auto-follow any new followers
              for (const follower of newFollowers) {
                try {
                  const success = await client.followUser(follower.handle)
                  parentPort?.postMessage({
                    type: 'follow_result',
                    handle: follower.handle,
                    success
                  })
                  
                  // Add delay between follows to avoid rate limits
                  await new Promise(resolve => setTimeout(resolve, 2000))
                } catch (error) {
                  parentPort?.postMessage({
                    type: 'error',
                    error: error instanceof Error ? error.message : 'Unknown error following user',
                    handle: follower.handle
                  })
                }
              }
            } catch (error) {
              parentPort?.postMessage({
                type: 'error',
                error: error instanceof Error ? error.message : 'Unknown error checking followers'
              })
              
              // If we hit an error, pause briefly before next check
              await new Promise(resolve => setTimeout(resolve, 30000))
            }
          }
          
          // Wait before next check
          await new Promise(resolve => setTimeout(resolve, checkInterval))
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

monitorFollowers()
