'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { BoldIcon, ItalicIcon, ListUnorderedIcon } from '@primer/octicons-react'
import { Button, IconButton, Spinner } from '@primer/react'

export interface SeriesDetailsEditorProps {
  /** Initial sanitized HTML to seed the editable surface with (uncontrolled after mount). */
  initialValue: string
  /** Called with the raw editor HTML on Save. The caller is responsible for
   * sanitizing/persisting (the server is authoritative) and for surfacing
   * errors; rejecting keeps the editor open with the draft intact. */
  onSave: (nextValueHtml: string) => Promise<void>
  onCancel: () => void
  disabled?: boolean
  saving?: boolean
  /**
   * Accessible label for the formatting toolbar. Defaults to the series-details
   * wording; callers reusing this editor for a different field (e.g. the
   * session description, specs/003-session-description) should pass a
   * distinct label so the two fields remain unambiguous to assistive tech.
   */
  toolbarLabel?: string
  /** Accessible name for the editable region. Defaults to "Series details". */
  textboxLabel?: string
  /** Placeholder copy shown when the editable region is empty. */
  placeholderText?: string
  /** Label for the primary save button. Defaults to "Save details". */
  saveLabel?: string
}

type FormatCommand = 'bold' | 'italic' | 'underline' | 'insertUnorderedList'

/**
 * A minimal, accessible headless rich-text editor limited to the four
 * supported Series Details controls (bold, italic, underline, bulleted
 * list). Uses native `contentEditable` + `document.execCommand` rather than a
 * new editor dependency (see specs/001-series-details/research.md Decision 3):
 * the repository's approved stack has no editor library, and the server
 * (`SeriesDetailsSanitizer`) remains the sole authority for the persisted
 * markup regardless of what the browser produces here.
 *
 * Reused (unchanged behavior/defaults) by the session description feature
 * (specs/003-session-description/research.md Decision 4) via the optional
 * label/placeholder props below.
 */
export function SeriesDetailsEditor({
  initialValue,
  onSave,
  onCancel,
  disabled = false,
  saving = false,
  toolbarLabel = 'Series details formatting',
  textboxLabel = 'Series details',
  placeholderText = 'Describe the series and what attendees can expect\u2026',
  saveLabel = 'Save details',
}: SeriesDetailsEditorProps) {
  const editorRef = useRef<HTMLDivElement | null>(null)
  const [isEmpty, setIsEmpty] = useState(() => initialValue.trim().length === 0)
  const [activeCommands, setActiveCommands] = useState<Record<FormatCommand, boolean>>({
    bold: false,
    italic: false,
    underline: false,
    insertUnorderedList: false,
  })

  const updateActiveCommands = useCallback(() => {
    if (typeof document === 'undefined' || !document.queryCommandState) return
    setActiveCommands({
      bold: document.queryCommandState('bold'),
      italic: document.queryCommandState('italic'),
      underline: document.queryCommandState('underline'),
      insertUnorderedList: document.queryCommandState('insertUnorderedList'),
    })
  }, [])

  // Seed the editable surface once on mount (entering edit mode always creates
  // a fresh instance of this component) and place the caret at the end so the
  // owner can continue typing naturally.
  useEffect(() => {
    const node = editorRef.current
    if (!node) return

    // Use <p> (an allowed tag) rather than the browser default <div> for new
    // paragraphs created by pressing Enter, so structure survives sanitization.
    try {
      document.execCommand('defaultParagraphSeparator', false, 'p')
    } catch {
      // Not all browsers support this command; falling back to native behavior.
    }

    node.innerHTML = initialValue
    setIsEmpty((node.textContent ?? '').trim().length === 0)

    node.focus()
    const range = document.createRange()
    range.selectNodeContents(node)
    range.collapse(false)
    const selection = window.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(range)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    function handleSelectionChange() {
      const node = editorRef.current
      const selection = typeof window !== 'undefined' ? window.getSelection() : null
      if (node && selection && node.contains(selection.anchorNode)) {
        updateActiveCommands()
      }
    }
    document.addEventListener('selectionchange', handleSelectionChange)
    return () => document.removeEventListener('selectionchange', handleSelectionChange)
  }, [updateActiveCommands])

  function runCommand(command: FormatCommand) {
    if (disabled || saving) return
    editorRef.current?.focus()
    document.execCommand(command)
    updateActiveCommands()
    handleInput()
  }

  function handleInput() {
    const node = editorRef.current
    if (!node) return
    setIsEmpty((node.textContent ?? '').trim().length === 0)
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.preventDefault()
      onCancel()
    }
  }

  async function handleSave() {
    if (disabled || saving) return
    const html = editorRef.current?.innerHTML ?? ''
    await onSave(html)
  }

  const controlsDisabled = disabled || saving

  return (
    <div className="space-y-2">
      <div
        role="toolbar"
        aria-label={toolbarLabel}
        className="flex items-center gap-1 rounded-t-lg px-2 py-1"
        style={{
          border: '1px solid var(--borderColor-default)',
          borderBottom: 'none',
          backgroundColor: 'var(--bgColor-muted)',
        }}
      >
        <IconButton
          icon={BoldIcon}
          aria-label="Bold"
          aria-pressed={activeCommands.bold}
          variant="invisible"
          size="small"
          disabled={controlsDisabled}
          onMouseDown={(event) => {
            event.preventDefault()
            runCommand('bold')
          }}
        />
        <IconButton
          icon={ItalicIcon}
          aria-label="Italic"
          aria-pressed={activeCommands.italic}
          variant="invisible"
          size="small"
          disabled={controlsDisabled}
          onMouseDown={(event) => {
            event.preventDefault()
            runCommand('italic')
          }}
        />
        <Button
          aria-label="Underline"
          aria-pressed={activeCommands.underline}
          variant="invisible"
          size="small"
          disabled={controlsDisabled}
          style={{ textDecoration: 'underline', fontWeight: 600, minWidth: 'auto', paddingLeft: 8, paddingRight: 8 }}
          onMouseDown={(event) => {
            event.preventDefault()
            runCommand('underline')
          }}
        >
          U
        </Button>
        <IconButton
          icon={ListUnorderedIcon}
          aria-label="Bulleted list"
          aria-pressed={activeCommands.insertUnorderedList}
          variant="invisible"
          size="small"
          disabled={controlsDisabled}
          onMouseDown={(event) => {
            event.preventDefault()
            runCommand('insertUnorderedList')
          }}
        />
      </div>

      <div className="relative">
        {isEmpty && (
          <p
            className="pointer-events-none absolute left-3 top-2 text-sm"
            style={{ color: 'var(--fgColor-muted)' }}
            aria-hidden="true"
          >
            {placeholderText}
          </p>
        )}
        <div
          ref={editorRef}
          role="textbox"
          aria-multiline="true"
          aria-label={textboxLabel}
          contentEditable={!controlsDisabled}
          suppressContentEditableWarning
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          onFocus={updateActiveCommands}
          onMouseUp={updateActiveCommands}
          className="min-h-32 rounded-b-lg px-3 py-2 text-sm [&_ul]:list-disc [&_ul]:pl-5"
          style={{
            border: '1px solid var(--borderColor-default)',
            backgroundColor: 'var(--bgColor-default)',
          }}
        />
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="primary"
          size="small"
          onClick={() => {
            void handleSave()
          }}
          disabled={controlsDisabled}
          aria-busy={saving}
        >
          {saving ? <Spinner size="small" /> : saveLabel}
        </Button>
        <Button variant="default" size="small" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
      </div>
    </div>
  )
}