import * as assert from "assert";
import { Uri } from "vscode";

/**
 * Test different SVG URI formats for gutterIconPath compatibility
 *
 * VS Code gutterIconPath accepts:
 * - Uri.file() for filesystem paths
 * - Uri.parse() for data URIs
 *
 * This test validates different data URI encoding strategies.
 */
suite("SVG URI Format Validation", () => {
  const testSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="3" height="16" viewBox="0 0 3 16"><rect width="3" height="16" fill="#ff0000"/></svg>';

  suite("Base64 Data URI (Current Implementation)", () => {
    test("Buffer.from is available in VS Code extension context", () => {
      assert.ok(Buffer, "Buffer should be available");
      assert.ok(Buffer.from, "Buffer.from should be available");
    });

    test("generates valid base64 encoding", () => {
      const base64 = Buffer.from(testSvg, "utf-8").toString("base64");

      assert.ok(base64.length > 0, "Base64 should not be empty");
      assert.ok(/^[A-Za-z0-9+/=]+$/.test(base64), "Base64 should only contain valid characters");

      // Verify roundtrip
      const decoded = Buffer.from(base64, "base64").toString("utf-8");
      assert.strictEqual(decoded, testSvg, "Decoded SVG should match original");
    });

    test("creates valid data URI with base64", () => {
      const base64 = Buffer.from(testSvg, "utf-8").toString("base64");
      const uri = Uri.parse(`data:image/svg+xml;base64,${base64}`);

      assert.strictEqual(uri.scheme, "data", "Scheme should be 'data'");
      assert.ok(uri.toString().includes("base64"), "URI should contain 'base64'");
      assert.ok(uri.toString().startsWith("data:image/svg+xml;base64,"), "URI should have correct prefix");
    });

    test("base64 does not contain problematic characters", () => {
      const base64 = Buffer.from(testSvg, "utf-8").toString("base64");

      // Base64 should not contain characters that need URL encoding
      assert.ok(!base64.includes(" "), "Base64 should not contain spaces");
      assert.ok(!base64.includes("\n"), "Base64 should not contain newlines");
      assert.ok(!base64.includes("<"), "Base64 should not contain unencoded <");
      assert.ok(!base64.includes(">"), "Base64 should not contain unencoded >");
    });
  });

  suite("Alternative: Percent-Encoded Data URI", () => {
    test("creates percent-encoded data URI", () => {
      const encoded = encodeURIComponent(testSvg);
      const uri = Uri.parse(`data:image/svg+xml;charset=utf-8,${encoded}`);

      assert.strictEqual(uri.scheme, "data", "Scheme should be 'data'");
      assert.ok(uri.toString().includes("svg"), "URI should contain 'svg'");
    });

    test("percent encoding is longer than base64", () => {
      const base64 = Buffer.from(testSvg, "utf-8").toString("base64");
      const percentEncoded = encodeURIComponent(testSvg);

      // Base64 is typically more efficient for binary/complex data
      console.log(`Base64 length: ${base64.length}, Percent-encoded length: ${percentEncoded.length}`);
      assert.ok(base64.length < percentEncoded.length, "Base64 should be more compact");
    });
  });

  suite("Color Embedding in SVG", () => {
    test("hex colors embed correctly", () => {
      const colors = ["#ff0000", "#00ff00", "#0000ff", "#123456"];

      colors.forEach(color => {
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="3" height="16"><rect fill="${color}"/></svg>`;
        const base64 = Buffer.from(svg, "utf-8").toString("base64");
        const decoded = Buffer.from(base64, "base64").toString("utf-8");

        assert.ok(decoded.includes(color), `Color ${color} should be preserved`);
      });
    });

    test("special characters in colors are encoded safely", () => {
      // Test that quotes and other special chars don't break encoding
      const svgWithQuotes = '<svg xmlns="http://www.w3.org/2000/svg"><rect fill="#f00"/></svg>';
      const base64 = Buffer.from(svgWithQuotes, "utf-8").toString("base64");
      const decoded = Buffer.from(base64, "base64").toString("utf-8");

      assert.strictEqual(decoded, svgWithQuotes, "Quotes should be preserved");
    });
  });

  suite("Uri.parse vs Uri.file", () => {
    test("Uri.parse is correct for data URIs", () => {
      const base64 = Buffer.from(testSvg, "utf-8").toString("base64");
      const uri = Uri.parse(`data:image/svg+xml;base64,${base64}`);

      assert.strictEqual(uri.scheme, "data", "Data URIs use Uri.parse");
      assert.notStrictEqual(uri.scheme, "file", "Data URIs should not use file scheme");
    });

    test("data URI does not have fsPath", () => {
      const base64 = Buffer.from(testSvg, "utf-8").toString("base64");
      const uri = Uri.parse(`data:image/svg+xml;base64,${base64}`);

      // Data URIs don't have file system paths
      assert.strictEqual(uri.fsPath, "", "Data URI should not have fsPath");
    });
  });

  suite("Performance Considerations", () => {
    test("base64 encoding is fast enough for caching", () => {
      const iterations = 1000;
      const start = Date.now();

      for (let i = 0; i < iterations; i++) {
        const base64 = Buffer.from(testSvg, "utf-8").toString("base64");
        Uri.parse(`data:image/svg+xml;base64,${base64}`);
      }

      const duration = Date.now() - start;
      const avgPerOp = duration / iterations;

      console.log(`${iterations} encodings in ${duration}ms (${avgPerOp.toFixed(3)}ms/op)`);
      assert.ok(avgPerOp < 1, "Encoding should be sub-millisecond (caching helps)");
    });

    test("caching prevents redundant encoding", () => {
      const cache = new Map<string, Uri>();
      const color = "#ff0000";

      // First call - should encode
      if (!cache.has(color)) {
        const svg = `<svg xmlns="http://www.w3.org/2000/svg"><rect fill="${color}"/></svg>`;
        const base64 = Buffer.from(svg, "utf-8").toString("base64");
        cache.set(color, Uri.parse(`data:image/svg+xml;base64,${base64}`));
      }

      // Second call - should use cache
      const uri1 = cache.get(color)!;
      const uri2 = cache.get(color)!;

      assert.strictEqual(uri1.toString(), uri2.toString(), "Cached URIs should be identical");
      assert.strictEqual(cache.size, 1, "Cache should have one entry");
    });
  });

  suite("Edge Cases", () => {
    test("handles empty color string", () => {
      const svg = '<svg xmlns="http://www.w3.org/2000/svg"><rect fill=""/></svg>';
      const base64 = Buffer.from(svg, "utf-8").toString("base64");

      assert.doesNotThrow(() => {
        Uri.parse(`data:image/svg+xml;base64,${base64}`);
      });
    });

    test("handles very long SVG", () => {
      const largeSvg = '<svg xmlns="http://www.w3.org/2000/svg">' +
        '<rect fill="#ff0000"/>'.repeat(100) +
        '</svg>';

      const base64 = Buffer.from(largeSvg, "utf-8").toString("base64");
      const uri = Uri.parse(`data:image/svg+xml;base64,${base64}`);

      assert.ok(uri.toString().length > 1000, "Large SVG should produce long URI");
    });

    test("handles unicode in SVG (unlikely for color bars)", () => {
      const svgWithUnicode = '<svg xmlns="http://www.w3.org/2000/svg"><!-- 日本語 --></svg>';
      const base64 = Buffer.from(svgWithUnicode, "utf-8").toString("base64");
      const decoded = Buffer.from(base64, "base64").toString("utf-8");

      assert.strictEqual(decoded, svgWithUnicode, "Unicode should be preserved");
    });
  });

  suite("Current Implementation Validation", () => {
    test("exact format matches blameProvider.ts implementation", () => {
      const color = "#ff0000";

      // This is the exact code from blameProvider.ts:586-588
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="3" height="16" viewBox="0 0 3 16"><rect width="3" height="16" fill="${color}"/></svg>`;
      const base64 = Buffer.from(svg, "utf-8").toString("base64");
      const uri = Uri.parse(`data:image/svg+xml;base64,${base64}`);

      // Validate format
      assert.ok(uri.toString().startsWith("data:image/svg+xml;base64,"));

      // Validate SVG content
      const decoded = Buffer.from(base64, "base64").toString("utf-8");
      assert.ok(decoded.includes('xmlns="http://www.w3.org/2000/svg"'));
      assert.ok(decoded.includes('width="3"'));
      assert.ok(decoded.includes('height="16"'));
      assert.ok(decoded.includes('viewBox="0 0 3 16"'));
      assert.ok(decoded.includes(`fill="${color}"`));
    });
  });
});
