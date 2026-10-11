import { markdown } from "@codemirror/lang-markdown";
import CodeMirror, { EditorView } from "@uiw/react-codemirror";

// Created once: a new array each render would reconfigure the editor.
const EXTENSIONS = [markdown(), EditorView.lineWrapping];

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
}

export function MarkdownEditor({ value, onChange }: MarkdownEditorProps) {
  return (
    <CodeMirror
      value={value}
      onChange={onChange}
      extensions={EXTENSIONS}
      basicSetup={{ foldGutter: false, highlightActiveLine: false }}
      className="overflow-hidden rounded-lg border border-slate-200 bg-white text-[15px] shadow-sm"
      minHeight="70vh"
    />
  );
}
