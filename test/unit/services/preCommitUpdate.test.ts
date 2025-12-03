import { describe, it, expect, vi, beforeEach } from "vitest";
import { PreCommitUpdateService } from "../../../src/services/preCommitUpdateService";

// Mock vscode
vi.mock("vscode", () => ({
  window: {
    withProgress: vi.fn(),
    showWarningMessage: vi.fn()
  },
  ProgressLocation: { Notification: 15 },
  CancellationTokenSource: vi.fn().mockImplementation(() => ({
    token: { isCancellationRequested: false },
    cancel: vi.fn(),
    dispose: vi.fn()
  }))
}));

describe("PreCommitUpdateService", () => {
  let service: PreCommitUpdateService;
  let mockRepository: Record<string, unknown>;
  let mockWindow: Record<string, ReturnType<typeof vi.fn>>;

  beforeEach(async () => {
    const vscode = await import("vscode");
    mockWindow = vscode.window;

    mockRepository = {
      root: "/test/repo",
      hasRemoteChanges: vi.fn().mockResolvedValue(true),
      updateRevision: vi.fn()
    };

    service = new PreCommitUpdateService();

    vi.resetAllMocks();

    // Default: withProgress executes task immediately
    mockWindow.withProgress.mockImplementation(
      async (
        _opts: unknown,
        task: (p: unknown, t: unknown) => Promise<unknown>
      ) => {
        return task({ report: vi.fn() }, { isCancellationRequested: false });
      }
    );
  });

  describe("runUpdate", () => {
    it("returns success when update succeeds", async () => {
      mockRepository.hasRemoteChanges.mockResolvedValueOnce(true);
      mockRepository.updateRevision.mockResolvedValueOnce({
        revision: 100,
        conflicts: [],
        message: "Updated to revision 100"
      });

      const result = await service.runUpdate(mockRepository);

      expect(result.success).toBe(true);
      expect(result.revision).toBe(100);
    });

    it("returns conflict info when conflicts detected", async () => {
      mockRepository.hasRemoteChanges.mockResolvedValueOnce(true);
      mockRepository.updateRevision.mockResolvedValueOnce({
        revision: 50,
        conflicts: ["/test/repo/file.txt"],
        message: "Updated with conflicts"
      });

      const result = await service.runUpdate(mockRepository);

      expect(result.success).toBe(false);
      expect(result.hasConflicts).toBe(true);
    });

    it("shows progress notification during update", async () => {
      mockRepository.hasRemoteChanges.mockResolvedValueOnce(true);
      mockRepository.updateRevision.mockResolvedValueOnce({
        revision: 100,
        conflicts: [],
        message: "Updated to revision 100"
      });

      await service.runUpdate(mockRepository);

      expect(mockWindow.withProgress).toHaveBeenCalledWith(
        expect.objectContaining({
          title: expect.stringContaining("Checking"),
          location: expect.anything()
        }),
        expect.any(Function)
      );
    });

    it("skips update when no remote changes", async () => {
      mockRepository.hasRemoteChanges.mockResolvedValueOnce(false);

      const result = await service.runUpdate(mockRepository);

      expect(result.success).toBe(true);
      expect(result.skipped).toBe(true);
      expect(mockRepository.updateRevision).not.toHaveBeenCalled();
    });

    it("returns cancelled when user cancels", async () => {
      mockWindow.withProgress.mockImplementation(
        async (
          _opts: unknown,
          task: (p: unknown, t: unknown) => Promise<unknown>
        ) => {
          return task({ report: vi.fn() }, { isCancellationRequested: true });
        }
      );

      const result = await service.runUpdate(mockRepository);

      expect(result.cancelled).toBe(true);
    });
  });

  describe("promptConflictResolution", () => {
    it("returns abort when user chooses Abort", async () => {
      mockWindow.showWarningMessage.mockResolvedValueOnce("Abort");

      const result = await service.promptConflictResolution();

      expect(result).toBe("abort");
    });

    it("returns continue when user chooses Commit Anyway", async () => {
      mockWindow.showWarningMessage.mockResolvedValueOnce("Commit Anyway");

      const result = await service.promptConflictResolution();

      expect(result).toBe("continue");
    });

    it("returns abort when user dismisses dialog", async () => {
      mockWindow.showWarningMessage.mockResolvedValueOnce(undefined);

      const result = await service.promptConflictResolution();

      expect(result).toBe("abort");
    });

    it("shows appropriate warning message", async () => {
      mockWindow.showWarningMessage.mockResolvedValueOnce("Abort");

      await service.promptConflictResolution();

      expect(mockWindow.showWarningMessage).toHaveBeenCalledWith(
        expect.stringContaining("conflict"),
        expect.objectContaining({ modal: true }),
        "Abort",
        "Commit Anyway"
      );
    });
  });

  describe("parseUpdateOutput", () => {
    it("extracts revision from success message", () => {
      const result = service.parseUpdateOutput("Updated to revision 42.");
      expect(result.revision).toBe(42);
    });

    it("extracts revision from At revision message", () => {
      const result = service.parseUpdateOutput("At revision 123.");
      expect(result.revision).toBe(123);
    });

    it("detects conflict markers in output", () => {
      const output = `
        Updating '.':
        C    src/file.txt
        Updated to revision 50.
        Summary of conflicts:
          Text conflicts: 1
      `;
      const result = service.parseUpdateOutput(output);
      expect(result.hasConflicts).toBe(true);
    });
  });
});
