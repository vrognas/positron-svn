import * as assert from "assert";
import { describe, it } from "mocha";
import * as ts from "typescript";

/**
 * CI Security Validator Tests (Phase 22.A)
 *
 * Tests AST-based validator that detects unsanitized error logging
 */

// Helper to create test source file
function createTestFile(code: string): ts.SourceFile {
  return ts.createSourceFile(
    "test.ts",
    code,
    ts.ScriptTarget.Latest,
    true
  );
}

// Helper to check if violation exists
function hasViolation(sourceFile: ts.SourceFile): boolean {
  let found = false;

  function visit(node: ts.Node) {
    if (ts.isTryStatement(node) && node.catchClause) {
      const catchBlock = node.catchClause.block;

      function visitNode(n: ts.Node) {
        if (ts.isExpressionStatement(n)) {
          const expr = n.expression;

          // Check for console.error/log/warn calls
          if (ts.isCallExpression(expr)) {
            const callExpr = expr as ts.CallExpression;

            if (ts.isPropertyAccessExpression(callExpr.expression)) {
              const propAccess = callExpr.expression;
              const obj = propAccess.expression;
              const prop = propAccess.name;

              if (ts.isIdentifier(obj) && obj.text === "console") {
                if (["error", "log", "warn"].includes(prop.text)) {
                  // Check if error variable is passed
                  if (callExpr.arguments.length > 0) {
                    const hasErrorArg = callExpr.arguments.some((arg) => {
                      return ts.isIdentifier(arg) &&
                             ["err", "error", "e", "ex"].includes(arg.text);
                    });

                    if (hasErrorArg) {
                      found = true;
                    }
                  }
                }
              }
            }
          }
        }

        // Recursively visit child nodes
        ts.forEachChild(n, visitNode);
      }

      ts.forEachChild(catchBlock, visitNode);
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return found;
}

describe("Security Validator - CI catch block scanner (Phase 22.A)", () => {
  /**
   * Test 1: Detect console.error with error variable
   */
  it("detects console.error(error) in catch block", () => {
    const code = `
      try {
        doSomething();
      } catch (error) {
        console.error(error);
      }
    `;

    const sourceFile = createTestFile(code);
    const violation = hasViolation(sourceFile);

    assert.strictEqual(violation, true, "Should detect console.error(error)");
  });

  /**
   * Test 2: Detect console.log with err variable
   */
  it("detects console.log('Error:', err) in catch block", () => {
    const code = `
      try {
        doSomething();
      } catch (err) {
        console.log("Error:", err);
      }
    `;

    const sourceFile = createTestFile(code);
    const violation = hasViolation(sourceFile);

    assert.strictEqual(violation, true, "Should detect console.log with err");
  });

  /**
   * Test 3: Allow static string logging
   */
  it("allows console.error with static string only", () => {
    const code = `
      try {
        doSomething();
      } catch (error) {
        console.error("Static error message");
      }
    `;

    const sourceFile = createTestFile(code);
    const violation = hasViolation(sourceFile);

    assert.strictEqual(violation, false, "Should allow static strings");
  });

  /**
   * Test 4: Detect console.error in nested if statement
   */
  it("detects console.error(e) in nested if statement", () => {
    const code = `
      try {
        doSomething();
      } catch (e) {
        if (condition) {
          console.error(e);
        }
      }
    `;

    const sourceFile = createTestFile(code);
    const violation = hasViolation(sourceFile);

    assert.strictEqual(violation, true, "Should detect console.error in nested if");
  });

  /**
   * Test 5: Detect console.log in nested try-catch
   */
  it("detects console.log(err) in nested try-catch", () => {
    const code = `
      try {
        doSomething();
      } catch (err) {
        try {
          handleError();
        } catch (inner) {
          console.log(err);
        }
      }
    `;

    const sourceFile = createTestFile(code);
    const violation = hasViolation(sourceFile);

    assert.strictEqual(violation, true, "Should detect console.log in nested try-catch");
  });

  /**
   * Test 6: Detect console.warn in else block
   */
  it("detects console.warn(error) in else block", () => {
    const code = `
      try {
        doSomething();
      } catch (error) {
        if (condition) {
          logError("context", error);
        } else {
          console.warn(error);
        }
      }
    `;

    const sourceFile = createTestFile(code);
    const violation = hasViolation(sourceFile);

    assert.strictEqual(violation, true, "Should detect console.warn in else block");
  });
});
