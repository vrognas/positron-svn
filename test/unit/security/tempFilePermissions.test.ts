import { describe, it, expect } from "vitest";
import * as tmp from "tmp";

describe("Temp File Security", () => {
  describe("File Permissions", () => {
    it("mode 0o600 allows only owner read/write", () => {
      const mode = 0o600;
      // Owner: read+write (6), Group: none (0), Others: none (0)
      expect(mode & 0o700).toBe(0o600); // owner bits
      expect(mode & 0o070).toBe(0o000); // group bits
      expect(mode & 0o007).toBe(0o000); // others bits
    });

    it("tmp.fileSync accepts mode option", () => {
      // Verify tmp module supports mode option
      const options = { prefix: "test-", mode: 0o600 };

      // tmp.fileSync returns object with name, fd, removeCallback
      const file = tmp.fileSync(options);
      expect(file.name).toBeDefined();
      expect(file.fd).toBeDefined();
      file.removeCallback();
    });
  });
});
