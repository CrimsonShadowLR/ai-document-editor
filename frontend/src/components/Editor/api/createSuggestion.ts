import { post } from "../../../shared/httpClient";
import type { CreateSuggestionBody, SuggestionResponse } from "../schema/suggestion";

export async function createSuggestion(body: CreateSuggestionBody, signal?: AbortSignal): Promise<SuggestionResponse> {
  return post<SuggestionResponse, CreateSuggestionBody>("/suggestions", body, signal);
}
