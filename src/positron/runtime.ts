/**
 * Positron Runtime Detection (Phase 23.P0)
 *
 * Provides utilities for detecting Positron vs VS Code environment
 * and safely accessing Positron-specific APIs
 */

import { tryAcquirePositronApi, inPositron as checkPositron, type PositronApi } from "@posit-dev/positron";

/**
 * Check if extension is running in Positron IDE
 *
 * @returns true if running in Positron, false if VS Code
 *
 * @example
 * ```typescript
 * if (isPositron()) {
 *   // Enable Positron-specific features
 *   activateConnectionsProvider();
 * }
 * ```
 */
export function isPositron(): boolean {
  return checkPositron();
}

/**
 * Safely acquire Positron API if available
 *
 * @returns Positron API object or undefined if in VS Code
 *
 * @example
 * ```typescript
 * const api = getPositronApi();
 * if (api) {
 *   // Register Positron-specific providers
 *   api.connections.registerConnectionDriver(svnDriver);
 * }
 * ```
 */
export function getPositronApi(): PositronApi | undefined {
  return tryAcquirePositronApi();
}

/**
 * Execute callback only in Positron environment
 *
 * Helper for conditional feature activation
 *
 * @param callback Function to execute if in Positron
 *
 * @example
 * ```typescript
 * whenPositron(() => {
 *   console.log("Running Positron-specific initialization");
 *   registerConnectionsProvider();
 * });
 * ```
 */
export function whenPositron(callback: (api: PositronApi) => void): void {
  const api = getPositronApi();
  if (api) {
    callback(api);
  }
}

/**
 * Get environment name for logging/telemetry
 *
 * @returns "Positron" or "VS Code"
 */
export function getEnvironmentName(): string {
  return isPositron() ? "Positron" : "VS Code";
}
