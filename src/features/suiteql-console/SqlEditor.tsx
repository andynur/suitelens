import { autocompletion, completionKeymap } from '@codemirror/autocomplete';
import { metadataCompletion } from './completion';
import type { MetadataTable } from '../../shared/storage/consoleLibrary';
import {
  useEffect,
  useRef,
  useMemo,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
} from 'react';
import { EditorState } from '@codemirror/state';
import {
  EditorView,
  keymap,
  lineNumbers,
  highlightActiveLine,
  drawSelection,
} from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { sql, PLSQL } from '@codemirror/lang-sql';
import { tags } from '@lezer/highlight';
import { t } from '../../shared/i18n';
import { MAX_QUERY_LENGTH } from '../../shared/storage/queryWorkspace';

const highlight = HighlightStyle.define([
  { tag: tags.keyword, color: 'var(--c-accent)' },
  { tag: [tags.string, tags.number, tags.bool, tags.null], color: 'var(--c-success)' },
  { tag: tags.comment, color: 'var(--c-fg-subtlest)' },
]);

const theme = EditorView.theme({
  '&': { minHeight: 'inherit', color: 'var(--c-fg)', backgroundColor: 'var(--c-surface)' },
  // Auto-grow from about 4 to 12 lines, then scroll inside the editor. A height set with the
  // resize handle fixes the editor at that size.
  '.cm-scroller': {
    fontFamily: 'var(--c-font-mono)',
    maxHeight: 'var(--sql-editor-height, 16rem)',
    minHeight: 'var(--sql-editor-height, 0)',
    overflow: 'auto',
  },
  '.cm-content': { minHeight: 'inherit', caretColor: 'var(--c-fg)' },
  '.cm-cursor': { borderLeftColor: 'var(--c-fg)' },
  '.cm-gutters': {
    backgroundColor: 'var(--c-surface)',
    color: 'var(--c-fg-subtlest)',
    borderColor: 'var(--c-line)',
  },
  '.cm-tooltip': {
    backgroundColor: 'var(--c-surface-overlay)',
    color: 'var(--c-fg)',
    borderColor: 'var(--c-line)',
  },
  '.cm-tooltip-autocomplete > ul > li[aria-selected]': {
    backgroundColor: 'var(--c-selected)',
    color: 'var(--c-accent)',
  },
  '.cm-activeLine': { backgroundColor: 'var(--c-muted)' },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
    backgroundColor: 'var(--c-selected)',
  },
  '&.cm-focused': { outline: '2px solid var(--c-focus)', outlineOffset: '2px' },
});

export const EDITOR_MIN_HEIGHT = 96;
export const EDITOR_MAX_HEIGHT = 640;
const EDITOR_STEP = 24;

const clampHeight = (value: number) =>
  Math.round(Math.min(EDITOR_MAX_HEIGHT, Math.max(EDITOR_MIN_HEIGHT, value)));

/** CodeMirror owns selection and undo while the active draft is mounted. */
export function SqlEditor({
  initialSql,
  tables = [],
  height,
  onHeightChange,
  onChange,
  onReady,
  onRun,
  onSelectionChange,
}: {
  initialSql: string;
  tables?: MetadataTable[];
  /** Fixed editor height in pixels; undefined auto-grows. */
  height?: number;
  onHeightChange?: (height: number | undefined) => void;
  onRun: () => void;
  onSelectionChange: (selected: boolean) => void;
  onChange: (sql: string) => void;
  onReady: (view: EditorView | undefined) => void;
}) {
  const completion = useMemo(() => metadataCompletion(tables), [tables]);
  const completionRef = useRef(completion);
  useEffect(() => {
    completionRef.current = completion;
  }, [completion]);
  const host = useRef<HTMLDivElement>(null);
  const callbacks = useRef({ onChange, onReady, onRun, onSelectionChange });
  useEffect(() => {
    callbacks.current = { onChange, onReady, onRun, onSelectionChange };
  }, [onChange, onReady, onRun, onSelectionChange]);
  useEffect(() => {
    const view = new EditorView({
      parent: host.current!,
      state: EditorState.create({
        doc: initialSql,
        extensions: [
          lineNumbers(),
          history(),
          drawSelection(),
          highlightActiveLine(),
          keymap.of([
            {
              key: 'Mod-Enter',
              run: () => {
                callbacks.current.onRun();
                return true;
              },
            },
            ...completionKeymap,
            ...defaultKeymap,
            ...historyKeymap,
          ]),
          sql({ dialect: PLSQL }),
          autocompletion({
            override: [(context) => completionRef.current(context)],
            activateOnTypingDelay: 0,
          }),
          syntaxHighlighting(highlight),
          theme,
          EditorView.lineWrapping,
          EditorView.contentAttributes.of({
            'aria-label': t('console.editor'),
            role: 'textbox',
            'aria-multiline': 'true',
            'aria-describedby': 'suiteql-draft-notice',
          }),
          EditorState.transactionFilter.of((transaction) =>
            transaction.newDoc.length > MAX_QUERY_LENGTH ? [] : transaction,
          ),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) callbacks.current.onChange(update.state.doc.toString());
            if (update.selectionSet || update.docChanged) {
              const range = update.state.selection.main;
              callbacks.current.onSelectionChange(
                Boolean(update.state.sliceDoc(range.from, range.to).trim()),
              );
            }
          }),
        ],
      }),
    });
    callbacks.current.onReady(view);
    callbacks.current.onSelectionChange(false);
    return () => {
      callbacks.current.onReady(undefined);
      view.destroy();
    };
    // A new tab mounts a new editor. Subsequent document edits are handled by CodeMirror.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const drag = useRef<{ startY: number; startHeight: number } | null>(null);
  const currentHeight = () => height ?? host.current?.getBoundingClientRect().height ?? 0;
  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    drag.current = { startY: event.clientY, startHeight: currentHeight() };
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    onHeightChange?.(clampHeight(drag.current.startHeight + event.clientY - drag.current.startY));
  };
  const onPointerUp = () => {
    drag.current = null;
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const delta = { ArrowUp: -EDITOR_STEP, ArrowDown: EDITOR_STEP }[event.key];
    if (delta !== undefined) {
      event.preventDefault();
      onHeightChange?.(clampHeight(currentHeight() + delta));
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      onHeightChange?.(event.key === 'Home' ? EDITOR_MIN_HEIGHT : EDITOR_MAX_HEIGHT);
    } else if (event.key === 'Escape' || event.key === 'Enter') {
      event.preventDefault();
      onHeightChange?.(undefined);
    }
  };
  return (
    <div className="flex flex-col">
      <div
        ref={host}
        className="min-h-24 rounded-md border border-line-input bg-surface text-sm"
        style={
          height === undefined
            ? undefined
            : ({ '--sql-editor-height': `${height - 2}px` } as CSSProperties)
        }
      />
      {onHeightChange && (
        <div
          role="separator"
          tabIndex={0}
          aria-orientation="horizontal"
          aria-label={t('console.resizeEditor')}
          aria-valuemin={EDITOR_MIN_HEIGHT}
          aria-valuemax={EDITOR_MAX_HEIGHT}
          aria-valuenow={height === undefined ? undefined : height}
          title={t('console.resizeEditorHint')}
          className="group flex h-3 cursor-row-resize touch-none items-center justify-center rounded-sm focus-visible:outline-2 focus-visible:outline-focus"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onDoubleClick={() => onHeightChange(undefined)}
          onKeyDown={onKeyDown}
        >
          <span className="h-1 w-10 rounded-full bg-line group-hover:bg-fg-subtlest" />
        </div>
      )}
    </div>
  );
}
