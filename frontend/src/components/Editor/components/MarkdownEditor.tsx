import { markdown } from "@codemirror/lang-markdown";
import { EditorView, type ViewUpdate } from "@codemirror/view";
import CodeMirror from "@uiw/react-codemirror";

import { suggestionExtension } from "../codemirror/suggestionField";

// Created once: a new array each render would reconfigure the editor.
const EXTENSIONS = [markdown(), EditorView.lineWrapping, suggestionExtension];

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  onCreateEditor: (view: EditorView) => void;
  onUpdate: (update: ViewUpdate) => void;
}

export function MarkdownEditor({ value, onChange, onCreateEditor, onUpdate }: MarkdownEditorProps) {
  return (
    <CodeMirror
      value={value}
      onChange={onChange}
      onCreateEditor={onCreateEditor}
      onUpdate={onUpdate}
      extensions={EXTENSIONS}
      basicSetup={{ foldGutter: false, highlightActiveLine: false }}
      className="overflow-hidden rounded-lg border border-slate-200 bg-white text-[15px] shadow-sm"
      minHeight="70vh"
    />
  );
}
