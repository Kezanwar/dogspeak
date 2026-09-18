import { useState, useCallback } from "react";
import type { ErrorObject } from "@app/lib/axios";
import { errorHandler as handleRawError } from "@app/lib/axios";

export function useErrorHandler() {
  const [error, setError] = useState<ErrorObject | null>(null);

  const handleError = useCallback((err: unknown) => {
    handleRawError(err, setError);
  }, []);

  const resetError = () => setError(null);

  return {
    error,
    handleError,
    resetError,
  };
}
