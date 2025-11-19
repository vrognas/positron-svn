import * as assert from "assert";
import * as sinon from "sinon";
import { BlameProvider } from "../../../blame/blameProvider";
import { Repository } from "../../../repository";

suite("BlameProvider - Color Hashing", () => {
  let provider: BlameProvider;
  let mockRepository: sinon.SinonStubbedInstance<Repository>;
  let sandbox: sinon.SinonSandbox;

  setup(() => {
    sandbox = sinon.createSandbox();
    mockRepository = sandbox.createStubInstance(Repository);
    provider = new BlameProvider(mockRepository as any);
  });

  teardown(() => {
    provider.dispose();
    sandbox.restore();
  });

  test("generates consistent color for same author", () => {
    // Given: Same author queried twice
    const author = "john.doe";

    // When: Get color twice
    const color1 = (provider as any).getAuthorColor(author);
    const color2 = (provider as any).getAuthorColor(author);

    // Then: Colors match exactly
    assert.strictEqual(color1, color2);

    // Verify: Cache hit on second call
    assert.strictEqual((provider as any).authorColors.size, 1);
  });

  test("generates different colors for different authors", () => {
    // Given: Three different authors
    const authors = ["john.doe", "jane.smith", "bob.jones"];

    // When: Get colors for all
    const colors = authors.map(a => (provider as any).getAuthorColor(a));

    // Then: All colors unique
    const uniqueColors = new Set(colors);
    assert.strictEqual(uniqueColors.size, 3);

    // Verify: No color collisions
    assert.notStrictEqual(colors[0], colors[1]);
    assert.notStrictEqual(colors[1], colors[2]);
    assert.notStrictEqual(colors[0], colors[2]);
  });

  test("generates readable HSL colors within bounds", () => {
    // Given: 10 random authors
    const authors = Array.from({ length: 10 }, (_, i) => `author${i}`);

    // When: Generate colors
    const colors = authors.map(a => (provider as any).getAuthorColor(a));

    // Then: All match HSL format
    colors.forEach(color => {
      assert.ok(color.startsWith("hsl("), `Expected HSL format, got: ${color}`);

      // Extract HSL values
      const match = color.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
      assert.ok(match, `Failed to parse: ${color}`);

      const [, h, s, l] = match!.map(Number);

      // Validate ranges
      assert.ok(h >= 0 && h < 360, `Hue out of bounds: ${h}`);
      assert.ok(s >= 60 && s <= 80, `Saturation out of bounds: ${s}`);
      assert.ok(l >= 50 && l <= 60, `Lightness out of bounds: ${l}`);
    });
  });

  test("uses cache to avoid redundant hash calculations", () => {
    // Given: Spy on hashToColor private method
    const hashSpy = sandbox.spy(provider as any, "hashToColor");

    // When: Request same author 5 times
    const author = "repeat.author";
    for (let i = 0; i < 5; i++) {
      (provider as any).getAuthorColor(author);
    }

    // Then: Hash only computed once
    assert.strictEqual(hashSpy.callCount, 1);
    assert.strictEqual((provider as any).authorColors.size, 1);
  });

  test("handles empty and special character authors", () => {
    // Given: Edge case author names
    const authors = ["", "a", "特殊字符", "author@domain.com", "author-name"];

    // When: Generate colors
    const colors = authors.map(a => (provider as any).getAuthorColor(a));

    // Then: All valid HSL colors
    colors.forEach((color, i) => {
      assert.ok(color.startsWith("hsl("), `Failed for: ${authors[i]}`);
    });

    // No crashes or invalid outputs
    assert.strictEqual(colors.length, 5);
  });
});
