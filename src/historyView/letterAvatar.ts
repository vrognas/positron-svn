// Copyright (c) 2025-present Viktor Rognas
// Licensed under MIT License

import { Uri } from "vscode";

// Cache for generated avatar URIs
const avatarCache: Map<string, Uri> = new Map();
const avatarAccessOrder: Map<string, number> = new Map();
const MAX_AVATAR_CACHE_SIZE = 100;

function evictOldestAvatar(): void {
  let oldestKey: string | null = null;
  let oldestTime = Infinity;
  for (const [key, time] of avatarAccessOrder.entries()) {
    if (time < oldestTime) {
      oldestTime = time;
      oldestKey = key;
    }
  }
  if (oldestKey !== null) {
    avatarCache.delete(oldestKey);
    avatarAccessOrder.delete(oldestKey);
  }
}

/**
 * Extract initials from author name
 * - Single name: first letter ("john" → "J")
 * - Full name: first + last initial ("John Doe" → "JD")
 * - Handles separators: space, dot, underscore, hyphen
 */
export function getInitials(name: string): string {
  if (!name || !name.trim()) return "?";

  const parts = name.trim().split(/[\s._-]+/);
  if (parts.length === 1) {
    return parts[0].charAt(0).toUpperCase();
  }
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
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
  // Use hue for variety, fixed saturation/lightness for readability
  const hue = Math.abs(hash % 360);
  return `hsl(${hue}, 65%, 45%)`;
}

/**
 * Create SVG avatar with initials on colored circle background
 */
function createAvatarSvg(initials: string, bgColor: string): string {
  // Font size: 8px for 1-2 chars works well at 16x16
  const fontSize = initials.length > 1 ? 7 : 8;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16">
<circle cx="8" cy="8" r="8" fill="${bgColor}"/>
<text x="8" y="11.5" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="${fontSize}" font-weight="500" fill="white" text-anchor="middle">${initials}</text>
</svg>`;

  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

/**
 * Generate a local letter avatar URI for the given author
 * - Deterministic: same author always gets same avatar
 * - No network requests
 * - Cached for performance
 */
export function getLetterAvatar(author: string): Uri {
  // Check cache first
  const cached = avatarCache.get(author);
  if (cached) {
    avatarAccessOrder.set(author, Date.now());
    return cached;
  }

  // Generate avatar
  const initials = getInitials(author);
  const bgColor = hashToColor(author);
  const dataUri = createAvatarSvg(initials, bgColor);
  const uri = Uri.parse(dataUri);

  // Evict LRU if at max size
  if (avatarCache.size >= MAX_AVATAR_CACHE_SIZE) {
    evictOldestAvatar();
  }

  // Cache and return
  avatarCache.set(author, uri);
  avatarAccessOrder.set(author, Date.now());

  return uri;
}

/**
 * Clear the avatar cache (for testing or config changes)
 */
export function clearAvatarCache(): void {
  avatarCache.clear();
  avatarAccessOrder.clear();
}
