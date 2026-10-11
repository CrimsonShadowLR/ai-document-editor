import { post } from "../../../shared/httpClient";
import type { CreateSuggestionBody, SuggestionResponse } from "../schema/suggestion";

export async function createSuggestion(body: CreateSuggestionBody): Promise<SuggestionResponse> {
  return post<SuggestionResponse, CreateSuggestionBody>("/suggestions", body);
}
