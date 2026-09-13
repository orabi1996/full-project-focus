import { QueryClient } from "@tanstack/react-query";

/**
 * Creates a production QueryClient instance with safe defaults for HRMS data.
 * - Prevents aggressive refetching of sensitive employee/payroll records.
 * - Disables window focus refetching to avoid query storms.
 * - Implements smart retry policies that avoid retrying client/authorization errors.
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 2 * 60 * 1000, // 2 minutes
        gcTime: 10 * 60 * 1000, // 10 minutes
        refetchOnWindowFocus: false,
        refetchOnReconnect: "always",
        retry(failureCount, error) {
          if (failureCount >= 2) return false;
          if (error instanceof Error) {
            const msg = error.message.toLowerCase();
            if (
              msg.includes("401") ||
              msg.includes("403") ||
              msg.includes("404") ||
              msg.includes("jwt") ||
              msg.includes("unauthorized") ||
              msg.includes("forbidden") ||
              msg.includes("denied")
            ) {
              return false;
            }
          }
          return true;
        },
      },
      mutations: {
        retry: 0,
      },
    },
  });
}

/**
 * Purges sensitive cached HRMS data upon user logout or authentication identity change.
 * Cancels active in-flight requests and removes sensitive cached queries from the provided client.
 * Harmless public/static configuration (such as "public_config") is preserved.
 */
export function clearSensitiveQueryCache(client: QueryClient): void {
  // 1. Abort any pending in-flight sensitive queries immediately
  void client.cancelQueries({
    predicate: (query) => {
      const topKey = query.queryKey[0];
      return topKey !== "public_config";
    },
  });

  // 2. Remove all sensitive queries from the cache
  client.removeQueries({
    predicate: (query) => {
      const topKey = query.queryKey[0];
      return topKey !== "public_config";
    },
  });
}
