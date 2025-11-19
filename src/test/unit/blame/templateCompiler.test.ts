import * as assert from "assert";
import { compileTemplate, clearTemplateCache } from "../../../blame/templateCompiler";

suite("Template Compiler", () => {
  teardown(() => {
    clearTemplateCache();
  });

  test("compiles simple template with variables", () => {
    const compile = compileTemplate("r${revision} by ${author}");
    const result = compile({ revision: "123", author: "John" });

    assert.strictEqual(result, "r123 by John");
  });

  test("compiles template without variables", () => {
    const compile = compileTemplate("No variables here");
    const result = compile({});

    assert.strictEqual(result, "No variables here");
  });

  test("caches compiled templates and reuses them", () => {
    const compile1 = compileTemplate("${author} - ${revision}");
    const compile2 = compileTemplate("${author} - ${revision}");

    // Same function reference = cached
    assert.strictEqual(compile1, compile2);

    const result = compile1({ author: "Jane", revision: "456" });
    assert.strictEqual(result, "Jane - 456");
  });
});
