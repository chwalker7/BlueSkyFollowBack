import { BskyAgent, AppBskyActorDefs } from '@atproto/api'

interface FollowingEntry {
  did: string
  handle: string
  displayName?: string
}

export class BlueskyClient {
  private agent: BskyAgent
  private logPrefix = '🔷'
  private knownFollowers: Set<string> = new Set()
  private initialized: boolean = false

  constructor() {
    this.agent = new BskyAgent({ service: 'https://bsky.social' })
  }

  async login(identifier: string, password: string): Promise<void> {
    console.log(`${this.logPrefix} Logging in as ${identifier}...`)
    await this.agent.login({ identifier, password })
    console.log(`${this.logPrefix} Login successful`)
  }

  async getProfile(handle: string) {
    console.log(`${this.logPrefix} Fetching profile for ${handle}...`)
    const profile = await this.agent.getProfile({ actor: handle })
    console.log(`${this.logPrefix} Profile found: @${profile.data.handle}`)
    return profile.data
  }

  async getFollowing(handle: string): Promise<FollowingEntry[]> {
    console.log(`${this.logPrefix} Fetching accounts that ${handle} is following...`)
    const profile = await this.getProfile(handle)
    
    let following: FollowingEntry[] = []
    let cursor: string | undefined = undefined
    
    do {
      const response = await this.agent.getFollows({
        actor: profile.did,
        limit: 100,
        cursor
      })
      
      following = following.concat(response.data.follows)
      cursor = response.data.cursor
    } while (cursor)

    console.log(`${this.logPrefix} Found ${following.length} accounts that ${handle} is following`)
    return following
  }

  async getFollowers(handle: string): Promise<FollowingEntry[]> {
    console.log(`${this.logPrefix} Fetching followers for ${handle}...`)
    const profile = await this.getProfile(handle)
    
    let followers: FollowingEntry[] = []
    let cursor: string | undefined = undefined
    
    do {
      const response = await this.agent.getFollowers({
        actor: profile.did,
        limit: 100,
        cursor
      })
      
      followers = followers.concat(response.data.followers)
      cursor = response.data.cursor
    } while (cursor)

    console.log(`${this.logPrefix} Found ${followers.length} followers`)
    return followers
  }

  async followUser(handle: string): Promise<boolean> {
    try {
      console.log(`${this.logPrefix} Attempting to follow ${handle}...`)
      const profile = await this.getProfile(handle)
      await this.agent.follow(profile.did)
      console.log(`${this.logPrefix} Successfully followed ${handle}`)
      return true
    } catch (error) {
      console.error(`${this.logPrefix} Failed to follow ${handle}:`, error instanceof Error ? error.message : error)
      return false
    }
  }

  async followUsersFollowing(targetHandles: string[]): Promise<void> {
    console.log(`\n${this.logPrefix} Starting to process ${targetHandles.length} target accounts...\n`)
    let totalFollowed = 0
    let totalAttempted = 0

    for (const targetHandle of targetHandles) {
      try {
        console.log(`\n${this.logPrefix} Processing target account: ${targetHandle}`)
        const following = await this.getFollowing(targetHandle)
        
        for (const account of following) {
          totalAttempted++
          const success = await this.followUser(account.handle)
          if (success) totalFollowed++
          
          // Add delay between follows to avoid rate limits
          await new Promise(resolve => setTimeout(resolve, 2000))
        }
      } catch (error) {
        console.error(`${this.logPrefix} Error processing ${targetHandle}:`, error instanceof Error ? error.message : error)
      }
    }

    console.log(`\n${this.logPrefix} Follow process completed:`)
    console.log(`   • Successfully followed: ${totalFollowed}/${totalAttempted}`)
  }

  async initializeFollowerList(): Promise<void> {
    if (this.initialized) return

    if (!this.agent.session?.handle) {
      throw new Error('Not logged in')
    }

    const followers = await this.getFollowers(this.agent.session.handle)
    
    for (const follower of followers) {
      this.knownFollowers.add(follower.did)
    }
    
    this.initialized = true
    console.log(`${this.logPrefix} Initialized with ${this.knownFollowers.size} existing followers`)
  }

  async checkNewFollowers(): Promise<FollowingEntry[]> {
    if (!this.initialized) {
      await this.initializeFollowerList()
    }

    if (!this.agent.session?.handle) {
      throw new Error('Not logged in')
    }

    const currentFollowers = await this.getFollowers(this.agent.session.handle)
    const newFollowers: FollowingEntry[] = []

    for (const follower of currentFollowers) {
      if (!this.knownFollowers.has(follower.did)) {
        newFollowers.push(follower)
        this.knownFollowers.add(follower.did)
      }
    }

    if (newFollowers.length > 0) {
      console.log(`${this.logPrefix} Found ${newFollowers.length} new followers`)
    }

    return newFollowers
  }
}
