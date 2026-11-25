/**
 * Code editor for the workbench: CodeMirror 6 with one EditorState per open file, so
 * switching between an animal's files keeps each one's undo history and selection.
 */
import { basicSetup } from 'codemirror';
import { EditorState, type Extension } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';
import { javascript } from '@codemirror/lang-javascript';
import { oneDark } from '@codemirror/theme-one-dark';

export interface CodeEditorOpts {
  parent: HTMLElement;
  onSave?: () => void;
  onChange?: (text: string) => void;
}

const theme = EditorView.theme({
  '&': { height: '100%', fontSize: '12px' },
  '.cm-scroller': { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace', lineHeight: '1.45' },
  '.cm-flash': { backgroundColor: 'rgba(255, 210, 90, 0.22)' },
});

export class CodeEditor {
  view: EditorView;
  private states = new Map<string, EditorState>();
  private current = '';
  private silent = false;
  constructor(private o: CodeEditorOpts) {
    this.view = new EditorView({ parent: o.parent, state: this.make('', '') });
  }
  private extensions(lang: string): Extension[] {
    return [
      basicSetup,
      lang === 'json' ? javascript() : javascript({ typescript: lang === 'ts' }),
      oneDark,
      theme,
      keymap.of([{ key: 'Mod-s', preventDefault: true, run: () => { this.o.onSave?.(); return true; } }]),
      EditorView.updateListener.of((u) => { if (u.docChanged && !this.silent) this.o.onChange?.(u.state.doc.toString()); }),
    ];
  }
  private make(text: string, key: string) {
    const lang = key.endsWith('.json') ? 'json' : key.endsWith('.ts') || key.endsWith('.tsx') ? 'ts' : 'js';
    return EditorState.create({ doc: text, extensions: this.extensions(lang) });
  }
  /** Show `key`'s document, creating it from `text` the first time (or when `reset`). */
  open(key: string, text: string, reset = false) {
    if (this.current) this.states.set(this.current, this.view.state);
    let st = this.states.get(key);
    if (!st || reset) st = this.make(text, key);
    this.silent = true;
    this.view.setState(st);
    this.silent = false;
    this.current = key;
  }
  get key() { return this.current; }
  text(key = this.current) { return key === this.current ? this.view.state.doc.toString() : this.states.get(key)?.doc.toString() ?? ''; }
  has(key: string) { return key === this.current || this.states.has(key); }
  /** Replace the whole document (keeps it undoable). */
  replace(text: string) {
    this.silent = true;
    this.view.dispatch({ changes: { from: 0, to: this.view.state.doc.length, insert: text } });
    this.silent = false;
  }
  forget(key: string) { this.states.delete(key); }
  /** Select [from, to) and scroll it to the top of the editor. */
  reveal(from: number, to: number) {
    const len = this.view.state.doc.length;
    from = Math.max(0, Math.min(from, len)); to = Math.max(from, Math.min(to, len));
    this.view.dispatch({ selection: { anchor: from, head: to }, effects: EditorView.scrollIntoView(from, { y: 'start', yMargin: 24 }) });
    this.view.focus();
  }
}
