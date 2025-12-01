// Copyright (c) 2025-present Viktor Rognas
// Licensed under MIT License

import { Uri } from "vscode";

// Cache for generated color dot URIs
const colorCache: Map<string, Uri> = new Map();
const colorAccessOrder: Map<string, number> = new Map();
const MAX_COLOR_CACHE_SIZE = 100;

function evictOldestColor(): void {
  let oldestKey: string | null = null;
  let oldestTime = Infinity;
  for (const [key, time] of colorAccessOrder.entries()) {
    if (time < oldestTime) {
      oldestTime = time;
      oldestKey = key;
    }
  }
  if (oldestKey !== null) {
    colorCache.delete(oldestKey);
    colorAccessOrder.delete(oldestKey);
  }
}

/**
 * Generate deterministic HSL color from string
 * Same input always produces same color
 */
export function hashToColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash % 360);
  return `hsl(${hue}, 65%, 50%)`;
}

/**
 * Create simple colored circle SVG
 */
function createColorDotSvg(color: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16">
<circle cx="8" cy="8" r="6" fill="${color}"/>
</svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

/**
 * Generate a colored dot URI for the given author
 * - Deterministic: same author always gets same color
 * - No network requests
 * - Cached for performance
 */
export function getAuthorColorDot(author: string): Uri {
  const cached = colorCache.get(author);
  if (cached) {
    colorAccessOrder.set(author, Date.now());
    return cached;
  }

  const color = hashToColor(author);
  const dataUri = createColorDotSvg(color);
  const uri = Uri.parse(dataUri);

  if (colorCache.size >= MAX_COLOR_CACHE_SIZE) {
    evictOldestColor();
  }

  colorCache.set(author, uri);
  colorAccessOrder.set(author, Date.now());

  return uri;
}

/**
 * Clear the color cache (for testing or config changes)
 */
export function clearColorCache(): void {
  colorCache.clear();
  colorAccessOrder.clear();
}
