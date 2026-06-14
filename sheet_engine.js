"use strict";

const SUPPORTED_SHEETS = {
  "Blind75": { name: "Blind 75", total: 75 },
  "Grind75": { name: "Grind 75", total: 75 },
  "Grind169": { name: "Grind 169", total: 169 },
  "NeetCode150": { name: "Neetcode 150", total: 150 },
  "LeetCode75": { name: "LeetCode 75", total: 75 },
  "TopInterview150": { name: "Top Interview 150", total: 150 },
  "Top100Liked": { name: "LeetCode 100 Most Liked", total: 100 },
  "SQL50": { name: "SQL 50", total: 50 },
  "StriverA2Z": { name: "Strivers A2Z DSA Sheet", total: 455 },
  "StriverSDE": { name: "Striver SDE Sheet", total: 191 },
  "LoveBabbar450": { name: "Love Babbar Sheet", total: 445 },
  "CoderArmy": { name: "Code Army Sheet", total: 726 },
  "GFG160": { name: "GFG 160", total: 160 },
  "CSESSet": { name: "CSES Problem Set", total: 300 },
  "InterviewBitSet": { name: "InterviewBit Sets", total: 200 },
  "NishantChahar151": { name: "Nishant Chahar 151", total: 151 },
  "KushalVijay20": { name: "Kushal Vijay Patterns", total: 100 },
  "ApnaCollege375": { name: "DSA by Shradha Didi & Aman Bhaiya", total: 403 },
  "FrazBhaiya": { name: "Fraz DSA Sheet", total: 279 },
  "AlgoMaster75": { name: "AlgoMaster 75", total: 75 },
  "SixComp30Days": { name: "6 Companies 30 Days", total: 90 },
  "Striver79": { name: "Striver 79", total: 79 },
  "AtharvaPatil150": { name: "Atharva Patil's 150 Sheet", total: 150 },
  "AlgoMaster300": { name: "AlgoMaster 300", total: 300 },
  "ArshDSA": { name: "Arsh DSA Sheet", total: 287 },
  "NeetCode250": { name: "Neetcode 250", total: 250 },
  "Essential20": { name: "20 Essential DSA Patterns", total: 180 },
  "AlgoMaster150": { name: "AlgoMaster 150", total: 150 },
  "DPMastery": { name: "DP Mastery Sheet", total: 67 },
  "StringMastery": { name: "String Mastery Sheet", total: 51 },
  "GraphMastery": { name: "Graph Mastery Sheet", total: 29 },
  "HeapMastery": { name: "Heap Mastery Sheet", total: 22 }
};

const SHEET_MAPPING_INDEX = {
  // LeetCode Arrays & Hashing
  "leetcode:set-matrix-zeroes": ["StriverSDE", "StriverA2Z", "AlgoMaster300", "LoveBabbar450"],
  "leetcode:pascals-triangle": ["StriverSDE", "StriverA2Z", "AlgoMaster300"],
  "leetcode:next-permutation": ["StriverSDE", "StriverA2Z", "AlgoMaster300", "LoveBabbar450"],
  "leetcode:rotate-image": ["StriverSDE", "StriverA2Z", "AlgoMaster300", "LoveBabbar450"],
  "leetcode:merge-intervals": ["StriverSDE", "StriverA2Z", "AlgoMaster300", "LoveBabbar450"],
  "leetcode:merge-sorted-array": ["StriverSDE", "StriverA2Z", "AlgoMaster300"],
  "leetcode:find-the-duplicate-number": ["StriverSDE", "StriverA2Z", "AlgoMaster300"],
  "leetcode:powx-n": ["StriverSDE", "StriverA2Z", "AlgoMaster300"],
  "leetcode:majority-element-ii": ["StriverSDE", "StriverA2Z", "AlgoMaster300"],
  "leetcode:reverse-pairs": ["StriverSDE", "StriverA2Z", "AlgoMaster300"],
  "leetcode:4sum": ["StriverSDE", "StriverA2Z", "AlgoMaster300"],
  "leetcode:two-sum": ["Blind75", "Grind75", "Grind169", "NeetCode150", "LeetCode75", "TopInterview150", "Top100Liked", "StriverA2Z", "LoveBabbar450", "NishantChahar151", "KushalVijay20", "ApnaCollege375", "FrazBhaiya", "AlgoMaster75", "SixComp30Days", "Striver79", "AtharvaPatil150", "StriverSDE"],
  "leetcode:valid-parentheses": ["Blind75", "Grind75", "Grind169", "NeetCode150", "LeetCode75", "TopInterview150", "Top100Liked", "StriverA2Z", "NishantChahar151", "KushalVijay20", "ApnaCollege375", "FrazBhaiya", "AlgoMaster75", "SixComp30Days", "Striver79", "AtharvaPatil150", "StriverSDE"],
  "leetcode:merge-two-sorted-lists": ["Blind75", "Grind75", "Grind169", "NeetCode150", "LeetCode75", "TopInterview150", "Top100Liked", "StriverA2Z", "LoveBabbar450", "NishantChahar151", "ApnaCollege375", "FrazBhaiya", "AlgoMaster75", "SixComp30Days", "Striver79", "AtharvaPatil150", "StriverSDE"],
  "leetcode:best-time-to-buy-and-sell-stock": ["Blind75", "Grind75", "Grind169", "NeetCode150", "LeetCode75", "TopInterview150", "Top100Liked", "StriverA2Z", "LoveBabbar450", "NishantChahar151", "KushalVijay20", "ApnaCollege375", "FrazBhaiya", "AlgoMaster75", "SixComp30Days", "Striver79", "AtharvaPatil150", "StriverSDE"],
  "leetcode:valid-palindrome": ["Blind75", "Grind75", "Grind169", "NeetCode150", "TopInterview150", "StriverA2Z", "NishantChahar151", "ApnaCollege375", "FrazBhaiya", "AlgoMaster75", "SixComp30Days", "Striver79", "AtharvaPatil150"],
  "leetcode:invert-binary-tree": ["Blind75", "Grind75", "Grind169", "NeetCode150", "Top100Liked", "StriverA2Z", "LoveBabbar450", "NishantChahar151", "ApnaCollege375", "FrazBhaiya", "AlgoMaster75", "Striver79", "AtharvaPatil150"],
  "leetcode:valid-anagram": ["Blind75", "Grind75", "Grind169", "NeetCode150", "LeetCode75", "TopInterview150", "StriverA2Z", "NishantChahar151", "ApnaCollege375", "FrazBhaiya", "AlgoMaster75", "Striver79", "AtharvaPatil150"],
  "leetcode:binary-search": ["Blind75", "Grind75", "Grind169", "NeetCode150", "LeetCode75", "TopInterview150", "StriverA2Z"],
  "leetcode:flood-fill": ["Blind75", "Grind75", "Grind169", "NeetCode150", "StriverA2Z"],
  "leetcode:lowest-common-ancestor-of-a-binary-search-tree": ["Blind75", "Grind75", "Grind169", "NeetCode150", "TopInterview150", "StriverA2Z", "LoveBabbar450"],
  "leetcode:balanced-binary-tree": ["Blind75", "Grind75", "Grind169", "NeetCode150", "StriverA2Z"],
  "leetcode:linked-list-cycle": ["Blind75", "Grind75", "Grind169", "NeetCode150", "LeetCode75", "TopInterview150", "Top100Liked", "StriverA2Z", "LoveBabbar450", "StriverSDE"],
  "leetcode:implement-queue-using-stacks": ["Blind75", "Grind75", "Grind169", "NeetCode150", "StriverA2Z", "LoveBabbar450"],
  "leetcode:first-bad-version": ["Grind75", "Grind169", "StriverA2Z"],
  "leetcode:ransom-note": ["Grind75", "Grind169", "TopInterview150"],
  "leetcode:climbing-stairs": ["Blind75", "Grind75", "Grind169", "NeetCode150", "TopInterview150", "Top100Liked", "StriverA2Z", "LoveBabbar450", "StriverSDE"],
  "leetcode:longest-palindrome": ["Grind75", "Grind169"],
  "leetcode:reverse-linked-list": ["Blind75", "Grind75", "Grind169", "NeetCode150", "LeetCode75", "TopInterview150", "Top100Liked", "StriverA2Z", "LoveBabbar450", "StriverSDE"],
  "leetcode:majority-element": ["Grind75", "Grind169", "TopInterview150", "Top100Liked", "StriverA2Z"],
  "leetcode:add-binary": ["Grind75", "Grind169", "TopInterview150"],
  "leetcode:diameter-of-binary-tree": ["Grind75", "Grind169", "NeetCode150", "Top100Liked", "StriverA2Z"],
  "leetcode:middle-of-the-linked-list": ["Grind75", "Grind169", "StriverA2Z"],
  "leetcode:maximum-depth-of-binary-tree": ["Blind75", "Grind75", "Grind169", "NeetCode150", "LeetCode75", "TopInterview150", "Top100Liked", "StriverA2Z"],
  "leetcode:contains-duplicate": ["Blind75", "Grind75", "Grind169", "NeetCode150", "StriverA2Z"],
  "leetcode:maximum-subarray": ["Blind75", "Grind169", "NeetCode150", "Top100Liked", "StriverA2Z", "LoveBabbar450", "StriverSDE"],
  "leetcode:insert-interval": ["Blind75", "Grind75", "Grind169", "NeetCode150", "TopInterview150", "Top100Liked", "StriverA2Z", "LoveBabbar450"],
  "leetcode:01-matrix": ["Blind75", "Grind75", "Grind169", "NeetCode150"],
  "leetcode:k-closest-points-to-origin": ["Blind75", "Grind75", "Grind169", "NeetCode150"],
  "leetcode:longest-substring-without-repeating-characters": ["Blind75", "Grind75", "Grind169", "NeetCode150", "TopInterview150", "Top100Liked", "StriverA2Z", "LoveBabbar450", "StriverSDE"],
  "leetcode:3sum": ["Blind75", "Grind75", "Grind169", "NeetCode150", "TopInterview150", "Top100Liked", "StriverA2Z", "LoveBabbar450", "StriverSDE"],
  "leetcode:binary-tree-level-order-traversal": ["Blind75", "Grind75", "Grind169", "NeetCode150", "TopInterview150", "Top100Liked", "StriverA2Z", "LoveBabbar450"],
  "leetcode:clone-graph": ["Blind75", "Grind75", "Grind169", "NeetCode150", "TopInterview150", "StriverA2Z", "LoveBabbar450", "StriverSDE"],
  "leetcode:evaluate-reverse-polish-notation": ["Blind75", "Grind75", "Grind169", "NeetCode150", "TopInterview150"],
  "leetcode:course-schedule": ["Blind75", "Grind75", "Grind169", "NeetCode150", "TopInterview150", "Top100Liked", "StriverA2Z", "LoveBabbar450", "StriverSDE"],
  "leetcode:implement-trie-prefix-tree": ["Blind75", "Grind75", "Grind169", "NeetCode150", "TopInterview150", "Top100Liked", "StriverA2Z", "LoveBabbar450", "StriverSDE"],
  "leetcode:coin-change": ["Blind75", "Grind75", "Grind169", "NeetCode150", "TopInterview150", "Top100Liked", "StriverA2Z", "LoveBabbar450", "StriverSDE"],
  "leetcode:product-of-array-except-self": ["Blind75", "Grind75", "Grind169", "NeetCode150", "LeetCode75", "TopInterview150", "Top100Liked", "StriverA2Z", "LoveBabbar450"],
  "leetcode:min-stack": ["Blind75", "Grind169", "NeetCode150", "TopInterview150", "Top100Liked", "StriverA2Z", "LoveBabbar450"],
  "leetcode:group-anagrams": ["Blind75", "NeetCode150", "TopInterview150", "Top100Liked", "StriverA2Z", "StriverSDE"],
  "leetcode:top-k-frequent-elements": ["Blind75", "NeetCode150", "Top100Liked", "StriverA2Z"],
  "leetcode:encode-and-decode-strings": ["Blind75", "NeetCode150"],
  "leetcode:longest-consecutive-sequence": ["Blind75", "NeetCode150", "TopInterview150", "Top100Liked", "StriverA2Z", "StriverSDE"],
  
  // Two Pointers
  "leetcode:two-sum-ii-input-array-is-sorted": ["NeetCode150", "TopInterview150", "StriverA2Z"],
  "leetcode:3sum-closest": ["TopInterview150", "StriverA2Z"],
  "leetcode:container-with-most-water": ["Blind75", "NeetCode150", "TopInterview150", "Top100Liked", "StriverA2Z"],
  "leetcode:trapping-rain-water": ["NeetCode150", "TopInterview150", "Top100Liked", "StriverA2Z", "StriverSDE"],
 
  // Sliding Window
  "leetcode:best-time-to-buy-and-sell-stock-ii": ["TopInterview150", "StriverA2Z"],
  "leetcode:longest-repeating-character-replacement": ["Blind75", "NeetCode150", "StriverA2Z", "StriverSDE"],
  "leetcode:permutation-in-string": ["NeetCode150"],
  "leetcode:minimum-window-substring": ["Blind75", "NeetCode150", "TopInterview150", "StriverA2Z", "StriverSDE"],
  "leetcode:sliding-window-maximum": ["NeetCode150", "Top100Liked", "StriverA2Z"],
 
  // Stack & Monotonic
  "leetcode:valid-sudoku": ["NeetCode150", "TopInterview150"],
  "leetcode:daily-temperatures": ["NeetCode150", "Top100Liked"],
  "leetcode:car-fleet": ["NeetCode150"],
  "leetcode:largest-rectangle-in-histogram": ["NeetCode150", "Top100Liked", "StriverA2Z", "StriverSDE"],
 
  // Binary Search
  "leetcode:search-a-2d-matrix": ["NeetCode150", "TopInterview150", "StriverA2Z"],
  "leetcode:koko-eating-bananas": ["NeetCode150", "StriverA2Z"],
  "leetcode:find-minimum-in-rotated-sorted-array": ["Blind75", "NeetCode150", "TopInterview150", "StriverA2Z"],
  "leetcode:search-in-rotated-sorted-array": ["Blind75", "NeetCode150", "TopInterview150", "Top100Liked", "StriverA2Z", "StriverSDE"],
  "leetcode:median-of-two-sorted-arrays": ["NeetCode150", "Top100Liked", "StriverA2Z"],
 
  // Linked List
  "leetcode:remove-nth-node-from-end-of-list": ["Blind75", "NeetCode150", "TopInterview150", "Top100Liked", "StriverA2Z", "StriverSDE"],
  "leetcode:copy-list-with-random-pointer": ["NeetCode150", "TopInterview150", "Top100Liked", "StriverA2Z", "StriverSDE"],
  "leetcode:add-two-numbers": ["NeetCode150", "TopInterview150", "Top100Liked", "StriverA2Z", "StriverSDE"],
  "leetcode:merge-k-sorted-lists": ["Blind75", "NeetCode150", "TopInterview150", "Top100Liked", "StriverA2Z", "StriverSDE"],
  "leetcode:reverse-nodes-in-k-group": ["NeetCode150", "Top100Liked", "StriverA2Z", "StriverSDE"],
 
  // Trees
  "leetcode:same-tree": ["Blind75", "NeetCode150", "TopInterview150", "StriverA2Z"],
  "leetcode:subtree-of-another-tree": ["Blind75", "NeetCode150", "StriverA2Z"],
  "leetcode:lowest-common-ancestor-of-a-binary-tree": ["NeetCode150", "TopInterview150", "Top100Liked", "StriverA2Z", "StriverSDE"],
  "leetcode:binary-tree-right-side-view": ["NeetCode150", "TopInterview150", "Top100Liked", "StriverA2Z"],
  "leetcode:count-good-nodes-in-binary-tree": ["NeetCode150"],
  "leetcode:validate-binary-search-tree": ["Blind75", "NeetCode150", "TopInterview150", "Top100Liked", "StriverA2Z", "StriverSDE"],
  "leetcode:kth-smallest-element-in-a-bst": ["Blind75", "NeetCode150", "TopInterview150", "Top100Liked", "StriverA2Z"],
  "leetcode:construct-binary-tree-from-preorder-and-inorder-traversal": ["Blind75", "NeetCode150", "TopInterview150", "Top100Liked", "StriverA2Z", "StriverSDE"],
  "leetcode:binary-tree-maximum-path-sum": ["Blind75", "NeetCode150", "Top100Liked", "StriverA2Z"],
  "leetcode:serialize-and-deserialize-binary-tree": ["Blind75", "NeetCode150", "Top100Liked", "StriverA2Z", "StriverSDE"],
 
  // Dynamic Programming & Greedy
  "leetcode:house-robber": ["Blind75", "Grind169", "NeetCode150", "TopInterview150", "Top100Liked", "StriverA2Z", "StriverSDE"],
  "leetcode:house-robber-ii": ["Blind75", "NeetCode150", "StriverA2Z"],
  "leetcode:longest-palindromic-substring": ["Blind75", "NeetCode150", "Top100Liked", "StriverA2Z", "StriverSDE"],
  "leetcode:decode-ways": ["Blind75", "NeetCode150", "TopInterview150", "StriverA2Z"],
  "leetcode:unique-paths": ["Blind75", "NeetCode150", "TopInterview150", "Top100Liked", "StriverA2Z", "StriverSDE"],
  "leetcode:word-break": ["Blind75", "NeetCode150", "TopInterview150", "Top100Liked", "StriverA2Z", "StriverSDE"],
  "leetcode:longest-increasing-subsequence": ["Blind75", "NeetCode150", "Top100Liked", "StriverA2Z", "StriverSDE"],
  
  // GeeksforGeeks Examples
  "gfg:reverse-an-array": ["StriverA2Z", "LoveBabbar450", "GFG160", "StriverSDE"],
  "gfg:find-minimum-and-maximum-element-in-an-array": ["StriverA2Z", "LoveBabbar450", "GFG160"],
  "gfg:kth-smallest-element": ["LoveBabbar450", "StriverA2Z", "StriverSDE"],
  "gfg:sort-an-array-of-0s-1s-and-2s": ["LoveBabbar450", "StriverA2Z", "GFG160", "StriverSDE"],
  "gfg:move-all-negative-elements-to-end": ["LoveBabbar450", "CoderArmy"],
  "gfg:union-of-two-arrays": ["LoveBabbar450", "StriverA2Z", "GFG160", "StriverSDE"],
  "gfg:cyclically-rotate-an-array-by-one": ["LoveBabbar450", "GFG160"],
  "gfg:missing-number-in-array": ["StriverA2Z", "GFG160"],
 
  // CSES Examples
  "cses:weird-algorithm": ["CSESSet"],
  "cses:missing-number": ["CSESSet"],
  "cses:repetitions": ["CSESSet"],
  "cses:increasing-array": ["CSESSet"],
  "cses:permutations": ["CSESSet"],
  "cses:number-spiral": ["CSESSet"],
 
  // InterviewBit Examples
  "interviewbit:max-sum-path": ["InterviewBitSet"],
  "interviewbit:min-steps-in-infinite-grid": ["InterviewBitSet"],
  "interviewbit:add-one-to-number": ["InterviewBitSet"],
  "interviewbit:max-non-negative-subarray": ["InterviewBitSet"],
  "interviewbit:repeat-and-missing-number-array": ["InterviewBitSet", "LoveBabbar450", "StriverA2Z", "StriverSDE"]
};

// In-memory cache of compiled indices (combines custom + pre-compiled)
let compiledIndex = null;
let compiledSheets = null;

function getStandardPlatformPrefix(platform) {
  const plat = String(platform || "").toLowerCase().trim();
  if (plat === "geeksforgeeks" || plat === "gfg") return "gfg";
  if (plat === "codingninjas" || plat === "code360" || plat === "coding ninjas (code360)") return "codingninjas";
  if (plat === "interviewbit" || plat === "ib") return "interviewbit";
  return plat;
}

// Robust normalization logic to clean names/slugs into standard kebab-case format
function normalizeSlug(str) {
  if (!str) return "";
  try {
    str = decodeURIComponent(str);
  } catch (e) {}
  
  // Remove leading digits/question numbering (e.g. "1. Two Sum" -> "Two Sum")
  str = str.replace(/^\s*\d+[\s\.\-_:\/]+/, "");
  str = str.replace(/^(problem|question|task|ques)\s*\d+[\s\.\-_:\/]*/i, "");
  str = str.toLowerCase();
  
  // Normalize synonyms
  str = str.replace(/\bzeroes\b/g, "zeros");
  str = str.replace(/\bbinary\s+search\s+tree\b/g, "bst");
  str = str.replace(/\blinked\s+list\b/g, "linkedlist");
  str = str.replace(/\bdepth\s+first\s+search\b/g, "dfs");
  str = str.replace(/\bbreadth\s+first\s+search\b/g, "bfs");
  
  str = str.replace(/[^a-z0-9\s\-]/g, "");
  str = str.replace(/[\s\-_]+/g, "-");
  return str.replace(/^-+|-+$/g, "");
}

// Tokenize and filter stop words
function getTokens(str) {
  const normalized = normalizeSlug(str);
  const stopWords = new Set([
    "a", "an", "the", "in", "of", "and", "or", "to", "for", "on", "with", "at",
    "by", "from", "sheet", "dsa", "problem", "solution", "easy", "medium", "hard"
  ]);
  return normalized.split("-").filter(token => token && !stopWords.has(token));
}

// Levenshtein edit distance
function levenshteinDistance(s1, s2) {
  const len1 = s1.length;
  const len2 = s2.length;
  const matrix = Array.from({ length: len1 + 1 }, () => new Array(len2 + 1).fill(0));
  
  for (let i = 0; i <= len1; i++) matrix[i][0] = i;
  for (let j = 0; j <= len2; j++) matrix[0][j] = j;
  
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }
  return matrix[len1][len2];
}

// Multi-strategy fuzzy match
function fuzzyMatch(subTitle, subSlug, entrySlug) {
  const normSubTitle = normalizeSlug(subTitle);
  const normSubSlug = normalizeSlug(subSlug);
  const normEntrySlug = normalizeSlug(entrySlug);

  if (normSubSlug === normEntrySlug || normSubTitle === normEntrySlug) {
    return true;
  }

  if (normSubSlug.includes(normEntrySlug) || normEntrySlug.includes(normSubSlug)) {
    const subWordsCount = normSubSlug.split("-").length;
    const entryWordsCount = normEntrySlug.split("-").length;
    if (Math.abs(subWordsCount - entryWordsCount) <= 2 && Math.min(subWordsCount, entryWordsCount) >= 2) {
      return true;
    }
  }

  const subTokens = getTokens(subTitle || subSlug);
  const entryTokens = getTokens(entrySlug);
  
  if (subTokens.length > 0 && entryTokens.length > 0) {
    const common = subTokens.filter(t => entryTokens.includes(t));
    const minLen = Math.min(subTokens.length, entryTokens.length);
    
    if (minLen <= 2 && common.length === minLen) {
      return true;
    }
    if (minLen > 2 && common.length >= Math.ceil(minLen * 0.8)) {
      return true;
    }
  }

  if (Math.abs(normSubSlug.length - normEntrySlug.length) <= 3) {
    const distance = levenshteinDistance(normSubSlug, normEntrySlug);
    const maxAllowedDistance = Math.min(2, Math.floor(normEntrySlug.length * 0.2));
    if (distance <= maxAllowedDistance) {
      return true;
    }
  }

  return false;
}

// Rebuild dynamic sheets index (merge pre-compiled + custom sheets)
async function compileInvertedIndex() {
  if (compiledIndex && compiledSheets) {
    return { index: compiledIndex, sheets: compiledSheets };
  }

  compiledIndex = { ...SHEET_MAPPING_INDEX };
  compiledSheets = { ...SUPPORTED_SHEETS };

  try {
    const customSheets = await getCustomSheets().catch(() => []);
    customSheets.forEach((sheet) => {
      const sheetId = `custom:${sheet.sheetName.replace(/\s+/g, "_")}`;
      compiledSheets[sheetId] = { name: sheet.sheetName, total: sheet.problems.length, isCustom: true };

      sheet.problems.forEach((probKey) => {
        const matchedKey = findFuzzyMatch(probKey);
        if (!compiledIndex[matchedKey]) {
          compiledIndex[matchedKey] = [];
        }
        if (!compiledIndex[matchedKey].includes(sheetId)) {
          compiledIndex[matchedKey].push(sheetId);
        }
      });
    });
  } catch (e) {
    console.error("Error compiling custom sheets index:", e);
  }

  return { index: compiledIndex, sheets: compiledSheets };
}

// Find fuzzy matching key in existing indices
function findFuzzyMatch(probKey) {
  const [rawPlatform, rawSlug] = probKey.split(":");
  const platform = getStandardPlatformPrefix(rawPlatform);
  const slug = rawSlug || "";
  const standardKey = `${platform}:${slug}`;

  if (SHEET_MAPPING_INDEX[standardKey]) return standardKey;
  if (!slug) return standardKey;

  const normSlug = normalizeSlug(slug);
  const keys = Object.keys(SHEET_MAPPING_INDEX);
  
  for (const k of keys) {
    const [kp, ks] = k.split(":");
    if (getStandardPlatformPrefix(kp) === platform && fuzzyMatch(slug, slug, ks)) {
      return k;
    }
  }

  return standardKey;
}

// Sheet membership lookup (with cross-platform matching support)
function getSheetsForProblem(platform, slug, title) {
  const plat = getStandardPlatformPrefix(platform);
  const normSlug = normalizeSlug(slug);
  const normTitle = title ? normalizeSlug(title) : normSlug.replace(/[-_]+/g, " ");
  
  const sheets = [];
  const index = compiledIndex || SHEET_MAPPING_INDEX;

  // 1. Direct same-platform exact lookup
  const directKey = `${plat}:${normSlug}`;
  if (index[directKey]) {
    sheets.push(...index[directKey]);
  }

  // 2. Cross-platform fuzzy matching lookup
  for (const [entryKey, sheetIds] of Object.entries(index)) {
    const [_, entrySlug] = entryKey.split(":");
    if (fuzzyMatch(normTitle, normSlug, entrySlug)) {
      sheets.push(...sheetIds);
    }
  }

  // Fallbacks
  if (plat === "cses" && !sheets.includes("CSESSet")) {
    sheets.push("CSESSet");
  }
  if (plat === "interviewbit" && !sheets.includes("InterviewBitSet")) {
    sheets.push("InterviewBitSet");
  }
  if (plat === "gfg" && !sheets.includes("GFG160")) {
    sheets.push("GFG160");
  }

  return [...new Set(sheets)];
}

// Reset cache if custom sheets are updated
function invalidateCompiledCache() {
  compiledIndex = null;
  compiledSheets = null;
}

// Import dynamic coding sheet by parsing GitHub repo content via API
async function importSheetFromGitHub(repoPath, sheetName, token) {
  // Endpoint to fetch repository tree recursively
  const url = `https://api.github.com/repos/${repoPath}/git/trees/main?recursive=1`;
  const headers = {
    "Accept": "application/vnd.github+json"
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(url, { headers });
  if (!res.ok) {
    throw new Error(`Failed to load repository files: ${res.statusText}`);
  }

  const data = await res.json();
  const tree = data.tree || [];

  const problems = [];
  const platforms = ["leetcode", "gfg", "cses", "interviewbit", "neetcode", "codingninjas"];

  tree.forEach((file) => {
    // Only parse files in problem directories or containing solution codes
    if (file.type !== "blob") return;
    
    const parts = file.path.split("/");
    const filename = parts[parts.length - 1];
    
    // Ignore meta files
    if (filename.startsWith(".") || filename.toLowerCase() === "readme.md") return;

    // Clean name
    const rawName = filename.split(".")[0];
    const cleanSlug = rawName.toLowerCase().replace(/^\d+[-_]/, "").replace(/[^a-z0-9]+/g, "-");

    // Guess platform from folder structure or default to LeetCode
    let guessedPlatform = "leetcode";
    for (const p of platforms) {
      if (file.path.toLowerCase().includes(p)) {
        guessedPlatform = p;
        break;
      }
    }

    problems.push(`${guessedPlatform}:${cleanSlug}`);
  });

  const uniqueProbs = [...new Set(problems)];
  if (uniqueProbs.length === 0) {
    throw new Error("No solved solution files parsed from repository path.");
  }

  const sheet = {
    sheetName,
    problems: uniqueProbs
  };

  await saveCustomSheet(sheet);
  invalidateCompiledCache();
  await compileInvertedIndex();

  return sheet;
}
