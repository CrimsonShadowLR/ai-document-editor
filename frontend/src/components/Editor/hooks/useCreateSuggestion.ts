import { useMutation } from "@tanstack/react-query";

import { createSuggestion } from "../api/createSuggestion";

export function useCreateSuggestion() {
  return useMutation({ mutationFn: createSuggestion });
}
