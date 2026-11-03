/**
 * Saving a file from the page.
 *
 * Part G's app writers drove the app from an automated browser, and the world
 * backup did nothing there: Chromium refuses the "Save as" picker at once with
 * the same AbortError a person's Cancel gives, and the export took it for one.
 * A browser under automation (`navigator.webdriver`) has nobody to answer the
 * picker, so it is not asked; the file is downloaded instead.
 */

/** Whether to ask where to save, with the File System Access picker. */
export function canAskWhereToSave(win: Window = window): boolean {
  return typeof (win as { showSaveFilePicker?: unknown }).showSaveFilePicker === 'function' && !win.navigator.webdriver
}

/**
 * Download `blob` as `filename`. The link is in the document while it is
 * clicked, and its URL is released a minute later rather than at once, so a
 * download that starts after the click still finds it.
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}
