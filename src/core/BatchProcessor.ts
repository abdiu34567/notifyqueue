import Logger from "../utils/Logger";

export interface BatchQueryOptions {
  batchSize?: number;
  maxQueriesPerSecond?: number;
}

/**
 * Processes database records in batches.
 * Instead of relying on a pre-known total, this function keeps querying using the provided
 * processBatch function (which takes offset and limit) until an empty array is returned.
 *
 * @param processBatch - A function that queries the database given an offset and a limit, and returns a Promise of an array of records.
 * @param handler - A function that processes the batch of records.
 * @param options - Optional pagination and rate limiting options.
 */
export async function processInBatches<T>(
  processBatch: (offset: number, limit: number) => Promise<T[]>,
  handler: (items: T[]) => Promise<void>,
  options?: BatchQueryOptions
): Promise<void> {
  const batchSize = options?.batchSize ?? 1000;
  const maxConcurrentBatches = 3; // Process up to 3 batches in parallel

  let offset = 0;
  let activeBatches: Promise<void>[] = [];

  while (true) {
    // Directly execute the batch query (RateLimiter is applied externally)
    const items = await processBatch(offset, batchSize);

    if (!items || items.length === 0) {
      // No more records, break loop
      break;
    }

    // Process batch in parallel without internal rate limiting
    const batchTask = handler(items);
    activeBatches.push(batchTask);

    // Wait if too many parallel batches are running
    if (activeBatches.length >= maxConcurrentBatches) {
      await Promise.race(activeBatches);
      activeBatches = activeBatches.filter((b) => !b.finally);
    }

    offset += items.length;
  }

  // Ensure all remaining batches are completed
  await Promise.all(activeBatches);
}

export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  maxRetries: number = 5,
  baseDelay: number = 500 // Initial delay in milliseconds
): Promise<T> {
  let attempt = 0;

  while (attempt <= maxRetries) {
    try {
      return await operation();
    } catch (error: any) {
      if (attempt === maxRetries) {
        Logger.error(`Max retries reached. Operation failed: ${error.message}`);
        throw error; // Fails after max retries
      }

      const delay = baseDelay * Math.pow(2, attempt); // Exponential backoff
      Logger.log(`Retrying after ${delay}ms... Attempt ${attempt + 1}`);
      await new Promise((resolve) => setTimeout(resolve, delay));

      attempt++;
    }
  }

  throw new Error("This should never happen, as we throw after max retries.");
}
