// Copyright (c) 2025-present Viktor Rognas
// Licensed under MIT License

/**
 * Conventional commit type definition
 */
export type CommitType =
  | "feat"
  | "fix"
  | "docs"
  | "style"
  | "refactor"
  | "perf"
  | "test"
  | "build"
  | "ci"
  | "chore"
  | "revert"
  | "custom";

/**
 * Parsed conventional commit structure
 */
export interface ConventionalCommit {
  type: CommitType | string;
  scope?: string;
  description: string;
}

/**
 * Commit type with UI metadata
 */
export interface CommitTypeInfo {
  type: CommitType;
  icon: string;
  label: string;
  description: string;
}

const MAX_MESSAGE_LENGTH = 50;

const COMMIT_TYPES: CommitTypeInfo[] = [
  {
    type: "feat",
    icon: "$(sparkle)",
    label: "feat",
    description: "New feature (MINOR version bump)"
  },
  {
    type: "fix",
    icon: "$(bug)",
    label: "fix",
    description: "Bug fix (PATCH version bump)"
  },
  {
    type: "docs",
    icon: "$(book)",
    label: "docs",
    description: "Documentation only changes"
  },
  {
    type: "style",
    icon: "$(paintcan)",
    label: "style",
    description: "Formatting, whitespace, semicolons"
  },
  {
    type: "refactor",
    icon: "$(wrench)",
    label: "refactor",
    description: "Code change without fix or feature"
  },
  {
    type: "perf",
    icon: "$(rocket)",
    label: "perf",
    description: "Performance improvement"
  },
  {
    type: "test",
    icon: "$(beaker)",
    label: "test",
    description: "Adding or updating tests"
  },
  {
    type: "build",
    icon: "$(package)",
    label: "build",
    description: "Build system or dependencies"
  },
  {
    type: "ci",
    icon: "$(server-process)",
    label: "ci",
    description: "CI/CD configuration"
  },
  {
    type: "chore",
    icon: "$(tools)",
    label: "chore",
    description: "Maintenance, no src/test change"
  },
  {
    type: "revert",
    icon: "$(discard)",
    label: "revert",
    description: "Revert a previous commit"
  },
  {
    type: "custom",
    icon: "$(pencil)",
    label: "custom",
    description: "Write custom message"
  }
];

// Regex to parse conventional commit: type(scope): description
const CONVENTIONAL_REGEX = /^(\w+)(?:\(([^)]+)\))?:\s*(.+)$/;

/**
 * Service for parsing and formatting conventional commit messages.
 * Enforces 50-char max message length.
 */
export class ConventionalCommitService {
  /**
   * Format a conventional commit object into a message string
   */
  format(commit: ConventionalCommit): string {
    const { type, scope, description } = commit;

    let prefix: string;
    if (scope) {
      prefix = `${type}(${scope}): `;
    } else {
      prefix = `${type}: `;
    }

    const maxDescLength = MAX_MESSAGE_LENGTH - prefix.length;
    let truncatedDesc = description;

    if (description.length > maxDescLength) {
      truncatedDesc = description.slice(0, maxDescLength - 3) + "...";
    }

    return prefix + truncatedDesc;
  }

  /**
   * Parse a commit message into conventional commit structure.
   * Returns null if not a valid conventional commit format.
   */
  parse(message: string): ConventionalCommit | null {
    if (!message || message.trim() === "") {
      return null;
    }

    const match = message.match(CONVENTIONAL_REGEX);
    if (!match) {
      return null;
    }

    const [, type, scope, description] = match;
    return {
      type: type as CommitType,
      scope: scope || undefined,
      description: (description || "").trim()
    };
  }

  /**
   * Get all available commit types with icons and descriptions
   */
  getCommitTypes(): CommitTypeInfo[] {
    return COMMIT_TYPES;
  }

  /**
   * Validate commit description.
   * Returns error message if invalid, undefined if valid.
   */
  validateDescription(description: string): string | undefined {
    if (!description || description.trim() === "") {
      return "Description cannot be empty";
    }

    if (description.length > MAX_MESSAGE_LENGTH) {
      return `Description exceeds ${MAX_MESSAGE_LENGTH} characters (${description.length})`;
    }

    return undefined;
  }

  /**
   * Get max allowed message length
   */
  getMaxLength(): number {
    return MAX_MESSAGE_LENGTH;
  }
}
