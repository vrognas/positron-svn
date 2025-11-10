# Performance Baselines

**Date**: 2025-11-10 (Updated)
**Version**: 2.18.1 (Phase 2.1 fixes)
**Purpose**: Track key performance metrics for SVN extension to ensure optimal user experience and identify regressions.

## Metrics

### 1. Extension Activation Time
- **Baseline**: TBD ms (measure via console.time)
- **Target**: <2000ms
- **Location**: `src/extension.ts:161` - `activate()` function
- **Measurement Method**: 
  - Start: Beginning of `activate()`
  - End: After `_activate()` completes
  - Instrumentation: `console.time('Extension Activation')`
- **Notes**: Includes SVN executable detection, manager initialization, and provider registration
- **Typical Range**: 500-1500ms for normal conditions

### 2. updateModelState() Execution Time
- **Baseline**: TBD ms (measure via console.time)
- **Expected**: 50-500ms (varies with repo size and file count)
- **Location**: `src/repository.ts:442` - `updateModelState()` method
- **Measurement Method**:
  - Start: Method entry
  - End: Before return statement
  - Instrumentation: `console.time('updateModelState')`
- **Variables Affecting Performance**:
  - Number of files in working copy
  - Network latency (if checkRemoteChanges=true)
  - SVN server response time
  - File system speed
- **Performance Profile**:
  - Small repos (<100 files): 50-150ms
  - Medium repos (100-1000 files): 150-300ms
  - Large repos (>1000 files): 300-500ms
  - With remote check: +200-2000ms (see metric #4)

### 3. Memory Usage Baseline
- **Baseline**: TBD MB heap
- **Expected**: 30-50MB heap for single repository
- **Measurement Method**: 
  - Use VS Code Developer Tools: Help > Toggle Developer Tools > Memory tab
  - Or: `process.memoryUsage().heapUsed / 1024 / 1024` in code
- **Key Measurement Points**:
  - After extension activation
  - After opening first repository
  - During updateModelState() execution
  - After loading large file history
- **Memory Growth Indicators**:
  - Gradual growth: Normal (cached data)
  - Sudden spikes: Investigate large operations
  - No release after operations: Potential leak
- **Target per Repository**:
  - Initial: ~10-15MB
  - Steady state: 30-50MB
  - Peak (during operations): 60-80MB
  - Multiple repos: Add ~20-30MB per repo

### 4. Remote Status Check Timing
- **Baseline**: TBD ms (measure via console.time)
- **Expected**: 200-2000ms (network dependent)
- **Location**: `src/repository.ts:443` - `updateModelState(checkRemoteChanges=true)`
- **Measurement Method**:
  - Start: When `checkRemoteChanges=true`
  - End: After `getStatus()` returns with remote data
  - Instrumentation: `console.time('Remote Status Check')`
- **Performance Factors**:
  - Network latency to SVN server
  - Server load and response time
  - Number of files to check
  - Repository size
- **Typical Ranges**:
  - Local network: 200-500ms
  - VPN connection: 500-1000ms
  - Remote/slow network: 1000-2000ms
  - Timeout: >2000ms (may need investigation)

## Instrumentation Points

### Optional Console Timing (for development/debugging)

**Extension Activation** (`src/extension.ts`):
```typescript
export async function activate(context: ExtensionContext) {
  console.time('Extension Activation');
  // ... existing code ...
  console.timeEnd('Extension Activation');
}
```

**updateModelState** (`src/repository.ts`):
```typescript
public async updateModelState(checkRemoteChanges: boolean = false) {
  console.time('updateModelState');
  // ... existing code ...
  console.timeEnd('updateModelState');
}
```

**Remote Check** (`src/repository.ts`):
```typescript
if (checkRemoteChanges) {
  console.time('Remote Status Check');
  // ... getStatus call ...
  console.timeEnd('Remote Status Check');
}
```

**Memory Snapshot** (add anywhere):
```typescript
const memUsage = process.memoryUsage();
console.log(`Memory: ${(memUsage.heapUsed / 1024 / 1024).toFixed(2)}MB heap, ${(memUsage.rss / 1024 / 1024).toFixed(2)}MB RSS`);
```

## Performance Testing Protocol

### Initial Baseline Measurement
1. Install extension in clean VS Code instance
2. Open test repository (small: ~50 files, medium: ~500 files, large: ~2000 files)
3. Enable Developer Tools console
4. Add instrumentation to key methods
5. Perform operations and record timings
6. Document results in this file

### Regression Testing
1. Before major changes, record current metrics
2. After changes, re-run same test scenarios
3. Compare results: flag >20% degradation
4. Investigate and optimize if needed
5. Update baselines if intentional change

### Test Scenarios
1. **Cold Start**: VS Code restart, extension activation
2. **Warm Start**: Extension already loaded, open new repo
3. **Status Update**: Modify 10 files, run updateModelState
4. **Remote Check**: Enable remote changes, measure check time
5. **Large Operation**: Commit 50+ files, measure end-to-end
6. **Memory Stress**: Open 5+ repos, monitor memory over 1 hour

## Performance Optimization Guidelines

### When to Optimize
- Extension activation >2500ms
- updateModelState >800ms for medium repos
- Memory usage >100MB for single repo
- Remote checks >3000ms regularly
- User-reported sluggishness

### Common Bottlenecks
1. **SVN Command Execution**: Subprocess overhead, parsing
2. **File System Operations**: Reading large status outputs
3. **Resource Group Updates**: VS Code UI refresh overhead
4. **Remote Checks**: Network latency, server timeouts
5. **Memory Leaks**: Unreleased event listeners, cached data

### Optimization Techniques
- Debounce/throttle frequent operations
- Lazy load heavy resources
- Cache parsed results where appropriate
- Use streaming parsers for large outputs
- Batch UI updates
- Profile with VS Code DevTools before optimizing

## Related Files
- `/home/user/positron-svn/src/extension.ts` - Activation logic
- `/home/user/positron-svn/src/repository.ts` - Core repository operations
- `/home/user/positron-svn/src/svnRepository.ts` - SVN command execution
- `/home/user/positron-svn/src/source_control_manager.ts` - Multi-repo management

## Measurement History

### 2025-11-10 - Phase 2.1 Fixes Applied

**Changes affecting performance:**
- ✅ **Fixed double decorator chain** - Removed duplicate @throttle/@globalSequentialize from StatusService
  - Impact: Eliminates redundant throttling overhead
  - Expected improvement: ~5-10% faster status updates
- ✅ **Refactored IStatusContext** - Reduced from 11 properties to 3 focused interfaces
  - Impact: Less object copying, cleaner call path
  - Expected improvement: Minor (< 2%), better maintainability
- ✅ **Service delegation** - StatusService now uses ResourceGroupManager directly
  - Impact: Reduced indirection
  - Expected improvement: Negligible

**Action Required:** Run actual measurements and document results

### Initial Baseline (PENDING - needs measurement)
- Extension Activation: TBD ms (target: <2000ms)
- updateModelState (small repo ~50 files): TBD ms (expected: 50-150ms)
- updateModelState (medium repo ~500 files): TBD ms (expected: 150-300ms)
- updateModelState (large repo ~2000 files): TBD ms (expected: 300-500ms)
- Memory Usage (single repo): TBD MB (expected: 30-50MB)
- Remote Status Check: TBD ms (expected: 200-2000ms, network dependent)

**Measurement Protocol:**
1. Install v2.18.1 in clean VS Code instance
2. Open test repositories (small/medium/large)
3. Add console.time() instrumentation per guidelines above
4. Perform 10 operations, record average
5. Update this document with actual values
6. Use as regression baseline for future changes

## Performance SLAs

### User-Facing Targets
- Extension ready: <2s from VS Code start
- Status update: <500ms for typical repos
- Command response: <100ms (excluding SVN operation time)
- UI responsiveness: No blocking >1s
- Memory footprint: <100MB per repo instance

### Monitoring
- Track via console timing during development
- Use VS Code Developer Tools for profiling
- Monitor user feedback for perceived slowness
- Automated tests for regression detection

## Next Steps
1. Add console.time instrumentation to key methods
2. Test with small/medium/large repositories
3. Record actual baseline measurements
4. Replace TBD values with real data
5. Set up regression test suite
6. Document performance improvements in CHANGELOG
