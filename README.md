# LinkLog Chrome Extension

A privacy-first, user-triggered Chrome Extension (Manifest V3) for logging LinkedIn networking outreach to Google Sheets with AI-powered role selection and smart suggestions.

## 🛡️ Privacy-First Design

LinkLog is built with privacy and user control at its core:

- **User-triggered only**: No automatic scraping, timers, or background crawling
- **Visible confirmation**: All captured data is shown to you before saving
- **Minimal data**: Only captures what you can see on the LinkedIn page
- **Local storage**: Settings and offline queue stored locally in your browser
- **Opt-in AI**: AI features are disabled by default and require your permission
- **No tracking**: We don't collect or track your browsing activity
- **Your data**: All captured data goes directly to your Google Sheet
- **API key security**: Your OpenAI API key is stored only in chrome.storage.sync
- **AI data**: Data is sent to OpenAI only when AI toggles are enabled

## 🚀 Features

- **Smart Profile Parsing**: Resilient extraction of name, title, company, and connection status
- **Role Selection Modal**: Choose the most relevant role from a ranked list
- **AI-Powered Insights**: Optional AI re-ranking, auto-tagging, and follow-up suggestions
- **Google Sheets Integration**: Save directly to your Google Sheets via Apps Script
- **Duplicate Detection**: Automatically detects and updates existing profiles
- **Offline Support**: Queues data when offline and syncs when connection is restored
- **CSV Export**: Export your captured data as CSV files
- **Capture on Connect**: Optional automatic capture when clicking LinkedIn's Connect button

## 📦 Installation

### Load as Unpacked Extension

1. **Download or Clone** this repository to your local machine

2. **Open Chrome** and navigate to `chrome://extensions/`

3. **Enable Developer Mode** by toggling the switch in the top-right corner

4. **Click "Load unpacked"** and select the LinkLog directory

5. **Pin the Extension** (optional) by clicking the puzzle piece icon in Chrome's toolbar and pinning LinkLog

### Icon Setup

Before loading the extension, replace the placeholder `icons/icon128.png` with an actual 128x128 PNG icon.

## 🔧 Google Apps Script Setup

### Option A: Use Existing Sheet (Recommended)

1. **Open your Google Sheet** where you want to log LinkedIn connections

2. **Ensure the header row** (first row) contains exactly these 8 columns:
   ```
   name | title | company | profile_url | requested_at | follow_up_date | tag | notes
   ```

3. **Go to Extensions → Apps Script** in your Google Sheet

4. **Replace the default code** with the following:

```javascript
function doPost(e) {
  try {
    // Parse the incoming JSON
    const data = JSON.parse(e.postData.contents);
    
    // Verify authorization
    const authHeader = e.parameter.Authorization || e.parameter.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return ContentService.createTextOutput(JSON.stringify({
        ok: false,
        error: 'Unauthorized'
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // Get the active spreadsheet
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = spreadsheet.getActiveSheet();
    
    // Ensure header row exists
    const headerRow = sheet.getRange(1, 1, 1, 8).getValues()[0];
    const expectedHeaders = ['name', 'title', 'company', 'profile_url', 'requested_at', 'follow_up_date', 'tag', 'notes'];
    
    if (headerRow.join('|') !== expectedHeaders.join('|')) {
      // Write header row if it doesn't match
      sheet.getRange(1, 1, 1, 8).setValues([expectedHeaders]);
    }
    
    const { mode, name, title, company, profileUrl, requestedAt, followUpDate, tag, notes } = data;
    
    if (mode === 'update') {
      // Find and update existing row
      const dataRange = sheet.getDataRange();
      const values = dataRange.getValues();
      
      for (let i = 1; i < values.length; i++) { // Skip header row
        if (values[i][3] === profileUrl) { // profile_url is column 4 (0-indexed)
          sheet.getRange(i + 1, 2, 1, 6).setValues([[title, company, requestedAt, followUpDate, tag, notes]]);
          return ContentService.createTextOutput(JSON.stringify({
            ok: true,
            message: 'Row updated',
            rowId: i + 1
          })).setMimeType(ContentService.MimeType.JSON);
        }
      }
    }
    
    // Append new row
    const newRow = sheet.getLastRow() + 1;
    sheet.getRange(newRow, 1, 1, 8).setValues([[name, title, company, profileUrl, requestedAt, followUpDate, tag, notes]]);
    
    return ContentService.createTextOutput(JSON.stringify({
      ok: true,
      message: 'Row added',
      rowId: newRow
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      ok: false,
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({
    ok: true,
    message: 'LinkLog Apps Script is running'
  })).setMimeType(ContentService.MimeType.JSON);
}
```

5. **Deploy the script**:
   - Click "Deploy" → "New deployment"
   - Choose "Web app" as the type
   - Set "Execute as" to "Me"
   - Set "Who has access" to "Anyone"
   - Click "Deploy"

6. **Copy the deployment URL** and use it in the extension settings

### Option B: Create New Sheet

If you want LinkLog to create a new sheet automatically, modify the Apps Script code to include:

```javascript
// Add this at the beginning of doPost function
if (!SpreadsheetApp.getActiveSpreadsheet()) {
  const newSpreadsheet = SpreadsheetApp.create('LinkLog Connections');
  const newSheet = newSpreadsheet.getActiveSheet();
  newSheet.getRange(1, 1, 1, 8).setValues([['name', 'title', 'company', 'profile_url', 'requested_at', 'follow_up_date', 'tag', 'notes']]);
  // Return the new sheet URL
  return ContentService.createTextOutput(JSON.stringify({
    ok: true,
    sheetUrl: newSpreadsheet.getUrl()
  })).setMimeType(ContentService.MimeType.JSON);
}
```

## 🔑 Authorization Token

For the authorization token, you can use any secure string. The Apps Script will validate the Bearer token format. You can generate a simple token or use a UUID.

## 🤖 OpenAI Setup

### Get an API Key

1. **Visit** [OpenAI Platform](https://platform.openai.com/api-keys)
2. **Sign in** or create an account
3. **Click "Create new secret key"**
4. **Copy the key** (it starts with `sk-`)

### Configure in Extension

1. **Open LinkLog** extension popup
2. **Go to Settings** tab
3. **Paste your API key** in the "API Key" field
4. **Choose model** (default: `gpt-3.5-turbo`)
5. **Click "Test OpenAI"** → expect ✅
6. **Toggle AI features** as desired:
   - "Use AI re-rank" - Re-ranks roles by relevance
   - "Use AI auto-tag" - Suggests professional tags
   - "Use AI follow-up suggestions" - Suggests optimal follow-up dates

### Demo/Mock AI Mode

For testing without API calls, enable "Demo/Mock AI mode" in settings. This provides realistic mock AI responses for all features.

## 📖 Usage

### Basic Workflow

1. **Navigate** to any LinkedIn profile page
2. **Click** the LinkLog extension icon in your Chrome toolbar
3. **Enter** an optional role keyword (e.g., "investment banking analyst")
4. **Click "Capture"** to extract profile data
5. **Select** the most relevant role from the modal (or fill in manual fields)
6. **Review** and edit the suggested tag and follow-up date
7. **Add** any notes
8. **Click "Save to Sheet"** to store the data

### Role Selection Modal

After capturing a profile, LinkLog will show a modal with ranked roles:
- **Top 3 roles** are shown by default
- **AI scores** are displayed if AI re-ranking is enabled
- **"Show all roles"** expands the list if there are more than 3
- **Radio buttons** let you select the most relevant role
- **Keyboard navigation** with ESC to cancel, ENTER to confirm

### Settings Configuration

1. **Google Apps Script URL**: Your deployed Apps Script web app URL
2. **Authorization Token**: The Bearer token for authentication
3. **AI Provider**: Currently supports OpenAI (default)
4. **AI API Key**: Your OpenAI API key (optional)
5. **Feature Toggles**:
   - **AI Re-rank**: Use AI to re-rank roles by relevance
   - **AI Auto-tag**: Automatically suggest tags based on profile
   - **AI Follow-up**: Suggest optimal follow-up dates
   - **Capture on Connect**: Automatically capture when clicking Connect
   - **Demo/Mock AI**: Use mock AI responses for testing

## 📊 Data Structure

The extension captures exactly 8 fields to your Google Sheet:

| Field | Description | Example |
|-------|-------------|---------|
| `name` | Person's full name | "John Doe" |
| `title` | Job title/role | "Senior Software Engineer" |
| `company` | Company name | "Google" |
| `profile_url` | LinkedIn profile URL | "https://linkedin.com/in/johndoe" |
| `requested_at` | ISO timestamp when captured | "2024-01-01T12:00:00.000Z" |
| `follow_up_date` | Suggested follow-up date | "2024-01-08" |
| `tag` | Category/tag | "Prospect", "IB", "Consulting" |
| `notes` | Additional notes | "Interested in our product" |

## 🏗️ File Structure

```
LinkLog/
├── manifest.json          # Extension configuration (Manifest V3)
├── content.js             # Content script with profile parsing
├── popup.html             # Main UI with role selection modal
├── popup.js               # Popup functionality and AI integration
├── service_worker.js      # Background service worker
├── icons/
│   └── icon128.png        # Extension icon (replace with actual image)
└── README.md              # This file
```

## 🔒 Permissions

LinkLog requests minimal permissions:

- **activeTab**: To access the current LinkedIn page
- **storage**: To save settings and offline queue locally
- **scripting**: To inject content scripts
- **host_permissions**: Only for `https://*.linkedin.com/*`

## 🛠️ Development

### Current Status

- ✅ Privacy-first design with user-triggered capture
- ✅ Smart profile parsing with resilient selectors
- ✅ Role selection modal with ranking
- ✅ Google Sheets integration via Apps Script
- ✅ Duplicate detection and update support
- ✅ Offline queue with exponential backoff
- ✅ OpenAI integration with role re-ranking
- ✅ CSV export functionality
- ✅ Settings management and privacy controls
- ✅ Demo/Mock AI mode for testing

### TODO

- [ ] Add Airtable/Notion integration stubs
- [ ] Enhance role selection UI with more details
- [ ] Add bulk operations support
- [ ] Implement auto-tagging and follow-up suggestions
- [ ] Add more AI providers (Claude, etc.)

### Technical Notes

- **Manifest V3**: Uses the latest Chrome extension manifest format
- **Resilient Parsing**: Multiple CSS selectors with fallbacks for LinkedIn's dynamic UI
- **Exponential Backoff**: Smart retry logic for network failures
- **Local Storage**: All data stored locally until successfully posted
- **Strict Schema**: Only 8 specified fields are written to Google Sheets
- **AI Integration**: OpenAI API with proper error handling and fallbacks

## 🐛 Troubleshooting

### Extension Not Loading
- Ensure Developer Mode is enabled
- Check that all files are present in the directory
- Verify `manifest.json` syntax is valid

### Capture Not Working
- Make sure you're on a LinkedIn profile page
- Check browser console for parsing errors
- LinkedIn may have updated their UI - check selectors in `content.js`

### Save Not Working
- Verify Google Apps Script URL and token are configured correctly
- Test connection using the "Test Apps Script" button
- Check service worker console for errors
- Ensure your Google Sheet has the correct header row

### Role Selection Modal Issues
- Ensure the page has fully loaded before capturing
- Check that the profile has experience sections
- Try refreshing the page and capturing again

### AI Features Not Working
- Verify OpenAI API key is correct
- Test connection using "Test OpenAI" button
- Check for rate limiting (429 errors)
- Try enabling "Demo/Mock AI mode" for testing

### Offline Queue Issues
- Check Chrome's storage quota
- Clear browser data if needed
- Verify network connectivity

## 📋 Compliance

LinkLog is designed to comply with:

- **GDPR**: User control over data collection and processing
- **CCPA**: Clear disclosure of data practices
- **LinkedIn ToS**: Respectful, user-triggered data collection
- **Chrome Web Store Policies**: Minimal permissions and transparent functionality

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly on LinkedIn
5. Submit a pull request

## 📄 License

This project is for educational and personal use. Please respect LinkedIn's terms of service and use responsibly.

---

**Remember**: LinkLog is designed for personal use and data collection. Always respect privacy and terms of service when scraping web data. The extension only captures what you explicitly choose to capture and always shows you the data before saving.
