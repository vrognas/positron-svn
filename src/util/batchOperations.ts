/**
 * Batch operations utilities (Phase 21.D)
 *
 * Adaptive chunking for bulk SVN operations to reduce overhead
 * while maintaining responsiveness
 */

/**
 * Split files into chunks based on adaptive strategy
 *
 * Strategy:
 * - <50 files: single batch (no overhead)
 * - 50-500 files: 50 files/chunk (balance overhead vs feedback)
 * - 500+ files: 100 files/chunk (reduce total overhead)
 *
 * @param files Array of file paths to chunk
 * @returns Array of file chunks
 *
 * @example
 * ```typescript
 * const files = Array.from({ length: 150 }, (_, i) => `file${i}.txt`);
 * const chunks = chunkFiles(files);
 * // Returns: [[files 0-49], [files 50-99], [files 100-149]]
 * ```
 */
export function chunkFiles<T>(files: T[]): T[][] {
  const count = files.length;

  // Fast path: small batch - process all at once
  if (count < 50) {
    return [files];
  }

  // Medium batch: 50 files/chunk
  if (count < 500) {
    return chunkArray(files, 50);
  }

  // Large batch: 100 files/chunk
  return chunkArray(files, 100);
}

/**
 * Split array into chunks of specified size
 */
function chunkArray<T>(array: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
}

/**
 * Execute operation on file chunks with progress tracking
 *
 * @param files Files to process
 * @param operation Async operation to perform on each chunk
 * @returns Combined results from all chunks
 */
export async function executeBatched<T, R>(
  files: T[],
  operation: (chunk: T[]) => Promise<R>
): Promise<R[]> {
  const chunks = chunkFiles(files);
  const results: R[] = [];

  for (const chunk of chunks) {
    const result = await operation(chunk);
    results.push(result);
  }

  return results;
}
