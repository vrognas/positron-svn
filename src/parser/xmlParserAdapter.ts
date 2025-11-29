// Copyright (c) 2017-2020 Christopher Johnston
// Copyright (c) 2025-present Viktor Rognas
// Licensed under MIT License

import { XMLParser } from "fast-xml-parser";
import { camelcase } from "../util";

/**
 * Represents a primitive value in parsed XML
 */
type XmlPrimitive = string | number | boolean | null;

/**
 * Represents any value that can appear in parsed XML.
 * Can be a primitive, object with string keys, or array.
 */
type XmlValue = XmlPrimitive | XmlObject | XmlArray;

/**
 * Represents an object in parsed XML with string keys
 */
interface XmlObject {
  [key: string]: XmlValue;
}

/**
 * Represents an array in parsed XML
 */
type XmlArray = XmlValue[];

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
   * Sanitize XML string by removing invalid characters
   * Valid XML chars: #x9 | #xA | #xD | [#x20-#xD7FF] | [#xE000-#xFFFD]
   */
  private static sanitizeXml(xml: string): string {
    // Remove control characters except tab, CR, LF
    return xml.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "");
  }

  /**
   * Create fast-xml-parser instance with configuration
   */
  private static createFxpParser(): XMLParser {
    return new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_",
      textNodeName: "_",
      ignoreDeclaration: true,
      trimValues: true,
      parseAttributeValue: false,
      parseTagValue: true,
      processEntities: false, // XXE protection
      allowBooleanAttributes: true,
      cdataPropName: "__cdata", // Handle CDATA sections
      htmlEntities: true, // Decode HTML entities
      removeNSPrefix: true, // Remove namespace prefixes
      numberParseOptions: {
        hex: false,
        leadingZeros: false,
        skipLike: /./ // Don't parse any numbers, keep as strings
      },
      stopNodes: [], // Parse all nodes
      unpairedTags: [], // No unpaired tags expected
      alwaysCreateTextNode: false,
      commentPropName: false, // Ignore comments
      isArray: () => false, // Single elements not wrapped in arrays
      tagValueProcessor: (_tagName: string, tagValue: string) => tagValue,
      attributeValueProcessor: (_attrName: string, attrValue: string) =>
        attrValue,
      // Disable strict XML validation to match xml2js permissiveness
      ignorePiTags: true, // Ignore PI tags
      preserveOrder: false // Don't preserve order
    });
  }

  /**
   * Recursively transform object keys to camelCase
   */
  private static toCamelCase(obj: XmlValue, depth: number = 0): XmlValue {
    if (depth > this.MAX_DEPTH) {
      throw new Error(
        `Object nesting exceeds maximum depth of ${this.MAX_DEPTH}`
      );
    }

    if (typeof obj !== "object" || obj === null) {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.toCamelCase(item, depth + 1));
    }

    const result: XmlObject = {};
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
  private static mergeAttributes(obj: XmlValue, depth: number = 0): XmlValue {
    if (depth > this.MAX_DEPTH) {
      throw new Error(
        `Object nesting exceeds maximum depth of ${this.MAX_DEPTH}`
      );
    }

    if (typeof obj !== "object" || obj === null) {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.mergeAttributes(item, depth + 1));
    }

    const result: XmlObject = {};
    let hasTextNode = false;
    let textNodeValue: XmlValue = null;

    // First pass: merge attributes and identify text nodes
    for (const key in obj) {
      if (key.startsWith("@_")) {
        // Merge attribute into parent (strip @_ prefix)
        const attrName = key.substring(2);
        result[attrName] = obj[key];
      } else if (key === "_") {
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

    // If text node exists with other properties, keep it as _
    if (hasTextNode) {
      result["_"] = textNodeValue;
    }

    return result;
  }

  /**
   * Normalize arrays based on explicitArray: false behavior
   * Single-element arrays become objects, unless already array
   */
  private static normalizeArrays(obj: XmlValue, depth: number = 0): XmlValue {
    if (depth > this.MAX_DEPTH) {
      throw new Error(
        `Object nesting exceeds maximum depth of ${this.MAX_DEPTH}`
      );
    }

    if (typeof obj !== "object" || obj === null) {
      return obj;
    }

    if (Array.isArray(obj)) {
      // Keep arrays as-is, but normalize their contents
      return obj.map(item => this.normalizeArrays(item, depth + 1));
    }

    const result: XmlObject = {};
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
  private static stripRootElement(obj: XmlValue): XmlValue {
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
      throw new Error("XML input is empty");
    }

    // Sanitize XML to remove invalid characters
    const sanitizedXml = this.sanitizeXml(xml);

    const parser = this.createFxpParser();
    let result = parser.parse(sanitizedXml);

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
