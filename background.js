// Use browser namespace if available, otherwise fall back to chrome
const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

// Handle extension installation
browserAPI.runtime.onInstalled.addListener(() => {
  console.log('Bluesky Mass Follow extension installed');
});

// Listen for messages from popup
browserAPI.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'getFollowStats') {
    // Return current follow stats from storage
    browserAPI.storage.local.get(['followStats'], (result) => {
      sendResponse(result.followStats || {
        total: 0,
        successful: 0,
        rateLimits: 0,
        processed: 0
      });
    });
    return true;
  }
});

// Rate limit tracking
const rateLimits = {
  hourlyPoints: {
    points: 0,
    resetTime: Date.now(),
    limit: 5000 // 5,000 points per hour
  },
  dailyPoints: {
    points: 0,
    resetTime: Date.now(),
    limit: 35000 // 35,000 points per day
  },
  apiRequests: {
    count: 0,
    resetTime: Date.now(),
    limit: 3000 // 3,000 requests per 5 minutes
  }
};

function resetRateLimits() {
  const now = Date.now();
  
  // Reset hourly points
  if (now - rateLimits.hourlyPoints.resetTime > 3600000) {
    rateLimits.hourlyPoints.points = 0;
    rateLimits.hourlyPoints.resetTime = now;
  }
  
  // Reset daily points
  if (now - rateLimits.dailyPoints.resetTime > 86400000) {
    rateLimits.dailyPoints.points = 0;
    rateLimits.dailyPoints.resetTime = now;
  }
  
  // Reset API requests (every 5 minutes)
  if (now - rateLimits.apiRequests.resetTime > 300000) {
    rateLimits.apiRequests.count = 0;
    rateLimits.apiRequests.resetTime = now;
  }
}

function checkRateLimits() {
  resetRateLimits();
  
  const CREATE_POINTS = 3; // Points cost for following (CREATE operation)
  
  // Check if we would exceed any limits
  if (rateLimits.hourlyPoints.points + CREATE_POINTS > rateLimits.hourlyPoints.limit) {
    return {
      allowed: false,
      waitTime: 3600000 - (Date.now() - rateLimits.hourlyPoints.resetTime),
      reason: 'hourly'
    };
  }
  
  if (rateLimits.dailyPoints.points + CREATE_POINTS > rateLimits.dailyPoints.limit) {
    return {
      allowed: false,
      waitTime: 86400000 - (Date.now() - rateLimits.dailyPoints.resetTime),
      reason: 'daily'
    };
  }
  
  if (rateLimits.apiRequests.count + 1 > rateLimits.apiRequests.limit) {
    return {
      allowed: false,
      waitTime: 300000 - (Date.now() - rateLimits.apiRequests.resetTime),
      reason: 'api'
    };
  }
  
  return { allowed: true };
}

function updateRateLimits(operation) {
  resetRateLimits();
  
  if (operation === 'follow') {
    rateLimits.hourlyPoints.points += 3; // CREATE operation
    rateLimits.dailyPoints.points += 3;
  }
  
  rateLimits.apiRequests.count++;
  
  // Save current state
  browserAPI.storage.local.set({ rateLimits });
}

// Handle rate limit checking requests from popup
browserAPI.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'checkRateLimits') {
    sendResponse(checkRateLimits());
    return true;
  }
  
  if (request.type === 'updateRateLimits') {
    updateRateLimits(request.operation);
    sendResponse({ success: true });
    return true;
  }
});
