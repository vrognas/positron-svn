// Copyright (c) 2017-2020 Christopher Johnston
// Copyright (c) 2025-present Viktor Rognas
// Licensed under MIT License

import picomatch from "picomatch";

/**
 * Pre-compiled matcher cache for performance optimization
 * Reduces O(n²) overhead by reusing picomatch instances
 */
interface PicomatchOptions {
  dot?: boolean;
  matchBase?: boolean;
}

/**
 * Fast path matcher for simple patterns (no complex globs)
 */
interface SimpleMatcher {
  pattern: string;
  isExclusion: boolean;
  matchFn: (path: string) => boolean;
}

interface MatcherCache {
  patterns: readonly string[];
  opts: PicomatchOptions;
  simpleMatchers: SimpleMatcher[];
  complexMatchers: Array<{ pattern: string; isExclusion: boolean; matcher: picomatch.Matcher }>;
}

let cachedMatcher: MatcherCache | null = null;

/**
 * Check if pattern is simple (no complex glob features)
 * Simple patterns: exact match, *.ext, prefix/
 * Complex patterns: **, {}, [], ?(...)
 */
function isSimplePattern(pattern: string): boolean {
  const cleanPattern = pattern[0] === "!" ? pattern.slice(1) : pattern;
  return !cleanPattern.includes("**") &&
         !cleanPattern.includes("{") &&
         !cleanPattern.includes("[") &&
         !cleanPattern.includes("?(");
}

/**
 * Create fast matcher for simple pattern
 */
function createSimpleMatcher(pattern: string): ((path: string) => boolean) | null {
  const cleanPattern = pattern[0] === "!" ? pattern.slice(1) : pattern;

  // *.ext - suffix match
  if (cleanPattern.startsWith("*") && !cleanPattern.slice(1).includes("*")) {
    const suffix = cleanPattern.slice(1);
    return (path: string) => path.endsWith(suffix);
  }

  // prefix/ - prefix match
  if (cleanPattern.endsWith("/") && !cleanPattern.slice(0, -1).includes("*")) {
    const prefix = cleanPattern.slice(0, -1);
    return (path: string) => path.startsWith(prefix);
  }

  // exact - literal match
  if (!cleanPattern.includes("*") && !cleanPattern.includes("?")) {
    return (path: string) => path === cleanPattern || path.endsWith("/" + cleanPattern);
  }

  return null;
}

function getCachedMatchers(
  patterns: readonly string[],
  opts: PicomatchOptions = {}
): Pick<MatcherCache, "simpleMatchers" | "complexMatchers"> {
  const optsKey = JSON.stringify(opts);

  // Check if cache is valid
  if (
    cachedMatcher &&
    cachedMatcher.patterns === patterns &&
    JSON.stringify(cachedMatcher.opts) === optsKey
  ) {
    return {
      simpleMatchers: cachedMatcher.simpleMatchers,
      complexMatchers: cachedMatcher.complexMatchers
    };
  }

  // Phase 21.C: Two-tier matching - split simple vs complex patterns
  const simpleMatchers: SimpleMatcher[] = [];
  const complexMatchers: Array<{ pattern: string; isExclusion: boolean; matcher: picomatch.Matcher }> = [];

  for (const pattern of patterns) {
    const isExclusion = pattern[0] === "!";
    const matchFn = createSimpleMatcher(pattern);

    if (matchFn && isSimplePattern(pattern)) {
      // Fast path: simple pattern
      simpleMatchers.push({ pattern, isExclusion, matchFn });
    } else {
      // Slow path: complex pattern needs picomatch
      complexMatchers.push({ pattern, isExclusion, matcher: picomatch(pattern, opts) });
    }
  }

  cachedMatcher = { patterns, opts, simpleMatchers, complexMatchers };
  return { simpleMatchers, complexMatchers };
}

export function matchAll(
  path: string,
  patterns: readonly string[],
  opts: PicomatchOptions = {}
): boolean {
  if (!patterns.length) {
    return false;
  }

  const { simpleMatchers, complexMatchers } = getCachedMatchers(patterns, opts);
  let match = false;

  // Phase 21.C: Fast path - check simple patterns first (O(n) string ops)
  for (const { isExclusion, matchFn } of simpleMatchers) {
    if (match !== isExclusion) {
      continue;
    }
    match = matchFn(path);
  }

  // Phase 21.C: Slow path - check complex patterns (picomatch)
  for (const { isExclusion, matcher } of complexMatchers) {
    if (match !== isExclusion) {
      continue;
    }
    match = matcher(path);
  }

  return match;
}

export function match(pattern: string) {
  return picomatch(pattern);
}

/**
 * Clear the matcher cache (useful for testing or config changes)
 */
export function clearMatcherCache(): void {
  cachedMatcher = null;
}
