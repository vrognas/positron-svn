#!/usr/bin/env ts-node
/**
 * CI Security Validator (Phase 22.A)
 *
 * AST-based scanner that detects unsanitized error logging in catch blocks
 * Prevents credential leaks by enforcing logError() usage
 */

import * as ts from "typescript";
import * as fs from "fs";
import * as path from "path";

interface Violation {
  file: string;
  line: number;
  column: number;
  code: string;
  suggestion: string;
}

const violations: Violation[] = [];

/**
 * Check if catch block contains unsanitized console calls
 */
function checkCatchBlock(
  node: ts.CatchClause,
  sourceFile: ts.SourceFile,
  fileName: string
): void {
  const catchBlock = node.block;

  function visitCatchStatement(stmt: ts.Statement) {
    if (ts.isExpressionStatement(stmt)) {
      const expr = stmt.expression;

      if (ts.isCallExpression(expr)) {
        const callExpr = expr as ts.CallExpression;

        // Check for console.error/log/warn calls
        if (ts.isPropertyAccessExpression(callExpr.expression)) {
          const propAccess = callExpr.expression;
          const obj = propAccess.expression;
          const prop = propAccess.name;

          if (ts.isIdentifier(obj) && obj.text === "console") {
            const methodName = prop.text;

            if (["error", "log", "warn"].includes(methodName)) {
              // Check if error variable is passed as argument
              const hasErrorArg = callExpr.arguments.some((arg) => {
                if (ts.isIdentifier(arg)) {
                  const name = arg.text;
                  return ["err", "error", "e", "ex", "exception"].includes(name);
                }
                return false;
              });

              if (hasErrorArg) {
                // Check for @security-allow comment
                const commentRanges = ts.getLeadingCommentRanges(
                  sourceFile.text,
                  stmt.pos
                );

                const hasAllowComment = commentRanges?.some((range) => {
                  const comment = sourceFile.text.substring(range.pos, range.end);
                  return comment.includes("@security-allow");
                });

                if (!hasAllowComment) {
                  const { line, character } = sourceFile.getLineAndCharacterOfPosition(stmt.pos);
                  const codeSnippet = sourceFile.text.substring(
                    stmt.pos,
                    Math.min(stmt.end, stmt.pos + 80)
                  ).trim();

                  violations.push({
                    file: fileName,
                    line: line + 1,
                    column: character + 1,
                    code: codeSnippet,
                    suggestion: `Use: logError("context", ${callExpr.arguments[0]?.getText(sourceFile) || "error"})`
                  });
                }
              }
            }
          }
        }
      }
    }
  }

  catchBlock.statements.forEach(visitCatchStatement);
}

/**
 * Visit all nodes in AST to find catch blocks
 */
function visit(node: ts.Node, sourceFile: ts.SourceFile, fileName: string): void {
  if (ts.isTryStatement(node) && node.catchClause) {
    checkCatchBlock(node.catchClause, sourceFile, fileName);
  }

  ts.forEachChild(node, (child) => visit(child, sourceFile, fileName));
}

/**
 * Scan a single file for violations
 */
function scanFile(filePath: string): void {
  const sourceCode = fs.readFileSync(filePath, "utf-8");
  const sourceFile = ts.createSourceFile(
    filePath,
    sourceCode,
    ts.ScriptTarget.Latest,
    true
  );

  visit(sourceFile, sourceFile, filePath);
}

/**
 * Recursively find all .ts files in directory
 */
function findTypeScriptFiles(dir: string, files: string[] = []): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      // Skip node_modules and out directories
      if (!["node_modules", "out", ".git"].includes(entry.name)) {
        findTypeScriptFiles(fullPath, files);
      }
    } else if (entry.isFile() && entry.name.endsWith(".ts")) {
      files.push(fullPath);
    }
  }

  return files;
}

/**
 * Main execution
 */
function main(): void {
  // When compiled, __dirname is out/scripts, so we need ../../src
  // When run from source, __dirname is scripts, so we need ../src
  const isCompiled = __dirname.includes("out");
  const srcDir = isCompiled
    ? path.join(__dirname, "..", "..", "src")
    : path.join(__dirname, "..", "src");
  const files = findTypeScriptFiles(srcDir);

  console.log(`🔍 Scanning ${files.length} TypeScript files for unsanitized error logging...\n`);

  files.forEach(scanFile);

  if (violations.length === 0) {
    console.log("✅ No violations found. All error logging is properly sanitized.\n");
    process.exit(0);
  } else {
    console.error(`❌ Found ${violations.length} unsanitized error logging violation(s):\n`);

    violations.forEach((v, i) => {
      console.error(`${i + 1}. ${v.file}:${v.line}:${v.column}`);
      console.error(`   ${v.code}`);
      console.error(`   ${v.suggestion}\n`);
    });

    console.error("Fix violations or add @security-allow comment if intentional.\n");
    process.exit(1);
  }
}

main();
