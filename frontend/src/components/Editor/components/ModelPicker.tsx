import { errorMessage } from "../../../shared/httpClient";
import { useSelectedModel } from "../hooks/useSelectedModel";

type ModelPickerProps = ReturnType<typeof useSelectedModel>;

export function ModelPicker({ modelsQuery, models, selected, setSelected }: ModelPickerProps) {
  if (modelsQuery.isPending) {
    return <span className="text-sm text-slate-500">Loading models…</span>;
  }
  if (modelsQuery.isError) {
    return (
      <span className="text-sm text-red-600">
        Can't reach the API: {errorMessage(modelsQuery.error, "is the backend running?")}
      </span>
    );
  }
  if (models.length === 0) {
    return <span className="text-sm text-amber-700">No models configured (set LLM_MODELS in .env)</span>;
  }

  return (
    <label className="flex items-center gap-2 text-sm text-slate-600">
      Model
      <select
        className="rounded-md border border-slate-300 bg-white px-2 py-1 text-sm text-slate-800"
        value={selected ?? ""}
        onChange={(event) => setSelected(event.target.value)}
      >
        {models.map((model) => (
          <option key={model} value={model}>
            {model}
          </option>
        ))}
      </select>
    </label>
  );
}
