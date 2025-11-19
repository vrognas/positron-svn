"use strict";

/**
 * Template compilation optimization
 * Parses template once, returns fast interpolation function
 * Eliminates 4-8 regex operations per line (500-1000 lines = 2000-8000 ops)
 */

export type TemplateData = Record<string, string | undefined>;
export type CompiledTemplateFn = (data: TemplateData) => string;

interface TemplateSegment {
  type: "literal" | "variable";
  value: string;
}

// Global cache: template string → compiled function
const templateCache = new Map<string, CompiledTemplateFn>();

/**
 * Parse template into segments (literal strings + variable placeholders)
 * Example: "r${revision} by ${author}" →
 *   [
 *     { type: 'literal', value: 'r' },
 *     { type: 'variable', value: 'revision' },
 *     { type: 'literal', value: ' by ' },
 *     { type: 'variable', value: 'author' }
 *   ]
 */
function parseTemplate(template: string): TemplateSegment[] {
  const segments: TemplateSegment[] = [];
  let pos = 0;

  while (pos < template.length) {
    // Find next variable placeholder
    const start = template.indexOf("${", pos);

    if (start === -1) {
      // No more variables, rest is literal
      if (pos < template.length) {
        segments.push({
          type: "literal",
          value: template.substring(pos)
        });
      }
      break;
    }

    // Add literal before variable
    if (start > pos) {
      segments.push({
        type: "literal",
        value: template.substring(pos, start)
      });
    }

    // Find variable end
    const end = template.indexOf("}", start + 2);
    if (end === -1) {
      // Malformed template, treat rest as literal
      segments.push({
        type: "literal",
        value: template.substring(pos)
      });
      break;
    }

    // Extract variable name
    const varName = template.substring(start + 2, end);
    segments.push({
      type: "variable",
      value: varName
    });

    pos = end + 1;
  }

  return segments;
}

/**
 * Compile template into fast interpolation function
 * Uses direct string concatenation (no regex)
 */
export function compileTemplate(template: string): CompiledTemplateFn {
  // Check cache first
  if (templateCache.has(template)) {
    return templateCache.get(template)!;
  }

  // Parse template into segments
  const segments = parseTemplate(template);

  // Generate optimized interpolation function
  const compiledFn: CompiledTemplateFn = (data: TemplateData) => {
    let result = "";

    for (const segment of segments) {
      if (segment.type === "literal") {
        result += segment.value;
      } else {
        // Variable - use data or empty string
        result += data[segment.value] || "";
      }
    }

    return result;
  };

  // Cache compiled function
  templateCache.set(template, compiledFn);

  return compiledFn;
}

/**
 * Clear template cache (call on config change)
 */
export function clearTemplateCache(): void {
  templateCache.clear();
}
