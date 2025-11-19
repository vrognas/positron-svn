"use strict";

import {
  Disposable,
  Range,
  TextEditor,
  TextEditorDecorationType,
  ThemeColor,
  Uri,
  window,
  workspace
} from "vscode";
import { debounce, throttle } from "../decorators";
import { ISvnBlameLine } from "../common/types";
import { Repository } from "../repository";
import { blameConfiguration } from "./blameConfiguration";
import { blameStateManager } from "./blameStateManager";

/**
 * BlameProvider manages gutter decorations for SVN blame
 * Per-repository instance (like StatusService)
 */
export class BlameProvider implements Disposable {
  private decorationTypes: {
    gutter: TextEditorDecorationType;
    icon: TextEditorDecorationType;
    inline: TextEditorDecorationType;
  };
  private blameCache = new Map<string, { data: ISvnBlameLine[]; version: number }>();
  private revisionColors = new Map<string, string>();  // revision → gradient color
  private svgCache = new Map<string, Uri>();  // color → SVG data URI
  private messageCache = new Map<string, string>();  // revision → commit message
  private disposables: Disposable[] = [];
  private isActivated = false;

  constructor(private repository: Repository) {
    this.decorationTypes = this.createDecorationTypes();
  }

  /**
   * Create all three decoration types
   */
  private createDecorationTypes(): {
    gutter: TextEditorDecorationType;
    icon: TextEditorDecorationType;
    inline: TextEditorDecorationType;
  } {
    return {
      gutter: window.createTextEditorDecorationType({
        before: {
          color: new ThemeColor("editorCodeLens.foreground"),
          margin: "0 1.5em 0 0",
          fontStyle: "italic",
          fontWeight: "normal"
        },
        isWholeLine: false
      }),
      icon: window.createTextEditorDecorationType({
        gutterIconPath: undefined,  // Set per decoration
        gutterIconSize: "auto",
        isWholeLine: false
      }),
      inline: window.createTextEditorDecorationType({
        after: {
          color: new ThemeColor("editorCodeLens.foreground"),
          margin: "0 0 0 3em",
          fontStyle: "italic",
          fontWeight: "normal"
        },
        isWholeLine: false
      })
    };
  }

  /**
   * Activate provider - register event handlers
   */
  public activate(): void {
    if (this.isActivated) {
      return;
    }

    this.disposables.push(
      // Editor changes
      window.onDidChangeActiveTextEditor(e => this.onActiveEditorChange(e)),

      // Document changes
      workspace.onDidChangeTextDocument(e => this.onDocumentChange(e)),
      workspace.onDidSaveTextDocument(d => this.onDocumentSave(d)),
      workspace.onDidCloseTextDocument(d => this.onDocumentClose(d)),

      // Visible range changes (for performance)
      window.onDidChangeTextEditorVisibleRanges(e => this.onVisibleRangeChange(e)),

      // State changes
      blameStateManager.onDidChangeState(uri => this.onBlameStateChange(uri)),
      blameConfiguration.onDidChange(e => this.onConfigurationChange(e))
    );

    this.isActivated = true;

    // Apply to current active editor
    if (window.activeTextEditor) {
      this.onActiveEditorChange(window.activeTextEditor);
    }
  }

  /**
   * Update decorations for editor (throttled to prevent spam)
   */
  @throttle
  public async updateDecorations(editor?: TextEditor): Promise<void> {
    const target = editor || window.activeTextEditor;
    if (!target) {
      return;
    }

    // Check if should decorate
    if (!this.shouldDecorate(target)) {
      this.clearDecorations(target);
      return;
    }

    // Large file check
    if (target.document.lineCount > 5000 && blameConfiguration.shouldWarnLargeFile()) {
      window.showWarningMessage(
        `File too large for blame (${target.document.lineCount} lines). Consider disabling blame.`
      );
      return;
    }

    try {
      // Fetch blame data (with cache)
      const blameData = await this.getBlameData(target.document.uri);
      if (!blameData) {
        this.clearDecorations(target);
        return;
      }

      // Create all 3 decoration arrays
      const decorations = await this.createAllDecorations(blameData, target);

      // Apply decorations based on config
      target.setDecorations(
        this.decorationTypes.gutter,
        blameConfiguration.isGutterTextEnabled() ? decorations.gutter : []
      );

      target.setDecorations(
        this.decorationTypes.icon,
        blameConfiguration.isGutterIconEnabled() ? decorations.icon : []
      );

      target.setDecorations(
        this.decorationTypes.inline,
        blameConfiguration.isInlineEnabled() ? decorations.inline : []
      );
    } catch (err) {
      console.error("BlameProvider: Failed to update decorations", err);
      this.clearDecorations(target);
    }
  }

  /**
   * Clear decorations for editor
   */
  public clearDecorations(editor?: TextEditor): void {
    const target = editor || window.activeTextEditor;
    if (target) {
      target.setDecorations(this.decorationTypes.gutter, []);
      target.setDecorations(this.decorationTypes.icon, []);
      target.setDecorations(this.decorationTypes.inline, []);
    }
  }

  /**
   * Clear cache for URI
   */
  public clearCache(uri: Uri): void {
    this.blameCache.delete(uri.toString());
  }

  /**
   * Dispose provider - cleanup resources
   */
  public dispose(): void {
    this.decorationTypes.gutter.dispose();
    this.decorationTypes.icon.dispose();
    this.decorationTypes.inline.dispose();
    this.blameCache.clear();
    this.revisionColors.clear();
    this.svgCache.clear();
    this.messageCache.clear();
    this.disposables.forEach(d => d.dispose());
    this.disposables = [];
    this.isActivated = false;
  }

  // ===== Event Handlers =====

  private async onActiveEditorChange(editor: TextEditor | undefined): Promise<void> {
    if (!editor) {
      return;
    }

    await this.updateDecorations(editor);
  }

  @debounce(500)
  private onDocumentChange(event: { document: { uri: Uri } }): void {
    // Clear decorations on text change (debounced to wait for typing to stop)
    const editor = window.activeTextEditor;
    if (editor && editor.document.uri.toString() === event.document.uri.toString()) {
      this.clearDecorations(editor);
    }
  }

  private async onDocumentSave(document: { uri: Uri }): Promise<void> {
    // Invalidate cache and refresh on save
    this.clearCache(document.uri);

    const editor = window.activeTextEditor;
    if (editor && editor.document.uri.toString() === document.uri.toString()) {
      await this.updateDecorations(editor);
    }
  }

  private onDocumentClose(document: { uri: Uri }): void {
    // Clear cache on close
    this.clearCache(document.uri);
  }

  private async onVisibleRangeChange(event: { textEditor: TextEditor }): Promise<void> {
    // Update decorations when scrolling (for future optimization)
    // Currently updates all decorations, but can be optimized to only visible range
    await this.updateDecorations(event.textEditor);
  }

  private async onBlameStateChange(uri: Uri | undefined): Promise<void> {
    // State toggled - update decorations
    const editor = window.activeTextEditor;
    if (!uri || (editor && editor.document.uri.toString() === uri.toString())) {
      await this.updateDecorations(editor);
    }
  }

  private async onConfigurationChange(_event: any): Promise<void> {
    // Save old decoration types
    const oldTypes = this.decorationTypes;

    // Create new decoration types first
    this.decorationTypes = this.createDecorationTypes();

    // Clear decorations using old types before disposing
    if (window.activeTextEditor) {
      window.activeTextEditor.setDecorations(oldTypes.gutter, []);
      window.activeTextEditor.setDecorations(oldTypes.icon, []);
      window.activeTextEditor.setDecorations(oldTypes.inline, []);
    }

    // Now safe to dispose old types
    oldTypes.gutter.dispose();
    oldTypes.icon.dispose();
    oldTypes.inline.dispose();

    // Clear caches (colors/templates may have changed)
    this.revisionColors.clear();
    this.svgCache.clear();
    // Keep messageCache (revision messages don't change)

    // Refresh all editors with new decoration types
    if (window.activeTextEditor) {
      await this.updateDecorations(window.activeTextEditor);
    }
  }

  // ===== Helper Methods =====

  /**
   * Check if editor should show blame decorations
   */
  private shouldDecorate(editor: TextEditor): boolean {
    const uri = editor.document.uri;

    // Must be file scheme
    if (uri.scheme !== "file") {
      return false;
    }

    // Check configuration - at least one decoration type must be enabled
    const anyDecorationEnabled =
      blameConfiguration.isGutterEnabled() ||
      blameConfiguration.isGutterIconEnabled() ||
      blameConfiguration.isInlineEnabled();

    if (!blameConfiguration.isEnabled() || !anyDecorationEnabled) {
      return false;
    }

    // Check state manager
    if (!blameStateManager.shouldShowBlame(uri)) {
      return false;
    }

    return true;
  }

  /**
   * Get blame data for URI (with caching)
   */
  private async getBlameData(uri: Uri): Promise<ISvnBlameLine[] | undefined> {
    const key = uri.toString();

    // Check cache
    const cached = this.blameCache.get(key);
    if (cached) {
      return cached.data;
    }

    // Fetch from repository
    try {
      const data = await this.repository.blame(uri.fsPath);

      // Cache with document version
      this.blameCache.set(key, { data, version: 0 });

      return data;
    } catch (err) {
      console.error("BlameProvider: Failed to fetch blame data", err);
      return undefined;
    }
  }

  /**
   * Create all decoration arrays from blame data
   */
  private async createAllDecorations(
    blameData: ISvnBlameLine[],
    editor: TextEditor
  ): Promise<{
    gutter: any[];
    icon: any[];
    inline: any[];
  }> {
    const gutterDecorations: any[] = [];
    const iconDecorations: any[] = [];
    const inlineDecorations: any[] = [];

    const template = blameConfiguration.getGutterTemplate();
    const dateFormat = blameConfiguration.getDateFormat();

    // Prefetch messages if inline enabled
    if (blameConfiguration.isInlineEnabled() && blameConfiguration.shouldShowInlineMessage()) {
      const uniqueRevisions = [...new Set(
        blameData.map(b => b.revision).filter(Boolean)
      )] as string[];

      if (uniqueRevisions.length > 0 && uniqueRevisions.length <= 100) {
        await this.prefetchMessages(uniqueRevisions);
      }
    }

    // Calculate revision range for gradient coloring
    const revisionRange = this.getRevisionRange(blameData);

    for (const blameLine of blameData) {
      const lineIndex = blameLine.lineNumber - 1; // 1-indexed to 0-indexed

      // Skip if line doesn't exist in document
      if (lineIndex < 0 || lineIndex >= editor.document.lineCount) {
        continue;
      }

      const range = new Range(lineIndex, 0, lineIndex, 0);

      // 1. Gutter text decoration
      if (blameConfiguration.isGutterTextEnabled()) {
        const text = this.formatBlameText(blameLine, template, dateFormat);
        gutterDecorations.push({
          range,
          renderOptions: {
            before: {
              contentText: text
            }
          }
        });
      }

      // Skip uncommitted lines for icon/inline
      if (!blameLine.revision || !blameLine.author) {
        continue;
      }

      // 2. Gutter icon decoration
      if (blameConfiguration.isGutterIconEnabled()) {
        const color = this.getRevisionColor(blameLine.revision, revisionRange);
        const svgUri = this.generateColorBarSvg(color);

        iconDecorations.push({
          range,
          renderOptions: {
            light: { gutterIconPath: svgUri },
            dark: { gutterIconPath: svgUri }
          }
        });
      }

      // 3. Inline annotation
      if (blameConfiguration.isInlineEnabled()) {
        const message = blameConfiguration.shouldShowInlineMessage()
          ? await this.getCommitMessage(blameLine.revision)
          : "";

        const inlineText = this.formatInlineText(blameLine, message);

        const line = editor.document.lineAt(lineIndex);
        inlineDecorations.push({
          range: new Range(
            lineIndex,
            line.range.end.character,
            lineIndex,
            line.range.end.character
          ),
          renderOptions: {
            after: {
              contentText: inlineText
            }
          }
        });
      }
    }

    return {
      gutter: gutterDecorations,
      icon: iconDecorations,
      inline: inlineDecorations
    };
  }

  /**
   * Format blame line using template
   */
  private formatBlameText(
    line: ISvnBlameLine,
    template: string,
    dateFormat: "relative" | "absolute"
  ): string {
    const revision = line.revision || "???";
    const author = line.author || "unknown";
    const date = this.formatDate(line.date, dateFormat);

    return template
      .replace(/\$\{revision\}/g, revision)
      .replace(/\$\{author\}/g, author)
      .replace(/\$\{date\}/g, date)
      .padEnd(30); // Ensure consistent spacing
  }

  /**
   * Format date (relative or absolute)
   */
  private formatDate(dateStr: string | undefined, format: "relative" | "absolute"): string {
    if (!dateStr) {
      return "unknown";
    }

    try {
      const date = new Date(dateStr);

      if (format === "relative") {
        return this.getRelativeTime(date);
      } else {
        return date.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: date.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined
        });
      }
    } catch {
      return dateStr; // Fallback to raw string
    }
  }

  /**
   * Get relative time string (e.g., "2 days ago")
   */
  private getRelativeTime(date: Date): string {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

    if (seconds < 60) return "just now";
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 2592000) return `${Math.floor(seconds / 86400)}d ago`;
    if (seconds < 31536000) return `${Math.floor(seconds / 2592000)}mo ago`;
    return `${Math.floor(seconds / 31536000)}y ago`;
  }

  // ===== Phase 2.5: Revision Gradient Coloring =====

  /**
   * Calculate min/max revision range from blame data
   */
  private getRevisionRange(blameData: ISvnBlameLine[]): { min: number; max: number } {
    const revisions = blameData
      .map(b => b.revision)
      .filter(Boolean)
      .map(r => parseInt(r as string, 10))
      .filter(r => !isNaN(r));

    if (revisions.length === 0) {
      return { min: 0, max: 0 };
    }

    return {
      min: Math.min(...revisions),
      max: Math.max(...revisions)
    };
  }

  /**
   * Get gradient color for revision (red → yellow → green)
   * Red (oldest) → Yellow (medium) → Green (newest)
   * Formula: hue interpolates from 0 (red) to 120 (green)
   */
  private getRevisionColor(revision: string, range: { min: number; max: number }): string {
    if (this.revisionColors.has(revision)) {
      return this.revisionColors.get(revision)!;
    }

    const revNum = parseInt(revision, 10);
    if (isNaN(revNum) || range.max === range.min) {
      // Fallback for invalid or single revision
      const color = this.hslToHex(60, 70, 50); // Yellow
      this.revisionColors.set(revision, color);
      return color;
    }

    // Normalize revision to 0-1 range
    const normalized = (revNum - range.min) / (range.max - range.min);

    // Interpolate hue: 0 (red) → 60 (yellow) → 120 (green)
    const hue = Math.round(normalized * 120);
    const saturation = 70;
    const lightness = 50;

    const color = this.hslToHex(hue, saturation, lightness);
    this.revisionColors.set(revision, color);
    return color;
  }

  /**
   * Convert HSL to hex color for better SVG compatibility in data URIs
   */
  private hslToHex(h: number, s: number, l: number): string {
    s /= 100;
    l /= 100;

    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs((h / 60) % 2 - 1));
    const m = l - c / 2;

    let r = 0, g = 0, b = 0;

    if (h >= 0 && h < 60) { r = c; g = x; b = 0; }
    else if (h >= 60 && h < 120) { r = x; g = c; b = 0; }
    else if (h >= 120 && h < 180) { r = 0; g = c; b = x; }
    else if (h >= 180 && h < 240) { r = 0; g = x; b = c; }
    else if (h >= 240 && h < 300) { r = x; g = 0; b = c; }
    else if (h >= 300 && h < 360) { r = c; g = 0; b = x; }

    const toHex = (val: number) => Math.round((val + m) * 255).toString(16).padStart(2, '0');

    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  }

  // ===== Phase 2.5: SVG Generation =====

  /**
   * Generate colored vertical bar SVG (cached by color)
   */
  private generateColorBarSvg(color: string): Uri {
    if (this.svgCache.has(color)) {
      return this.svgCache.get(color)!;
    }

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="3" height="16" viewBox="0 0 3 16"><rect width="3" height="16" fill="${color}"/></svg>`;
    const base64 = Buffer.from(svg, "utf-8").toString("base64");
    const uri = Uri.parse(`data:image/svg+xml;base64,${base64}`);

    this.svgCache.set(color, uri);
    return uri;
  }

  // ===== Phase 2.5: Message Fetching =====

  /**
   * Get commit message for revision (cached)
   */
  private async getCommitMessage(revision: string): Promise<string> {
    if (this.messageCache.has(revision)) {
      return this.messageCache.get(revision)!;
    }

    if (!blameConfiguration.isLogsEnabled()) {
      return "";
    }

    try {
      const log = await this.repository.log(revision, revision, 1);
      const message = log[0]?.msg || "";
      this.messageCache.set(revision, message);
      return message;
    } catch (err) {
      console.error(`BlameProvider: Failed to fetch message for r${revision}`, err);
      return "";
    }
  }

  /**
   * Prefetch messages for multiple revisions (batch)
   */
  private async prefetchMessages(revisions: string[]): Promise<void> {
    if (!blameConfiguration.isLogsEnabled()) {
      return;
    }

    const uncached = revisions.filter(r => !this.messageCache.has(r));

    for (const revision of uncached) {
      await this.getCommitMessage(revision);
    }
  }

  // ===== Phase 2.5: Text Formatting =====

  /**
   * Truncate commit message intelligently
   */
  private truncateMessage(message: string): string {
    if (!message) {
      return "";
    }

    const maxLength = blameConfiguration.getInlineMaxLength();

    // Extract first line only
    const firstLine = message.split("\n")[0].trim();

    if (firstLine.length <= maxLength) {
      return firstLine;
    }

    // Truncate at word boundary
    const ellipsis = "...";
    const targetLength = maxLength - ellipsis.length;

    const truncated = firstLine.substring(0, targetLength);
    const lastSpace = truncated.lastIndexOf(" ");

    if (lastSpace > targetLength * 0.75) {
      // Good word boundary found
      return truncated.substring(0, lastSpace) + ellipsis;
    } else {
      // No good boundary, hard truncate
      return truncated + ellipsis;
    }
  }

  /**
   * Format inline text with message and template
   */
  private formatInlineText(line: ISvnBlameLine, message: string): string {
    const template = blameConfiguration.getInlineTemplate();
    const revision = line.revision || "???";
    const author = line.author || "unknown";
    const dateFormat = blameConfiguration.getDateFormat();
    const date = this.formatDate(line.date, dateFormat);

    const truncatedMessage = this.truncateMessage(message);

    return template
      .replace(/\$\{revision\}/g, revision)
      .replace(/\$\{author\}/g, author)
      .replace(/\$\{date\}/g, date)
      .replace(/\$\{message\}/g, truncatedMessage);
  }
}
