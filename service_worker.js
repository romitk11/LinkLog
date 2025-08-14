/**
 * LinkLog Background Service Worker
 * Handles data persistence, offline queue, and Google Apps Script integration
 */

// Settings cache
let settings = {
  appsScriptUrl: '',
  token: '',
  aiProvider: 'groq',
  aiModel: 'llama3-8b',
  aiKey: '',
  aiRerank: false,
  aiAutoTag: false,
  aiFollowUp: false,
  demoAI: false,
  captureOnConnect: false
};

// Offline queue
let offlineQueue = [];
let isProcessingQueue = false;

// Initialize service worker
chrome.runtime.onInstalled.addListener(() => {
  console.log('LinkLog service worker installed');
  loadSettings();
  flushQueue();
});

// Load settings from storage
function loadSettings() {
  chrome.storage.sync.get(settings, (result) => {
    settings = { ...settings, ...result };
  });
}

// Listen for storage changes
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'sync') {
    loadSettings();
  }
});

// Message handling
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case 'SAVE_ROW':
      handleSaveRow(message.payload, sendResponse);
      return true; // Indicate async response
      
    case 'TEST_APPS_SCRIPT':
      handleTestAppsScript(message.url, message.token, sendResponse);
      return true;
      
    case 'CONNECT_CLICKED':
      handleConnectClicked(message.profileUrl, sendResponse);
      return true;
      
    default:
      sendResponse({ success: false, error: 'Unknown message type' });
  }
});

/**
 * Handle SAVE_ROW message
 * @param {Object} payload - The data to save
 * @param {Function} sendResponse - Response callback
 */
async function handleSaveRow(payload, sendResponse) {
  try {
    // Check for existing profile
    const existingProfile = await checkExistingProfile(payload.profileUrl);
    const mode = existingProfile ? 'update' : 'append';
    
    // Post to Google Apps Script
    const result = await postRow(payload, mode);
    
    if (result.success) {
      // Update local index
      await updateLocalIndex(payload.profileUrl, {
        sheetRowId: result.rowId,
        lastUpdated: new Date().toISOString()
      });
      
      sendResponse({ success: true, mode });
    } else {
      throw new Error(result.error);
    }
    
  } catch (error) {
    console.error('Save row error:', error);
    
    // Add to offline queue
    await enqueue(payload, mode);
    
    sendResponse({ 
      success: false, 
      error: error.message,
      queued: true 
    });
  }
}

/**
 * Check if profile already exists in local storage
 * @param {string} profileUrl - Profile URL to check
 * @returns {Object|null} Existing profile data or null
 */
async function checkExistingProfile(profileUrl) {
  return new Promise((resolve) => {
    chrome.storage.local.get(['localIndex'], (result) => {
      const localIndex = result.localIndex || {};
      resolve(localIndex[profileUrl] || null);
    });
  });
}

/**
 * Update local index with profile data
 * @param {string} profileUrl - Profile URL
 * @param {Object} data - Data to store
 */
async function updateLocalIndex(profileUrl, data) {
  return new Promise((resolve) => {
    chrome.storage.local.get(['localIndex'], (result) => {
      const localIndex = result.localIndex || {};
      localIndex[profileUrl] = data;
      
      chrome.storage.local.set({ localIndex }, resolve);
    });
  });
}

/**
 * Post data to Google Apps Script
 * @param {Object} payload - Data to post
 * @param {string} mode - 'append' or 'update'
 * @returns {Object} Response from Apps Script
 */
async function postRow(payload, mode) {
  if (!settings.appsScriptUrl || !settings.token) {
    throw new Error('Apps Script URL or token not configured');
  }

  const response = await fetch(settings.appsScriptUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${settings.token}`
    },
    body: JSON.stringify({
      mode,
      ...payload
    })
  });

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new Error('Authentication failed - check your token');
    } else if (response.status >= 500) {
      throw new Error(`Server error: ${response.status}`);
    } else {
      throw new Error(`HTTP error: ${response.status}`);
    }
  }

  const data = await response.json();
  
  if (!data.ok) {
    throw new Error(data.error || 'Unknown error from Apps Script');
  }

  return {
    success: true,
    rowId: data.rowId,
    message: data.message
  };
}

/**
 * Add item to offline queue
 * @param {Object} payload - Data to queue
 * @param {string} mode - 'append' or 'update'
 */
async function enqueue(payload, mode) {
  const queueItem = {
    payload,
    mode,
    timestamp: new Date().toISOString(),
    retryCount: 0
  };

  return new Promise((resolve) => {
    chrome.storage.local.get(['offlineQueue'], (result) => {
      const queue = result.offlineQueue || [];
      queue.push(queueItem);
      
      chrome.storage.local.set({ offlineQueue: queue }, () => {
        offlineQueue = queue;
        resolve();
      });
    });
  });
}

/**
 * Process offline queue with exponential backoff
 */
async function flushQueue() {
  if (isProcessingQueue) return;
  
  isProcessingQueue = true;
  
  try {
    // Load queue from storage
    const result = await new Promise((resolve) => {
      chrome.storage.local.get(['offlineQueue'], resolve);
    });
    
    const queue = result.offlineQueue || [];
    if (queue.length === 0) return;

    console.log(`Processing ${queue.length} queued items`);

    const newQueue = [];
    
    for (const item of queue) {
      try {
        // Calculate backoff delay
        const delay = Math.min(1000 * Math.pow(2, item.retryCount), 30000); // Max 30 seconds
        
        if (item.retryCount > 0) {
          await new Promise(resolve => setTimeout(resolve, delay));
        }

        // Attempt to post
        const result = await postRow(item.payload, item.mode);
        
        if (result.success) {
          // Update local index
          await updateLocalIndex(item.payload.profileUrl, {
            sheetRowId: result.rowId,
            lastUpdated: new Date().toISOString()
          });
          
          console.log('Successfully processed queued item');
        } else {
          throw new Error(result.error);
        }
        
      } catch (error) {
        console.error('Error processing queued item:', error);
        
        // Increment retry count
        item.retryCount++;
        
        // Keep in queue if retry count is reasonable
        if (item.retryCount < 5) {
          newQueue.push(item);
        } else {
          console.error('Dropping item after 5 retries:', item);
        }
      }
    }

    // Update queue in storage
    await new Promise((resolve) => {
      chrome.storage.local.set({ offlineQueue: newQueue }, resolve);
    });
    
    offlineQueue = newQueue;
    
  } catch (error) {
    console.error('Error flushing queue:', error);
  } finally {
    isProcessingQueue = false;
  }
}

/**
 * Handle Apps Script connection test
 * @param {string} url - Apps Script URL
 * @param {string} token - Authorization token
 * @param {Function} sendResponse - Response callback
 */
async function handleTestAppsScript(url, token, sendResponse) {
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (response.ok) {
      sendResponse({ success: true });
    } else {
      sendResponse({ 
        success: false, 
        error: `HTTP ${response.status}: ${response.statusText}` 
      });
    }
  } catch (error) {
    sendResponse({ 
      success: false, 
      error: error.message 
    });
  }
}

/**
 * Handle Connect button click (if enabled)
 * @param {string} profileUrl - Profile URL
 * @param {Function} sendResponse - Response callback
 */
async function handleConnectClicked(profileUrl, sendResponse) {
  if (!settings.captureOnConnect) {
    sendResponse({ success: false, error: 'Capture on Connect not enabled' });
    return;
  }

  try {
    // For now, just log the event
    // In a full implementation, this would trigger a popup confirmation
    console.log('Connect clicked on profile:', profileUrl);
    
    sendResponse({ 
      success: true, 
      message: 'Connect event logged' 
    });
  } catch (error) {
    sendResponse({ 
      success: false, 
      error: error.message 
    });
  }
}

// Stub functions for future integrations
async function postAirtable(row) {
  // TODO: Implement Airtable integration
  console.log('Airtable integration not implemented yet');
  return { success: false, error: 'Not implemented' };
}

async function postNotion(row) {
  // TODO: Implement Notion integration
  console.log('Notion integration not implemented yet');
  return { success: false, error: 'Not implemented' };
}

// Utility functions
function normalizeDateISO(dateString) {
  if (!dateString) return '';
  
  try {
    const date = new Date(dateString);
    return date.toISOString().split('T')[0]; // YYYY-MM-DD format
  } catch (error) {
    console.warn('Invalid date format:', dateString);
    return '';
  }
}

// Periodic queue processing
setInterval(flushQueue, 60000); // Check every minute

// Handle service worker startup
self.addEventListener('activate', (event) => {
  console.log('LinkLog service worker activated');
  loadSettings();
  flushQueue();
});

console.log('LinkLog service worker loaded');
