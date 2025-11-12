# IMPLEMENTATION PLAN

**Version**: v2.17.127
**Updated**: 2025-11-12
**Status**: Phase 20-21 complete ✅. Phase 22 immediate priority. Phase 23 HIGH RISK (API experimental).

---

## Phase 22: Security Hardening + CI Validator 🔴 IMMEDIATE

**Target**: v2.17.126-128
**Effort**: 6-10h (CI validator added)
**Impact**: 100% users protected, automated enforcement

### Tasks

**A. CI Security Validator** (2-3h) [FIRST - Prevents regression]
- AST-based catch block scanner
- Detects console.error/log(error) violations
- CI fails if unsanitized error handling found
- Files: `scripts/validate-error-logging.ts` (150L)
- Tests: `test/scripts/validate-error-logging.test.ts` (80L)
- Integration: `.github/workflows/main.yml` security-check job
- Performance: ~2s overhead

**B. Migrate remaining catch blocks** (3-4h)
- Files: svnRepository.ts (2), svn.ts (1), extension.ts (2), source_control_manager.ts (4), commands/command.ts (3), parsers (5), others (5)
- Pattern: `console.error(...)` → `logError("context", err)`
- Coverage: 22/47 → 100% sanitized
- Tests: +3 per file (verify credential patterns)

**C. Audit stderr paths** (1-2h)
- Review all `svn.exec()` stderr handling
- Apply ErrorSanitizer to error paths
- Files: svnRepository.ts, commands/*.ts
- Tests: +3 (stderr credential scenarios)

**D. Documentation** (0.5-1h)
- SECURITY.md with sanitization patterns
- Developer guide for error handling

**Order**: A → B → C → D (CI enforces B/C immediately)

| Task | Effort | Priority |
|------|--------|----------|
| CI validator (NEW) | 2-3h | P0 |
| Migrate catch blocks | 3-4h | P0 |
| Audit stderr | 1-2h | P0 |
| Documentation | 0.5-1h | P2 |

---

## Phase 23: Positron Integration ⚡ HIGH RISK

**Target**: v2.17.129-134
**Effort**: 8-12h core (9.5-15h with bonuses)
**Impact**: Strategic differentiation for data science users
**Status**: ⚠️ DEFER until API stability confirmed

### ⚠️ BLOCKERS IDENTIFIED

**Positron API Status: EXPERIMENTAL**
- @posit-dev/positron v0.1.x marked NOT production-ready
- Warning: "API definitions may change without notice, break compatibility, or be removed"
- **Risk**: 35% chance API methods don't exist, 50% chance breaking changes
- **Version mismatch**: Extension declares ^2025.6.x, APIs require 2025.07.0+

**Recommendation**: **PROTOTYPE-FIRST (2-3h spike)** before 12h commitment
1. Install @posit-dev/positron
2. Verify API methods exist
3. Test against Positron 2025.07.0+
4. Decision: proceed or defer until v1.0

### Core Tasks (if proceeding)

**A. Runtime Integration** (3-4h) [P0]
- Direct Positron API import (no tryAcquirePositronApi wrapper)
- Register metadata provider: branch, revision, remote, status
- Update on: branch switch, commit, update
- Files: `src/positron/runtimeMetadata.ts` (150L)
- Tests: +3 mocked TDD (hybrid strategy)

**B. Connections Pane** (2-3h) [P1]
- Register SVN remotes as connections
- Quick actions: Update, Switch, Show Changes
- Files: `src/positron/connectionsProvider.ts` (120L)
- Tests: +3 TDD

**C. Data Science File Icons** (1-2h) [P2]
- Custom icons: R, Python, Jupyter, RMarkdown
- SVN status overlay
- Files: Extend `src/decorators.ts` (+40L)
- Tests: +3 TDD

**D. Languages Context** (2-3h) [P3]
- R packages: Track DESCRIPTION version
- Python: venv/conda integration
- Files: `src/positron/languagesContext.ts` (100L)
- Tests: +3 TDD

### Bonus Features (Positron-Only)

**E. Console Integration** (1-2h)
- SVN commands from R/Python console
- Files: `src/positron/consoleIntegration.ts` (80L)
- Tests: +2 TDD

**F. Data Viewer Hooks** (0.5-1h)
- Track data file provenance
- Files: Extend `src/historyView/itemLogProvider.ts` (+30L)
- Tests: +2 TDD

### E2E Strategy: Hybrid

- **Mock-first**: Unit tests with Positron API mocks (TDD pattern)
- **Manual validation**: Test in real Positron after implementation
- **Effort**: 1-2h mock setup during Phase 23
- **Risk**: 20-40% rework if mocks diverge from real APIs

| Task | Effort | Impact | Priority |
|------|--------|--------|----------|
| A. Runtime metadata | 3-4h | Core differentiation | P0 |
| B. Connections | 2-3h | UX improvement | P1 |
| C. DS file icons | 1-2h | Visual polish | P2 |
| D. Languages context | 2-3h | R/Python workflows | P3 |
| **Core total** | **8-12h** | | |
| E. Console (bonus) | 1-2h | Power users | BONUS |
| F. Data viewer (bonus) | 0.5-1h | Provenance | BONUS |

---

## Summary

**Phase 22**: 6-10h, CRITICAL (security + CI enforcement)
**Phase 23**: 8-15h, HIGH RISK (API experimental, defer recommended)
**Total**: 14-25h if both executed

---

## Strategic Decisions

### Phase 22 Approach

**CI-First Strategy**:
1. Build validator FIRST (prevents regression during conversions)
2. Validator runs in parallel with eslint (~2s)
3. AST-based (zero false positives)
4. Blocks merge if violations found

### Phase 23 Approach

**DEFER Until**:
- @posit-dev/positron reaches v0.5.0+ or removes "experimental" warning
- Changelog/deprecation policy established
- Version compatibility confirmed (^2025.6.x vs 2025.07.0+)

**Alternative: Prototype-First**:
- 2-3h spike to validate API exists
- Test real Positron 2025.07.0+
- Abort if incompatible (saves 10-12h)

**If Proceeding**:
- Feature flag: `positron.integration.enabled` (default: false)
- Error handling: Try-catch all API calls
- Start with A (runtime metadata) - smallest surface, highest visibility

---

## Unresolved Questions

### Phase 22
- Block merge or warning-only for CI validator?
- Scan test files or skip?
- Whitelist format: inline comments or config file?

### Phase 23
- **Does `registerRuntimeMetadataProvider()` exist?** (no docs found)
- **When will APIs stabilize?** (experimental warning persists)
- **Positron test runner exists?** (vs @vscode/test-electron)
- **Should we remove VS Code engine declaration?** (Positron-only)
- **Add Positron-specific SVN features?** (not in VS Code upstream)
