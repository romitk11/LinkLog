/**
 * LinkLog Content Script
 * Privacy-first LinkedIn profile data capture
 * User-triggered only - no automatic scraping
 */

/**
 * Helper function to get first non-empty text from multiple selectors
 * @param {string[]} selectors - Array of CSS selectors to try
 * @param {Element} root - Root element to search in (default: document)
 * @returns {string|null} First non-empty text found or null
 */
function firstNonEmpty(selectors, root = document) {
  for (const selector of selectors) {
    try {
      const element = root.querySelector(selector);
      if (element && element.textContent && element.textContent.trim()) {
        return element.textContent.trim();
      }
    } catch (error) {
      // Continue to next selector if current one fails
      continue;
    }
  }
  return null;
}

/**
 * Gets connection status from visible buttons/links
 * @returns {'none'|'pending'|'connected'} Connection status
 */
function getStatus() {
  const buttons = document.querySelectorAll('button, a[role="button"], span');
  for (const button of buttons) {
    const text = button.textContent.toLowerCase();
    if (text.includes('message')) {
      return 'connected';
    } else if (text.includes('pending')) {
      return 'pending';
    } else if (text.includes('connect')) {
      return 'none';
    }
  }
  return 'none';
}

/**
 * Parses basic profile information
 * @param {Document} doc - Document to parse (default: document)
 * @returns {Object} Basic profile data
 */
function parseProfileBasics(doc = document) {
  const result = {
    name: null,
    title: null,
    company: null,
    profileUrl: window.location.href,
    status: getStatus()
  };

  try {
    // Extract name - try multiple selectors
    const nameSelectors = [
      'main h1',
      'div.scaffold-layout h1',
      'h1',
      '.text-heading-xlarge',
      'h1[aria-label*="profile"]'
    ];
    result.name = firstNonEmpty(nameSelectors, doc);

    // Extract title/headline - sibling/div under h1
    const titleSelectors = [
      'main h1 ~ div',
      'div.text-body-medium.break-words',
      '[data-test-id="hero-summary__occupation"]',
      'section[aria-label*="Intro"] div',
      '.pv-text-details__left-panel .text-body-medium'
    ];
    result.title = firstNonEmpty(titleSelectors, doc);

    // Extract company - prefer company links
    const companySelectors = [
      'a[href*="/company/"]',
      '[data-section="experience"] a[href*="/company/"]',
      '.pv-entity__company-summary-info h3',
      '.experience__company-name'
    ];
    result.company = firstNonEmpty(companySelectors, doc);

  } catch (error) {
    console.warn('LinkLog: Error parsing profile basics:', error);
  }

  return result;
}

/**
 * Parses experience list from profile
 * @param {Document} doc - Document to parse (default: document)
 * @returns {Array} Array of experience roles
 */
function parseExperienceList(doc = document) {
  const roles = [];
  
  try {
    // Find experience sections
    const experienceSections = doc.querySelectorAll('section[id*="experience"], section[aria-label*="Experience"]');
    
    for (const section of experienceSections) {
      const roleElements = section.querySelectorAll('li, .pv-entity__summary-info');
      
      for (const roleElement of roleElements) {
        try {
          // Extract title
          const titleSelectors = [
            'span[aria-hidden="true"]',
            'strong',
            '.pv-entity__summary-title',
            '.pv-entity__role-details-container h3'
          ];
          const title = firstNonEmpty(titleSelectors, roleElement);
          
          // Extract company
          const companySelectors = [
            'a[href*="/company/"]',
            '.pv-entity__company-summary-info h3',
            '.pv-entity__secondary-title'
          ];
          const company = firstNonEmpty(companySelectors, roleElement);
          
          // Extract description (keep short, truncate)
          const descSelectors = [
            '.pv-entity__description',
            '.pv-entity__extra-details',
            '.pv-entity__summary-info-v2'
          ];
          let desc = firstNonEmpty(descSelectors, roleElement);
          if (desc && desc.length > 200) {
            desc = desc.substring(0, 200) + '...';
          }
          
          // Extract dates and determine if current
          const dateSelectors = [
            '.pv-entity__date-range span:nth-child(2)',
            '.pv-entity__date-range',
            '.pv-entity__dates time'
          ];
          const dates = firstNonEmpty(dateSelectors, roleElement);
          const isCurrent = dates && (dates.toLowerCase().includes('present') || dates.toLowerCase().includes('current'));
          
          if (title) {
            roles.push({
              title,
              company: company || null,
              desc: desc || null,
              dates: dates || null,
              isCurrent: !!isCurrent
            });
          }
        } catch (error) {
          // Continue to next role if current one fails
          continue;
        }
      }
    }
  } catch (error) {
    console.warn('LinkLog: Error parsing experience list:', error);
  }
  
  return roles;
}

/**
 * Extracts light context information (best-effort)
 * @param {Document} doc - Document to parse (default: document)
 * @returns {Object} Context information
 */
function parseContext(doc = document) {
  const context = {
    mutualsCount: null,
    sharedSchool: null,
    lastPostDate: null
  };
  
  try {
    // Try to get mutual connections count
    const mutualsElement = doc.querySelector('span[aria-label*="mutual"], a[href*="mutual"]');
    if (mutualsElement) {
      const text = mutualsElement.textContent;
      const match = text.match(/(\d+)/);
      if (match) {
        context.mutualsCount = parseInt(match[1]);
      }
    }
    
    // Try to get shared school
    const schoolElements = doc.querySelectorAll('a[href*="/school/"]');
    for (const school of schoolElements) {
      if (school.textContent && school.textContent.trim()) {
        context.sharedSchool = school.textContent.trim();
        break;
      }
    }
    
    // Try to get last post date (very basic)
    const postElements = doc.querySelectorAll('time, .feed-shared-update-v2__timestamp');
    if (postElements.length > 0) {
      const lastPost = postElements[0];
      if (lastPost.textContent) {
        context.lastPostDate = lastPost.textContent.trim();
      }
    }
    
  } catch (error) {
    console.warn('LinkLog: Error parsing context:', error);
  }
  
  return context;
}

// Message listener for popup communication
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'CAPTURE_PROFILE') {
    try {
      // Parse profile data
      const profile = parseProfileBasics();
      const roles = parseExperienceList();
      const context = parseContext();
      
      sendResponse({
        profile,
        roles,
        context
      });
    } catch (error) {
      console.error('LinkLog: Error capturing profile:', error);
      sendResponse({ error: error.message });
    }
  }
  
  // Return true to indicate async response
  return true;
});

// Optional: Listen for Connect button clicks if enabled
let connectListenerEnabled = false;

function setupConnectListener() {
  if (connectListenerEnabled) return;
  
  document.addEventListener('click', (event) => {
    const target = event.target;
    if (target.textContent && target.textContent.toLowerCase().includes('connect')) {
      // Notify background service worker
      chrome.runtime.sendMessage({
        type: 'CONNECT_CLICKED',
        profileUrl: window.location.href
      });
    }
  });
  
  connectListenerEnabled = true;
}

// Check if capture on connect is enabled
chrome.storage.sync.get(['captureOnConnect'], (result) => {
  if (result.captureOnConnect) {
    setupConnectListener();
  }
});

// Listen for storage changes
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'sync' && changes.captureOnConnect) {
    if (changes.captureOnConnect.newValue) {
      setupConnectListener();
    } else {
      connectListenerEnabled = false;
    }
  }
});

console.log('LinkLog content script loaded');
