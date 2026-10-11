import { useEffect, useState } from "react";

import { readStorage, writeStorage } from "../../../shared/storage";
import { useModels } from "./useModels";

const STORAGE_KEY = "editor.model";

/**
 * The model chosen in the picker, remembered across reloads. Falls back to the
 * backend default when nothing is saved or the saved model is no longer offered.
 */
export function useSelectedModel() {
  const modelsQuery = useModels();
  const [saved, setSaved] = useState<string | null>(() => readStorage(STORAGE_KEY, null));

  const models = modelsQuery.data?.models ?? [];
  const selected = saved && models.includes(saved) ? saved : (modelsQuery.data?.default ?? null);

  useEffect(() => {
    if (saved) writeStorage(STORAGE_KEY, saved);
  }, [saved]);

  return { modelsQuery, models, selected, setSelected: setSaved };
}
