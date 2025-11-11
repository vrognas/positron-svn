import { XMLParser } from "fast-xml-parser";
import { camelcase } from "../util";

interface ParseOptions {
  mergeAttrs?: boolean;
  explicitArray?: boolean;
  explicitRoot?: boolean;
  camelcase?: boolean;
}

/**
 * XML Parser Adapter providing xml2js-compatible parsing using fast-xml-parser
 *
 * Implements key xml2js behaviors:
 * - mergeAttrs: Merge XML attributes into parent object
 * - explicitArray: Control single vs array element wrapping
 * - explicitRoot: Include/exclude root element (false strips root)
 * - camelcase: Transform tag and attribute names to camelCase
 *
 * Security limits:
 * - Max XML size: 10MB (DoS protection)
 * - Max tag count: 100,000 (entity expansion protection)
 * - Max recursion depth: 100 levels (stack overflow protection)
 */
export class XmlParserAdapter {
  // Security limits
  private static readonly MAX_XML_SIZE = 10 * 1024 * 1024; // 10MB
  private static readonly MAX_TAG_COUNT = 100000;
  private static readonly MAX_DEPTH = 100;
  /**
   * Create fast-xml-parser instance with configuration
   */
  private static createFxpParser(): XMLParser {
    return new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_",
      textNodeName: "#text",
      ignoreDeclaration: true,
      trimValues: true,
      parseAttributeValue: false,
      parseTagValue: true,
      processEntities: false, // XXE protection
      allowBooleanAttributes: true
    });
  }

  /**
   * Recursively transform object keys to camelCase
   */
  private static toCamelCase(obj: any, depth: number = 0): any {
    if (depth > this.MAX_DEPTH) {
      throw new Error(`Object nesting exceeds maximum depth of ${this.MAX_DEPTH}`);
    }

    if (typeof obj !== "object" || obj === null) {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.toCamelCase(item, depth + 1));
    }

    const result: any = {};
    for (const key in obj) {
      const camelKey = camelcase(key);
      result[camelKey] = this.toCamelCase(obj[key], depth + 1);
    }
    return result;
  }

  /**
   * Merge attributes (prefixed with @_) into parent object
   * Mimics xml2js mergeAttrs: true behavior
   */
  private static mergeAttributes(obj: any, depth: number = 0): any {
    if (depth > this.MAX_DEPTH) {
      throw new Error(`Object nesting exceeds maximum depth of ${this.MAX_DEPTH}`);
    }

    if (typeof obj !== "object" || obj === null) {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.mergeAttributes(item, depth + 1));
    }

    const result: any = {};
    let hasTextNode = false;
    let textNodeValue: any = null;

    // First pass: merge attributes and identify text nodes
    for (const key in obj) {
      if (key.startsWith("@_")) {
        // Merge attribute into parent (strip @_ prefix)
        const attrName = key.substring(2);
        result[attrName] = obj[key];
      } else if (key === "#text") {
        hasTextNode = true;
        textNodeValue = obj[key];
      } else {
        result[key] = this.mergeAttributes(obj[key], depth + 1);
      }
    }

    // If only text node exists, return text value directly
    if (hasTextNode && Object.keys(result).length === 0) {
      return textNodeValue;
    }

    // If text node exists with other properties, keep it as #text
    if (hasTextNode) {
      result["#text"] = textNodeValue;
    }

    return result;
  }

  /**
   * Normalize arrays based on explicitArray: false behavior
   * Single-element arrays become objects, unless already array
   */
  private static normalizeArrays(obj: any, depth: number = 0): any {
    if (depth > this.MAX_DEPTH) {
      throw new Error(`Object nesting exceeds maximum depth of ${this.MAX_DEPTH}`);
    }

    if (typeof obj !== "object" || obj === null) {
      return obj;
    }

    if (Array.isArray(obj)) {
      // Keep arrays as-is, but normalize their contents
      return obj.map(item => this.normalizeArrays(item, depth + 1));
    }

    const result: any = {};
    for (const key in obj) {
      const value = obj[key];

      // Recursively process the value first
      const processed = this.normalizeArrays(value, depth + 1);

      // If it's an array with single element, unwrap it
      if (Array.isArray(processed) && processed.length === 1) {
        result[key] = processed[0];
      } else {
        result[key] = processed;
      }
    }
    return result;
  }

  /**
   * Strip root element if explicitRoot: false
   * Mimics xml2js explicitRoot: false behavior
   */
  private static stripRootElement(obj: any): any {
    if (typeof obj !== "object" || obj === null || Array.isArray(obj)) {
      return obj;
    }

    const keys = Object.keys(obj);
    // If single root element, return its value
    if (keys.length === 1) {
      return obj[keys[0]];
    }

    return obj;
  }

  /**
   * Parse XML string with xml2js-compatible output
   *
   * @param xml XML string to parse
   * @param options Parsing options
   * @returns Parsed object matching xml2js structure
   * @throws Error if XML exceeds security limits
   */
  public static parse(xml: string, options: ParseOptions = {}): any {
    // Security: Validate input size
    if (xml.length > this.MAX_XML_SIZE) {
      throw new Error(`XML exceeds maximum size of ${this.MAX_XML_SIZE} bytes`);
    }

    // Security: Validate tag count (rough estimate)
    const tagCount = (xml.match(/<[^>]+>/g) || []).length;
    if (tagCount > this.MAX_TAG_COUNT) {
      throw new Error(`XML exceeds maximum tag count of ${this.MAX_TAG_COUNT}`);
    }

    // Security: Reject empty input
    if (!xml || xml.trim().length === 0) {
      throw new Error('XML input is empty');
    }

    const parser = this.createFxpParser();
    let result = parser.parse(xml);

    // Apply transformations in order
    if (options.mergeAttrs) {
      result = this.mergeAttributes(result);
    }

    // Strip root element if explicitRoot: false (default behavior)
    if (options.explicitRoot === false) {
      result = this.stripRootElement(result);
    }

    if (options.camelcase) {
      result = this.toCamelCase(result);
    }

    if (options.explicitArray === false) {
      result = this.normalizeArrays(result);
    }

    return result;
  }
}
