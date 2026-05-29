"use strict";

const CODESYNC_GITHUB_CLIENT_ID = "Ov23likMwfQLsGH9E40I";
const GITHUB_OAUTH_SCOPE = "repo";
const GITHUB_DEVICE_CODE_URL = "https://github.com/login/device/code";
const GITHUB_ACCESS_TOKEN_URL = "https://github.com/login/oauth/access_token";
const AUTH_ALARM_NAME = "codesync-github-auth-poll";

const DEFAULT_SETTINGS = {
  githubToken: "",
  repository: "",
  branch: "",
  authorName: "CodeSync",
  authorEmail: "codesync@users.noreply.github.com",
  enableDailyStreak: false,
  organizeByDifficulty: false,
  organizeByLanguage: false,
  folderConvention: "",
  baseFolder: "CodeSync",
  commitTemplate: "Add {platform} solution: {title}"
};

const GITHUB_RATE_LIMIT_RETRY_MS = 60 * 1000;
const GITHUB_MAX_RETRIES = 2;

const LANGUAGE_EXTENSIONS = {
  "c": "c",
  "c++": "cpp",
  "cpp": "cpp",
  "c#": "cs",
  "csharp": "cs",
  "go": "go",
  "golang": "go",
  "java": "java",
  "javascript": "js",
  "js": "js",
  "typescript": "ts",
  "kotlin": "kt",
  "php": "php",
  "python": "py",
  "python 2": "py",
  "python 3": "py",
  "ruby": "rb",
  "rust": "rs",
  "scala": "scala",
  "swift": "swift",
  "mysql": "sql",
  "postgresql": "sql",
  "sql": "sql",
  "racket": "rkt",
  "erlang": "erl",
  "elixir": "ex",
  "dart": "dart",
  "bash": "sh",
  "shell": "sh",
  "plain text": "txt",
  "text": "txt"
};

const NOTIFICATION_ICON =
  "data:image/svg+xml;charset=UTF-8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128"><rect width="128" height="128" rx="24" fill="#111827"/><path fill="#38bdf8" d="M33 43 12 64l21 21 8-8-13-13 13-13zM95 43l-8 8 13 13-13 13 8 8 21-21z"/><path fill="#f8fafc" d="m74 26-31 78h12l31-78z"/></svg>'
  );

chrome.runtime.onInstalled.addListener(async () => {
  const existing = await getStorage(DEFAULT_SETTINGS);
  await setStorage({ ...DEFAULT_SETTINGS, ...removeUndefined(existing) });
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === AUTH_ALARM_NAME) {
    pollGitHubAuth().catch((error) => {
      console.warn("CodeSync GitHub auth polling failed:", error.message);
      notify("CodeSync GitHub login failed", error.message || "Login could not be completed.");
    });
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "CODESYNC_AUTH_START") {
    startGitHubAuth()
      .then((result) => sendResponse({ ok: true, result }))
      .catch((error) => sendResponse({ ok: false, error: error.message || String(error) }));
    return true;
  }

  if (!message || message.type !== "CODESYNC_SUBMISSION") {
    return false;
  }

  handleSubmission(message.payload, sender)
    .then((result) => sendResponse({ ok: true, result }))
    .catch((error) => {
      console.error("CodeSync submission failed:", error);
      notify("CodeSync sync failed", error.message || "Unable to push submission to GitHub.");
      sendResponse({ ok: false, error: error.message || String(error) });
    });

  return true;
});

async function startGitHubAuth() {
  const clientId = getGitHubClientId();
  const deviceData = await requestDeviceCode(clientId);
  const intervalSeconds = Number(deviceData.interval || 5);
  const authState = {
    clientId,
    deviceCode: deviceData.device_code,
    userCode: deviceData.user_code,
    verificationUrl: buildVerificationUrl(deviceData),
    intervalSeconds,
    expiresAt: Date.now() + Number(deviceData.expires_in || 900) * 1000
  };

  await setLocalStorage({ codesyncAuthState: authState });
  scheduleAuthPoll(intervalSeconds);

  const authPageUrl = chrome.runtime.getURL("auth.html");
  chrome.tabs.create({ url: authPageUrl }, () => {
    const error = chrome.runtime.lastError;
    if (error) {
      console.warn("CodeSync could not open GitHub login helper tab:", error.message);
    }
  });

  return {
    userCode: authState.userCode,
    verificationUrl: authState.verificationUrl
  };
}

async function requestDeviceCode(clientId) {
  const response = await fetch(GITHUB_DEVICE_CODE_URL, {
    method: "POST",
    headers: {
      "Accept": "application/json",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      client_id: clientId,
      scope: GITHUB_OAUTH_SCOPE
    })
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.error) {
    throw new Error(data.error_description || data.message || "Could not start GitHub login.");
  }

  return data;
}

async function pollGitHubAuth() {
  const { codesyncAuthState: authState } = await getLocalStorage({ codesyncAuthState: null });
  if (!authState) {
    return;
  }

  if (Date.now() >= authState.expiresAt) {
    await clearAuthState();
    notify("CodeSync GitHub login expired", "Start GitHub login again from the CodeSync popup.");
    return;
  }

  const response = await fetch(GITHUB_ACCESS_TOKEN_URL, {
    method: "POST",
    headers: {
      "Accept": "application/json",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      client_id: authState.clientId,
      device_code: authState.deviceCode,
      grant_type: "urn:ietf:params:oauth:grant-type:device_code"
    })
  });

  const data = await response.json().catch(() => ({}));
  if (data.access_token) {
    const user = await fetchGitHubUser(data.access_token);
    await setStorage({
      githubToken: data.access_token,
      githubUser: user.login || user.name || "GitHub user"
    });
    await clearAuthState();
    notify("CodeSync GitHub connected", `Connected as ${user.login || user.name || "GitHub user"}.`);
    return;
  }

  if (data.error === "authorization_pending") {
    scheduleAuthPoll(authState.intervalSeconds);
    return;
  }

  if (data.error === "slow_down") {
    authState.intervalSeconds = Number(authState.intervalSeconds || 5) + 5;
    await setLocalStorage({ codesyncAuthState: authState });
    scheduleAuthPoll(authState.intervalSeconds);
    return;
  }

  await clearAuthState();
  throw new Error(data.error_description || data.message || "GitHub login was not completed.");
}

async function fetchGitHubUser(token) {
  const response = await githubFetch("https://api.github.com/user", {
    headers: githubHeaders(token)
  });

  if (!response.ok) {
    throw new Error(await githubErrorMessage(response, "Could not validate GitHub login"));
  }

  return response.json();
}

function scheduleAuthPoll(intervalSeconds) {
  chrome.alarms.create(AUTH_ALARM_NAME, {
    when: Date.now() + Math.max(Number(intervalSeconds || 5), 1) * 1000
  });
}

async function clearAuthState() {
  await removeLocalStorage(["codesyncAuthState"]);
  chrome.alarms.clear(AUTH_ALARM_NAME);
}

function buildVerificationUrl(deviceData) {
  if (deviceData.verification_uri_complete) {
    return deviceData.verification_uri_complete;
  }

  const url = new URL(deviceData.verification_uri);
  url.searchParams.set("user_code", deviceData.user_code);
  return url.toString();
}

function getGitHubClientId() {
  const clientId = String(CODESYNC_GITHUB_CLIENT_ID || "").trim();
  if (!clientId || clientId === "YOUR_GITHUB_OAUTH_CLIENT_ID") {
    throw new Error("CodeSync GitHub login is not configured. Set CODESYNC_GITHUB_CLIENT_ID in background.js.");
  }
  return clientId;
}

async function handleSubmission(rawSubmission, sender) {
  const settings = await getSettings();
  validateSettings(settings);

  // Normalize content-script data before deriving paths or writing to GitHub.
  const submission = normalizeSubmission(rawSubmission, sender);
  const files = buildSubmissionFiles(submission, settings);
  const commitMessage = renderCommitMessage(settings.commitTemplate, submission);

  const writeContext = {
    token: settings.githubToken,
    repository: settings.repository,
    branch: cleanText(settings.branch),
    author: buildCommitAuthor(settings),
    message: commitMessage
  };

  await putGitHubFile({
    ...writeContext,
    path: files.solution.path,
    content: files.solution.content
  });

  await putGitHubFile({
    ...writeContext,
    path: files.readme.path,
    content: files.readme.content
  });

  await putGitHubFile({
    ...writeContext,
    path: files.metadata.path,
    content: files.metadata.content
  });

  if (settings.enableDailyStreak) {
    await putGitHubFile({
      ...writeContext,
      path: buildDailyStreakPath(submission, settings),
      content: buildDailyStreakContent(submission),
      message: `Update CodeSync streak: ${new Date(submission.detectedAt).toISOString().slice(0, 10)}`
    });
  }

  notify("CodeSync synced solution", `${submission.platform}: ${submission.title}`);
  return { solutionPath: files.solution.path, readmePath: files.readme.path, metadataPath: files.metadata.path };
}

function normalizeSubmission(rawSubmission, sender) {
  const pageUrl = rawSubmission.problemUrl || sender?.tab?.url || "";
  const title = cleanText(rawSubmission.title) || "Untitled Problem";
  const language = cleanText(rawSubmission.language) || "Text";
  const platform = cleanText(rawSubmission.platform) || "Unknown";
  const sourceCode = String(rawSubmission.sourceCode || "").trim();
  const topics = normalizeTopics(rawSubmission.topics);
  const detectedAt = rawSubmission.detectedAt || new Date().toISOString();

  if (!sourceCode) {
    throw new Error("Accepted submission was detected, but source code could not be extracted.");
  }

  return {
    id: rawSubmission.id || hashString(`${platform}|${title}|${language}|${sourceCode}`),
    platform,
    title,
    problemUrl: pageUrl,
    language,
    topics,
    runtime: cleanText(rawSubmission.runtime) || "N/A",
    memory: cleanText(rawSubmission.memory) || "N/A",
    difficulty: normalizeDifficulty(rawSubmission.difficulty),
    sourceCode,
    description: cleanText(rawSubmission.description),
    detectedAt
  };
}

function buildSubmissionFiles(submission, settings) {
  const extension = extensionForLanguage(submission.language);
  const basePath = buildSubmissionBasePath(submission, settings);
  const solutionFileName = `solution.${extension}`;
  const solutionHeader = getCommentHeader(submission, extension);
  const readme = buildReadme(submission);
  const metadata = buildMetadata(submission);

  return {
    solution: {
      path: joinPath(basePath, solutionFileName),
      content: `${solutionHeader}${submission.sourceCode.trim()}\n`
    },
    readme: {
      path: joinPath(basePath, "README.md"),
      content: readme
    },
    metadata: {
      path: joinPath(basePath, "metadata.json"),
      content: `${JSON.stringify(metadata, null, 2)}\n`
    }
  };
}

function buildSubmissionBasePath(submission, settings) {
  const values = {
    baseFolder: settings.baseFolder || DEFAULT_SETTINGS.baseFolder,
    platform: submission.platform,
    difficulty: submission.difficulty,
    language: displayLanguage(submission.language),
    problemTitle: submission.title,
    title: submission.title,
    primaryTag: primaryTopic(submission.topics)
  };

  if (cleanText(settings.folderConvention)) {
    return renderFolderConvention(settings.folderConvention, values);
  }

  return joinPath(
    ...sanitizePath(values.baseFolder),
    sanitizePathPart(values.platform),
    settings.organizeByDifficulty ? sanitizePathPart(values.difficulty) : "",
    settings.organizeByLanguage ? sanitizePathPart(values.language) : "",
    sanitizePathPart(values.problemTitle)
  );
}

function renderFolderConvention(convention, values) {
  const rendered = String(convention).replace(/\{(\w+)\}/g, (match, key) => {
    return Object.prototype.hasOwnProperty.call(values, key) ? values[key] : match;
  });

  return joinPath(...rendered.split("/").map((part) => sanitizePathPart(part)));
}

function getCommentHeader(submission, extension) {
  const lines = [
    `Platform: ${submission.platform}`,
    `Problem: ${submission.title}`,
    `URL: ${submission.problemUrl || "N/A"}`,
    `Language: ${submission.language}`,
    `Difficulty: ${submission.difficulty}`,
    `Topics: ${submission.topics.join(", ")}`,
    `Runtime: ${submission.runtime}`,
    `Memory: ${submission.memory}`,
    `Synced: ${submission.detectedAt}`
  ];

  if (["py", "rb", "sh", "r", "pl"].includes(extension)) {
    return lines.map((line) => `# ${line}`).join("\n") + "\n\n";
  }

  if (["sql"].includes(extension)) {
    return lines.map((line) => `-- ${line}`).join("\n") + "\n\n";
  }

  return `/*\n${lines.map((line) => ` * ${line}`).join("\n")}\n */\n\n`;
}

function buildReadme(submission) {
  const description = submission.description || "Problem description was not available on the page at sync time.";

  return [
    `# ${submission.title}`,
    "",
    `- Platform: ${submission.platform}`,
    `- Language: ${submission.language}`,
    `- Difficulty: ${submission.difficulty}`,
    `- Topics: ${submission.topics.join(", ")}`,
    `- Runtime: ${submission.runtime}`,
    `- Memory: ${submission.memory}`,
    `- Problem URL: ${submission.problemUrl || "N/A"}`,
    `- Synced: ${submission.detectedAt}`,
    "",
    "## Problem Description",
    "",
    description,
    "",
    "## Explanation",
    "",
    buildGeneratedExplanation(submission),
    ""
  ].join("\n");
}

function buildMetadata(submission) {
  return {
    submissionTimestamp: submission.detectedAt,
    runtime: submission.runtime,
    memoryUsage: submission.memory,
    difficulty: submission.difficulty,
    tags: submission.topics,
    platform: submission.platform,
    language: submission.language,
    problemTitle: submission.title,
    problemUrl: submission.problemUrl,
    submissionId: submission.id
  };
}

function buildGeneratedExplanation(submission) {
  const tags = submission.topics.filter((topic) => topic !== "Uncategorized");
  const tagText = tags.length ? ` The detected topics are ${tags.join(", ")}.` : "";
  return `This solution was accepted on ${submission.platform} using ${submission.language}.${tagText} Review the synced source file for the implementation details.`;
}

async function putGitHubFile({ token, repository, branch, author, path, content, message }) {
  const encodedPath = path.split("/").map(encodeURIComponent).join("/");
  const url = `https://api.github.com/repos/${repository}/contents/${encodedPath}`;
  const existing = await getGitHubFile(token, url, branch);
  const body = {
    message,
    content: utf8ToBase64(content)
  };

  if (branch) {
    body.branch = branch;
  }

  if (author) {
    body.author = author;
    body.committer = author;
  }

  if (existing?.sha) {
    // GitHub requires the current blob SHA when updating an existing file.
    body.sha = existing.sha;
  }

  const response = await githubFetch(url, {
    method: "PUT",
    headers: githubHeaders(token),
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    throw new Error(await githubErrorMessage(response, `Failed to write ${path}`));
  }

  return response.json();
}

async function getGitHubFile(token, url, branch) {
  const branchUrl = branch ? `${url}?ref=${encodeURIComponent(branch)}` : url;
  const response = await githubFetch(branchUrl, {
    method: "GET",
    headers: githubHeaders(token)
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(await githubErrorMessage(response, "Failed to inspect existing GitHub file"));
  }

  return response.json();
}

function githubHeaders(token) {
  return {
    "Accept": "application/vnd.github+json",
    "Authorization": `Bearer ${token}`,
    "Content-Type": "application/json",
    "X-GitHub-Api-Version": "2022-11-28"
  };
}

async function githubFetch(url, options = {}, attempt = 0) {
  let response;
  try {
    response = await fetch(url, options);
  } catch (error) {
    throw new Error("Network request to GitHub failed. Check your internet connection and try again.");
  }

  if (!isRateLimited(response) || attempt >= GITHUB_MAX_RETRIES) {
    return response;
  }

  await delay(getRateLimitDelay(response));
  return githubFetch(url, options, attempt + 1);
}

function isRateLimited(response) {
  return response.status === 429 || response.status === 403 && (
    response.headers.get("x-ratelimit-remaining") === "0" ||
    /rate limit/i.test(response.headers.get("x-ratelimit-resource") || "")
  );
}

function getRateLimitDelay(response) {
  const retryAfter = Number(response.headers.get("retry-after"));
  if (Number.isFinite(retryAfter) && retryAfter > 0) {
    return retryAfter * 1000;
  }

  const resetSeconds = Number(response.headers.get("x-ratelimit-reset"));
  if (Number.isFinite(resetSeconds) && resetSeconds > 0) {
    return Math.max(resetSeconds * 1000 - Date.now(), 1000);
  }

  return GITHUB_RATE_LIMIT_RETRY_MS;
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function githubErrorMessage(response, fallback) {
  if (response.status === 401) {
    return `${fallback}: GitHub authentication expired or was revoked. Login with GitHub again.`;
  }

  if (response.status === 403 && response.headers.get("x-ratelimit-remaining") === "0") {
    return `${fallback}: GitHub API rate limit exceeded. Try again after the reset time.`;
  }

  if (response.status === 404) {
    return `${fallback}: Repository, branch, or file path was not found. Confirm the selected repository and branch.`;
  }

  try {
    const data = await response.json();
    return `${fallback}: ${response.status} ${data.message || response.statusText}`;
  } catch (error) {
    return `${fallback}: ${response.status} ${response.statusText}`;
  }
}

function renderCommitMessage(template, submission) {
  const values = {
    platform: submission.platform,
    title: submission.title,
    language: submission.language,
    date: new Date(submission.detectedAt).toISOString().slice(0, 10)
  };

  return String(template || DEFAULT_SETTINGS.commitTemplate).replace(/\{(\w+)\}/g, (match, key) => {
    return Object.prototype.hasOwnProperty.call(values, key) ? values[key] : match;
  });
}

function buildCommitAuthor(settings) {
  const name = cleanText(settings.authorName);
  const email = cleanText(settings.authorEmail);
  return name && email ? { name, email } : null;
}

function buildDailyStreakPath(submission, settings) {
  const date = new Date(submission.detectedAt).toISOString().slice(0, 10);
  return joinPath(settings.baseFolder, "_streak", `${date}.md`);
}

function buildDailyStreakContent(submission) {
  const date = new Date(submission.detectedAt).toISOString().slice(0, 10);
  return [
    `# CodeSync Streak - ${date}`,
    "",
    `- ${submission.platform}: ${submission.title}`,
    `- Language: ${submission.language}`,
    `- Difficulty: ${submission.difficulty}`,
    `- URL: ${submission.problemUrl || "N/A"}`,
    ""
  ].join("\n");
}

function validateSettings(settings) {
  if (!settings.githubToken) {
    throw new Error("GitHub is not connected. Open the CodeSync popup and choose Login with GitHub.");
  }

  if (!/^[\w.-]+\/[\w.-]+$/.test(settings.repository || "")) {
    const message = settings.repository ? "Repository must use owner/repository format." : "Missing repository. Choose or create a GitHub repository in the CodeSync popup.";
    throw new Error(message);
  }
}

async function getSettings() {
  const settings = await getStorage(DEFAULT_SETTINGS);
  return { ...DEFAULT_SETTINGS, ...removeUndefined(settings) };
}

function getStorage(defaults) {
  return new Promise((resolve, reject) => {
    chrome.storage.sync.get(defaults, (result) => {
      const error = chrome.runtime.lastError;
      if (error) {
        reject(new Error(error.message));
        return;
      }
      resolve(result);
    });
  });
}

function setStorage(values) {
  return new Promise((resolve, reject) => {
    chrome.storage.sync.set(values, () => {
      const error = chrome.runtime.lastError;
      if (error) {
        reject(new Error(error.message));
        return;
      }
      resolve();
    });
  });
}

function getLocalStorage(defaults) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(defaults, (result) => {
      const error = chrome.runtime.lastError;
      if (error) {
        reject(new Error(error.message));
        return;
      }
      resolve(result);
    });
  });
}

function setLocalStorage(values) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set(values, () => {
      const error = chrome.runtime.lastError;
      if (error) {
        reject(new Error(error.message));
        return;
      }
      resolve();
    });
  });
}

function removeLocalStorage(keys) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.remove(keys, () => {
      const error = chrome.runtime.lastError;
      if (error) {
        reject(new Error(error.message));
        return;
      }
      resolve();
    });
  });
}

function notify(title, message) {
  chrome.notifications.create({
    type: "basic",
    iconUrl: NOTIFICATION_ICON,
    title,
    message
  }, () => {
    const error = chrome.runtime.lastError;
    if (error) {
      console.warn("CodeSync notification failed:", error.message);
    }
  });
}

function extensionForLanguage(language) {
  const key = String(language || "").trim().toLowerCase();
  return LANGUAGE_EXTENSIONS[key] || LANGUAGE_EXTENSIONS[key.replace(/\s+/g, " ")] || "txt";
}

function displayLanguage(language) {
  const value = cleanText(language);
  return value || "Unknown Language";
}

function normalizeTopics(topics) {
  const normalized = []
    .concat(topics || [])
    .map((topic) => cleanText(topic))
    .filter(Boolean)
    .filter((topic, index, values) => values.findIndex((value) => value.toLowerCase() === topic.toLowerCase()) === index)
    .slice(0, 8);

  return normalized.length > 0 ? normalized : ["Uncategorized"];
}

function primaryTopic(topics) {
  return normalizeTopics(topics)[0];
}

function normalizeDifficulty(value) {
  const difficulty = cleanText(value);
  return difficulty || "Unknown";
}

function sanitizePathPart(value) {
  const sanitized = String(value || "untitled")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[<>:"\\|?*\x00-\x1F]/g, "")
    .replace(/[^\w .-]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[. ]+$/g, "")
    .replace(/^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i, "$1-file")
    .slice(0, 90);

  return sanitized || "untitled";
}

function sanitizePath(value) {
  return String(value || "")
    .replace(/\\/g, "/")
    .split("/")
    .map((part) => sanitizePathPart(part))
    .filter(Boolean);
}

function joinPath(...parts) {
  return parts
    .filter(Boolean)
    .join("/")
    .replace(/\\/g, "/")
    .replace(/\/+/g, "/")
    .replace(/^\/|\/$/g, "");
}

function cleanText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function utf8ToBase64(value) {
  // btoa only accepts binary strings, so encode UTF-8 text explicitly first.
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

function hashString(value) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0;
  }
  return Math.abs(hash).toString(36);
}

function removeUndefined(object) {
  return Object.fromEntries(Object.entries(object || {}).filter(([, value]) => value !== undefined));
}
