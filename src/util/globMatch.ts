import { minimatch, Minimatch, MinimatchOptions } from "minimatch";

/**
 * Pre-compiled matcher cache for performance optimization
 * Reduces O(n²) overhead by reusing Minimatch instances
 */
interface MatcherCache {
  patterns: readonly string[];
  opts: MinimatchOptions;
  matchers: Array<{ pattern: string; isExclusion: boolean; matcher: Minimatch }>;
}

let cachedMatcher: MatcherCache | null = null;

function getCachedMatchers(
  patterns: readonly string[],
  opts: MinimatchOptions = {}
): MatcherCache["matchers"] {
  const optsKey = JSON.stringify(opts);
  const patternsKey = patterns.join("|");
  const cacheKey = `${patternsKey}:${optsKey}`;

  // Check if cache is valid
  if (
    cachedMatcher &&
    cachedMatcher.patterns === patterns &&
    JSON.stringify(cachedMatcher.opts) === optsKey
  ) {
    return cachedMatcher.matchers;
  }

  // Build new cache
  const matchers = patterns.map(pattern => ({
    pattern,
    isExclusion: pattern[0] === "!",
    matcher: new Minimatch(pattern, opts)
  }));

  cachedMatcher = { patterns, opts, matchers };
  return matchers;
}

export function matchAll(
  path: string,
  patterns: readonly string[],
  opts: MinimatchOptions = {}
): boolean {
  if (!patterns.length) {
    return false;
  }

  const matchers = getCachedMatchers(patterns, opts);
  let match = false;

  for (const { isExclusion, matcher } of matchers) {
    // If we've got a match, only re-test for exclusions.
    // if we don't have a match, only re-test for inclusions.
    if (match !== isExclusion) {
      continue;
    }

    match = matcher.match(path);
  }

  return match;
}

export function match(pattern: string) {
  return new Minimatch(pattern);
}

/**
 * Clear the matcher cache (useful for testing or config changes)
 */
export function clearMatcherCache(): void {
  cachedMatcher = null;
}
