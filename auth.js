"use strict";

const codeBox = document.getElementById("codeBox");
const copyButton = document.getElementById("copyButton");
const openButton = document.getElementById("openButton");
const message = document.getElementById("message");

let authState = null;

document.addEventListener("DOMContentLoaded", restoreAuthState);
copyButton.addEventListener("click", copyCode);
openButton.addEventListener("click", openGitHub);

async function restoreAuthState() {
  const result = await chrome.storage.local.get({ codesyncAuthState: null });
  authState = result.codesyncAuthState;

  if (!authState?.userCode) {
    codeBox.textContent = "No code";
    showMessage("Start GitHub login again from the CodeSync popup.");
    copyButton.disabled = true;
    openButton.disabled = true;
    return;
  }

  codeBox.textContent = authState.userCode;
  await copyCode();
  showMessage("Code copied. Open GitHub and paste it if the code is not prefilled.");
}

async function copyCode() {
  if (!authState?.userCode) {
    return;
  }

  try {
    await navigator.clipboard.writeText(authState.userCode);
    showMessage("Code copied to clipboard.");
  } catch (error) {
    showMessage("Copy failed. Select the code and copy it manually.");
  }
}

function openGitHub() {
  if (authState?.verificationUrl) {
    window.open(authState.verificationUrl, "_blank", "noopener,noreferrer");
  }
}

function showMessage(text) {
  message.textContent = text;
}
