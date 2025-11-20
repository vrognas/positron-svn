# Test Suite Issues - Detailed Code Examples

## ISSUE 1: Brittle Manual Mock Management

### Current Pattern (PROBLEMATIC)
```typescript
// src/test/unit/commands/checkout.test.ts (lines 14-55)
let origValidateUrl: typeof validation.validateRepositoryUrl;
let origGetBranchName: typeof branchHelper.getBranchName;
let origShowInputBox: typeof window.showInputBox;
let origShowOpenDialog: typeof window.showOpenDialog;
let origShowErrorMessage: typeof window.showErrorMessage;
let origShowInfoMessage: typeof window.showInformationMessage;

setup(() => {
  (validation as any).validateRepositoryUrl = (url: string) => {
    validateUrlCalls.push({ url });
    return validateUrlResult;
  };
  (branchHelper as any).getBranchName = (url: string) => {
    getBranchNameCalls.push({ url });
    return getBranchNameResult;
  };
  (window as any).showInputBox = async (options?: any) => {
    inputBoxCalls.push({ options });
    return inputBoxResult;
  };
  // ... more mocks
});

teardown(() => {
  (validation as any).validateRepositoryUrl = origValidateUrl;
  (branchHelper as any).getBranchName = origGetBranchName;
  (window as any).showInputBox = origShowInputBox;
  (window as any).showOpenDialog = origShowOpenDialog;
  (window as any).showErrorMessage = origShowErrorMessage;
  (window as any).showInfoMessage = origShowInfoMessage;
});
```

**Issues**:
- 6 globals to manually restore (error-prone)
- `as any` casts mask type errors
- Manual call tracking arrays
- No call verification (just counts)
- 40+ lines of boilerplate

### Recommended Pattern (SINON)
```typescript
import * as sinon from "sinon";

suite("Checkout Commands Tests", () => {
  let validateUrlStub: sinon.SinonStub;
  let getBranchNameStub: sinon.SinonStub;
  let showInputBoxStub: sinon.SinonStub;

  setup(() => {
    validateUrlStub = sinon.stub(validation, 'validateRepositoryUrl')
      .resolves(true);
    getBranchNameStub = sinon.stub(branchHelper, 'getBranchName')
      .resolves("trunk");
    showInputBoxStub = sinon.stub(window, 'showInputBox')
      .resolves("/home/checkout");
  });

  teardown(() => {
    sinon.restore(); // All stubs restored automatically
  });

  test("validates URL on checkout", async () => {
    await checkout.execute();

    // Better assertions
    assert(validateUrlStub.calledOnce);
    assert(validateUrlStub.calledWith("https://repo.url"));
  });
});
```

**Benefits**:
- Automatic restoration (`sinon.restore()`)
- Type-safe stubs
- Built-in call verification
- 20 lines less code
- Call argument verification built-in

---

## ISSUE 2: Weak Assertions - Tests That Always Pass

### Current Pattern (PROBLEMATIC)
```typescript
// src/test/unit/commands/addRemove.test.ts (line 39)
test("add single unversioned file", async () => {
  const fileUri = Uri.file("/workspace/newfile.txt");
  const resource = new Resource(fileUri, Status.UNVERSIONED);

  (addCmd as any).getResourceStates = async () => [resource];

  await addCmd.execute(resource);

  assert.ok(true, "Should handle Resource instance");  // ALWAYS PASSES!
});
```

**Issues**:
- `assert.ok(true)` always passes
- Doesn't verify actual behavior
- No validation that file was added
- No status change verification

### Recommended Pattern
```typescript
test("add single unversioned file", async () => {
  const fileUri = Uri.file("/workspace/newfile.txt");
  const resource = new Resource(fileUri, Status.UNVERSIONED);

  // Mock addFiles to track calls
  const addFilesStub = sinon.stub(mockRepository, 'addFiles')
    .resolves({ exitCode: 0, stdout: "", stderr: "" });

  // Mock getResourceStates
  sinon.stub(addCmd as any, 'getResourceStates')
    .resolves([resource]);

  // Execute
  await addCmd.execute(resource);

  // Verify actual behavior
  assert.strictEqual(addFilesStub.callCount, 1);
  assert.deepStrictEqual(addFilesStub.firstCall.args[0], [fileUri.fsPath]);
  assert.strictEqual(showErrorCalls.length, 0);
});
```

**Improvements**:
- Verifies correct method called
- Verifies correct parameters
- Verifies no errors shown
- Actual behavior validated

---

## ISSUE 3: Missing Error Scenario Tests

### Current State (MISSING)
```typescript
// Parsers tested with valid XML only

// src/test/unit/parsers/statusParser.test.ts
test("parses basic modified file", async () => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<status>
  <target path=".">
    <entry path="file.txt">
      <wc-status props="none" item="modified">
        <commit revision="123">
          <author>user</author>
        </commit>
      </wc-status>
    </entry>
  </target>
</status>`;

  const result = await parseStatusXml(xml);
  assert.strictEqual(result.length, 1);
  // Only tests happy path!
});
```

### Recommended Addition (ERROR SUITES)
```typescript
suite("StatusParser Error Handling", () => {
  test("handles malformed XML gracefully", async () => {
    const malformedXml = `<?xml version="1.0"?>
<status>
  <target path=".">
    <entry path="file.txt">
      <!-- Missing closing tags! -->
    </entry>
</status>`;

    assert.throws(() => {
      parseStatusXml(malformedXml);
    }, /XML parsing error/);
  });

  test("handles missing required fields", async () => {
    const incompleteXml = `<?xml version="1.0"?>
<status>
  <target path=".">
    <entry path="file.txt">
      <!-- Missing wc-status element -->
    </entry>
  </target>
</status>`;

    assert.throws(() => {
      parseStatusXml(incompleteXml);
    }, /missing required field/i);
  });

  test("handles null/undefined input", async () => {
    assert.throws(() => {
      parseStatusXml(null as any);
    }, /invalid input/i);

    assert.throws(() => {
      parseStatusXml(undefined as any);
    }, /invalid input/i);
  });

  test("handles special characters in paths", async () => {
    const xml = `<?xml version="1.0"?>
<status>
  <target path=".">
    <entry path="file&quot;with&quot;quotes.txt">
      <wc-status props="none" item="modified"/>
    </entry>
  </target>
</status>`;

    const result = await parseStatusXml(xml);
    assert.strictEqual(result[0].path, 'file"with"quotes.txt');
  });

  test("handles encoding issues", async () => {
    // UTF-8 with BOM or encoding declaration mismatch
    const xmlWithBOM = '\uFEFF<?xml version="1.0" encoding="UTF-8"?><status/>';
    const result = await parseStatusXml(xmlWithBOM);
    assert.ok(Array.isArray(result));
  });
});
```

---

## ISSUE 4: No Tests for Concurrent Operations

### Current State (MISSING)
```typescript
// Only sequential operation test exists
// /test/unit/error-handling.test.ts (lines 84-99)
test("sequential operations prevent race condition", async () => {
  let counter = 0;
  const results: number[] = [];

  const queue = Promise.resolve();

  await queue
    .then(() => operation(1))
    .then(() => operation(2))
    .then(() => operation(3));

  // Doesn't test actual concurrent operations!
});
```

### Recommended Addition
```typescript
suite("Concurrency Tests", () => {
  test("parallel status checks don't interfere", async () => {
    const repo = new Repository("/workspace");
    const statusStub = sinon.stub(repo, 'getStatus');

    let callCount = 0;
    statusStub.callsFake(async () => {
      callCount++;
      await new Promise(r => setTimeout(r, 100));
      return [];
    });

    // Start 3 concurrent status checks
    const [r1, r2, r3] = await Promise.all([
      repo.getStatus(),
      repo.getStatus(),
      repo.getStatus()
    ]);

    assert.strictEqual(statusStub.callCount, 3);
    assert.deepStrictEqual([r1, r2, r3], [[], [], []]);
  });

  test("file add blocks concurrent blame request", async () => {
    const repo = new Repository("/workspace");
    const addStub = sinon.stub(repo, 'addFiles');
    const blameStub = sinon.stub(repo, 'blame');

    let addStarted = false;
    let blameExecutedDuringAdd = false;

    addStub.callsFake(async () => {
      addStarted = true;
      await new Promise(r => setTimeout(r, 200));
    });

    blameStub.callsFake(async () => {
      if (addStarted) {
        blameExecutedDuringAdd = true;
      }
      return [];
    });

    // Start both operations
    const [addResult, blameResult] = await Promise.all([
      repo.addFiles(['file.txt']),
      repo.blame('file.txt')
    ]);

    // Verify sequential execution (add completes first)
    assert.strictEqual(addStub.calledBefore(blameStub), true);
  });

  test("cancel in-flight blame request", async () => {
    const repo = new Repository("/workspace");
    const blameStub = sinon.stub(repo, 'blame');

    let executionCount = 0;
    blameStub.callsFake(async (file, { signal } = {}) => {
      executionCount++;
      if (signal?.aborted) {
        throw new Error("Blame cancelled");
      }
      return [];
    });

    const controller = new AbortController();
    const promise = repo.blame('file.txt', { signal: controller.signal });

    setTimeout(() => controller.abort(), 50);

    assert.rejects(promise, /Blame cancelled/);
    assert.strictEqual(executionCount, 1);
  });
});
```

---

## ISSUE 5: Missing Command Tests (27 Commands Untested)

### Commands Without Tests
- merge
- switch  
- resolve (conflict resolution)
- cleanup
- patch
- ignore variants
- openCommands variants
- search commands

### Example: Missing Merge Test
```typescript
// src/test/unit/commands/merge.test.ts (MISSING - should be created)
import * as assert from "assert";
import * as sinon from "sinon";
import { Merge } from "../../../commands/merge";
import { Repository } from "../../../repository";

suite("Merge Command Tests", () => {
  let mergeCmd: Merge;
  let mockRepository: Partial<Repository>;

  setup(() => {
    mergeCmd = new Merge();
    mockRepository = {
      merge: sinon.stub().resolves({ exitCode: 0, stdout: "", stderr: "" })
    };
  });

  teardown(() => {
    sinon.restore();
    mergeCmd.dispose();
  });

  test("merge branch to working copy", async () => {
    const mergeStub = mockRepository.merge as sinon.SinonStub;

    // Mock the required methods
    sinon.stub(mergeCmd as any, 'getBranchInfo').resolves({
      url: "https://repo/branches/feature",
      revision: "HEAD"
    });

    await mergeCmd.execute();

    assert(mergeStub.calledOnce);
    assert(mergeStub.calledWith(
      sinon.match.string,
      sinon.match.string,
      sinon.match.object
    ));
  });

  test("merge with conflicts prompts resolution", async () => {
    const mergeStub = mockRepository.merge as sinon.SinonStub;
    mergeStub.rejects(new Error("Conflict in file.txt"));

    const showErrorStub = sinon.stub(window, 'showErrorMessage');

    assert.rejects(
      mergeCmd.execute(),
      /Conflict in file.txt/
    );
  });

  test("merge with --dry-run shows preview", async () => {
    const dryRunStub = sinon.stub(mergeCmd as any, 'showMergePreview');

    const mergeStub = mockRepository.merge as sinon.SinonStub;
    mergeStub.resolves({
      exitCode: 0,
      stdout: "M  file1.txt\nM  file2.txt",
      stderr: ""
    });

    await mergeCmd.execute({ preview: true });

    assert(dryRunStub.calledOnce);
  });
});
```

---

## ISSUE 6: Incomplete Mock Verification

### Current Pattern
```typescript
// src/test/unit/commands/commit.test.ts (lines 21-25)
let inputCommitMessageCalls: any[] = [];
let inputCommitFilesCalls: any[] = [];
let showInfoCalls: any[] = [];
let showErrorCalls: any[] = [];
let commitFilesCalls: any[] = [];

// setup() and tests create calls...
// but NOT ALL are verified!
```

### Recommended Complete Verification
```typescript
test("commit displays success message", async () => {
  const commitStub = sinon.stub(mockRepository, 'commitFiles')
    .resolves("Revision 42: commit successful");
  const infoStub = sinon.stub(window, 'showInformationMessage');

  await commit.execute(resource);

  // Verify ALL mocks
  assert(commitStub.calledOnce);
  assert(commitStub.calledWith("Fix bug", ["/test/repo/file.txt"]));

  assert(infoStub.calledOnce);
  assert(infoStub.calledWith(
    sinon.match(/Revision 42/)
  ));

  // Verify no errors shown
  assert.strictEqual(showErrorCalls.length, 0);
});

test("commit shows error on failure", async () => {
  const commitStub = sinon.stub(mockRepository, 'commitFiles')
    .rejects(new Error("Not authorized"));
  const errorStub = sinon.stub(window, 'showErrorMessage');

  await commit.execute(resource);

  assert(commitStub.calledOnce);
  assert(errorStub.calledOnce);
  assert(errorStub.calledWith(
    sinon.match(/Not authorized/)
  ));

  // Verify no success message shown
  assert(infoStub.notCalled);
});
```

