import * as dotenv from 'dotenv'
import { Worker } from 'worker_threads'
import path from 'path'

dotenv.config()

async function main() {
  try {
    // Validate environment variables
    if (!process.env.BLUESKY_USERNAME || !process.env.BLUESKY_PASSWORD) {
      throw new Error('Missing required environment variables in .env file')
    }

    console.log('🔷 Starting Bluesky auto-follow service...')
    
    // Create and start the follower monitor worker
    const workerPath = path.join(__dirname, 'workers', 'follower-monitor.worker.js')
    const worker = new Worker(workerPath)

    // Send credentials to worker
    worker.postMessage({
      type: 'credentials',
      username: process.env.BLUESKY_USERNAME,
      password: process.env.BLUESKY_PASSWORD
    })

    // Handle worker messages
    worker.on('message', (message) => {
      switch (message.type) {
        case 'follow_result':
          if (message.success) {
            console.log(`✅ Successfully followed @${message.handle}`)
          } else {
            console.log(`❌ Failed to follow @${message.handle}`)
          }
          break
          
        case 'error':
          console.error('❌ Error:', message.error)
          if (message.handle) {
            console.error(`   While processing @${message.handle}`)
          }
          break
      }
    })

    // Handle worker errors
    worker.on('error', (error) => {
      console.error('❌ Worker error:', error)
    })

    // Handle worker exit
    worker.on('exit', (code) => {
      if (code !== 0) {
        console.error(`❌ Worker stopped with exit code ${code}`)
        process.exit(1)
      }
    })

    console.log('🔷 Monitoring followers for auto-follow...')
    console.log('🔷 Press Ctrl+C to stop')

  } catch (error) {
    console.error('\n❌ Fatal error:', error instanceof Error ? error.message : error)
    process.exit(1)
  }
}

// Handle interruption
process.on('SIGINT', () => {
  console.log('\n\n🛑 Process interrupted by user')
  process.exit(0)
})

main()
