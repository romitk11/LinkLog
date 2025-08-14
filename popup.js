/**
 * LinkLog Popup Script
 * Handles UI interactions, AI integration, and data management
 */

// Global state
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

let currentData = {
  profile: null,
  roles: [],
  context: null,
  selectedRole: null,
  rankedRoles: []
};

// DOM elements
const elements = {};

// Initialize popup
document.addEventListener('DOMContentLoaded', () => {
  initializeElements();
  setupEventListeners();
  loadSettings();
  loadSessionData();
});

function initializeElements() {
  // Tab elements
  elements.captureTab = document.getElementById('captureTab');
  elements.settingsTab = document.getElementById('settingsTab');
  elements.privacyTab = document.getElementById('privacyTab');
  elements.captureContent = document.getElementById('captureContent');
  elements.settingsContent = document.getElementById('settingsContent');
  elements.privacyContent = document.getElementById('privacyContent');

  // Capture elements
  elements.keywordField = document.getElementById('keywordField');
  elements.captureBtn = document.getElementById('captureBtn');
  elements.profileSection = document.getElementById('profileSection');
  elements.nameField = document.getElementById('nameField');
  elements.titleField = document.getElementById('titleField');
  elements.companyField = document.getElementById('companyField');
  elements.profileUrlField = document.getElementById('profileUrlField');
  elements.statusField = document.getElementById('statusField');

  // Role selection elements
  elements.selectedRoleSection = document.getElementById('selectedRoleSection');
  elements.selectedRolePill = document.getElementById('selectedRolePill');
  elements.roleSelectModal = document.getElementById('roleSelectModal');
  elements.roleOptions = document.getElementById('roleOptions');
  elements.cancelRoleBtn = document.getElementById('cancelRoleBtn');
  elements.confirmRoleBtn = document.getElementById('confirmRoleBtn');

  // Details elements
  elements.detailsSection = document.getElementById('detailsSection');
  elements.tagField = document.getElementById('tagField');
  elements.notesField = document.getElementById('notesField');
  elements.followUpField = document.getElementById('followUpField');
  elements.saveBtn = document.getElementById('saveBtn');

  // Settings elements
  elements.appsScriptUrlField = document.getElementById('appsScriptUrlField');
  elements.tokenField = document.getElementById('tokenField');
  elements.aiProviderField = document.getElementById('aiProviderField');
  elements.aiModelField = document.getElementById('aiModelField');
  elements.aiKeyField = document.getElementById('aiKeyField');
  elements.aiRerankToggle = document.getElementById('aiRerankToggle');
  elements.aiAutoTagToggle = document.getElementById('aiAutoTagToggle');
  elements.aiFollowUpToggle = document.getElementById('aiFollowUpToggle');
  elements.demoAIToggle = document.getElementById('demoAIToggle');
  elements.captureOnConnectToggle = document.getElementById('captureOnConnectToggle');
  elements.saveSettingsBtn = document.getElementById('saveSettingsBtn');
  elements.cancelSettingsBtn = document.getElementById('cancelSettingsBtn');

  // Test buttons
  elements.testAppsScriptBtn = document.getElementById('testAppsScriptBtn');
  elements.testOpenAIBtn = document.getElementById('testOpenAIBtn');

  // More menu elements
  elements.moreBtn = document.getElementById('moreBtn');
  elements.moreDropdown = document.getElementById('moreDropdown');
  elements.exportCsvBtn = document.getElementById('exportCsvBtn');

  // Status
  elements.statusMessage = document.getElementById('statusMessage');
}

function setupEventListeners() {
  // Tab navigation
  elements.captureTab.addEventListener('click', () => switchTab('capture'));
  elements.settingsTab.addEventListener('click', () => switchTab('settings'));
  elements.privacyTab.addEventListener('click', () => switchTab('privacy'));

  // Capture functionality
  elements.captureBtn.addEventListener('click', handleCapture);

  // Role selection modal
  elements.cancelRoleBtn.addEventListener('click', closeRoleModal);
  elements.confirmRoleBtn.addEventListener('click', confirmRoleSelection);

  // Save functionality
  elements.saveBtn.addEventListener('click', handleSave);

  // Settings
  elements.saveSettingsBtn.addEventListener('click', saveSettings);
  elements.cancelSettingsBtn.addEventListener('click', loadSettings);
  elements.testAppsScriptBtn.addEventListener('click', testAppsScript);
  elements.testOpenAIBtn.addEventListener('click', testOpenAI);

  // Toggle switches
  elements.aiRerankToggle.addEventListener('click', () => toggleSwitch('aiRerank'));
  elements.aiAutoTagToggle.addEventListener('click', () => toggleSwitch('aiAutoTag'));
  elements.aiFollowUpToggle.addEventListener('click', () => toggleSwitch('aiFollowUp'));
  elements.demoAIToggle.addEventListener('click', () => toggleSwitch('demoAI'));
  elements.captureOnConnectToggle.addEventListener('click', () => toggleSwitch('captureOnConnect'));

  // More menu
  elements.moreBtn.addEventListener('click', toggleMoreMenu);
  elements.exportCsvBtn.addEventListener('click', exportCsv);

  // Provider change handler
  elements.aiProviderField.addEventListener('change', handleProviderChange);

  // Keyboard shortcuts
  document.addEventListener('keydown', handleKeyboard);
}

function switchTab(tabName) {
  // Update tab buttons
  [elements.captureTab, elements.settingsTab, elements.privacyTab].forEach(tab => {
    tab.classList.remove('active');
  });
  
  // Update content
  [elements.captureContent, elements.settingsContent, elements.privacyContent].forEach(content => {
    content.classList.remove('active');
  });

  // Activate selected tab
  switch (tabName) {
    case 'capture':
      elements.captureTab.classList.add('active');
      elements.captureContent.classList.add('active');
      break;
    case 'settings':
      elements.settingsTab.classList.add('active');
      elements.settingsContent.classList.add('active');
      break;
    case 'privacy':
      elements.privacyTab.classList.add('active');
      elements.privacyContent.classList.add('active');
      break;
  }
}

async function handleCapture() {
  try {
    showStatus('Capturing profile data...', 'info');
    elements.captureBtn.disabled = true;
    elements.captureBtn.innerHTML = '<span class="loader"></span>Capturing...';

    // Get current tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab.url.includes('linkedin.com')) {
      showStatus('Please navigate to a LinkedIn profile page', 'error');
      return;
    }

    // Send message to content script
    const response = await chrome.tabs.sendMessage(tab.id, {
      type: 'CAPTURE_PROFILE',
      keyword: elements.keywordField.value.trim()
    });

    if (response.error) {
      throw new Error(response.error);
    }

    // Store captured data
    currentData.profile = response.profile;
    currentData.roles = response.roles;
    currentData.context = response.context;

    // Display profile data
    displayProfileData(response.profile);

    // Rank roles and open selection modal
    await rankAndShowRoles(response.roles, elements.keywordField.value.trim());

    // Save session data
    saveSessionData();

    showStatus('Profile captured successfully!', 'success');

  } catch (error) {
    console.error('Capture error:', error);
    showStatus(`Capture failed: ${error.message}`, 'error');
  } finally {
    elements.captureBtn.disabled = false;
    elements.captureBtn.textContent = 'Capture';
  }
}

function displayProfileData(profile) {
  elements.nameField.value = profile.name || '';
  elements.titleField.value = profile.title || '';
  elements.companyField.value = profile.company || '';
  elements.profileUrlField.value = profile.profileUrl || '';
  elements.statusField.value = profile.status || '';

  elements.profileSection.classList.remove('hidden');
  elements.detailsSection.classList.remove('hidden');
}

async function rankAndShowRoles(roles, keyword) {
  try {
    // Stage A: Heuristic ranking
    const heuristicRoles = roles.map((role, index) => ({
      ...role,
      index,
      score: scoreRoleHeuristic(role, keyword)
    })).sort((a, b) => b.score - a.score);

    // Stage B: AI re-ranking (if enabled)
    let rankedRoles = heuristicRoles;
    if (settings.aiRerank && !settings.demoAI) {
      showStatus('Analyzing roles with AI...', 'info');
      try {
        rankedRoles = await reRankWithLLM(heuristicRoles, keyword, settings);
      } catch (error) {
        console.warn('AI re-ranking failed, using heuristic:', error);
        showStatus('AI unavailable — using fallback', 'info');
      }
    } else if (settings.demoAI) {
      // Demo mode - add mock AI scores
      rankedRoles = heuristicRoles.map(role => ({
        ...role,
        aiScore: Math.random() * 0.3 + 0.7, // 0.7-1.0
        aiExplanation: 'Demo mode: Mock AI analysis'
      }));
    }

    currentData.rankedRoles = rankedRoles;
    openRoleModal(rankedRoles);

  } catch (error) {
    console.error('Role ranking error:', error);
    showStatus('Error ranking roles', 'error');
  }
}

function scoreRoleHeuristic(role, keyword) {
  const k = (keyword || '').toLowerCase().trim();
  if (!k) return role.isCurrent ? 1 : 0;

  const words = k.split(/\s+/).filter(Boolean);
  const t = (role.title || '').toLowerCase();
  const c = (role.company || '').toLowerCase();
  const d = (role.desc || '').toLowerCase();

  let score = role.isCurrent ? 1 : 0;

  for (const word of words) {
    if (t.includes(word)) score += 3;
    if (c.includes(word)) score += 1.5;
    if (d.includes(word)) score += 1;
  }

  return score;
}

function getAiEndpointAndHeaders({ aiProvider, aiKey }) {
  if (aiProvider === 'groq') {
    return {
      url: 'https://api.groq.com/openai/v1/chat/completions',
      headers: { 'Authorization': `Bearer ${aiKey}`, 'Content-Type': 'application/json' }
    };
  }
  if (aiProvider === 'openai') {
    return {
      url: 'https://api.openai.com/v1/chat/completions',
      headers: { 'Authorization': `Bearer ${aiKey}`, 'Content-Type': 'application/json' }
    };
  }
  if (aiProvider === 'openrouter') {
    return {
      url: 'https://openrouter.ai/api/v1/chat/completions',
      headers: { 'Authorization': `Bearer ${aiKey}`, 'Content-Type': 'application/json' }
    };
  }
  throw new Error('Unknown AI provider');
}

async function reRankWithLLM(roles, keyword, settings, timeoutMs = 12000) {
  if (!settings.aiKey) throw new Error('No API key provided');

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const { url, headers } = getAiEndpointAndHeaders({ aiProvider: settings.aiProvider, aiKey: settings.aiKey });
    const model = settings.aiModel || (settings.aiProvider === 'groq' ? 'llama3-8b' : 'gpt-3.5-turbo');

    const body = {
      model,
      temperature: 0,
      messages: [
        { role: 'system', content: 'Rank roles vs keyword. Return JSON array of {index, score:0..1, explanation}.' },
        { role: 'user', content: `Keyword: ${keyword || ''}\n${roles.slice(0, 10).map((r, i) => `#${i}: ${r.title || ''} @ ${r.company || ''} — ${(r.desc || '').slice(0, 160)}`).join('\n')}` }
      ]
    };

    // Add response_format for OpenAI, but not for Groq
    if (settings.aiProvider === 'openai') {
      body.response_format = { type: 'json_object' };
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      if (response.status === 429) {
        throw new Error('Too many AI requests — try again shortly');
      }
      throw new Error(`${settings.aiProvider} API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    
    // Parse JSON defensively
    let rankings;
    try {
      if (settings.aiProvider === 'openai') {
        rankings = JSON.parse(content).rankings;
      } else {
        // For Groq and OpenRouter, parse the content directly
        rankings = JSON.parse(content);
      }
    } catch (parseError) {
      console.warn('Failed to parse AI response as JSON:', content);
      throw new Error('Invalid AI response format');
    }

    // Apply AI scores to roles
    return roles.map((role, index) => {
      const ranking = rankings.find(r => r.index === index);
      return {
        ...role,
        aiScore: ranking ? ranking.score : 0,
        aiExplanation: ranking ? ranking.explanation : ''
      };
    }).sort((a, b) => (b.aiScore || 0) - (a.aiScore || 0));

  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('AI request timed out');
    }
    throw error;
  }
}

function openRoleModal(rankedRoles) {
  const container = elements.roleOptions;
  container.innerHTML = '';

  const displayRoles = rankedRoles.slice(0, 3);
  let selectedIndex = 0;

  displayRoles.forEach((role, index) => {
    const roleElement = document.createElement('div');
    roleElement.className = 'role-option';
    roleElement.dataset.index = role.index;

    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = 'roleSelection';
    radio.className = 'role-radio';
    radio.checked = index === 0;

    const content = document.createElement('div');
    content.className = 'role-content';

    const title = document.createElement('div');
    title.className = 'role-title';
    title.textContent = role.title;

    const company = document.createElement('div');
    company.className = 'role-company';
    company.textContent = role.company || 'Unknown Company';

    const dates = document.createElement('div');
    dates.className = 'role-dates';
    dates.textContent = role.dates || '';

    content.appendChild(title);
    content.appendChild(company);
    content.appendChild(dates);

    // Add AI score if available
    if (role.aiScore !== undefined) {
      const score = document.createElement('div');
      score.className = 'role-score';
      score.textContent = `AI match: ${role.aiScore.toFixed(2)}`;
      content.appendChild(score);

      if (role.aiExplanation) {
        const explanation = document.createElement('div');
        explanation.className = 'ai-explanation';
        explanation.textContent = role.aiExplanation;
        content.appendChild(explanation);
      }
    }

    roleElement.appendChild(radio);
    roleElement.appendChild(content);

    roleElement.addEventListener('click', () => {
      // Update radio selection
      container.querySelectorAll('input[type="radio"]').forEach(r => r.checked = false);
      radio.checked = true;
      selectedIndex = role.index;
    });

    container.appendChild(roleElement);
  });

  // Show "Show all roles" if more than 3
  if (rankedRoles.length > 3) {
    const showAllBtn = document.createElement('button');
    showAllBtn.className = 'show-all-btn';
    showAllBtn.textContent = 'Show all roles';
    showAllBtn.addEventListener('click', () => {
      showAllRoles(rankedRoles);
    });
    container.appendChild(showAllBtn);
  }

  elements.roleSelectModal.classList.remove('hidden');
}

function showAllRoles(rankedRoles) {
  const container = elements.roleOptions;
  container.innerHTML = '';

  rankedRoles.forEach((role, index) => {
    const roleElement = document.createElement('div');
    roleElement.className = 'role-option';
    roleElement.dataset.index = role.index;

    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = 'roleSelection';
    radio.className = 'role-radio';
    radio.checked = index === 0;

    const content = document.createElement('div');
    content.className = 'role-content';

    const title = document.createElement('div');
    title.className = 'role-title';
    title.textContent = role.title;

    const company = document.createElement('div');
    company.className = 'role-company';
    company.textContent = role.company || 'Unknown Company';

    const dates = document.createElement('div');
    dates.className = 'role-dates';
    dates.textContent = role.dates || '';

    content.appendChild(title);
    content.appendChild(company);
    content.appendChild(dates);

    if (role.aiScore !== undefined) {
      const score = document.createElement('div');
      score.className = 'role-score';
      score.textContent = `AI match: ${role.aiScore.toFixed(2)}`;
      content.appendChild(score);

      if (role.aiExplanation) {
        const explanation = document.createElement('div');
        explanation.className = 'ai-explanation';
        explanation.textContent = role.aiExplanation;
        content.appendChild(explanation);
      }
    }

    roleElement.appendChild(radio);
    roleElement.appendChild(content);

    roleElement.addEventListener('click', () => {
      container.querySelectorAll('input[type="radio"]').forEach(r => r.checked = false);
      radio.checked = true;
    });

    container.appendChild(roleElement);
  });
}

function closeRoleModal() {
  elements.roleSelectModal.classList.add('hidden');
}

function confirmRoleSelection() {
  const selectedRadio = elements.roleOptions.querySelector('input[type="radio"]:checked');
  if (!selectedRadio) return;

  const selectedIndex = parseInt(selectedRadio.closest('.role-option').dataset.index);
  const selectedRole = currentData.rankedRoles.find(role => role.index === selectedIndex);

  if (selectedRole) {
    currentData.selectedRole = selectedRole;
    displaySelectedRole(selectedRole);
    closeRoleModal();
    updateSaveButton();
  }
}

function displaySelectedRole(role) {
  elements.selectedRolePill.textContent = `Selected: ${role.title} — ${role.company || 'Unknown'} (${role.dates || ''})`;
  elements.selectedRolePill.classList.remove('hidden');
  elements.selectedRoleSection.classList.remove('hidden');
}

function updateSaveButton() {
  const hasSelectedRole = currentData.selectedRole !== null;
  const hasManualFields = elements.titleField.value.trim() || elements.companyField.value.trim();
  
  elements.saveBtn.disabled = !(hasSelectedRole || hasManualFields);
}

async function handleSave() {
  try {
    if (!settings.appsScriptUrl || !settings.token) {
      showStatus('Please configure Apps Script URL and token in Settings', 'error');
      return;
    }

    showStatus('Saving to Google Sheets...', 'info');
    elements.saveBtn.disabled = true;
    elements.saveBtn.innerHTML = '<span class="loader"></span>Saving...';

    // Build payload (strict 8-column schema)
    const payload = {
      name: currentData.profile.name || '',
      title: currentData.selectedRole?.title || currentData.profile.title || '',
      company: currentData.selectedRole?.company || currentData.profile.company || '',
      profileUrl: currentData.profile.profileUrl,
      requestedAt: new Date().toISOString(),
      followUpDate: elements.followUpField.value || '',
      tag: elements.tagField.value || '',
      notes: elements.notesField.value || ''
    };

    // Send to background service worker
    const response = await chrome.runtime.sendMessage({
      type: 'SAVE_ROW',
      payload
    });

    if (response.success) {
      showStatus('Successfully saved to Google Sheets!', 'success');
      // Clear form
      clearForm();
    } else {
      throw new Error(response.error || 'Unknown error');
    }

  } catch (error) {
    console.error('Save error:', error);
    showStatus(`Save failed: ${error.message}`, 'error');
  } finally {
    elements.saveBtn.disabled = false;
    elements.saveBtn.textContent = 'Save to Sheet';
  }
}

function clearForm() {
  elements.keywordField.value = '';
  elements.tagField.value = '';
  elements.notesField.value = '';
  elements.followUpField.value = '';
  elements.profileSection.classList.add('hidden');
  elements.selectedRoleSection.classList.add('hidden');
  elements.detailsSection.classList.add('hidden');
  currentData = { profile: null, roles: [], context: null, selectedRole: null, rankedRoles: [] };
  saveSessionData();
}

// Settings management
function loadSettings() {
  chrome.storage.sync.get(settings, (result) => {
    settings = { ...settings, ...result };
    updateSettingsUI();
  });
}

function updateSettingsUI() {
  elements.appsScriptUrlField.value = settings.appsScriptUrl;
  elements.tokenField.value = settings.token;
  elements.aiProviderField.value = settings.aiProvider;
  elements.aiModelField.value = settings.aiModel;
  elements.aiKeyField.value = settings.aiKey;
  
  updateToggle(elements.aiRerankToggle, settings.aiRerank);
  updateToggle(elements.aiAutoTagToggle, settings.aiAutoTag);
  updateToggle(elements.aiFollowUpToggle, settings.aiFollowUp);
  updateToggle(elements.demoAIToggle, settings.demoAI);
  updateToggle(elements.captureOnConnectToggle, settings.captureOnConnect);
  
  // Update model options based on provider
  updateModelOptions(settings.aiProvider);
}

function updateToggle(element, isActive) {
  if (isActive) {
    element.classList.add('active');
  } else {
    element.classList.remove('active');
  }
}

function toggleSwitch(settingName) {
  settings[settingName] = !settings[settingName];
  updateToggle(elements[`${settingName}Toggle`], settings[settingName]);
}

function saveSettings() {
  settings.appsScriptUrl = elements.appsScriptUrlField.value.trim();
  settings.token = elements.tokenField.value.trim();
  settings.aiProvider = elements.aiProviderField.value;
  settings.aiModel = elements.aiModelField.value.trim() || (settings.aiProvider === 'groq' ? 'llama3-8b' : 'gpt-3.5-turbo');
  settings.aiKey = elements.aiKeyField.value.trim();

  chrome.storage.sync.set(settings, () => {
    showStatus('Settings saved successfully!', 'success');
  });
}

async function testAppsScript() {
  if (!settings.appsScriptUrl || !settings.token) {
    showStatus('Please enter Apps Script URL and token', 'error');
    return;
  }

  try {
    showStatus('Testing Apps Script connection...', 'info');
    
    const response = await chrome.runtime.sendMessage({
      type: 'TEST_APPS_SCRIPT',
      url: settings.appsScriptUrl,
      token: settings.token
    });

    if (response.success) {
      showStatus('Apps Script connection successful!', 'success');
    } else {
      throw new Error(response.error);
    }
  } catch (error) {
    showStatus(`Apps Script test failed: ${error.message}`, 'error');
  }
}

async function testOpenAI() {
  if (!settings.aiKey) {
    showStatus('Please enter your API key', 'error');
    return;
  }

  try {
    showStatus(`Testing ${settings.aiProvider} connection...`, 'info');
    
    if (settings.aiProvider === 'groq') {
      const success = await testGroq(settings);
      if (success) {
        showStatus('Groq API connection successful!', 'success');
      } else {
        throw new Error('Invalid response format');
      }
    } else if (settings.aiProvider === 'openai') {
      const response = await fetch('https://api.openai.com/v1/models', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${settings.aiKey}`
        }
      });

      if (response.ok) {
        showStatus('OpenAI API connection successful!', 'success');
      } else {
        throw new Error(`API error: ${response.status}`);
      }
    } else if (settings.aiProvider === 'openrouter') {
      const response = await fetch('https://openrouter.ai/api/v1/models', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${settings.aiKey}`
        }
      });

      if (response.ok) {
        showStatus('OpenRouter API connection successful!', 'success');
      } else {
        throw new Error(`API error: ${response.status}`);
      }
    }
  } catch (error) {
    console.error(`${settings.aiProvider} API test error:`, error);
    showStatus(`${settings.aiProvider} API test failed: ${error.message}`, 'error');
  }
}

async function testGroq(settings) {
  const { url, headers } = getAiEndpointAndHeaders({ aiProvider: 'groq', aiKey: settings.aiKey });
  const body = {
    model: settings.aiModel || 'llama3-8b',
    temperature: 0,
    messages: [
      { role: 'system', content: 'Reply with JSON {"ok":true}' },
      { role: 'user', content: 'Ping' }
    ]
  };
  const r = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
  const j = await r.json();
  const text = j?.choices?.[0]?.message?.content || '';
  return /"ok"\s*:\s*true/.test(text);
}

// Session data management
function saveSessionData() {
  chrome.storage.local.set({
    currentData: currentData
  });
}

function loadSessionData() {
  chrome.storage.local.get(['currentData'], (result) => {
    if (result.currentData) {
      currentData = result.currentData;
      
      if (currentData.profile) {
        displayProfileData(currentData.profile);
        if (currentData.selectedRole) {
          displaySelectedRole(currentData.selectedRole);
        }
        updateSaveButton();
      }
    }
  });
}

// Utility functions
function showStatus(message, type = 'info') {
  elements.statusMessage.textContent = message;
  elements.statusMessage.className = `status ${type}`;
  elements.statusMessage.classList.remove('hidden');
  
  // Auto-hide after 5 seconds
  setTimeout(() => {
    elements.statusMessage.classList.add('hidden');
  }, 5000);
}

function toggleMoreMenu() {
  elements.moreDropdown.classList.toggle('show');
}

function exportCsv() {
  if (!currentData.profile) {
    showStatus('No data to export', 'error');
    return;
  }

  const csvData = [
    ['name', 'title', 'company', 'profile_url', 'requested_at', 'follow_up_date', 'tag', 'notes'],
    [
      currentData.profile.name || '',
      currentData.selectedRole?.title || currentData.profile.title || '',
      currentData.selectedRole?.company || currentData.profile.company || '',
      currentData.profile.profileUrl || '',
      new Date().toISOString(),
      elements.followUpField.value || '',
      elements.tagField.value || '',
      elements.notesField.value || ''
    ]
  ];

  const csv = csvData.map(row => row.map(field => `"${field}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = `linklog_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  
  URL.revokeObjectURL(url);
  showStatus('CSV exported successfully!', 'success');
}

function handleKeyboard(event) {
  // ESC to close modal
  if (event.key === 'Escape' && !elements.roleSelectModal.classList.contains('hidden')) {
    closeRoleModal();
  }
  
  // ENTER to confirm role selection
  if (event.key === 'Enter' && !elements.roleSelectModal.classList.contains('hidden')) {
    confirmRoleSelection();
  }
}

// Close more menu when clicking outside
document.addEventListener('click', (event) => {
  if (!elements.moreBtn.contains(event.target) && !elements.moreDropdown.contains(event.target)) {
    elements.moreDropdown.classList.remove('show');
  }
});

// Provider change handler
function handleProviderChange() {
  const provider = elements.aiProviderField.value;
  updateModelOptions(provider);
  
  // Set default model for the provider
  const defaultModel = provider === 'groq' ? 'llama3-8b' : 
                      provider === 'openai' ? 'gpt-3.5-turbo' : 
                      'meta-llama/llama-3-8b-instruct';
  elements.aiModelField.value = defaultModel;
}

// Update model options based on provider
function updateModelOptions(provider) {
  const modelField = elements.aiModelField;
  const currentValue = modelField.value;
  
  // Clear existing options
  modelField.innerHTML = '';
  
  let options = [];
  if (provider === 'groq') {
    options = [
      { value: 'llama3-8b', label: 'Llama 3.1 8B (Fast)' },
      { value: 'llama3-70b', label: 'Llama 3.1 70B (Powerful)' },
      { value: 'mixtral-8x7b', label: 'Mixtral 8x7B (Balanced)' }
    ];
  } else if (provider === 'openai') {
    options = [
      { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo (Fast)' },
      { value: 'gpt-4o-mini', label: 'GPT-4o Mini (Balanced)' }
    ];
  } else if (provider === 'openrouter') {
    options = [
      { value: 'meta-llama/llama-3-8b-instruct', label: 'Llama 3.1 8B Instruct' },
      { value: 'mistralai/mistral-7b-instruct', label: 'Mistral 7B Instruct' }
    ];
  }
  
  // Add options
  options.forEach(option => {
    const optionElement = document.createElement('option');
    optionElement.value = option.value;
    optionElement.textContent = option.label;
    modelField.appendChild(optionElement);
  });
  
  // Try to restore current value or set default
  if (options.some(opt => opt.value === currentValue)) {
    modelField.value = currentValue;
  } else if (options.length > 0) {
    modelField.value = options[0].value;
  }
}
