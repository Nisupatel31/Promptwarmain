const CRISIS_PATTERNS = [
  /\b(kill|hurt)\s+(myself|me)\b/i,
  /\b(suicide|suicidal)\b/i,
  /\bend\s+(my|this)\s+life\b/i,
  /\bdon'?t want to (be alive|live|wake up)\b/i,
  /\bbetter off dead\b/i,
  /\bno reason to live\b/i,
  /\bplanning to die\b/i
];

const THEMES = {
  "Mock tests": ["mock", "test score", "marks", "rank", "percentile"],
  "Time pressure": ["time", "behind", "syllabus", "deadline", "not enough"],
  "Sleep": ["sleep", "tired", "exhausted", "awake", "insomnia"],
  "Family expectations": ["parent", "family", "expectation", "disappoint"],
  "Comparison": ["compare", "everyone else", "friends are", "better than me"],
  "Focus": ["focus", "concentrate", "distracted", "procrastinat"],
  "Self-doubt": ["failure", "fail", "not good enough", "can't do", "useless"]
};

const STRENGTHS = {
  "Taking breaks": ["break", "rest", "walk", "pause"],
  "Reaching out": ["talked", "called", "friend", "teacher", "counsellor"],
  "Movement": ["exercise", "run", "gym", "yoga", "stretch"],
  "Mindfulness": ["breath", "meditat", "grounding", "calm"],
  "Planning": ["plan", "schedule", "list", "one step"],
  "Healthy sleep": ["slept well", "early night", "rested"]
};

const NEGATIVE_WORDS = [
  "anxious", "afraid", "angry", "burnout", "confused", "drained", "exhausted",
  "fail", "failure", "hopeless", "lonely", "overwhelmed", "panic", "sad",
  "scared", "stressed", "tired", "useless", "worried"
];

const POSITIVE_WORDS = [
  "better", "calm", "confident", "good", "grateful", "happy", "hopeful",
  "managed", "proud", "ready", "rested", "strong"
];

export function detectCrisis(text) {
  return CRISIS_PATTERNS.some((pattern) => pattern.test(text));
}

function countMatches(text, words) {
  const normalized = text.toLowerCase();
  return words.reduce((count, word) => {
    let matches = 0;
    let position = normalized.indexOf(word);
    while (position !== -1) {
      matches += 1;
      position = normalized.indexOf(word, position + word.length);
    }
    return count + matches;
  }, 0);
}

export function extractSignals(text, dictionary = THEMES) {
  return Object.entries(dictionary)
    .map(([name, keywords]) => ({ name, count: countMatches(text, keywords) }))
    .filter((signal) => signal.count > 0)
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

export function analyzeEntry({ text, mood, tags = [] }) {
  const cleanText = text.trim().replace(/\s+/g, " ");
  if (!cleanText) {
    throw new Error("Journal text is required.");
  }

  const numericMood = Math.min(5, Math.max(1, Number(mood) || 3));
  const isCrisis = detectCrisis(cleanText);
  const themes = extractSignals(`${cleanText} ${tags.join(" ")}`);
  const strengths = extractSignals(cleanText, STRENGTHS);
  const negativeCount = countMatches(cleanText, NEGATIVE_WORDS);
  const positiveCount = countMatches(cleanText, POSITIVE_WORDS);
  const stressLevel = isCrisis
    ? "urgent"
    : numericMood <= 2 || negativeCount >= 3
      ? "high"
      : numericMood === 3 || negativeCount > positiveCount
        ? "moderate"
        : "steady";

  return {
    isCrisis,
    mood: numericMood,
    stressLevel,
    themes,
    strengths,
    reflection: createReflection({ mood: numericMood, stressLevel, themes, strengths })
  };
}

function createReflection({ mood, stressLevel, themes, strengths }) {
  const mainTheme = themes[0]?.name;
  const strength = strengths[0]?.name;

  if (stressLevel === "high") {
    return {
      acknowledgement: mainTheme
        ? `It sounds like ${mainTheme.toLowerCase()} is carrying a lot of weight today. Feeling stretched does not mean you are falling behind as a person.`
        : "You sound deeply stretched today. That deserves care before another push for productivity.",
      insight: "When the mind treats the whole exam journey as one immediate problem, even opening a book can feel threatening.",
      action: "Put both feet on the floor. Exhale slowly three times, then choose a task that takes no more than ten minutes.",
      encouragement: "A difficult day is information, not a verdict on your ability."
    };
  }

  if (stressLevel === "moderate") {
    return {
      acknowledgement: mainTheme
        ? `I notice some tension around ${mainTheme.toLowerCase()}. You are allowed to take that seriously without letting it define the whole day.`
        : "There is some tension in what you wrote, and also enough steadiness to work with.",
      insight: strength
        ? `${strength} may already be one of your useful recovery signals.`
        : "Naming the pressure clearly can reduce the mental effort of carrying it.",
      action: "Write the next smallest study action on paper, and give it one focused 15-minute block.",
      encouragement: "You do not need perfect confidence before taking the next step."
    };
  }

  return {
    acknowledgement: mood >= 4
      ? "There is a sense of steadiness in your check-in today. It is worth noticing what helped create it."
      : "You seem to have some room to breathe today.",
    insight: strength
      ? `${strength} appears to be supporting you. Repeating what works is a real strategy.`
      : "Stable days are useful data too; they show the conditions in which you can recover and focus.",
    action: "Protect one small thing that is working today, whether that is a break, a plan, movement, or sleep.",
    encouragement: "Progress includes learning how to stay well while you prepare."
  };
}

export function aggregateSignals(entries, key) {
  const totals = new Map();
  for (const entry of entries) {
    for (const signal of entry.analysis?.[key] || []) {
      totals.set(signal.name, (totals.get(signal.name) || 0) + signal.count);
    }
  }
  return [...totals.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

export function calculateStreak(entries, now = new Date()) {
  const localDateKey = (value) => {
    const date = new Date(value);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };
  const days = new Set(entries.map((entry) => localDateKey(entry.createdAt)));
  let streak = 0;
  const cursor = new Date(now);
  cursor.setHours(12, 0, 0, 0);

  const today = localDateKey(cursor);
  if (!days.has(today)) {
    cursor.setDate(cursor.getDate() - 1);
  }

  while (days.has(localDateKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export function sanitizeEntry(entry) {
  if (!entry) return {};
  return {
    id: String(entry.id || ""),
    createdAt: String(entry.createdAt || ""),
    text: String(entry.text || "").slice(0, 1200),
    mood: Math.min(5, Math.max(1, Number(entry.mood) || 3)),
    tags: Array.isArray(entry.tags) ? entry.tags.map(String).slice(0, 8) : [],
    analysis: entry.analysis || {}
  };
}
