import test from "node:test";
import assert from "node:assert/strict";
import {
  aggregateSignals,
  analyzeEntry,
  calculateStreak,
  detectCrisis,
  extractSignals,
  sanitizeEntry
} from "../wellness.js";

test("detectCrisis catches direct self-harm language", () => {
  assert.equal(detectCrisis("I want to kill myself tonight"), true);
  assert.equal(detectCrisis("I am stressed about my mock test"), false);
});

test("analyzeEntry identifies exam pressure themes", () => {
  const result = analyzeEntry({
    text: "My mock test rank was low and I feel behind on the syllabus.",
    mood: 2
  });
  assert.equal(result.stressLevel, "high");
  assert.deepEqual(result.themes.map((theme) => theme.name), ["Mock tests", "Time pressure"]);
});

test("analyzeEntry recognizes protective habits", () => {
  const result = analyzeEntry({
    text: "I took a walk and talked to my friend. I feel better now.",
    mood: 4
  });
  assert.deepEqual(result.strengths.map((item) => item.name), ["Reaching out", "Taking breaks"]);
  assert.equal(result.stressLevel, "steady");
});

test("extractSignals is case insensitive and ordered by frequency", () => {
  const signals = extractSignals("SLEEP was poor. I am tired and need sleep.");
  assert.equal(signals[0].name, "Sleep");
  assert.equal(signals[0].count, 3);
});

test("aggregateSignals combines repeated themes", () => {
  const entries = [
    { analysis: { themes: [{ name: "Sleep", count: 2 }] } },
    { analysis: { themes: [{ name: "Sleep", count: 1 }, { name: "Focus", count: 1 }] } }
  ];
  assert.deepEqual(aggregateSignals(entries, "themes"), [
    { name: "Sleep", count: 3 },
    { name: "Focus", count: 1 }
  ]);
});

test("calculateStreak counts consecutive dates", () => {
  const entries = [
    { createdAt: "2026-06-11T10:00:00.000Z" },
    { createdAt: "2026-06-12T10:00:00.000Z" },
    { createdAt: "2026-06-13T10:00:00.000Z" }
  ];
  assert.equal(calculateStreak(entries, new Date("2026-06-13T12:00:00.000Z")), 3);
});

test("sanitizeEntry bounds untrusted stored values", () => {
  const clean = sanitizeEntry({
    id: 4,
    createdAt: "2026-06-13",
    text: "x".repeat(1300),
    mood: 99,
    tags: Array(10).fill("tag")
  });
  assert.equal(clean.text.length, 1200);
  assert.equal(clean.mood, 5);
  assert.equal(clean.tags.length, 8);
});

test("empty journal entries are rejected", () => {
  assert.throws(() => analyzeEntry({ text: "  ", mood: 3 }), /required/);
});
