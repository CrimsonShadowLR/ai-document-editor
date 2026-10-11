import { MarkdownEditor } from "./components/MarkdownEditor";
import { ModelPicker } from "./components/ModelPicker";
import { useDocument } from "./hooks/useDocument";
import { useSelectedModel } from "./hooks/useSelectedModel";

export function Editor() {
  const { content, setContent, isSaved } = useDocument();
  const modelSelection = useSelectedModel();

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-4">
        <ModelPicker {...modelSelection} />
        <span className="text-xs text-slate-400">{isSaved ? "Saved" : "Saving…"}</span>
      </div>
      <MarkdownEditor value={content} onChange={setContent} />
    </div>
  );
}
