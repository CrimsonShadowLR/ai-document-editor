import { useQuery } from "@tanstack/react-query";

import { listModels } from "../api/listModels";

export const MODELS_QUERY_KEY = ["models"] as const;

export function useModels() {
  return useQuery({
    queryKey: MODELS_QUERY_KEY,
    queryFn: listModels,
    // The list only changes when .env changes and the backend restarts.
    staleTime: Infinity,
  });
}
