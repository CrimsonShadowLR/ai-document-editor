/** Wire shape of `GET /models`. */
export interface ModelsResponse {
  models: string[];
  default: string | null;
}
