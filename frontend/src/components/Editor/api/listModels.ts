import { get } from "../../../shared/httpClient";
import type { ModelsResponse } from "../schema/models";

export async function listModels(): Promise<ModelsResponse> {
  return get<ModelsResponse>("/models");
}
