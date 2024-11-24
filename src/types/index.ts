export interface FollowTask {
  did: string
  handle: string
}

export interface WorkerMessage {
  type: 'ready' | 'result' | 'error'
  success?: boolean
  handle?: string
  error?: string
  isRateLimit?: boolean
}

export interface HealthCheckStatus {
  healthy: boolean
  remaining?: number
}
