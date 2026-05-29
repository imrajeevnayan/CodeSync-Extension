"use strict";

(() => {
  const CHECK_DEBOUNCE_MS = 700;
  const CHECK_THROTTLE_MS = 1500;
  const DUPLICATE_TTL_MS = 10 * 60 * 1000;
  const sentSubmissions = new Map();
  const pendingSubmissions = new Set();
  let lastUrl = location.href;
  let checkTimer = null;
  let lastCheckAt = 0;
  let unsupportedPlatformWarned = false;

  const PLATFORM_EXTRACTORS = [
    {
      id: "leetcode",
      name: "LeetCode",
      matches: () => hostIncludes("leetcode.com"),
      extractor: extractLeetCode
    },
    {
      id: "hackerrank",
      name: "HackerRank",
      matches: () => hostIncludes("hackerrank.com"),
      extractor: extractHackerRank
    },
    {
      id: "codesignal",
      name: "CodeSignal",
      matches: () => hostIncludes("codesignal.com"),
      extractor: extractCodeSignal
    },
    {
      id: "interviewbit",
      name: "InterviewBit",
      matches: () => hostIncludes("interviewbit.com"),
      extractor: extractInterviewBit
    },
    {
      id: "algoexpert",
      name: "AlgoExpert",
      matches: () => hostIncludes("algoexpert.io"),
      extractor: extractAlgoExpert
    },
    {
      id: "codeforces",
      name: "Codeforces",
      matches: () => hostIncludes("codeforces.com"),
      extractor: extractCodeforces
    },
    {
      id: "atcoder",
      name: "AtCoder",
      matches: () => hostIncludes("atcoder.jp"),
      extractor: extractAtCoder
    },
    {
      id: "codechef",
      name: "CodeChef",
      matches: () => hostIncludes("codechef.com"),
      extractor: extractCodeChef
    },
    {
      id: "topcoder",
      name: "Topcoder",
      matches: () => hostIncludes("topcoder.com"),
      extractor: extractTopcoder
    },
    {
      id: "spoj",
      name: "SPOJ",
      matches: () => hostIncludes("spoj.com"),
      extractor: extractSpoj
    },
    {
      id: "geeksforgeeks",
      name: "GeeksforGeeks",
      matches: () => hostIncludes("geeksforgeeks.org"),
      extractor: extractGeeksforGeeks
    },
    {
      id: "exercism",
      name: "Exercism",
      matches: () => hostIncludes("exercism.org"),
      extractor: extractExercism
    },
    {
      id: "codingninjas",
      name: "Coding Ninjas (Code360)",
      matches: () => hostIncludes("codingninjas.com") || (hostIncludes("naukri.com") && location.pathname.includes("/code360")),
      extractor: extractCodingNinjas
    },
    {
      id: "neetcode",
      name: "NeetCode",
      matches: () => hostIncludes("neetcode.io"),
      extractor: extractNeetCode
    },
    {
      id: "binarysearch",
      name: "BinarySearch",
      matches: () => hostIncludes("binarysearch.com"),
      extractor: extractBinarySearch
    },
    {
      id: "cses",
      name: "CSES",
      matches: () => hostIncludes("cses.fi"),
      extractor: extractCses
    },
    {
      id: "uva",
      name: "UVa Online Judge",
      matches: () => hostIncludes("onlinejudge.org") || hostIncludes("uva.onlinejudge.org"),
      extractor: extractUva
    },
    {
      id: "lintcode",
      name: "LintCode",
      matches: () => hostIncludes("lintcode.com"),
      extractor: extractLintCode
    }
  ];

  patchHistoryApi();
  installObservers();
  scheduleExtraction("initial");

  function installObservers() {
    // Coding sites are often SPAs; watching DOM changes catches late verdict updates.
    const observer = new MutationObserver(() => scheduleExtraction("mutation"));
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      characterData: true
    });

    window.addEventListener("popstate", () => scheduleExtraction("popstate"));
    window.addEventListener("hashchange", () => scheduleExtraction("hashchange"));
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) {
        scheduleExtraction("visible");
      }
    });
  }

  function patchHistoryApi() {
    // Detect client-side route changes that do not trigger full page reloads.
    ["pushState", "replaceState"].forEach((methodName) => {
      const original = history[methodName];
      history[methodName] = function patchedHistoryMethod(...args) {
        const result = original.apply(this, args);
        window.dispatchEvent(new Event("codesync:navigation"));
        return result;
      };
    });

    window.addEventListener("codesync:navigation", () => {
      if (lastUrl !== location.href) {
        lastUrl = location.href;
        scheduleExtraction("spa-navigation");
      }
    });
  }

  function scheduleExtraction(reason) {
    window.clearTimeout(checkTimer);
    const elapsed = Date.now() - lastCheckAt;
    const wait = Math.max(CHECK_DEBOUNCE_MS, CHECK_THROTTLE_MS - elapsed);
    checkTimer = window.setTimeout(() => detectAndSubmit(reason), wait);
  }

  async function detectAndSubmit(reason) {
    lastCheckAt = Date.now();
    const platform = PLATFORM_EXTRACTORS.find((candidate) => candidate.matches());
    if (!platform) {
      handleUnsupportedPlatform();
      return;
    }

    cleanupSentSubmissions();

    try {
      const extracted = await platform.extractor(platform);
      if (!extracted || !extracted.accepted) {
        return;
      }

      const submission = normalizeSubmission(extracted, platform);
      const duplicateKey = createDuplicateKey(submission);
      if (isDuplicate(duplicateKey)) {
        return;
      }

      markPending(duplicateKey);
      await sendSubmission(submission);
      markSubmitted(duplicateKey);
      console.info("CodeSync submission sent:", reason, submission.title);
    } catch (error) {
      console.warn("CodeSync extraction failed:", error);
    } finally {
      clearPendingSubmissions();
    }
  }

  function handleUnsupportedPlatform() {
    if (unsupportedPlatformWarned) {
      return;
    }

    unsupportedPlatformWarned = true;
    console.info("CodeSync skipped this page because the current coding platform is not supported.");
  }

  function normalizeSubmission(extracted, platform) {
    const sourceCode = cleanCode(extracted.sourceCode || getVisibleCode());
    const title = cleanText(extracted.title || getDocumentTitle());
    const language = cleanText(extracted.language || detectLanguageFromPage());
    const problemUrl = extracted.problemUrl || canonicalUrl();

    return {
      id: hashString([platform.id, title, language, sourceCode].join("|")),
      platform: platform.name,
      title,
      problemUrl,
      language,
      topics: normalizeTopics(extracted.topics || getGenericTopics(), title, extracted.description || getGenericDescription()),
      runtime: cleanText(extracted.runtime || getGenericRuntime()),
      memory: cleanText(extracted.memory || getGenericMemory()),
      difficulty: cleanText(extracted.difficulty || getGenericDifficulty()),
      sourceCode,
      description: cleanDescription(extracted.description || getGenericDescription()),
      detectedAt: new Date().toISOString()
    };
  }

  async function sendSubmission(submission) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({
        type: "CODESYNC_SUBMISSION",
        payload: submission
      }, (response) => {
        const error = chrome.runtime.lastError;
        if (error) {
          reject(new Error(error.message));
          return;
        }

        if (!response?.ok) {
          reject(new Error(response?.error || "Background sync failed."));
          return;
        }

        resolve(response.result);
      });
    });
  }

  function extractLeetCode() {
    const accepted = pageHasAcceptedText([
      "[data-e2e-locator='submission-result']",
      ".text-green-s",
      ".text-green-60",
      "[class*='success']"
    ]);

    return {
      accepted,
      title: textFromSelectors([
        "[data-cy='question-title']",
        ".mr-2.text-label-1",
        "a[href^='/problems/']",
        "h1"
      ]),
      language: textFromSelectors([
        "button[id*='headlessui-listbox-button']",
        "[data-e2e-locator='console-submit-lang']",
        ".ant-select-selection-selected-value",
        ".rounded.items-center"
      ]),
      sourceCode: codeFromMonaco() || codeFromCodeMirror() || codeFromSelectors(["pre", "code"]),
      topics: topicsFromSelectors([
        "a[href*='/tag/']",
        "a[href*='/tags/']",
        "[class*='topic']",
        "[class*='tag']"
      ]),
      difficulty: textFromSelectors(["[diff]", "[class*='difficulty']", "[class*='Difficulty']"]),
      runtime: metricFromPage(/runtime\s*:?\s*([.\d]+\s*(?:ms|s))/i),
      memory: metricFromPage(/memory\s*:?\s*([.\d]+\s*(?:mb|kb|gb))/i),
      description: textFromSelectors([
        "[data-track-load='description_content']",
        ".elfjS",
        ".question-content",
        "div[class*='description']"
      ]),
      problemUrl: canonicalUrl()
    };
  }

  function extractHackerRank() {
    return {
      accepted: pageHasAcceptedText([
        ".submission-status",
        ".congrats-heading",
        ".success",
        "[data-analytics='SubmissionStatus']"
      ]),
      title: textFromSelectors(["h1", ".challenge-title", ".ui-content-header h1"]),
      language: textFromSelectors([".css-1hwfws3", ".select-language", "[data-attr2='language-select']"]),
      sourceCode: codeFromMonaco() || codeFromCodeMirror() || codeFromAce() || codeFromSelectors(["pre", "code"]),
      topics: topicsFromSelectors([".challenge-tags a", ".tag", "[class*='tag']"]),
      difficulty: textFromSelectors([".difficulty", "[class*='difficulty']"]),
      runtime: metricFromPage(/runtime\s*:?\s*([.\d]+\s*(?:ms|s))/i),
      memory: metricFromPage(/memory\s*:?\s*([.\d]+\s*(?:mb|kb|gb))/i),
      description: textFromSelectors([".challenge-body-html", ".challenge_problem_statement", ".problem-statement"]),
      problemUrl: canonicalUrl()
    };
  }

  function extractCodeSignal() {
    return {
      accepted: pageHasAcceptedText(["[class*='success']", "[class*='status']", "[data-testid*='result']"]),
      title: textFromSelectors(["[data-testid='task-title']", "h1", "h2"]),
      language: textFromSelectors(["[data-testid*='language']", "[class*='language'] button", "[class*='LanguageSelector']"]),
      sourceCode: codeFromMonaco() || codeFromCodeMirror() || codeFromAce() || codeFromSelectors(["pre", "code"]),
      topics: topicsFromSelectors(["[data-testid*='tag']", "[class*='tag']", "[class*='skill']"]),
      difficulty: textFromSelectors(["[data-testid*='difficulty']", "[class*='difficulty']"]),
      runtime: metricFromPage(/runtime\s*:?\s*([.\d]+\s*(?:ms|s))/i),
      memory: metricFromPage(/memory\s*:?\s*([.\d]+\s*(?:mb|kb|gb))/i),
      description: textFromSelectors(["[data-testid='task-description']", "[class*='description']", "[class*='statement']"]),
      problemUrl: canonicalUrl()
    };
  }

  function extractInterviewBit() {
    return {
      accepted: pageHasAcceptedText([".accepted", ".success", ".submission-result", "[class*='result']"]),
      title: textFromSelectors([".p-title", ".problem-title", "h1", "h2"]),
      language: textFromSelectors([".language-select", "[class*='language']", ".Select-value-label"]),
      sourceCode: codeFromMonaco() || codeFromCodeMirror() || codeFromAce() || codeFromSelectors(["pre", "code"]),
      topics: topicsFromSelectors(["a[href*='/courses/']", "a[href*='/problems/']", ".tag", "[class*='tag']"]),
      difficulty: textFromSelectors([".difficulty", "[class*='difficulty']"]),
      runtime: metricFromPage(/runtime\s*:?\s*([.\d]+\s*(?:ms|s))/i),
      memory: metricFromPage(/memory\s*:?\s*([.\d]+\s*(?:mb|kb|gb))/i),
      description: textFromSelectors([".problem-content", ".question-content", "[class*='description']"]),
      problemUrl: canonicalUrl()
    };
  }

  function extractAlgoExpert() {
    return {
      accepted: pageHasAcceptedText(["[class*='success']", "[class*='passed']", "[class*='Correct']", "[class*='accepted']"]),
      title: textFromSelectors(["[data-testid='question-title']", ".question-title", ".prompt h1", "h1"]),
      language: textFromSelectors(["[class*='language']", "[data-testid*='language']", "button[aria-haspopup='listbox']"]),
      sourceCode: codeFromMonaco() || codeFromCodeMirror() || codeFromAce() || codeFromSelectors(["pre", "code"]),
      topics: topicsFromSelectors(["[class*='category']", "[class*='tag']", "[data-testid*='tag']"]),
      difficulty: textFromSelectors(["[class*='difficulty']", "[data-testid*='difficulty']"]),
      runtime: metricFromPage(/runtime\s*:?\s*([.\d]+\s*(?:ms|s))/i),
      memory: metricFromPage(/memory\s*:?\s*([.\d]+\s*(?:mb|kb|gb))/i),
      description: textFromSelectors([".html-content", ".prompt", "[class*='question'] [class*='content']"]),
      problemUrl: canonicalUrl()
    };
  }

  function extractCodeforces() {
    const accepted = pageHasAcceptedText([".verdict-accepted", ".status-small", ".submissionVerdictWrapper"]) ||
      /\baccepted\b/i.test(textFromSelectors(["table.status-frame-datatable", ".status-frame-datatable"]));

    return {
      accepted,
      title: textFromSelectors([".problem-statement .title", ".caption.titled", "h1"]),
      language: textFromSelectors(["select[name='programTypeId'] option:checked", "td.status-party-cell + td", ".program-source-text + div"]),
      sourceCode: codeFromSelectors(["#sourceCodeTextarea", "pre.program-source", ".source", "pre", "code"]),
      topics: topicsFromSelectors([".tag-box", ".roundbox .tag", "a[href*='/problemset/tags/']"]),
      difficulty: textFromSelectors([".difficulty", "[class*='difficulty']"]) || inferCodeforcesDifficulty(),
      runtime: textFromSelectors([".time-consumed-cell", "td[title*='Time']"]) || metricFromPage(/time\s*:?\s*([.\d]+\s*(?:ms|s))/i),
      memory: textFromSelectors([".memory-consumed-cell", "td[title*='Memory']"]) || metricFromPage(/memory\s*:?\s*([.\d]+\s*(?:mb|kb|gb|bytes))/i),
      description: textFromSelectors([".problem-statement"]),
      problemUrl: canonicalUrl()
    };
  }

  function extractAtCoder() {
    const title = textFromSelectors(["span.h2", ".h2", "#task-statement h2", "h1"]);
    return {
      accepted: pageHasAcceptedText([".label-success", ".submission-score", "#judge-status", ".table"]) &&
        /\bAC\b|\bAccepted\b/i.test(document.body.innerText),
      title,
      language: textFromSelectors(["select[name='data.LanguageId'] option:checked", "#select-lang option:checked", ".prettyprint + p"]),
      sourceCode: codeFromAce() || codeFromSelectors(["#editor textarea", "pre.prettyprint", "pre", "code"]),
      topics: topicsFromSelectors([".breadcrumb a", "a[href*='/contests/']"]),
      difficulty: textFromSelectors([".difficulty", "[class*='difficulty']"]) || inferAtCoderDifficulty(location.href, title),
      runtime: metricFromPage(/(?:exec\s*time|time)\s*:?\s*([.\d]+\s*(?:ms|s))/i),
      memory: metricFromPage(/memory\s*:?\s*([.\d]+\s*(?:mb|kb|gb))/i),
      description: textFromSelectors(["#task-statement", ".lang-en", ".part"]),
      problemUrl: canonicalUrl()
    };
  }

  function extractCodeChef() {
    return {
      accepted: pageHasAcceptedText([".accepted", ".status-accepted", ".result", "[class*='success']"]) ||
        /\baccepted\b/i.test(document.body.innerText),
      title: textFromSelectors([".problem-statement h3", ".problem-title", "h1", "h2"]),
      language: textFromSelectors(["select option:checked", "[class*='language']", ".chosen-single"]),
      sourceCode: codeFromMonaco() || codeFromCodeMirror() || codeFromAce() || codeFromSelectors(["#edit-program", "pre", "code"]),
      topics: topicsFromSelectors([".problem-tags a", ".tags a", "[class*='tag']"]),
      difficulty: textFromSelectors([".difficulty", "[class*='difficulty']"]),
      runtime: metricFromPage(/time\s*:?\s*([.\d]+\s*(?:ms|s))/i),
      memory: metricFromPage(/memory\s*:?\s*([.\d]+\s*(?:mb|kb|gb))/i),
      description: textFromSelectors([".problem-statement", "#problem-statement", "[class*='statement']"]),
      problemUrl: canonicalUrl()
    };
  }

  function extractTopcoder() {
    return {
      accepted: pageHasAcceptedText(["[class*='accepted']", "[class*='success']", "[class*='passed']", ".submission-status"]),
      title: textFromSelectors(["[class*='problem-title']", "[class*='challenge-title']", "h1", "h2"]),
      language: textFromSelectors(["[class*='language']", "select option:checked"]),
      sourceCode: codeFromMonaco() || codeFromCodeMirror() || codeFromAce() || codeFromSelectors(["pre", "code", "textarea"]),
      topics: topicsFromSelectors(["[class*='track']", "[class*='tag']", "[class*='category']"]),
      difficulty: textFromSelectors(["[class*='difficulty']", "[class*='level']"]),
      runtime: metricFromPage(/runtime\s*:?\s*([.\d]+\s*(?:ms|s))/i),
      memory: metricFromPage(/memory\s*:?\s*([.\d]+\s*(?:mb|kb|gb))/i),
      description: textFromSelectors(["[class*='problem-statement']", "[class*='statement']", "[class*='description']"]),
      problemUrl: canonicalUrl()
    };
  }

  function extractSpoj() {
    return {
      accepted: pageHasAcceptedText([".statusres_15", ".accepted", ".status"]) ||
        /\baccepted\b/i.test(document.body.innerText),
      title: textFromSelectors(["#problem-name", ".prob h2", "h1", "h2"]),
      language: textFromSelectors(["select[name='lang'] option:checked", ".lang", "td:nth-child(7)"]),
      sourceCode: codeFromCodeMirror() || codeFromAce() || codeFromSelectors(["#subm_file", "textarea", "pre", "code"]),
      topics: topicsFromSelectors(["#problem-tags a", ".tag", "a[href*='tag=']"]),
      difficulty: textFromSelectors([".difficulty", "[class*='difficulty']"]),
      runtime: metricFromPage(/time\s*:?\s*([.\d]+\s*(?:ms|s))/i),
      memory: metricFromPage(/memory\s*:?\s*([.\d]+\s*(?:mb|kb|gb))/i),
      description: textFromSelectors(["#problem-body", ".prob", "[class*='problem']"]),
      problemUrl: canonicalUrl()
    };
  }

  function extractGeeksforGeeks() {
    return {
      accepted: pageHasAcceptedText([".problems_success", ".success", "[class*='accepted']", "[class*='correct']"]),
      title: textFromSelectors([".problems_header_content__title", ".problem-tab h3", "h1", "h2"]),
      language: textFromSelectors([".problems_language_dropdown__button", "[class*='language']", "select option:checked"]),
      sourceCode: codeFromMonaco() || codeFromCodeMirror() || codeFromAce() || codeFromSelectors(["pre", "code", "textarea"]),
      topics: topicsFromSelectors([".problems_tag_container__2h0ZK", ".problem-tags a", "a[href*='/tag/']", "[class*='tag']"]),
      difficulty: textFromSelectors([".problems_problem_difficulty__3M8RS", "[class*='difficulty']", "[class*='Difficulty']"]),
      runtime: metricFromPage(/runtime\s*:?\s*([.\d]+\s*(?:ms|s))/i),
      memory: metricFromPage(/memory\s*:?\s*([.\d]+\s*(?:mb|kb|gb))/i),
      description: textFromSelectors([".problems_problem_content__Xm_eO", ".problem-statement", "[class*='problemContent']"]),
      problemUrl: canonicalUrl()
    };
  }

  function extractExercism() {
    return {
      accepted: pageHasAcceptedText(["[class*='passed']", "[class*='complete']", "[class*='success']", ".c-completed-badge"]),
      title: textFromSelectors([".exercise-title", "[class*='exercise-title']", "h1", "h2"]),
      language: textFromSelectors([".track-title", "[class*='track']", "[class*='language']"]),
      sourceCode: codeFromMonaco() || codeFromCodeMirror() || codeFromSelectors(["pre", "code", "textarea"]),
      topics: topicsFromSelectors([".track-title", "[class*='track-title']", "[class*='tag']"]),
      difficulty: textFromSelectors(["[class*='difficulty']", "[class*='level']"]),
      runtime: metricFromPage(/runtime\s*:?\s*([.\d]+\s*(?:ms|s))/i),
      memory: metricFromPage(/memory\s*:?\s*([.\d]+\s*(?:mb|kb|gb))/i),
      description: textFromSelectors([".instructions", "[class*='instructions']", "[class*='description']", "article"]),
      problemUrl: canonicalUrl()
    };
  }

  function extractCodingNinjas() {
    return {
      accepted: pageHasAcceptedText(["[class*='accepted']", "[class*='success']", "[class*='passed']", "[class*='correct']", "[class*='status']"]),
      title: textFromSelectors(["[class*='problem-title']", "[class*='ProblemTitle']", "h1", "h2", "h3"]),
      language: textFromSelectors(["[class*='language']", "select option:checked", "button[aria-haspopup='listbox']"]),
      sourceCode: codeFromMonaco() || codeFromCodeMirror() || codeFromAce() || codeFromSelectors(["pre", "code", "textarea"]),
      topics: topicsFromSelectors(["[class*='tag']", "[class*='topic']", "[class*='category']"]),
      difficulty: textFromSelectors(["[class*='difficulty']", "[class*='level']"]),
      runtime: metricFromPage(/runtime\s*:?\s*([.\d]+\s*(?:ms|s))/i),
      memory: metricFromPage(/memory\s*:?\s*([.\d]+\s*(?:mb|kb|gb))/i),
      description: textFromSelectors(["[class*='problem-statement']", "[class*='description']", "[class*='ProblemStatement']", "article"]),
      problemUrl: canonicalUrl()
    };
  }

  function extractLintCode() {
    return {
      accepted: pageHasAcceptedText([
        ".verdict-accepted",
        "[class*='accepted']",
        "[class*='success']",
        "[class*='passed']",
        "[class*='VerdictAccepted']"
      ]) || /\baccepted\b|\bac\b/i.test(document.body.innerText),
      title: textFromSelectors([
        ".problem-title",
        ".problem-detail-title",
        "[class*='title']",
        "h1",
        "h2",
        "h3"
      ]),
      language: textFromSelectors([
        ".language-select select option:checked",
        "[class*='language']",
        "select option:checked",
        "[aria-haspopup='listbox']"
      ]),
      sourceCode: codeFromMonaco() || codeFromCodeMirror() || codeFromAce() || codeFromSelectors([
        "pre",
        "code",
        "textarea"
      ]),
      topics: topicsFromSelectors([
        "[class*='tag']",
        "[class*='topic']",
        "a[href*='/tag/']",
        "a[href*='/problem/']"
      ]),
      difficulty: textFromSelectors([
        ".difficulty",
        "[class*='difficulty']",
        "[class*='Difficulty']",
        ".level"
      ]),
      runtime: metricFromPage(/(?:exec\s*time|time)\s*:?\s*([.\d]+\s*(?:ms|s))/i),
      memory: metricFromPage(/memory\s*:?\s*([.\d]+\s*(?:mb|kb|gb))/i),
      description: textFromSelectors([
        ".problem-description",
        ".problem-detail-description",
        "article",
        "[class*='description']",
        "[class*='content']"
      ]),
      problemUrl: canonicalUrl()
    };
  }

  function extractNeetCode() {
    return {
      accepted: pageHasAcceptedText(["[class*='accepted']", "[class*='success']", "[class*='passed']", "[data-testid*='result']"]),
      title: textFromSelectors(["[data-testid*='title']", "[class*='problem-title']", "h1", "h2"]),
      language: textFromSelectors(["[class*='language']", "button[aria-haspopup='listbox']", "select option:checked"]),
      sourceCode: codeFromMonaco() || codeFromCodeMirror() || codeFromAce() || codeFromSelectors(["pre", "code", "textarea"]),
      topics: topicsFromSelectors(["a[href*='tag']", "a[href*='roadmap']", "[class*='tag']", "[class*='topic']"]),
      difficulty: textFromSelectors(["[class*='difficulty']", "[class*='Difficulty']"]),
      runtime: metricFromPage(/runtime\s*:?\s*([.\d]+\s*(?:ms|s))/i),
      memory: metricFromPage(/memory\s*:?\s*([.\d]+\s*(?:mb|kb|gb))/i),
      description: textFromSelectors(["article", "[class*='description']", "[class*='statement']"]),
      problemUrl: canonicalUrl()
    };
  }

  function extractBinarySearch() {
    return {
      accepted: pageHasAcceptedText(["[class*='accepted']", "[class*='success']", "[class*='passed']", "[class*='result']"]),
      title: textFromSelectors(["[class*='title']", "h1", "h2"]),
      language: textFromSelectors(["[class*='language']", "button[aria-haspopup='listbox']", "select option:checked"]),
      sourceCode: codeFromMonaco() || codeFromCodeMirror() || codeFromAce() || codeFromSelectors(["pre", "code", "textarea"]),
      topics: topicsFromSelectors(["[class*='tag']", "[class*='topic']", "a[href*='tag']"]),
      difficulty: textFromSelectors(["[class*='difficulty']", "[class*='level']"]),
      runtime: metricFromPage(/runtime\s*:?\s*([.\d]+\s*(?:ms|s))/i),
      memory: metricFromPage(/memory\s*:?\s*([.\d]+\s*(?:mb|kb|gb))/i),
      description: textFromSelectors(["article", "[class*='description']", "[class*='statement']"]),
      problemUrl: canonicalUrl()
    };
  }

  function extractCses() {
    const topics = topicsFromSelectors([".nav a", ".breadcrumb a"]);
    return {
      accepted: pageHasAcceptedText([".task-score", ".status", ".summary", ".content"]) && /\baccepted\b|\b100\b/i.test(document.body.innerText),
      title: textFromSelectors([".title-block h1", ".content h1", "h1"]),
      language: textFromSelectors(["select[name='lang'] option:checked", "select option:checked"]),
      sourceCode: codeFromCodeMirror() || codeFromAce() || codeFromSelectors(["textarea", "pre", "code"]),
      topics,
      difficulty: inferCsesDifficulty(topics),
      runtime: metricFromPage(/time\s*limit\s*:?\s*([.\d]+\s*s)/i),
      memory: metricFromPage(/memory\s*limit\s*:?\s*([.\d]+\s*(?:mb|kb|gb))/i),
      description: textFromSelectors([".content", ".md", "article"]),
      problemUrl: canonicalUrl()
    };
  }

  function extractUva() {
    return {
      accepted: pageHasAcceptedText([".status", ".verdict", "table", ".content"]) || /\baccepted\b/i.test(document.body.innerText),
      title: textFromSelectors(["#col3_content h3", ".problem h3", "h1", "h2", "h3"]),
      language: textFromSelectors(["select[name='language'] option:checked", "select option:checked"]),
      sourceCode: codeFromCodeMirror() || codeFromAce() || codeFromSelectors(["textarea", "pre", "code"]),
      topics: topicsFromSelectors([".breadcrumb a", ".tag", "a[href*='category']"]),
      difficulty: "Unknown",
      runtime: metricFromPage(/runtime\s*:?\s*([.\d]+\s*(?:ms|s))/i),
      memory: metricFromPage(/memory\s*:?\s*([.\d]+\s*(?:mb|kb|gb))/i),
      description: textFromSelectors(["#col3_content", ".problem", "article", ".content"]),
      problemUrl: canonicalUrl()
    };
  }

  function pageHasAcceptedText(selectors) {
    // Prefer scoped verdict text, then fall back to body text for sites with loose markup.
    const acceptedPattern = /\b(accepted|successful|correct answer|all tests passed|congratulations|passed|solved|complete|100\/100|score:\s*100|AC)\b/i;
    const rejectedPattern = /\b(wrong answer|runtime error|time limit exceeded|memory limit exceeded|compilation error|compile error|failed|failure|rejected|pending|queued|running|judging|in progress|processing|partial|skipped)\b/i;
    const scopedText = selectors
      .flatMap((selector) => Array.from(document.querySelectorAll(selector)))
      .map((node) => cleanText(node.innerText || node.textContent))
      .filter(Boolean)
      .join(" ");

    if (acceptedPattern.test(scopedText) && !rejectedPattern.test(scopedText)) {
      return true;
    }

    const bodyText = cleanText(document.body?.innerText || "");
    return acceptedPattern.test(bodyText) && !rejectedPattern.test(bodyText);
  }

  function textFromSelectors(selectors) {
    for (const selector of selectors) {
      const node = document.querySelector(selector);
      const value = selector.includes(":checked") && node ? node.textContent : node?.innerText || node?.textContent || node?.value;
      const text = cleanText(value);
      if (text) {
        return text;
      }
    }
    return "";
  }

  function topicsFromSelectors(selectors) {
    const noisyLabels = /^(easy|medium|hard|premium|solved|accepted|submit|solution|editor|problem|practice|challenge)$/i;
    return selectors
      .flatMap((selector) => Array.from(document.querySelectorAll(selector)))
      .map((node) => cleanText(node.innerText || node.textContent || node.getAttribute("aria-label") || ""))
      .flatMap(splitTopicText)
      .filter((topic) => topic.length >= 2 && topic.length <= 48)
      .filter((topic) => !noisyLabels.test(topic))
      .filter((topic, index, values) => values.findIndex((value) => value.toLowerCase() === topic.toLowerCase()) === index)
      .slice(0, 8);
  }

  function codeFromSelectors(selectors) {
    for (const selector of selectors) {
      const node = document.querySelector(selector);
      const value = node?.value || node?.innerText || node?.textContent || "";
      const code = cleanCode(value);
      if (looksLikeCode(code)) {
        return code;
      }
    }
    return "";
  }

  function codeFromMonaco() {
    const lines = Array.from(document.querySelectorAll(".monaco-editor .view-lines .view-line"));
    const code = lines.map((line) => line.innerText || line.textContent || "").join("\n");
    return looksLikeCode(code) ? code : "";
  }

  function codeFromCodeMirror() {
    const lines = Array.from(document.querySelectorAll(".CodeMirror-code pre, .cm-line"));
    const code = lines.map((line) => line.innerText || line.textContent || "").join("\n");
    return looksLikeCode(code) ? code : "";
  }

  function codeFromAce() {
    const lines = Array.from(document.querySelectorAll(".ace_line"));
    const code = lines.map((line) => line.innerText || line.textContent || "").join("\n");
    return looksLikeCode(code) ? code : "";
  }

  function codeFromPlainTextEditors() {
    return codeFromSelectors([
      "[contenteditable='true']",
      "[role='textbox']",
      ".editor textarea",
      ".cm-content",
      ".view-line"
    ]);
  }

  function getVisibleCode() {
    return codeFromMonaco() || codeFromCodeMirror() || codeFromAce() || codeFromPlainTextEditors() || codeFromSelectors(["textarea", "pre", "code"]);
  }

  function detectLanguageFromPage() {
    const text = cleanText(document.body?.innerText || "");
    const languages = ["C++", "Python 3", "Python", "JavaScript", "TypeScript", "Java", "C#", "C", "Go", "Ruby", "Rust", "Kotlin", "Swift", "PHP", "Scala", "SQL"];
    return languages.find((language) => new RegExp(`\\b${escapeRegExp(language)}\\b`, "i").test(text)) || "Text";
  }

  function getGenericDescription() {
    return textFromSelectors([
      "article",
      ".problem-statement",
      ".question-content",
      ".description",
      "[class*='description']",
      "[class*='statement']"
    ]);
  }

  function getGenericTopics() {
    return topicsFromSelectors([
      "a[href*='tag']",
      "a[href*='topic']",
      "[class*='tag']",
      "[class*='topic']",
      "[data-testid*='tag']"
    ]);
  }

  function getGenericRuntime() {
    return metricFromPage(/(?:runtime|time)\s*:?\s*([.\d]+\s*(?:ms|s))/i);
  }

  function getGenericMemory() {
    return metricFromPage(/memory\s*:?\s*([.\d]+\s*(?:mb|kb|gb|bytes))/i);
  }

  function getGenericDifficulty() {
    return textFromSelectors(["[class*='difficulty']", "[class*='Difficulty']", "[class*='level']"]);
  }

  function metricFromPage(pattern) {
    const text = cleanText(document.body?.innerText || "");
    const match = text.match(pattern);
    return match?.[1] || "";
  }

  function getDocumentTitle() {
    return document.title.split(/[-|]/)[0] || "Untitled Problem";
  }

  function canonicalUrl() {
    const canonical = document.querySelector("link[rel='canonical']")?.href;
    return canonical || location.href.split("#")[0];
  }

  function createDuplicateKey(submission) {
    return hashString([submission.platform, submission.problemUrl, submission.language, submission.sourceCode].join("|"));
  }

  function isDuplicate(key) {
    const sessionKey = `codesync:${key}`;
    return pendingSubmissions.has(key) || sentSubmissions.has(key) || sessionStorage.getItem(sessionKey) === "1";
  }

  function markPending(key) {
    pendingSubmissions.add(key);
  }

  function markSubmitted(key) {
    pendingSubmissions.delete(key);
    sentSubmissions.set(key, Date.now());
    sessionStorage.setItem(`codesync:${key}`, "1");
  }

  function clearPendingSubmissions() {
    pendingSubmissions.clear();
  }

  function cleanupSentSubmissions() {
    const cutoff = Date.now() - DUPLICATE_TTL_MS;
    sentSubmissions.forEach((timestamp, key) => {
      if (timestamp < cutoff) {
        sentSubmissions.delete(key);
      }
    });
  }

  function cleanDescription(value) {
    return cleanText(value).slice(0, 12000);
  }

  function normalizeTopics(topics, title = "", description = "") {
    const normalized = []
      .concat(topics || [])
      .map((topic) => cleanText(topic))
      .filter(Boolean)
      .filter((topic, index, values) => values.findIndex((value) => value.toLowerCase() === topic.toLowerCase()) === index)
      .slice(0, 8);

    if (normalized.length > 0) {
      return normalized;
    }

    return inferTopics(`${title} ${description}`);
  }

  function splitTopicText(value) {
    return cleanText(value)
      .split(/[,;|/]+|\n/)
      .map((topic) => topic.replace(/^#/, "").trim())
      .filter(Boolean);
  }

  function inferTopics(text) {
    const source = cleanText(text).toLowerCase();
    const topicRules = [
      ["Dynamic Programming", /\b(dp|dynamic programming|memoization|tabulation)\b/],
      ["Graph", /\b(graph|tree|dfs|bfs|shortest path|dijkstra|topological|union find)\b/],
      ["Array", /\b(array|subarray|prefix sum|two pointer|sliding window)\b/],
      ["String", /\b(string|substring|subsequence|palindrome|anagram)\b/],
      ["Binary Search", /\b(binary search|lower bound|upper bound)\b/],
      ["Greedy", /\b(greedy|interval|sorting)\b/],
      ["Math", /\b(math|number theory|modulo|prime|gcd|combinatorics)\b/],
      ["Stack", /\b(stack|monotonic)\b/],
      ["Queue", /\b(queue|deque|heap|priority queue)\b/],
      ["Hash Table", /\b(hash|map|set|frequency)\b/]
    ];

    const inferred = topicRules
      .filter(([, pattern]) => pattern.test(source))
      .map(([topic]) => topic)
      .slice(0, 4);

    return inferred.length > 0 ? inferred : ["Uncategorized"];
  }

  function cleanText(value) {
    return String(value || "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
  }

  function cleanCode(value) {
    return String(value || "")
      .replace(/\u00a0/g, " ")
      .replace(/\n{4,}/g, "\n\n\n")
      .trim();
  }

  function looksLikeCode(value) {
    const code = cleanCode(value);
    return code.length > 20 && /[{}();=#<>]|\b(class|def|function|public|import|include|return|package|using|let|const|var|fn|impl|SELECT)\b/i.test(code);
  }

  function hostIncludes(hostPart) {
    return location.hostname.toLowerCase().includes(hostPart);
  }

  function escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function hashString(value) {
    let hash = 0;
    for (let index = 0; index < value.length; index += 1) {
      hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0;
    }
    return Math.abs(hash).toString(36);
  }

  function inferCodeforcesDifficulty() {
    const tags = Array.from(document.querySelectorAll(".tag-box, .roundbox .tag, a[href*='/problemset/tags/']"))
      .map(node => node.textContent || node.innerText || "");
    for (const tag of tags) {
      const match = tag.match(/\*?(\d{3,4})/);
      if (match) {
        return match[1];
      }
    }
    return "Unknown";
  }

  function inferAtCoderDifficulty(url, title) {
    const text = `${url} ${title}`.toLowerCase();
    const taskMatch = text.match(/_([a-h])\b/) || text.match(/\b([a-h])\s*[-.]/);
    if (taskMatch) {
      const task = taskMatch[1];
      if (task === "a" || task === "b") return "Easy";
      if (task === "c" || task === "d") return "Medium";
      return "Hard";
    }
    if (text.includes("arc")) {
      const arcMatch = text.match(/_([a-f])\b/) || text.match(/\b([a-f])\s*[-.]/);
      if (arcMatch) {
        const task = arcMatch[1];
        if (task === "a") return "Medium";
        return "Hard";
      }
    }
    if (text.includes("agc")) {
      return "Hard";
    }
    return "Unknown";
  }

  function inferCsesDifficulty(topics) {
    const topicText = (topics || []).join(" ").toLowerCase();
    if (topicText.includes("introductory")) return "Easy";
    if (topicText.includes("sorting") || topicText.includes("searching") || topicText.includes("math")) return "Medium";
    if (topicText.includes("dynamic") || topicText.includes("graph") || topicText.includes("tree") || topicText.includes("range")) return "Medium";
    if (topicText.includes("geometry") || topicText.includes("string")) return "Medium";
    if (topicText.includes("advanced") || topicText.includes("additional")) return "Hard";
    return "Unknown";
  }
})();
