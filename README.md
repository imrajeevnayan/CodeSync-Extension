# CodeSync

CodeSync is a Manifest V3 Chrome Extension that detects accepted submissions on coding platforms and automatically syncs solutions to a GitHub repository.

It is designed like LeetHub, but with broader platform support and a cleaner repository structure:

```text
CodeSync/
  LeetCode/
    Two Sum/
      solution.cpp
      README.md
      metadata.json

  Codeforces/
    Problem Name/
      solution.cpp
      README.md
      metadata.json
```

## Features

- Login with GitHub using OAuth Device Flow
- Choose an existing GitHub repository
- Create a new GitHub repository from the popup
- Near-instant detection (<300ms) and background queuing (<100ms) for real-time GitHub synchronization
- Robust node-by-node DOM verdict matching to isolate successful submission outcomes from historic failure logs on the page across all supported platforms
- Extract problem title, URL, language, source code, description, and topics when available
- Sync a solution file, problem `README.md`, and `metadata.json`
- Update existing GitHub files using SHA support
- UTF-8 safe Base64 encoding for GitHub uploads
- Clean platform/problem folder structure
- Optional difficulty-based folder organization through stored settings
- Optional language-based folder organization through stored settings
- Custom folder naming conventions through stored settings
- Duplicate submission protection
- Rate-limit-aware GitHub API calls
- Support for resubmissions and file overwrites
- Final-verdict filtering to ignore failed, pending, running, and wrong-answer submissions
- Custom branch support through stored settings
- Commit author metadata support
- Optional daily streak commits through stored settings
- Local topic/tag inference when a platform does not expose tags
- SPA navigation detection
- Dynamic site support using `MutationObserver`
- Chrome notifications for sync success or failure

## Supported Platforms

- LeetCode
- HackerRank
- CodeSignal
- InterviewBit
- AlgoExpert
- Codeforces
- AtCoder
- CodeChef
- Topcoder
- SPOJ
- GeeksforGeeks
- Exercism
- Coding Ninjas (Code360)
- NeetCode
- BinarySearch
- CSES
- UVa Online Judge
- LintCode

## Supported Coding Sheets

CodeSync automatically detects when a solved problem belongs to any of the curated coding sheets, creating dedicated folders for each sheet in your GitHub repository and pushing solutions into them.

The following sheets are supported out-of-the-box:

| Coding Sheet | Solved | Total |
| :--- | :--- | :--- |
| Code Army Sheet | 0 | 726 |
| Strivers A2Z DSA Sheet | 0 | 455 |
| Love Babbar Sheet | 0 | 445 |
| DSA by Shradha Didi & Aman Bhaiya | 0 | 403 |
| AlgoMaster 300 | 0 | 300 |
| Arsh DSA Sheet | 0 | 287 |
| Fraz DSA Sheet | 0 | 279 |
| Neetcode 250 | 0 | 250 |
| Striver SDE Sheet | 0 | 191 |
| 20 Essential DSA Patterns | 0 | 180 |
| Neetcode 150 | 0 | 150 |
| Top Interview 150 | 0 | 150 |
| Atharva Patil's 150 Sheet | 0 | 150 |
| AlgoMaster 150 | 0 | 150 |
| LeetCode 100 Most Liked | 0 | 100 |
| 6 Companies 30 Days | 0 | 90 |
| Striver 79 | 0 | 79 |
| Blind 75 | 0 | 75 |
| AlgoMaster 75 | 0 | 75 |
| DP Mastery Sheet | 0 | 67 |
| String Mastery Sheet | 0 | 51 |
| Graph Mastery Sheet | 0 | 29 |
| Heap Mastery Sheet | 0 | 22 |
| Grind 75 | 0 | 75 |
| Grind 169 | 0 | 169 |
| LeetCode 75 | 0 | 75 |
| SQL 50 | 0 | 50 |
| GFG 160 | 0 | 160 |
| CSES Problem Set | 0 | 300 |
| InterviewBit Sets | 0 | 200 |
| Nishant Chahar 151 | 0 | 151 |
| Kushal Vijay Patterns | 0 | 100 |

## Repository Structure

By default, CodeSync automatically maps each accepted submission to multiple paths in your repository to give you the most organized view possible:

1. **Difficulty + Topic folders** (creates a folder for each of the primary topics, up to 3):
   ```text
   {baseFolder}/{platform}/{difficulty}/{topic}/{problemTitle}/
   ```
   *Example*: `CodeSync/leetcode/easy/two-pointer/two-sum/`

2. **Difficulty "All" folder**:
   ```text
   {baseFolder}/{platform}/{difficulty}/all/{problemTitle}/
   ```
   *Example*: `CodeSync/leetcode/easy/all/two-sum/`

3. **Platform-wide "All" folder**:
   ```text
   {baseFolder}/{platform}/all/{problemTitle}/
   ```
   *Example*: `CodeSync/leetcode/all/two-sum/`

Each problem folder contains:
- `solution.{languageExtension}`: The synced source code with metadata comments header.
- `README.md`: The formatted problem details and description.
- `metadata.json`: Machine-readable metadata.

`metadata.json` contains:

```json
{
  "submissionTimestamp": "2026-05-29T12:00:00.000Z",
  "runtime": "42 ms",
  "memoryUsage": "16.5 MB",
  "difficulty": "Easy",
  "tags": ["Array", "Hash Table"],
  "platform": "LeetCode",
  "language": "Python 3"
}
```

Folders are created automatically by GitHub when CodeSync writes files. CodeSync does not create empty folders, which keeps the repository clean and avoids duplicate folder commits.

### Custom Folder Settings (Optional)

If you prefer a single custom path structure instead of the automatic multi-path layout, you can configure a `folderConvention` setting stored in `chrome.storage.sync`:

```json
{
  "folderConvention": "{baseFolder}/{platform}/{difficulty}/{language}/{problemTitle}"
}
```

Custom convention supports these placeholders:
- `{baseFolder}`
- `{platform}`
- `{difficulty}`
- `{language}`
- `{problemTitle}`
- `{title}`
- `{primaryTag}`

### Topic & Difficulty Normalization

- **Difficulty mapping**: Classifies rating values and string keywords into three primary levels: `easy`, `medium`, `hard` (defaulting to `unknown` if undetermined).
- **Topic slugification**: Standardizes topic tags into clean, uniform folder names (e.g. converting `"two pointer"` or `"two pointers"` to `two-pointer`, `"dynamic programming"` or `"dp"` to `dynamic-programming`, etc.).

## Files

```text
manifest.json
background.js
content.js
popup.html
popup.css
popup.js
README.md
```

## GitHub OAuth Setup

CodeSync uses the same general approach as LeetHub: the extension bundles a public GitHub OAuth App Client ID, and users only click **Login with GitHub**.

GitHub requires an OAuth App before login can start. The Client ID is public and safe to ship in the extension. A client secret must not be shipped in a browser extension.

### Create a GitHub OAuth App

1. Go to GitHub Developer Settings:
   `https://github.com/settings/developers`

2. Open **OAuth Apps**.

3. Click **New OAuth App**.

4. Use values like:

```text
Application name: CodeSync
Homepage URL: https://github.com/your-username/CodeSync
Authorization callback URL: http://localhost
```

5. Enable **Device Flow** in the OAuth App settings.

6. Copy the OAuth App **Client ID**.

7. Open `popup.js` and replace:

```js
const CODESYNC_GITHUB_CLIENT_ID = "YOUR_GITHUB_OAUTH_CLIENT_ID";
```

with:

```js
const CODESYNC_GITHUB_CLIENT_ID = "your_real_github_oauth_client_id";
```

After this one-time developer setup, users do not need to enter a token or Client ID. They only click **Login with GitHub**.

## Installation

1. Open Chrome.

2. Go to:

```text
chrome://extensions
```

3. Enable **Developer mode**.

4. Click **Load unpacked**.

5. Select the CodeSync folder.

6. Confirm that the extension loads without errors.

## Usage

1. Click the CodeSync extension icon.

2. Click **Login with GitHub**.

3. Enter the displayed code on GitHub when prompted.

4. Choose an existing repository, or create a new repository.

5. Solve and submit a problem on a supported coding platform.

6. When the submission is accepted, CodeSync syncs the solution to GitHub.

## Popup UI

The popup intentionally stays minimal:

- GitHub account status
- Login with GitHub
- Choose repository
- Refresh repositories
- Create new repository

Advanced settings are kept internal so the extension feels simple for end users.

## How Sync Works

1. `content.js` runs on supported coding platforms.

2. It watches for page changes using `MutationObserver`.

3. It detects accepted verdicts using platform-specific extractors.

4. It extracts title, URL, language, code, description, and topics.

5. It sends the submission to `background.js`.

6. `background.js` writes or updates files through the GitHub REST API.

7. Chrome shows a success or failure notification.

## GitHub Permissions

The OAuth scope used is:

```text
repo
```

This is required to:

- Read repositories
- Create repositories
- Write solution files
- Update existing files
- Support private repositories if enabled later

## Verification

Run these checks from the project folder:

```powershell
node --check background.js
node --check content.js
node --check popup.js
Get-Content manifest.json | ConvertFrom-Json | Out-Null
```

Then reload the extension from:

```text
chrome://extensions
```

## Debugging

### Extension Load Errors

Go to:

```text
chrome://extensions
```

Find CodeSync and click **Errors** if Chrome reports any issue.

### Background Logs

Go to:

```text
chrome://extensions
```

Find CodeSync and open the service worker inspection view.

### Content Script Logs

Open a supported coding platform, then open DevTools:

```text
F12 -> Console
```

Look for CodeSync messages.

### Popup Logs

Right-click the extension popup and choose **Inspect**.

## Common Issues

### "CodeSync GitHub login is not configured"

The OAuth Client ID has not been set in `popup.js`.

Create a GitHub OAuth App, enable Device Flow, and replace:

```js
const CODESYNC_GITHUB_CLIENT_ID = "YOUR_GITHUB_OAUTH_CLIENT_ID";
```

with your real Client ID.

### Repositories Do Not Load

Check that:

- GitHub login completed successfully
- The OAuth App has Device Flow enabled
- The extension has network access
- The OAuth token has the `repo` scope

### Submission Is Not Detected

Supported coding sites change their DOM often. If a submission is accepted but not synced:

- Open DevTools on the coding platform
- Check the console for CodeSync extraction warnings
- Confirm the source code is visible on the page after acceptance
- Try refreshing the submission result page

### GitHub Upload Fails

Check:

- The selected repository still exists
- The authenticated account has write access
- The OAuth token has not been revoked
- The file path does not exceed GitHub limits

CodeSync handles common failures with clear messages:

- Expired or revoked GitHub token: asks the user to login again
- Missing repository: asks the user to choose or create a repository
- Network failures: asks the user to check the connection
- GitHub API rate limits: waits and retries before failing
- Unsupported platform: skips the page without syncing

## Security Notes

- CodeSync does not ask users to paste a personal access token.
- OAuth tokens are stored using `chrome.storage.sync`.
- The OAuth Client ID is public by design.
- Do not put a GitHub OAuth Client Secret in this extension.

## Development Notes

- Manifest version: `3`
- Background worker: `background.js`
- Content script: `content.js`
- Popup UI: `popup.html`, `popup.css`, `popup.js`
- Storage: `chrome.storage.sync`
- GitHub API: REST Contents API

## License

Add your preferred license before publishing.
