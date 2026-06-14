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
      const decoded = atob(existingFile.content.replace(/\s/g, ""));
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
