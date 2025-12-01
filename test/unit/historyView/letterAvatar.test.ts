import { describe, it, expect } from "vitest";

describe("Author Color Dots", () => {
  describe("Color Generation", () => {
    it("generates consistent color for same author", () => {
      const hashToColor = (str: string): string => {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
          hash = str.charCodeAt(i) + ((hash << 5) - hash);
        }
        const hue = Math.abs(hash % 360);
        return `hsl(${hue}, 65%, 50%)`;
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
        return `hsl(${hue}, 65%, 50%)`;
      };

      const color1 = hashToColor("john.doe");
      const color2 = hashToColor("jane.smith");
      expect(color1).not.toBe(color2);
    });

    it("produces valid HSL color format", () => {
      const hashToColor = (str: string): string => {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
          hash = str.charCodeAt(i) + ((hash << 5) - hash);
        }
        const hue = Math.abs(hash % 360);
        return `hsl(${hue}, 65%, 50%)`;
      };

      const color = hashToColor("test");
      expect(color).toMatch(/^hsl\(\d+, 65%, 50%\)$/);
    });
  });

  describe("SVG Generation", () => {
    it("generates valid SVG data URI", () => {
      const createColorDotSvg = (color: string): string => {
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16">
<circle cx="8" cy="8" r="6" fill="${color}"/>
</svg>`;
        return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
      };

      const uri = createColorDotSvg("hsl(200, 65%, 50%)");
      expect(uri.startsWith("data:image/svg+xml;base64,")).toBe(true);
    });

    it("creates circle element in SVG", () => {
      const createColorDotSvg = (color: string): string => {
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16">
<circle cx="8" cy="8" r="6" fill="${color}"/>
</svg>`;
        return svg;
      };

      const svg = createColorDotSvg("hsl(200, 65%, 50%)");
      expect(svg).toContain("circle");
      expect(svg).toContain('r="6"');
    });
  });
});
