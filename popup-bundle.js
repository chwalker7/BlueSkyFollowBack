const { BskyAgent } = require('@atproto/api');

// Use browser namespace if available, otherwise fall back to chrome
const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

class BlueskyFollower {
  constructor() {
    this.agent = null;
    this.isRunning = false;
    this.stats = {
      total: 0,
      successful: 0,
      rateLimits: 0,
      processed: 0
    };
    this.queue = [];
    this.followInterval = 2000;
  }

  async initialize(username, password) {
    try {
      console.log('Attempting to initialize BskyAgent...');
      this.agent = new BskyAgent({ service: 'https://bsky.social' });
      console.log('Agent created with service: https://bsky.social');

      console.log('Attempting login with username:', username);
      const loginResponse = await this.agent.login({ identifier: username, password });
      console.log('Login response received:', {
        success: true,
        did: loginResponse.data.did,
        handle: loginResponse.data.handle,
        email: loginResponse.data.email
      });

      return true;
    } catch (error) {
      console.error('Login failed with detailed error:', {
        message: error.message,
        status: error.status,
        error: error.error,
        stack: error.stack,
        response: error.response ? {
          status: error.response.status,
          statusText: error.response.statusText,
          data: error.response.data
        } : 'No response data'
      });

      // Set a more detailed error message
      const errorMessage = document.getElementById('password-error');
      if (error.response) {
        switch (error.response.status) {
          case 401:
            errorMessage.textContent = 'Invalid credentials. Please check your username and password.';
            break;
          case 429:
            errorMessage.textContent = 'Too many login attempts. Please try again later.';
            break;
          case 500:
            errorMessage.textContent = 'Bluesky server error. Please try again later.';
            break;
          default:
            errorMessage.textContent = `Login failed: ${error.message || 'Unknown error'}`;
        }
      } else if (error.message.includes('Failed to fetch')) {
        errorMessage.textContent = 'Network error. Please check your internet connection.';
      } else {
        errorMessage.textContent = `Login error: ${error.message || 'Unknown error'}`;
      }
      errorMessage.style.display = 'block';

      return false;
    }
  }

  async followUser(handle) {
    try {
      console.log(`Attempting to follow user: ${handle}`);
      
      // Check rate limits first
      const rateLimitCheck = await new Promise(resolve => {
        browserAPI.runtime.sendMessage({ type: 'checkRateLimits' }, resolve);
      });
      console.log('Rate limit check result:', rateLimitCheck);

      if (!rateLimitCheck.allowed) {
        this.stats.rateLimits++;
        console.log(`Rate limit hit. Wait time: ${rateLimitCheck.waitTime}ms`);
        return { success: false, rateLimit: true, waitTime: rateLimitCheck.waitTime };
      }

      console.log(`Fetching profile for handle: ${handle}`);
      const profile = await this.agent.getProfile({ actor: handle });
      console.log('Profile fetched:', {
        did: profile.data.did,
        handle: profile.data.handle,
        displayName: profile.data.displayName
      });

      console.log(`Following user with DID: ${profile.data.did}`);
      const followResponse = await this.agent.follow(profile.data.did);
      console.log('Follow response:', followResponse);
      
      // Update rate limits after successful follow
      await browserAPI.runtime.sendMessage({ type: 'updateRateLimits', operation: 'follow' });
      console.log('Rate limits updated after follow');
      
      this.stats.successful++;
      return { success: true };
    } catch (error) {
      console.error('Follow operation failed:', {
        handle,
        error: {
          message: error.message,
          status: error.status,
          error: error.error,
          stack: error.stack,
          response: error.response ? {
            status: error.response.status,
            statusText: error.response.statusText,
            data: error.response.data
          } : 'No response data'
        }
      });

      if (error.message?.includes('Rate Limit')) {
        this.stats.rateLimits++;
        return { success: false, rateLimit: true };
      }
      return { success: false, error: error.message };
    } finally {
      this.stats.processed++;
      this.updateUI();
    }
  }

  updateUI() {
    const progressText = document.getElementById('progressText');
    const progressBar = document.getElementById('progressBar');
    const successRate = document.getElementById('successRate');
    const rateLimits = document.getElementById('rateLimits');
    
    progressText.textContent = `${this.stats.processed}/${this.stats.total}`;
    progressBar.style.width = `${(this.stats.processed / this.stats.total) * 100}%`;
    successRate.textContent = `${Math.round((this.stats.successful / this.stats.processed) * 100) || 0}%`;
    rateLimits.textContent = this.stats.rateLimits;

    console.log('UI Updated:', {
      processed: this.stats.processed,
      total: this.stats.total,
      successful: this.stats.successful,
      rateLimits: this.stats.rateLimits
    });
  }

  async start(targets) {
    console.log('Starting follow operation with targets:', targets);
    this.isRunning = true;
    this.stats = {
      total: targets.length,
      successful: 0,
      rateLimits: 0,
      processed: 0
    };
    this.queue = [...targets];
    
    document.getElementById('progress').classList.add('active');
    document.getElementById('startBtn').style.display = 'none';
    document.getElementById('stopBtn').style.display = 'block';
    
    while (this.isRunning && this.queue.length > 0) {
      const handle = this.queue.shift();
      console.log(`Processing handle: ${handle}`);
      const result = await this.followUser(handle);
      console.log('Follow result:', result);
      
      if (result.rateLimit) {
        // Use the wait time from rate limit check, or default to 2 minutes
        const waitTime = result.waitTime || 120000;
        console.log(`Rate limit encountered. Waiting ${waitTime}ms before retry`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        this.queue.unshift(handle); // Try again
        console.log(`Returned ${handle} to queue for retry`);
      } else {
        // Normal delay between follows
        console.log(`Waiting ${this.followInterval}ms before next follow`);
        await new Promise(resolve => setTimeout(resolve, this.followInterval));
      }
    }
    
    if (this.queue.length === 0) {
      console.log('Queue empty, stopping operation');
      this.stop();
    }
  }

  stop() {
    console.log('Stopping follow operation');
    this.isRunning = false;
    document.getElementById('startBtn').style.display = 'block';
    document.getElementById('stopBtn').style.display = 'none';
  }
}

// Save input field values to storage
async function saveFieldValue(field, value) {
  const data = {};
  data[field] = value;
  await browserAPI.storage.local.set(data);
  console.log(`Saved ${field} to storage:`, value);
}

// Load and restore field value
async function loadFieldValue(field, element) {
  const result = await browserAPI.storage.local.get([field]);
  if (result[field]) {
    element.value = result[field];
    console.log(`Loaded ${field} from storage:`, result[field]);
  }
}

// UI Event Handlers
document.addEventListener('DOMContentLoaded', async () => {
  console.log('Popup loaded, initializing...');
  const follower = new BlueskyFollower();
  
  const usernameField = document.getElementById('username');
  const passwordField = document.getElementById('password');
  const targetsField = document.getElementById('targets');
  const rememberCheckbox = document.getElementById('remember');
  
  // Load all saved values
  const saved = await browserAPI.storage.local.get(['username', 'password', 'targets', 'remember']);
  console.log('Loaded saved values:', {
    hasUsername: !!saved.username,
    hasPassword: !!saved.password,
    hasTargets: !!saved.targets,
    remember: saved.remember
  });
  
  // Restore saved values
  if (saved.username) usernameField.value = saved.username;
  if (saved.password) passwordField.value = saved.password;
  if (saved.targets) targetsField.value = saved.targets;
  if (saved.remember) rememberCheckbox.checked = saved.remember;
  
  // Save values on blur (when clicking away)
  usernameField.addEventListener('blur', (e) => {
    console.log('Username blur event, saving value');
    saveFieldValue('username', e.target.value);
  });
  
  passwordField.addEventListener('blur', (e) => {
    if (rememberCheckbox.checked) {
      console.log('Password blur event, saving value');
      saveFieldValue('password', e.target.value);
    }
  });
  
  targetsField.addEventListener('blur', (e) => {
    console.log('Targets blur event, saving value');
    saveFieldValue('targets', e.target.value);
  });
  
  // Also save on input changes
  usernameField.addEventListener('input', (e) => {
    console.log('Username changed, saving value');
    saveFieldValue('username', e.target.value);
  });
  
  passwordField.addEventListener('input', (e) => {
    if (rememberCheckbox.checked) {
      console.log('Password changed, saving value');
      saveFieldValue('password', e.target.value);
    }
  });
  
  targetsField.addEventListener('input', (e) => {
    console.log('Targets changed, saving value');
    saveFieldValue('targets', e.target.value);
  });
  
  rememberCheckbox.addEventListener('change', async (e) => {
    console.log('Remember checkbox changed:', e.target.checked);
    await saveFieldValue('remember', e.target.checked);
    if (!e.target.checked) {
      console.log('Remember unchecked, removing saved password');
      await browserAPI.storage.local.remove(['password']);
    } else {
      console.log('Remember checked, saving current password');
      await saveFieldValue('password', passwordField.value);
    }
  });
  
  // Restore values when popup gains focus
  window.addEventListener('focus', async () => {
    console.log('Window focused, restoring values');
    await loadFieldValue('username', usernameField);
    await loadFieldValue('password', passwordField);
    await loadFieldValue('targets', targetsField);
  });
  
  document.getElementById('startBtn').addEventListener('click', async () => {
    console.log('Start button clicked');
    const username = usernameField.value.trim();
    const password = passwordField.value.trim();
    const targets = targetsField.value
      .split('\n')
      .map(t => t.trim())
      .filter(t => t);
    const remember = rememberCheckbox.checked;
    
    console.log('Form data:', {
      username,
      hasPassword: !!password,
      targetsCount: targets.length,
      remember
    });
    
    // Validate inputs
    let hasError = false;
    if (!username) {
      document.getElementById('username-error').textContent = 'Username is required';
      document.getElementById('username-error').style.display = 'block';
      hasError = true;
    }
    if (!password) {
      document.getElementById('password-error').textContent = 'Password is required';
      document.getElementById('password-error').style.display = 'block';
      hasError = true;
    }
    if (targets.length === 0) {
      document.getElementById('targets-error').textContent = 'At least one target account is required';
      document.getElementById('targets-error').style.display = 'block';
      hasError = true;
    }
    
    if (hasError) {
      console.log('Validation failed');
      return;
    }
    
    // Clear any previous errors
    document.querySelectorAll('.error').forEach(el => el.style.display = 'none');
    
    try {
      // Initialize and start
      console.log('Attempting to initialize follower');
      const success = await follower.initialize(username, password);
      if (success) {
        console.log('Initialization successful');
        if (remember) {
          console.log('Saving credentials');
          await browserAPI.storage.local.set({ username, password, remember });
        } else {
          console.log('Removing saved password');
          await browserAPI.storage.local.remove(['password']);
          await browserAPI.storage.local.set({ username, remember });
        }
        await follower.start(targets);
      } else {
        console.log('Initialization failed');
      }
    } catch (error) {
      console.error('Error in start button handler:', error);
      document.getElementById('password-error').textContent = `Error: ${error.message}`;
      document.getElementById('password-error').style.display = 'block';
    }
  });
  
  document.getElementById('stopBtn').addEventListener('click', () => {
    console.log('Stop button clicked');
    follower.stop();
  });
});
