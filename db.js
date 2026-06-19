"use strict";

const DB_NAME = "CodeSyncDB";
const DB_VERSION = 2;

let dbInstance = null;

function getDB() {
  if (dbInstance) return Promise.resolve(dbInstance);

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // Deduplication store
      if (!db.objectStoreNames.contains("submissions")) {
        db.createObjectStore("submissions", { keyPath: "key" });
      }

      // Async sync queue store
      if (!db.objectStoreNames.contains("queue")) {
        db.createObjectStore("queue", { keyPath: "id", autoIncrement: true });
      }

      // Progress tracker store
      if (!db.objectStoreNames.contains("progress")) {
        db.createObjectStore("progress", { keyPath: "sheetName" });
      }

      // Custom/Imported sheets store
      if (!db.objectStoreNames.contains("custom_sheets")) {
        db.createObjectStore("custom_sheets", { keyPath: "sheetName" });
      }
    };

    request.onsuccess = (event) => {
      dbInstance = event.target.result;
      resolve(dbInstance);
    };

    request.onerror = (event) => {
      reject(new Error("Failed to open IndexedDB: " + event.target.error));
    };
  });
}

// Submissions helpers
async function isDuplicateSubmission(key, ttlMs = 45000) {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("submissions", "readonly");
    const store = transaction.objectStore("submissions");
    const request = store.get(key);

    request.onsuccess = () => {
      const data = request.result;
      if (!data) {
        resolve(false);
        return;
      }
      const isFresh = (Date.now() - data.timestamp) < ttlMs;
      resolve(isFresh);
    };

    request.onerror = () => reject(request.error);
  });
}

async function saveSubmission(key, payload) {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("submissions", "readwrite");
    const store = transaction.objectStore("submissions");
    const request = store.put({
      key,
      timestamp: Date.now(),
      payload
    });

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// Queue helpers
async function addToQueue(payload) {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("queue", "readwrite");
    const store = transaction.objectStore("queue");
    const request = store.add({
      status: "pending",
      payload,
      retries: 0,
      lastAttempt: 0,
      error: null
    });

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getQueueJobs() {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("queue", "readonly");
    const store = transaction.objectStore("queue");
    const request = store.getAll();

    request.onsuccess = () => {
      resolve(request.result || []);
    };
    request.onerror = () => reject(request.error);
  });
}

async function updateQueueJob(job) {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("queue", "readwrite");
    const store = transaction.objectStore("queue");
    const request = store.put(job);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function removeQueueJob(id) {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("queue", "readwrite");
    const store = transaction.objectStore("queue");
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// Cache for solved progress to avoid unnecessary reads
const progressCache = {};

// Progress helper with memory cache
async function getProgress(sheetName) {
  if (progressCache[sheetName]) {
    return Promise.resolve(progressCache[sheetName]);
  }

  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("progress", "readonly");
    const store = transaction.objectStore("progress");
    const request = store.get(sheetName);

    request.onsuccess = () => {
      const data = request.result || { sheetName, solvedKeys: [], lastSolved: 0 };
      progressCache[sheetName] = data;
      resolve(data);
    };
    request.onerror = () => reject(request.error);
  });
}

async function getAllProgress() {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("progress", "readonly");
    const store = transaction.objectStore("progress");
    const request = store.getAll();

    request.onsuccess = () => {
      const results = request.result || [];
      results.forEach((p) => {
        progressCache[p.sheetName] = p;
      });
      resolve(results);
    };
    request.onerror = () => reject(request.error);
  });
}

async function markSolvedInProgress(sheetName, problemKey) {
  const progress = await getProgress(sheetName);
  
  if (progress.solvedKeys.includes(problemKey)) {
    return;
  }

  progress.solvedKeys.push(problemKey);
  progress.lastSolved = Date.now();
  progressCache[sheetName] = progress;

  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("progress", "readwrite");
    const store = transaction.objectStore("progress");
    const request = store.put(progress);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// Custom Sheets helpers
async function saveCustomSheet(sheet) {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("custom_sheets", "readwrite");
    const store = transaction.objectStore("custom_sheets");
    const request = store.put(sheet);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function deleteCustomSheet(sheetName) {
  const db = await getDB();
  delete progressCache[sheetName];
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("custom_sheets", "readwrite");
    const store = transaction.objectStore("custom_sheets");
    const request = store.delete(sheetName);

    request.onsuccess = async () => {
      try {
        const transProgress = db.transaction("progress", "readwrite");
        const storeProgress = transProgress.objectStore("progress");
        const req = storeProgress.delete(sheetName);
        req.onsuccess = () => resolve();
        req.onerror = () => resolve();
      } catch (err) {
        resolve();
      }
    };
    request.onerror = () => reject(request.error);
  });
}

async function getCustomSheets() {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("custom_sheets", "readonly");
    const store = transaction.objectStore("custom_sheets");
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

// Submissions historical fetcher for analytics engines
async function getAllSubmissions() {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("submissions", "readonly");
    const store = transaction.objectStore("submissions");
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}
