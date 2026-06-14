"use strict";

// Timezone-safe daily streak calculation
function calculateStreak(submissions) {
  if (!submissions || submissions.length === 0) {
    return { currentStreak: 0, maxStreak: 0, streakAtRisk: false };
  }

  // Get unique local dates (YYYY-MM-DD) of submissions
  const dates = new Set(
    submissions.map((s) => {
      const date = new Date(s.timestamp || s.detectedAt);
      return toLocalISOString(date).slice(0, 10);
    })
  );

  const sortedDates = Array.from(dates).sort((a, b) => new Date(b) - new Date(a)); // Descending order
  const todayStr = toLocalISOString(new Date()).slice(0, 10);
  const yesterdayStr = toLocalISOString(new Date(Date.now() - 86400000)).slice(0, 10);

  let currentStreak = 0;
  let maxStreak = 0;
  let runningStreak = 0;

  // Calculate current streak
  let checkDate = new Date(todayStr);
  if (!dates.has(todayStr) && !dates.has(yesterdayStr)) {
    currentStreak = 0;
  } else {
    let dateToVerify = dates.has(todayStr) ? todayStr : yesterdayStr;
    let tempDate = new Date(dateToVerify);
    while (dates.has(toLocalISOString(tempDate).slice(0, 10))) {
      currentStreak++;
      tempDate.setDate(tempDate.getDate() - 1);
    }
  }

  // Calculate max streak historically
  const chronologicalDates = Array.from(dates).sort((a, b) => new Date(a) - new Date(b));
  if (chronologicalDates.length > 0) {
    runningStreak = 1;
    maxStreak = 1;
    for (let i = 1; i < chronologicalDates.length; i++) {
      const prev = new Date(chronologicalDates[i - 1]);
      const curr = new Date(chronologicalDates[i]);
      const diffTime = Math.abs(curr - prev);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays === 1) {
        runningStreak++;
      } else if (diffDays > 1) {
        runningStreak = 1;
      }
      if (runningStreak > maxStreak) {
        maxStreak = runningStreak;
      }
    }
  }

  const streakAtRisk = currentStreak > 0 && !dates.has(todayStr);

  return { currentStreak, maxStreak, streakAtRisk };
}

// Convert date to timezone-safe local YYYY-MM-DD
function toLocalISOString(date) {
  const tzo = -date.getTimezoneOffset();
  const dif = tzo >= 0 ? '+' : '-';
  const pad = (num) => (num < 10 ? '0' : '') + num;
  
  return date.getFullYear() +
    '-' + pad(date.getMonth() + 1) +
    '-' + pad(date.getDate()) +
    'T' + pad(date.getHours()) +
    ':' + pad(date.getMinutes()) +
    ':' + pad(date.getSeconds()) +
    dif + pad(Math.floor(Math.abs(tzo) / 60)) +
    ':' + pad(Math.floor(Math.abs(tzo) % 60));
}

// Get heatmap submissions count for last 365 days
function generateHeatmapData(submissions) {
  const heatmap = {};
  const today = new Date();
  
  // Initialize last 365 days with 0
  for (let i = 365; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = toLocalISOString(d).slice(0, 10);
    heatmap[key] = 0;
  }

  // Populate actual counts
  submissions.forEach((s) => {
    const date = new Date(s.timestamp || s.detectedAt);
    const key = toLocalISOString(date).slice(0, 10);
    if (heatmap[key] !== undefined) {
      heatmap[key]++;
    }
  });

  return heatmap;
}

// Generate topic statistics and identify strengths/weaknesses
function generateTopicAnalytics(submissions) {
  const topicsCount = {};
  submissions.forEach((s) => {
    const payload = s.payload || s;
    const topics = payload.topics || [];
    topics.forEach((topic) => {
      const clean = topic.trim();
      topicsCount[clean] = (topicsCount[clean] || 0) + 1;
    });
  });

  const sortedTopics = Object.entries(topicsCount).sort((a, b) => b[1] - a[1]);
  const strongest = sortedTopics.length > 0 ? sortedTopics[0][0] : "None";
  const weakest = sortedTopics.length > 1 ? sortedTopics[sortedTopics.length - 1][0] : "None";

  return { topicsCount, strongest, weakest };
}

// Language statistics
function generateLanguageAnalytics(submissions) {
  const langCount = {};
  submissions.forEach((s) => {
    const payload = s.payload || s;
    const lang = payload.language || "Unknown";
    langCount[lang] = (langCount[lang] || 0) + 1;
  });
  return langCount;
}

// Insights Engine
function generateInsights(submissions, streakData, topicData) {
  const insights = [];
  
  if (submissions.length === 0) {
    insights.push("No submissions synced yet. Solve a problem to start generating insights!");
    return insights;
  }

  // 1. Streak check
  if (streakData.streakAtRisk) {
    insights.push("🔥 Your daily streak is at risk! Submit a solution today to keep it active.");
  } else if (streakData.currentStreak > 0) {
    insights.push(`💪 Awesome! You are on a ${streakData.currentStreak}-day streak. Keep it up!`);
  }

  // 2. Strongest topic check
  if (topicData.strongest && topicData.strongest !== "None" && topicData.strongest !== "Uncategorized") {
    insights.push(`🎯 Your strongest domain is ${topicData.strongest}, where you have solved the most problems.`);
  }

  // 3. Inactive areas check
  // Check if graphs or trees haven't been solved in 5 days
  const now = Date.now();
  const graphSubmissions = submissions.filter(s => {
    const p = s.payload || s;
    return (p.topics || []).some(t => t.toLowerCase().includes("graph") || t.toLowerCase().includes("tree"));
  });

  if (graphSubmissions.length > 0) {
    const lastGraphDate = Math.max(...graphSubmissions.map(s => s.timestamp || new Date(s.detectedAt).getTime()));
    const daysSince = (now - lastGraphDate) / (1000 * 60 * 60 * 24);
    if (daysSince >= 5) {
      insights.push(`⚠️ It's been ${Math.floor(daysSince)} days since you solved a Graph or Tree problem. Keep your skills sharp!`);
    }
  } else {
    insights.push("💡 Try solving some Graph or Tree problems to diversify your skills!");
  }

  return insights.slice(0, 3); // Max 3 insights
}
