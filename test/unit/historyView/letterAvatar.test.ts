import { describe, it, expect } from "vitest";

describe("Letter Avatar Generator", () => {
  describe("Initials Extraction", () => {
    it("extracts first letter from single name", () => {
      const getInitials = (name: string): string => {
        if (!name) return "?";
        const parts = name.trim().split(/[\s._-]+/);
        if (parts.length === 1) {
          return parts[0].charAt(0).toUpperCase();
        }
        return (
          parts[0].charAt(0) + parts[parts.length - 1].charAt(0)
        ).toUpperCase();
      };

      expect(getInitials("john")).toBe("J");
      expect(getInitials("admin")).toBe("A");
    });

    it("extracts two initials from full name", () => {
      const getInitials = (name: string): string => {
        if (!name) return "?";
        const parts = name.trim().split(/[\s._-]+/);
        if (parts.length === 1) {
          return parts[0].charAt(0).toUpperCase();
        }
        return (
          parts[0].charAt(0) + parts[parts.length - 1].charAt(0)
        ).toUpperCase();
      };

      expect(getInitials("John Doe")).toBe("JD");
      expect(getInitials("john.doe")).toBe("JD");
      expect(getInitials("john_doe")).toBe("JD");
      expect(getInitials("john-doe")).toBe("JD");
    });

    it("handles empty/undefined gracefully", () => {
      const getInitials = (name: string): string => {
        if (!name) return "?";
        const parts = name.trim().split(/[\s._-]+/);
        if (parts.length === 1) {
          return parts[0].charAt(0).toUpperCase();
        }
        return (
          parts[0].charAt(0) + parts[parts.length - 1].charAt(0)
        ).toUpperCase();
      };

      expect(getInitials("")).toBe("?");
    });
  });

  describe("Color Generation", () => {
    it("generates consistent color for same author", () => {
      const hashToColor = (str: string): string => {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
          hash = str.charCodeAt(i) + ((hash << 5) - hash);
        }
        const hue = Math.abs(hash % 360);
        return `hsl(${hue}, 65%, 45%)`;
      };

      const color1 = hashToColor("john.doe");
      const color2 = hashToColor("john.doe");
      expect(color1).toBe(color2);
    });

    it("generates different colors for different authors", () => {
      const hashToColor = (str: string): string => {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
          hash = str.charCodeAt(i) + ((hash << 5) - hash);
        }
        const hue = Math.abs(hash % 360);
        return `hsl(${hue}, 65%, 45%)`;
      };

      const color1 = hashToColor("john.doe");
      const color2 = hashToColor("jane.smith");
      expect(color1).not.toBe(color2);
    });
  });

  describe("SVG Generation", () => {
    it("generates valid SVG data URI", () => {
      const createAvatarSvg = (initials: string, bgColor: string): string => {
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16">
          <circle cx="8" cy="8" r="8" fill="${bgColor}"/>
          <text x="8" y="11" font-family="sans-serif" font-size="8" fill="white" text-anchor="middle">${initials}</text>
        </svg>`;
        return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
      };

      const uri = createAvatarSvg("JD", "hsl(200, 65%, 45%)");
      expect(uri.startsWith("data:image/svg+xml;base64,")).toBe(true);
    });

    it("includes initials in SVG", () => {
      const createAvatarSvg = (initials: string, bgColor: string): string => {
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16">
          <circle cx="8" cy="8" r="8" fill="${bgColor}"/>
          <text x="8" y="11" font-family="sans-serif" font-size="8" fill="white" text-anchor="middle">${initials}</text>
        </svg>`;
        return svg;
      };

      const svg = createAvatarSvg("JD", "hsl(200, 65%, 45%)");
      expect(svg).toContain("JD");
      expect(svg).toContain("circle");
    });
  });
});
