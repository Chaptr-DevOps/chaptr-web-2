/** A single bullet note on the chapter completion page. */
export type ChapterNote = {
  id: string
  content: string
  /** True while an optimistic insert is still awaiting its real row id. */
  pending?: boolean
}
