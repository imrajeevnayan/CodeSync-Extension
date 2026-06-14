"use strict";

let isQueueProcessing = false;
let queueTimeoutId = null;
let emptyQueueSleepMs = 5000; // 5-second sleep when queue empty

function startQueueProcessor() {
  triggerQueueRun();
}

function triggerQueueRun() {
  if (queueTimeoutId) {
    clearTimeout(queueTimeoutId);
  }
  
  // Run processQueue dynamically
  queueTimeoutId = setTimeout(() => {
    processQueue().catch((err) => console.error("Error processing sync queue:", err));
  }, 500);
}

async function processQueue() {
  if (isQueueProcessing) return;
  isQueueProcessing = true;

  try {
    const jobs = await getQueueJobs();
    const pendingJobs = jobs.filter(j => j.status === "pending" || j.status === "failed");

    if (pendingJobs.length === 0) {
      isQueueProcessing = false;
      
      // Sleep cycle: schedule next run in 5 seconds
      queueTimeoutId = setTimeout(() => {
        processQueue().catch((err) => console.error("Error processing sync queue:", err));
      }, emptyQueueSleepMs);
      return;
    }

    console.info(`Found ${pendingJobs.length} jobs in CodeSync sync queue. Processing micro-batch.`);

    // Micro-batch limit: 3 jobs max per cycle
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
        const sheets = getSheetsForProblem(job.payload.platform, job.payload.slug);
        
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
    
    // Process next batch soon (1.5 seconds)
    queueTimeoutId = setTimeout(() => {
      processQueue().catch((err) => console.error("Error processing sync queue:", err));
    }, 1500);
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

  const sheets = getSheetsForProblem(submission.platform, submission.slug);
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

  // Sync to all computed base paths sequentially
  for (const basePath of basePaths) {
    await putGitHubFile({
      ...writeContext,
      path: joinPath(basePath, solutionFileName),
      content: solutionContent
    });

    await putGitHubFile({
      ...writeContext,
      path: joinPath(basePath, "README.md"),
      content: readmeContent
    });

    await putGitHubFile({
      ...writeContext,
      path: joinPath(basePath, "metadata.json"),
      content: metadataContent
    });
  }

  // Handle Global/Custom Metadata Folders
  await updateSheetMetadata(submission, sheets, writeContext);

  // Update repository README.md with latest sheets solved counts
  try {
    await updateReadmeSolvedCounts(writeContext);
  } catch (err) {
    console.warn("Failed to update README solved counts:", err.message);
  }

  if (settings.enableDailyStreak) {
    await putGitHubFile({
      ...writeContext,
      path: buildDailyStreakPath(submission, settings),
      content: buildDailyStreakContent(submission),
      message: `Update CodeSync streak: ${new Date(submission.detectedAt).toISOString().slice(0, 10)}`
    });
  }

  notify("CodeSync synced solution", `${submission.platform}: ${submission.title}`);
}

async function updateSheetMetadata(submission, sheets, writeContext) {
  const metadataPath = "metadata/problem_sheets.json";
  
  let existingIndex = {};
  try {
    const existingFile = await getGitHubFile(writeContext.token, `https://api.github.com/repos/${writeContext.repository}/contents/${metadataPath}`, writeContext.branch);
    if (existingFile && existingFile.content) {
      const decoded = base64ToUtf8(existingFile.content);
      existingIndex = JSON.parse(decoded);
    }
  } catch (e) {
    console.info("Metadata file problem_sheets.json does not exist yet. Creating a new one.");
  }

  const problemKey = `${submission.platform.toLowerCase()}:${submission.slug.toLowerCase()}`;
  existingIndex[problemKey] = sheets;

  const content = JSON.stringify(existingIndex, null, 2) + "\n";

  await putGitHubFile({
    ...writeContext,
    path: metadataPath,
    content: content,
    message: `Update sheets metadata for ${problemKey}`
  });
}

async function updateReadmeSolvedCounts(writeContext) {
  const readmePath = "README.md";
  let readmeFile;
  try {
    readmeFile = await getGitHubFile(writeContext.token, `https://api.github.com/repos/${writeContext.repository}/contents/${readmePath}`, writeContext.branch);
  } catch (e) {
    console.info("Could not fetch README.md to update solved progress:", e.message);
    return;
  }

  if (!readmeFile || !readmeFile.content) {
    return;
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
    // Generate and append sheets progress table if missing
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
    await putGitHubFile({
      ...writeContext,
      path: readmePath,
      content: updatedText,
      message: "docs: update sheets solved progress tracker in README"
    });
    console.info("Successfully updated sheets solved progress tracker in repository README.md");
  }
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
