"use strict";

// GitHub does not allow a browser extension to safely keep an OAuth client secret,
// so CodeSync uses OAuth Device Flow with this public Client ID bundled in the app.
// Replace this once with your GitHub OAuth App Client ID before publishing.
const CODESYNC_GITHUB_CLIENT_ID = "YOUR_GITHUB_OAUTH_CLIENT_ID";
const GITHUB_OAUTH_SCOPE = "repo";
const GITHUB_DEVICE_CODE_URL = "https://github.com/login/device/code";
const GITHUB_ACCESS_TOKEN_URL = "https://github.com/login/oauth/access_token";
const GITHUB_RATE_LIMIT_RETRY_MS = 60 * 1000;
const GITHUB_MAX_RETRIES = 2;

const DEFAULT_SETTINGS = {
  githubToken: "",
  githubUser: "",
  repository: "",
  baseFolder: "CodeSync",
  commitTemplate: "Add {platform} solution: {title}"
};

const form = document.getElementById("settingsForm");
const message = document.getElementById("message");
const statusBadge = document.getElementById("statusBadge");
const loginButton = document.getElementById("loginButton");
const logoutButton = document.getElementById("logoutButton");
const githubAccount = document.getElementById("githubAccount");
const repositorySelect = document.getElementById("repositorySelect");
const refreshReposButton = document.getElementById("refreshReposButton");
const createRepoButton = document.getElementById("createRepoButton");
const newRepositoryName = document.getElementById("newRepositoryName");

const fields = {
  repository: document.getElementById("repository")
};

document.addEventListener("DOMContentLoaded", restoreSettings);
form.addEventListener("submit", (event) => event.preventDefault());
loginButton.addEventListener("click", loginWithGitHub);
logoutButton.addEventListener("click", logoutFromGitHub);
refreshReposButton.addEventListener("click", refreshRepositories);
createRepoButton.addEventListener("click", createRepository);
repositorySelect.addEventListener("change", () => {
  if (repositorySelect.value) {
    fields.repository.value = repositorySelect.value;
    setStorage({ repository: repositorySelect.value });
    updateAuthUiFromStorage();
    showMessage(`Selected ${repositorySelect.value}.`, "success");
  }
});

async function restoreSettings() {
  try {
    const settings = await getStorage(DEFAULT_SETTINGS);
    Object.entries({ ...DEFAULT_SETTINGS, ...settings }).forEach(([key, value]) => {
      if (fields[key]) {
        fields[key].value = value || "";
      }
    });
    updateAuthUi(settings);
    if (settings.githubToken) {
      await loadRepositoryOptions(settings.githubToken, settings.repository);
    }
  } catch (error) {
    showMessage(error.message, "error");
  }
}

async function loginWithGitHub() {
  loginButton.disabled = true;
  logoutButton.disabled = true;
  showMessage("Starting GitHub login...", "");

  try {
    const formSettings = readForm();
    const clientId = getGitHubClientId();
    ensureOAuthClientId(clientId);
    await setStorage(formSettings);
    const deviceData = await requestDeviceCode(clientId);

    showMessage(`Enter code ${deviceData.user_code} in the GitHub tab.`, "");
    window.open(deviceData.verification_uri, "_blank", "noopener,noreferrer");

    const token = await pollForAccessToken(deviceData, clientId);
    const user = await fetchGitHubUser(token);
    await setStorage({
      githubToken: token,
      githubUser: user.login || user.name || "GitHub user"
    });

    const settings = await getStorage(DEFAULT_SETTINGS);
    updateAuthUi(settings);
    await loadRepositoryOptions(token, settings.repository);
    showMessage(`Connected as ${settings.githubUser}.`, "success");
  } catch (error) {
    showMessage(error.message, "error");
  } finally {
    loginButton.disabled = false;
    logoutButton.disabled = false;
  }
}

async function logoutFromGitHub() {
  await setStorage({ githubToken: "", githubUser: "" });
  const settings = await getStorage(DEFAULT_SETTINGS);
  clearRepositoryOptions("Login to load repositories");
  updateAuthUi(settings);
  showMessage("GitHub account disconnected.", "success");
}

async function refreshRepositories() {
  refreshReposButton.disabled = true;
  showMessage("Loading repositories...", "");

  try {
    const settings = await getStorage(DEFAULT_SETTINGS);
    if (!settings.githubToken) {
      throw new Error("Login with GitHub first.");
    }

    await loadRepositoryOptions(settings.githubToken, fields.repository.value.trim());
    showMessage("Repositories loaded.", "success");
  } catch (error) {
    showMessage(error.message, "error");
  } finally {
    refreshReposButton.disabled = false;
  }
}

async function createRepository() {
  createRepoButton.disabled = true;
  showMessage("Creating repository...", "");

  try {
    const settings = await getStorage(DEFAULT_SETTINGS);
    if (!settings.githubToken) {
      throw new Error("Login with GitHub first.");
    }

    const name = normalizeRepositoryName(newRepositoryName.value);
    if (!name) {
      throw new Error("Enter a repository name.");
    }

    const repository = await createGitHubRepository(settings.githubToken, {
      name,
      private: false
    });

    fields.repository.value = repository.full_name;
    newRepositoryName.value = "";
    await setStorage({ repository: repository.full_name });
    await loadRepositoryOptions(settings.githubToken, repository.full_name);
    updateAuthUi({ ...settings, repository: repository.full_name });
    showMessage(`Created and selected ${repository.full_name}.`, "success");
  } catch (error) {
    showMessage(error.message, "error");
  } finally {
    createRepoButton.disabled = false;
  }
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

async function pollForAccessToken(deviceData, clientId) {
  const expiresAt = Date.now() + Number(deviceData.expires_in || 900) * 1000;
  let intervalSeconds = Number(deviceData.interval || 5);

  while (Date.now() < expiresAt) {
    await delay(intervalSeconds * 1000);

    const response = await fetch(GITHUB_ACCESS_TOKEN_URL, {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        client_id: clientId,
        device_code: deviceData.device_code,
        grant_type: "urn:ietf:params:oauth:grant-type:device_code"
      })
    });

    const data = await response.json().catch(() => ({}));
    if (data.access_token) {
      return data.access_token;
    }

    if (data.error === "authorization_pending") {
      continue;
    }

    if (data.error === "slow_down") {
      intervalSeconds += 5;
      continue;
    }

    throw new Error(data.error_description || data.message || "GitHub login was not completed.");
  }

  throw new Error("GitHub login timed out. Start login again from the popup.");
}

async function fetchGitHubUser(token) {
  const response = await githubFetch("https://api.github.com/user", {
    headers: {
      "Accept": "application/vnd.github+json",
      "Authorization": `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28"
    }
  });

  if (!response.ok) {
    const detail = await response.json().catch(() => ({}));
    throw new Error(`Could not read GitHub profile: ${detail.message || response.statusText}`);
  }

  return response.json();
}

async function fetchGitHubRepositories(token) {
  const repositories = [];
  let page = 1;

  while (page <= 5) {
    const url = new URL("https://api.github.com/user/repos");
    url.searchParams.set("per_page", "100");
    url.searchParams.set("page", String(page));
    url.searchParams.set("sort", "updated");
    url.searchParams.set("affiliation", "owner,collaborator,organization_member");

    const response = await githubFetch(url.toString(), {
      headers: githubApiHeaders(token)
    });

    if (!response.ok) {
      const detail = await response.json().catch(() => ({}));
      throw new Error(`Could not load repositories: ${detail.message || response.statusText}`);
    }

    const pageItems = await response.json();
    repositories.push(...pageItems);
    if (pageItems.length < 100) {
      break;
    }
    page += 1;
  }

  return repositories;
}

async function createGitHubRepository(token, options) {
  const response = await githubFetch("https://api.github.com/user/repos", {
    method: "POST",
    headers: {
      ...githubApiHeaders(token),
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      name: options.name,
      private: Boolean(options.private),
      auto_init: true,
      description: "Coding solution archive created by CodeSync."
    })
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`Could not create repository: ${data.message || response.statusText}`);
  }

  return data;
}

async function loadRepositoryOptions(token, selectedRepository) {
  clearRepositoryOptions("Loading repositories...");
  const repositories = await fetchGitHubRepositories(token);

  repositorySelect.replaceChildren();
  const placeholder = new Option("Select a repository", "");
  repositorySelect.appendChild(placeholder);

  repositories
    .sort((first, second) => first.full_name.localeCompare(second.full_name))
    .forEach((repository) => {
      const visibility = repository.private ? "private" : "public";
      repositorySelect.appendChild(new Option(`${repository.full_name} (${visibility})`, repository.full_name));
    });

  if (selectedRepository) {
    const hasSelected = Array.from(repositorySelect.options).some((option) => option.value === selectedRepository);
    if (!hasSelected) {
      repositorySelect.appendChild(new Option(`${selectedRepository} (manual)`, selectedRepository));
    }
    repositorySelect.value = selectedRepository;
  }
}

function readForm() {
  return {
    repository: fields.repository.value.trim(),
    baseFolder: DEFAULT_SETTINGS.baseFolder,
    commitTemplate: DEFAULT_SETTINGS.commitTemplate
  };
}

function validateRepository(repository) {
  if (!/^[\w.-]+\/[\w.-]+$/.test(repository || "")) {
    throw new Error("Repository must be in owner/repository format.");
  }
}

function githubApiHeaders(token) {
  return {
    "Accept": "application/vnd.github+json",
    "Authorization": `Bearer ${token}`,
    "X-GitHub-Api-Version": "2022-11-28"
  };
}

async function githubFetch(url, options = {}, attempt = 0) {
  const response = await fetch(url, options);
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

function ensureOAuthClientId(clientId) {
  if (!clientId) {
    throw new Error("CodeSync GitHub login is not configured. Set CODESYNC_GITHUB_CLIENT_ID in popup.js.");
  }
}

function normalizeRepositoryName(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^A-Za-z0-9._-]/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}

function getGitHubClientId() {
  const clientId = String(CODESYNC_GITHUB_CLIENT_ID || "").trim();
  return clientId === "YOUR_GITHUB_OAUTH_CLIENT_ID" ? "" : clientId;
}

function updateAuthUi(settings) {
  const connected = Boolean(settings.githubToken);
  githubAccount.textContent = connected ? settings.githubUser || "Connected" : "Not connected";
  loginButton.textContent = connected ? "Reconnect GitHub" : "Login with GitHub";
  logoutButton.classList.toggle("hidden", !connected);
  refreshReposButton.disabled = !connected;
  createRepoButton.disabled = !connected;
  repositorySelect.disabled = !connected;
  newRepositoryName.disabled = !connected;

  const repositoryReady = /^[\w.-]+\/[\w.-]+$/.test(fields.repository.value.trim());
  const configured = connected && repositoryReady;
  statusBadge.textContent = configured ? "Ready" : connected ? "GitHub connected" : "Not configured";
  statusBadge.classList.toggle("ready", configured);
}

async function updateAuthUiFromStorage() {
  const settings = await getStorage(DEFAULT_SETTINGS);
  updateAuthUi(settings);
}

function clearRepositoryOptions(label) {
  repositorySelect.replaceChildren(new Option(label, ""));
}

function showMessage(text, type) {
  message.textContent = text;
  message.className = `message ${type || ""}`.trim();
}

function delay(milliseconds) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
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
