// Lightweight typo tolerance — no external library, no external AI. Plain
// Levenshtein edit distance, used only as a FALLBACK when an exact
// substring match already failed, so it can never make an already-correct
// match worse or slower for the common case.
export function levenshteinDistance(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      current[j] = a[i - 1] === b[j - 1] ? previous[j - 1] : 1 + Math.min(previous[j - 1], previous[j], current[j - 1]);
    }
    previous = current;
  }
  return previous[b.length];
}

// Shorter words tolerate less absolute edit distance (so "class" doesn't
// fuzzy-match everything within 2 edits of its 5 letters) while longer
// words like "enrollment"/"attendance"/"revenue" can absorb a couple of
// typos — including transposition-style typos ("studnets"/"revenew"),
// which cost 2 substitutions under plain Levenshtein, not 1.
function threshold(word) {
  if (word.length <= 6) return 1;
  return 2;
}

// Finds the best fuzzy match for `word` among `candidates` (a flat list of
// strings, e.g. one entity's synonyms). Returns the matched candidate or
// null. Skips candidates under ~4 characters (too short to fuzz safely —
// almost everything is within 1 edit of a 3-letter word) and multi-word
// phrases (fuzzy-matching "this month" word-by-word isn't meaningful the
// same way a single misspelled noun is).
export function fuzzyFindBest(word, candidates) {
  if (!word || word.length < 4) return null;
  let best = null;
  let bestDistance = Infinity;
  for (const candidate of candidates) {
    if (candidate.includes(" ") || candidate.length < 4) continue;
    const distance = levenshteinDistance(word, candidate);
    if (distance <= threshold(candidate) && distance < bestDistance) {
      best = candidate;
      bestDistance = distance;
    }
  }
  return best;
}
