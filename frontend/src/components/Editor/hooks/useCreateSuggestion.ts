import { useMutation } from "@tanstack/react-query";

import { createSuggestion } from "../api/createSuggestion";
import type { CreateSuggestionBody } from "../schema/suggestion";

export function useCreateSuggestion() {
  return useMutation({
    mutationFn: ({ body, signal }: { body: CreateSuggestionBody; signal?: AbortSignal }) =>
      createSuggestion(body, signal),
  });
}
