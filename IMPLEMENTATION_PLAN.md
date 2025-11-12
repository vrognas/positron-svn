# IMPLEMENTATION PLAN

**Version**: v2.17.125
**Updated**: 2025-11-12
**Status**: Phase 20-21 complete ✅. Phase 22-23 planned.

---

## Phase 22: Security Hardening (Complete Phase 20) 🔴

**Target**: v2.17.125-127
**Effort**: 4-7h
**Impact**: 100% users protected from credential disclosure

### Current State
- Phase 20 foundation: `util/errorLogger.ts` created ✅
- Coverage: 9/47 catch blocks sanitized (19%)
- Remaining: 22 identifiable blocks need migration

### Tasks

**A. Migrate remaining catch blocks** (2-3h)
- Files: svnRepository.ts (2), svn.ts (1), extension.ts (2), source_control_manager.ts (4), commands/command.ts (3), parsers (5), others (5)
- Pattern: `console.error(...)` → `logError("context", err)`
- Coverage: 22/47 → 100% sanitized
- Tests: +3 per file (verify credential patterns sanitized)

**B. Audit stderr output paths** (1-2h)
- Review all `svn.exec()` calls for stderr handling
- Ensure ErrorSanitizer applied to all error paths
- Files: svnRepository.ts, commands/*.ts
- Tests: +3 (stderr credential exposure scenarios)

**C. Security regression suite** (1-2h)
- Centralized test covering all 47 catch blocks
- Automated credential pattern detection
- CI/CD integration (fail on unsanitized errors)

**D. Documentation** (0.5-1h)
- Update SECURITY.md with sanitization patterns
- Developer guide for error handling

| Task | Effort | Impact | Priority |
|------|--------|--------|----------|
| Migrate catch blocks | 2-3h | 100% users | P0 |
| Audit stderr paths | 1-2h | 100% users | P0 |
| Regression suite | 1-2h | CI/CD protection | P1 |
| Documentation | 0.5-1h | Developer velocity | P2 |

---

## Phase 23: Positron Integration ⚡

**Target**: v2.17.128-132
**Effort**: 12-18h
**Impact**: Data science users get differentiated value from fork

### Current State (Positron Alignment: 25%)
- Engine declaration: ✅ package.json
- API usage: ❌ None (no runtime/connections/languages)
- Detection pattern: ❌ No tryAcquirePositronApi()
- Dual environment: ❌ VS Code only

### Tasks

**A. Runtime service integration** (4-6h)
- Expose SVN repo info to Positron runtime pane
- Show active branch, revision, remote status
- API: `positron.runtime.registerRuntimeMetadataProvider()`
- Files: New `src/positron/runtimeIntegration.ts`
- Tests: +3 (metadata updates on branch switch/commit)

**B. Connections pane integration** (3-5h)
- Register SVN remotes in Connections pane
- Quick actions: Update, Switch Branch, Show Remote Changes
- API: `positron.connections.registerConnectionProvider()`
- Files: New `src/positron/connectionsIntegration.ts`
- Tests: +3 (connection lifecycle, actions)

**C. Languages API integration** (3-5h)
- Provide SVN context to language-specific workflows
- R packages: Track pkg version from SVN metadata
- Python: Integrate with venv/conda environments
- API: `positron.languages.registerContextProvider()`
- Files: New `src/positron/languagesIntegration.ts`
- Tests: +3 (R/Python context scenarios)

**D. Positron UI enhancements** (2-3h)
- Data science-specific file icons (R, Python, Jupyter)
- Enhanced diff view for notebooks (.ipynb)
- Quick pick improvements for data workflows
- Files: Extend existing UI components
- Tests: +3 (UI rendering, notebook diff)

| Task | Effort | Impact | Priority |
|------|--------|--------|----------|
| Runtime integration | 4-6h | Core differentiation | P0 |
| Connections pane | 3-5h | UX improvement | P1 |
| Languages API | 3-5h | R/Python workflows | P1 |
| UI enhancements | 2-3h | Polish | P2 |

---

## Summary

**Phase 22**: 4-7h, CRITICAL (security hardening)
**Phase 23**: 12-18h, HIGH (strategic differentiation)
**Total**: 16-25h for complete security + Positron integration

---

## Strategic Rationale

### Why Phase 22 (Security) First
1. **User impact**: 100% users vulnerable to credential leaks
2. **Compliance**: Production blocker for enterprise environments
3. **Foundation complete**: logError() utility exists, pattern proven
4. **Low effort**: 4-7h to close 22 identifiable gaps
5. **Debt paydown**: Finishing Phase 20 enables clean slate

### Why Phase 23 (Positron Integration) Second
1. **Strategic differentiation**: Fork currently indistinguishable from upstream
2. **Mission alignment**: "Positron-optimized fork with enhanced features" unrealized
3. **User value**: Data science workflows (R/Python/Jupyter) are primary use case
4. **Concrete APIs**: Positron provides runtime/connections/languages APIs ready to use
5. **Market positioning**: Justifies fork maintenance vs contributing upstream

---

## Unresolved Questions

- Positron APIs stability? (beta vs stable for runtime/connections/languages)
- Security audit tooling? (automated credential pattern detection in CI)
- Backward compat? (VS Code users if Positron APIs added)
- E2E test infra needed before Phase 23?
