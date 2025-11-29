import { describe, it, expect } from "vitest";
import * as ts from "typescript";

/**
 * CI Security Validator Tests (Phase 22.A)
 *
 * Tests AST-based validator that detects unsanitized error logging
 */

// Helper to create test source file
function createTestFile(code: string): ts.SourceFile {
  return ts.createSourceFile("test.ts", code, ts.ScriptTarget.Latest, true);
}

// Helper to check if violation exists
function hasViolation(sourceFile: ts.SourceFile): boolean {
  let found = false;

  function visit(node: ts.Node) {
    if (ts.isTryStatement(node) && node.catchClause) {
      const catchBlock = node.catchClause.block;

      ts.forEachChild(catchBlock, stmt => {
        if (ts.isExpressionStatement(stmt)) {
          const expr = stmt.expression;

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
                    const hasErrorArg = callExpr.arguments.some(arg => {
                      return (
                        ts.isIdentifier(arg) &&
                        ["err", "error", "e", "ex"].includes(arg.text)
                      );
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
      });
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

    expect(violation).toBe(true);
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

    expect(violation).toBe(true);
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

    expect(violation).toBe(false);
  });
});
