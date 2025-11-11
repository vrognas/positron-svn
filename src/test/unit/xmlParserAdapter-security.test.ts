import * as assert from "assert";
import { XmlParserAdapter } from "../../parser/xmlParserAdapter";

suite("XmlParserAdapter - Security Tests", () => {
  test("rejects oversized XML (10MB limit)", () => {
    const oversized = '<?xml version="1.0"?><entry>' + 'A'.repeat(11 * 1024 * 1024) + '</entry>';

    assert.throws(() => {
      XmlParserAdapter.parse(oversized, {});
    }, /exceeds maximum size/i);
  });

  test("rejects excessive tag count (100K limit)", () => {
    let manyTags = '<?xml version="1.0"?><root>';
    for (let i = 0; i < 150000; i++) {
      manyTags += `<e${i}/>`;
    }
    manyTags += '</root>';

    assert.throws(() => {
      XmlParserAdapter.parse(manyTags, {});
    }, /exceeds maximum tag count/i);
  });

  test("rejects deeply nested XML (stack overflow protection)", () => {
    let deepXml = '<?xml version="1.0"?>';
    const depth = 150;
    for (let i = 0; i < depth; i++) {
      deepXml += '<level>';
    }
    deepXml += 'deep';
    for (let i = 0; i < depth; i++) {
      deepXml += '</level>';
    }

    assert.throws(() => {
      XmlParserAdapter.parse(deepXml, { camelcase: true });
    }, /nesting.*depth|recursion/i);
  });

  test("handles malformed XML gracefully", () => {
    const malformed = '<info><entry>unclosed';

    assert.throws(() => {
      XmlParserAdapter.parse(malformed, {});
    });
  });

  test("rejects empty XML", () => {
    assert.throws(() => {
      XmlParserAdapter.parse('', {});
    });
  });

  test("handles XXE protection (no external entities)", () => {
    const xxe = `<?xml version="1.0"?>
<!DOCTYPE foo [
  <!ENTITY xxe SYSTEM "file:///etc/passwd">
]>
<entry>&xxe;</entry>`;

    // processEntities:false should prevent expansion
    const result = XmlParserAdapter.parse(xxe, {});
    // Should not contain file contents
    assert.ok(!JSON.stringify(result).includes('/etc/passwd'));
  });

  test("rejects long tag names (ReDoS protection)", () => {
    const longTag = `<?xml version="1.0"?>
<${'a'.repeat(2000)}>test</${'a'.repeat(2000)}>`;

    assert.throws(() => {
      XmlParserAdapter.parse(longTag, { camelcase: true });
    }, /tag name too long/i);
  });

  test("handles CDATA safely", () => {
    const cdata = `<?xml version="1.0"?>
<entry><![CDATA[<script>alert('xss')</script>]]></entry>`;

    const result = XmlParserAdapter.parse(cdata, {});
    // CDATA should be preserved as text
    assert.ok(JSON.stringify(result).includes('script'));
  });

  test("rejects null bytes in content", () => {
    const nullByte = `<?xml version="1.0"?>
<entry path="file\u0000.txt">test</entry>`;

    const result = XmlParserAdapter.parse(nullByte, { mergeAttrs: true });
    // Null bytes should not appear in output
    assert.ok(!JSON.stringify(result).includes('\u0000'));
  });

  test("handles very long attribute values", () => {
    const longAttr = `<?xml version="1.0"?>
<entry path="${'x'.repeat(100000)}">test</entry>`;

    // Should parse but respect size limits
    assert.throws(() => {
      XmlParserAdapter.parse(longAttr, { mergeAttrs: true });
    }, /exceeds maximum/i);
  });
});
