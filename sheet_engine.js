"use strict";

// Pre-compiled supported sheets with metadata
const SUPPORTED_SHEETS = {
  "Blind75": { name: "Blind 75", total: 75 },
  "Grind75": { name: "Grind 75", total: 75 },
  "Grind169": { name: "Grind 169", total: 169 },
  "NeetCode150": { name: "NeetCode 150", total: 150 },
  "LeetCode75": { name: "LeetCode 75", total: 75 },
  "TopInterview150": { name: "Top Interview 150", total: 150 },
  "Top100Liked": { name: "Top 100 Liked", total: 100 },
  "SQL50": { name: "SQL 50", total: 50 },
  "StriverA2Z": { name: "Striver A2Z DSA", total: 450 },
  "LoveBabbar450": { name: "Love Babbar 450", total: 450 },
  "CoderArmy": { name: "Coder Army DSA", total: 350 },
  "GFG160": { name: "GFG 160", total: 160 },
  "CSESSet": { name: "CSES Problem Set", total: 300 },
  "InterviewBitSet": { name: "InterviewBit Sets", total: 200 }
};

// Inverted index for O(1) sheet lookups
// Key: 'platform:slug'
const SHEET_MAPPING_INDEX = {
  // LeetCode Arrays & Hashing
  "leetcode:two-sum": ["Blind75", "Grind75", "Grind169", "NeetCode150", "LeetCode75", "TopInterview150", "Top100Liked", "StriverA2Z", "LoveBabbar450"],
  "leetcode:valid-parentheses": ["Blind75", "Grind75", "Grind169", "NeetCode150", "LeetCode75", "TopInterview150", "Top100Liked", "StriverA2Z"],
  "leetcode:merge-two-sorted-lists": ["Blind75", "Grind75", "Grind169", "NeetCode150", "LeetCode75", "TopInterview150", "Top100Liked", "StriverA2Z", "LoveBabbar450"],
  "leetcode:best-time-to-buy-and-sell-stock": ["Blind75", "Grind75", "Grind169", "NeetCode150", "LeetCode75", "TopInterview150", "Top100Liked", "StriverA2Z", "LoveBabbar450"],
  "leetcode:valid-palindrome": ["Blind75", "Grind75", "Grind169", "NeetCode150", "TopInterview150", "StriverA2Z"],
  "leetcode:invert-binary-tree": ["Blind75", "Grind75", "Grind169", "NeetCode150", "Top100Liked", "StriverA2Z", "LoveBabbar450"],
  "leetcode:valid-anagram": ["Blind75", "Grind75", "Grind169", "NeetCode150", "LeetCode75", "TopInterview150", "StriverA2Z"],
  "leetcode:binary-search": ["Blind75", "Grind75", "Grind169", "NeetCode150", "LeetCode75", "TopInterview150", "StriverA2Z"],
  "leetcode:flood-fill": ["Blind75", "Grind75", "Grind169", "NeetCode150", "StriverA2Z"],
  "leetcode:lowest-common-ancestor-of-a-binary-search-tree": ["Blind75", "Grind75", "Grind169", "NeetCode150", "TopInterview150", "StriverA2Z", "LoveBabbar450"],
  "leetcode:balanced-binary-tree": ["Blind75", "Grind75", "Grind169", "NeetCode150", "StriverA2Z"],
  "leetcode:linked-list-cycle": ["Blind75", "Grind75", "Grind169", "NeetCode150", "LeetCode75", "TopInterview150", "Top100Liked", "StriverA2Z", "LoveBabbar450"],
  "leetcode:implement-queue-using-stacks": ["Blind75", "Grind75", "Grind169", "NeetCode150", "StriverA2Z", "LoveBabbar450"],
  "leetcode:first-bad-version": ["Grind75", "Grind169", "StriverA2Z"],
  "leetcode:ransom-note": ["Grind75", "Grind169", "TopInterview150"],
  "leetcode:climbing-stairs": ["Blind75", "Grind75", "Grind169", "NeetCode150", "TopInterview150", "Top100Liked", "StriverA2Z", "LoveBabbar450"],
  "leetcode:longest-palindrome": ["Grind75", "Grind169"],
  "leetcode:reverse-linked-list": ["Blind75", "Grind75", "Grind169", "NeetCode150", "LeetCode75", "TopInterview150", "Top100Liked", "StriverA2Z", "LoveBabbar450"],
  "leetcode:majority-element": ["Grind75", "Grind169", "TopInterview150", "Top100Liked", "StriverA2Z"],
  "leetcode:add-binary": ["Grind75", "Grind169", "TopInterview150"],
  "leetcode:diameter-of-binary-tree": ["Grind75", "Grind169", "NeetCode150", "Top100Liked", "StriverA2Z"],
  "leetcode:middle-of-the-linked-list": ["Grind75", "Grind169", "StriverA2Z"],
  "leetcode:maximum-depth-of-binary-tree": ["Blind75", "Grind75", "Grind169", "NeetCode150", "LeetCode75", "TopInterview150", "Top100Liked", "StriverA2Z"],
  "leetcode:contains-duplicate": ["Blind75", "Grind75", "Grind169", "NeetCode150", "StriverA2Z"],
  "leetcode:maximum-subarray": ["Blind75", "Grind169", "NeetCode150", "Top100Liked", "StriverA2Z", "LoveBabbar450"],
  "leetcode:insert-interval": ["Blind75", "Grind75", "Grind169", "NeetCode150", "TopInterview150", "Top100Liked", "StriverA2Z", "LoveBabbar450"],
  "leetcode:01-matrix": ["Blind75", "Grind75", "Grind169", "NeetCode150"],
  "leetcode:k-closest-points-to-origin": ["Blind75", "Grind75", "Grind169", "NeetCode150"],
  "leetcode:longest-substring-without-repeating-characters": ["Blind75", "Grind75", "Grind169", "NeetCode150", "TopInterview150", "Top100Liked", "StriverA2Z", "LoveBabbar450"],
  "leetcode:3sum": ["Blind75", "Grind75", "Grind169", "NeetCode150", "TopInterview150", "Top100Liked", "StriverA2Z", "LoveBabbar450"],
  "leetcode:binary-tree-level-order-traversal": ["Blind75", "Grind75", "Grind169", "NeetCode150", "TopInterview150", "Top100Liked", "StriverA2Z", "LoveBabbar450"],
  "leetcode:clone-graph": ["Blind75", "Grind75", "Grind169", "NeetCode150", "TopInterview150", "StriverA2Z", "LoveBabbar450"],
  "leetcode:evaluate-reverse-polish-notation": ["Blind75", "Grind75", "Grind169", "NeetCode150", "TopInterview150"],
  "leetcode:course-schedule": ["Blind75", "Grind75", "Grind169", "NeetCode150", "TopInterview150", "Top100Liked", "StriverA2Z", "LoveBabbar450"],
  "leetcode:implement-trie-prefix-tree": ["Blind75", "Grind75", "Grind169", "NeetCode150", "TopInterview150", "Top100Liked", "StriverA2Z", "LoveBabbar450"],
  "leetcode:coin-change": ["Blind75", "Grind75", "Grind169", "NeetCode150", "TopInterview150", "Top100Liked", "StriverA2Z", "LoveBabbar450"],
  "leetcode:product-of-array-except-self": ["Blind75", "Grind75", "Grind169", "NeetCode150", "LeetCode75", "TopInterview150", "Top100Liked", "StriverA2Z", "LoveBabbar450"],
  "leetcode:min-stack": ["Blind75", "Grind169", "NeetCode150", "TopInterview150", "Top100Liked", "StriverA2Z", "LoveBabbar450"],
  "leetcode:group-anagrams": ["Blind75", "NeetCode150", "TopInterview150", "Top100Liked", "StriverA2Z"],
  "leetcode:top-k-frequent-elements": ["Blind75", "NeetCode150", "Top100Liked", "StriverA2Z"],
  "leetcode:encode-and-decode-strings": ["Blind75", "NeetCode150"],
  "leetcode:longest-consecutive-sequence": ["Blind75", "NeetCode150", "TopInterview150", "Top100Liked", "StriverA2Z"],
  
  // Two Pointers
  "leetcode:two-sum-ii-input-array-is-sorted": ["NeetCode150", "TopInterview150", "StriverA2Z"],
  "leetcode:3sum-closest": ["TopInterview150", "StriverA2Z"],
  "leetcode:container-with-most-water": ["Blind75", "NeetCode150", "TopInterview150", "Top100Liked", "StriverA2Z"],
  "leetcode:trapping-rain-water": ["NeetCode150", "TopInterview150", "Top100Liked", "StriverA2Z"],

  // Sliding Window
  "leetcode:best-time-to-buy-and-sell-stock-ii": ["TopInterview150", "StriverA2Z"],
  "leetcode:longest-repeating-character-replacement": ["Blind75", "NeetCode150", "StriverA2Z"],
  "leetcode:permutation-in-string": ["NeetCode150"],
  "leetcode:minimum-window-substring": ["Blind75", "NeetCode150", "TopInterview150", "StriverA2Z"],
  "leetcode:sliding-window-maximum": ["NeetCode150", "Top100Liked", "StriverA2Z"],

  // Stack & Monotonic
  "leetcode:valid-sudoku": ["NeetCode150", "TopInterview150"],
  "leetcode:daily-temperatures": ["NeetCode150", "Top100Liked"],
  "leetcode:car-fleet": ["NeetCode150"],
  "leetcode:largest-rectangle-in-histogram": ["NeetCode150", "Top100Liked", "StriverA2Z"],

  // Binary Search
  "leetcode:search-a-2d-matrix": ["NeetCode150", "TopInterview150", "StriverA2Z"],
  "leetcode:koko-eating-bananas": ["NeetCode150", "StriverA2Z"],
  "leetcode:find-minimum-in-rotated-sorted-array": ["Blind75", "NeetCode150", "TopInterview150", "StriverA2Z"],
  "leetcode:search-in-rotated-sorted-array": ["Blind75", "NeetCode150", "TopInterview150", "Top100Liked", "StriverA2Z"],
  "leetcode:median-of-two-sorted-arrays": ["NeetCode150", "Top100Liked", "StriverA2Z"],

  // Linked List
  "leetcode:remove-nth-node-from-end-of-list": ["Blind75", "NeetCode150", "TopInterview150", "Top100Liked", "StriverA2Z"],
  "leetcode:copy-list-with-random-pointer": ["NeetCode150", "TopInterview150", "Top100Liked", "StriverA2Z"],
  "leetcode:add-two-numbers": ["NeetCode150", "TopInterview150", "Top100Liked", "StriverA2Z"],
  "leetcode:merge-k-sorted-lists": ["Blind75", "NeetCode150", "TopInterview150", "Top100Liked", "StriverA2Z"],
  "leetcode:reverse-nodes-in-k-group": ["NeetCode150", "Top100Liked", "StriverA2Z"],

  // Trees
  "leetcode:same-tree": ["Blind75", "NeetCode150", "TopInterview150", "StriverA2Z"],
  "leetcode:subtree-of-another-tree": ["Blind75", "NeetCode150", "StriverA2Z"],
  "leetcode:lowest-common-ancestor-of-a-binary-tree": ["NeetCode150", "TopInterview150", "Top100Liked", "StriverA2Z"],
  "leetcode:binary-tree-right-side-view": ["NeetCode150", "TopInterview150", "Top100Liked", "StriverA2Z"],
  "leetcode:count-good-nodes-in-binary-tree": ["NeetCode150"],
  "leetcode:validate-binary-search-tree": ["Blind75", "NeetCode150", "TopInterview150", "Top100Liked", "StriverA2Z"],
  "leetcode:kth-smallest-element-in-a-bst": ["Blind75", "NeetCode150", "TopInterview150", "Top100Liked", "StriverA2Z"],
  "leetcode:construct-binary-tree-from-preorder-and-inorder-traversal": ["Blind75", "NeetCode150", "TopInterview150", "Top100Liked", "StriverA2Z"],
  "leetcode:binary-tree-maximum-path-sum": ["Blind75", "NeetCode150", "Top100Liked", "StriverA2Z"],
  "leetcode:serialize-and-deserialize-binary-tree": ["Blind75", "NeetCode150", "Top100Liked", "StriverA2Z"],

  // Dynamic Programming & Greedy
  "leetcode:house-robber": ["Blind75", "Grind169", "NeetCode150", "TopInterview150", "Top100Liked", "StriverA2Z"],
  "leetcode:house-robber-ii": ["Blind75", "NeetCode150", "StriverA2Z"],
  "leetcode:longest-palindromic-substring": ["Blind75", "NeetCode150", "Top100Liked", "StriverA2Z"],
  "leetcode:decode-ways": ["Blind75", "NeetCode150", "TopInterview150", "StriverA2Z"],
  "leetcode:unique-paths": ["Blind75", "NeetCode150", "TopInterview150", "Top100Liked", "StriverA2Z"],
  "leetcode:word-break": ["Blind75", "NeetCode150", "TopInterview150", "Top100Liked", "StriverA2Z"],
  "leetcode:longest-increasing-subsequence": ["Blind75", "NeetCode150", "Top100Liked", "StriverA2Z"],
  
  // GeeksforGeeks Examples
  "gfg:reverse-an-array": ["StriverA2Z", "LoveBabbar450", "GFG160"],
  "gfg:find-minimum-and-maximum-element-in-an-array": ["StriverA2Z", "LoveBabbar450", "GFG160"],
  "gfg:kth-smallest-element": ["LoveBabbar450", "StriverA2Z"],
  "gfg:sort-an-array-of-0s-1s-and-2s": ["LoveBabbar450", "StriverA2Z", "GFG160"],
  "gfg:move-all-negative-elements-to-end": ["LoveBabbar450", "CoderArmy"],
  "gfg:union-of-two-arrays": ["LoveBabbar450", "StriverA2Z", "GFG160"],
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
  "interviewbit:repeat-and-missing-number-array": ["InterviewBitSet", "LoveBabbar450", "StriverA2Z"]
};

// In-memory cache of compiled indices (combines custom + pre-compiled)
let compiledIndex = null;
let compiledSheets = null;

// Fuzzy Normalization logic to clean names/slugs
function fuzzyNormalize(str) {
  if (!str) return "";
  const stopWords = new Set(["problem", "solution", "dsa", "sheet", "a", "an", "the", "in", "of", "and", "or", "to", "for", "on", "with", "at", "set", "questions", "question"]);
  return str
    .toLowerCase()
    .replace(/[^\w\s-]/g, "") // remove punctuation
    .split(/[\s_-]+/)
    .filter((word) => word && !stopWords.has(word))
    .join("-");
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
        // Find best match in pre-existing keys or match fuzzy
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
  if (SHEET_MAPPING_INDEX[probKey]) return probKey;

  const [platform, slug] = probKey.split(":");
  if (!slug) return probKey;

  const normSlug = fuzzyNormalize(slug);
  const keys = Object.keys(SHEET_MAPPING_INDEX);
  
  for (const k of keys) {
    const [kp, ks] = k.split(":");
    if (kp === platform && fuzzyNormalize(ks) === normSlug) {
      return k;
    }
  }

  return probKey;
}

// Sheet membership lookup
function getSheetsForProblem(platform, slug) {
  const normKey = `${platform.toLowerCase()}:${slug.toLowerCase()}`;
  const sheets = [];

  // Match from precompiled or compiled dynamic index
  const index = compiledIndex || SHEET_MAPPING_INDEX;
  const matchedKey = findFuzzyMatch(normKey);

  if (index[matchedKey]) {
    sheets.push(...index[matchedKey]);
  }

  // Fallbacks
  if (platform.toLowerCase() === "cses" && !sheets.includes("CSESSet")) {
    sheets.push("CSESSet");
  }
  if (platform.toLowerCase() === "interviewbit" && !sheets.includes("InterviewBitSet")) {
    sheets.push("InterviewBitSet");
  }
  if ((platform.toLowerCase() === "geeksforgeeks" || platform.toLowerCase() === "gfg") && !sheets.includes("GFG160")) {
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
