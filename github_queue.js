"use strict";

let isQueueProcessing = false;
let queueTimeoutId = null;

function startQueueProcessor() {
  triggerQueueRun();
}

function triggerQueueRun() {
  if (queueTimeoutId) {
    clearTimeout(queueTimeoutId);
    queueTimeoutId = null;
  }
  
  // Run processQueue immediately
  processQueue().catch((err) => console.error("Error processing sync queue:", err));
}

async function processQueue() {
  if (isQueueProcessing) return;
  isQueueProcessing = true;

  try {
    const jobs = await getQueueJobs();
    const pendingJobs = jobs.filter(j => j.status === "pending" || j.status === "failed");

    if (pendingJobs.length === 0) {
      isQueueProcessing = false;
      return;
    }

    console.info(`Found ${pendingJobs.length} jobs in CodeSync sync queue. Processing batch.`);

    // Process up to 3 jobs
    const batch = pendingJobs.slice(0, 3);

    for (const job of batch) {
      if (job.retries >= 3) {
        job.status = "abandoned";
        await updateQueueJob(job);
        continue;
      }

      job.status = "processing";
      job.lastAttempt = Date.now();
      await updateQueueJob(job);

      try {
        await executeJob(job.payload);
        
        // Remove from queue on success
        await removeQueueJob(job.id);

        // Update progress of completed sheets
        const problemKey = `${job.payload.platform.toLowerCase()}:${job.payload.slug.toLowerCase()}`;
        const sheets = getSheetsForProblem(job.payload.platform, job.payload.slug, job.payload.title);
        
        // Batch progress updates
        for (const sheet of sheets) {
          await markSolvedInProgress(sheet, problemKey);
        }
      } catch (err) {
        console.warn(`Sync job ${job.id} failed:`, err.message);
        job.status = "failed";
        job.retries += 1;
        job.error = err.message;
        await updateQueueJob(job);
      }
    }
  } catch (error) {
    console.error("Queue loop failure:", error);
  } finally {
    isQueueProcessing = false;

    // If more jobs arrived, process them soon
    getQueueJobs().then((jobs) => {
      const remaining = jobs.filter(j => j.status === "pending" || j.status === "failed");
      if (remaining.length > 0) {
        queueTimeoutId = setTimeout(() => {
          processQueue().catch((err) => console.error("Error processing sync queue:", err));
        }, 500);
      }
    }).catch(() => {});
  }
}

async function executeJob(submission) {
  const settings = await getSettings();
  validateSettings(settings);

  const basePaths = buildSubmissionBasePaths(submission, settings);
  const extension = extensionForLanguage(submission.language);
  const solutionFileName = `solution.${extension}`;
  const solutionHeader = getCommentHeader(submission, extension);
  const readmeContent = buildReadme(submission);
  const metadataContent = `${JSON.stringify(buildMetadata(submission), null, 2)}\n`;
  const solutionContent = `${solutionHeader}${submission.sourceCode.trim()}\n`;

  const sheets = getSheetsForProblem(submission.platform, submission.slug, submission.title);
  const sheetsLine = sheets.length > 0 ? sheets.join(", ") : "None";

  // Clean commit message
  const commitMessage = `Solved: ${submission.title} (${submission.platform})\nSheets: ${sheetsLine}`;

  const writeContext = {
    token: settings.githubToken,
    repository: settings.repository,
    branch: cleanText(settings.branch),
    author: buildCommitAuthor(settings),
    message: commitMessage
  };

  const filesToCommit = [];

  // Collect solution, problem README, and metadata for each target path
  for (const basePath of basePaths) {
    filesToCommit.push({
      path: joinPath(basePath, solutionFileName),
      content: solutionContent
    });

    filesToCommit.push({
      path: joinPath(basePath, "README.md"),
      content: readmeContent
    });

    filesToCommit.push({
      path: joinPath(basePath, "metadata.json"),
      content: metadataContent
    });
  }

  // Collect updated sheets metadata
  try {
    const sheetMetaFile = await getUpdatedSheetMetadataFile(submission, sheets, writeContext);
    if (sheetMetaFile) {
      filesToCommit.push(sheetMetaFile);
    }
  } catch (err) {
    console.warn("Could not prepare sheet metadata file:", err.message);
  }

  // Collect updated root README with solved table
  try {
    const rootReadmeFile = await getUpdatedReadmeFile(writeContext);
    if (rootReadmeFile) {
      filesToCommit.push(rootReadmeFile);
    }
  } catch (err) {
    console.warn("Could not prepare root README update:", err.message);
  }

  // Collect daily streak if enabled
  if (settings.enableDailyStreak) {
    filesToCommit.push({
      path: buildDailyStreakPath(submission, settings),
      content: buildDailyStreakContent(submission)
    });
  }

  // 1. Attempt fast single-commit push via Git Trees API
  let committed = false;
  try {
    await commitMultipleFilesViaTree({
      ...writeContext,
      files: filesToCommit
    });
    committed = true;
    console.info(`CodeSync: Pushed ${filesToCommit.length} files in 1 instant commit to GitHub!`);
  } catch (treeError) {
    console.warn("Git Tree commit failed, falling back to sequential writes:", treeError.message);
  }

  // 2. Fallback to sequential putGitHubFile if Git Tree API could not commit
  if (!committed) {
    for (const file of filesToCommit) {
      await putGitHubFile({
        ...writeContext,
        path: file.path,
        content: file.content
      });
    }
  }

  notify("CodeSync synced solution", `${submission.platform}: ${submission.title}`);
}

async function getUpdatedSheetMetadataFile(submission, sheets, writeContext) {
  const metadataPath = "metadata/problem_sheets.json";
  let existingIndex = {};
  try {
    const existingFile = await getGitHubFile(writeContext.token, `https://api.github.com/repos/${writeContext.repository}/contents/${metadataPath}`, writeContext.branch);
    if (existingFile && existingFile.content) {
      const decoded = base64ToUtf8(existingFile.content);
      existingIndex = JSON.parse(decoded);
    }
  } catch (e) {
    // Brand new file
  }

  const problemKey = `${submission.platform.toLowerCase()}:${submission.slug.toLowerCase()}`;
  existingIndex[problemKey] = sheets;

  return {
    path: metadataPath,
    content: JSON.stringify(existingIndex, null, 2) + "\n"
  };
}

async function getUpdatedReadmeFile(writeContext) {
  const readmePath = "README.md";
  let readmeFile;
  try {
    readmeFile = await getGitHubFile(writeContext.token, `https://api.github.com/repos/${writeContext.repository}/contents/${readmePath}`, writeContext.branch);
  } catch (e) {
    return null;
  }

  if (!readmeFile || !readmeFile.content) {
    return null;
  }

  const progressList = await getAllProgress().catch(() => []);
  const solvedCounts = {};
  progressList.forEach((p) => {
    solvedCounts[p.sheetName] = p.solvedKeys.length;
  });

  const readmeText = base64ToUtf8(readmeFile.content);
  let updatedText = readmeText;
  let hasChanges = false;

  const hasTable = updatedText.includes("Coding Sheets Progress") || updatedText.includes("Supported Coding Sheets");

  if (!hasTable) {
    const initialTable = getInitialProgressTable(solvedCounts);
    updatedText = updatedText.trim() + "\n\n" + initialTable;
    hasChanges = true;
  } else {
    for (const [sheetId, sheetMeta] of Object.entries(SUPPORTED_SHEETS)) {
      const solvedCount = solvedCounts[sheetId] || 0;
      const escapedName = sheetMeta.name.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
      const regex = new RegExp(`(\\|\\s*${escapedName}\\s*\\|\\s*)\\d+(\\s*\\|\\s*${sheetMeta.total}\\s*\\|)`, "i");

      if (regex.test(updatedText)) {
        const newText = updatedText.replace(regex, `$1${solvedCount}$2`);
        if (newText !== updatedText) {
          updatedText = newText;
          hasChanges = true;
        }
      }
    }
  }

  if (hasChanges) {
    return {
      path: readmePath,
      content: updatedText
    };
  }
  return null;
}

function getInitialProgressTable(solvedCounts) {
  const lines = [
    "## Coding Sheets Progress",
    "",
    "CodeSync automatically tracks your progress across curated coding sheets. Here is your current progress:",
    "",
    "| Coding Sheet | Solved | Total |",
    "| :--- | :--- | :--- |"
  ];
  for (const [sheetId, sheetMeta] of Object.entries(SUPPORTED_SHEETS)) {
    const solvedCount = solvedCounts[sheetId] || 0;
    lines.push(`| ${sheetMeta.name} | ${solvedCount} | ${sheetMeta.total} |`);
  }
  lines.push("");
  return lines.join("\n");
}

function base64ToUtf8(str) {
  const binary = atob(str.replace(/\s/g, ""));
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}
