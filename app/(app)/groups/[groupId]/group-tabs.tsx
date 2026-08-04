'use client'

import { useState, useTransition, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Megaphone,
  BookMarked,
  Plus,
  Trash2,
  Edit2,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  Check,
  Calendar,
  Clock,
  Loader2,
  Send,
  Search,
  BookOpen,
  X,
  FileText
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { BookCover } from '@/components/book-cover'
import { cn } from '@/lib/utils'
import {
  GroupAnnouncement,
  AnnouncementComment,
  GroupBookListItem,
  getGroupAnnouncements,
  createGroupAnnouncement,
  updateGroupAnnouncementContent,
  deleteGroupAnnouncement,
  getAnnouncementComments,
  addAnnouncementComment,
  deleteAnnouncementComment,
  getGroupBookList,
  addGroupBookListItem,
  removeGroupBookListItem,
  updateGroupBookListItem
} from './group-actions'

interface GroupTabsProps {
  groupId: string
  userId: string
  isAdmin: boolean
  isOwner: boolean
  isMember: boolean
  initialAnnouncements: GroupAnnouncement[]
  initialBookList: GroupBookListItem[]
}

interface SearchHit {
  title: string
  author: string
  pages: number | null
  cover: string | null
}

export function GroupTabs({
  groupId,
  userId,
  isAdmin,
  isOwner,
  isMember,
  initialAnnouncements,
  initialBookList
}: GroupTabsProps) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'announcements' | 'booklist'>('announcements')
  const [isPending, startTransition] = useTransition()

  const canManage = isAdmin || isOwner

  // --- Announcements State ---
  const [announcements, setAnnouncements] = useState<GroupAnnouncement[]>(initialAnnouncements)
  const [expandedComments, setExpandedComments] = useState<Record<string, boolean>>({})
  const [commentsMap, setCommentsMap] = useState<Record<string, AnnouncementComment[]>>({})
  const [commentsLoading, setCommentsLoading] = useState<Record<string, boolean>>({})
  const [newCommentText, setNewCommentText] = useState<Record<string, string>>({})
  
  // Creation state
  const [isCreatingAnn, setIsCreatingAnn] = useState(false)
  const [annTitle, setAnnTitle] = useState('')
  const [annContent, setAnnContent] = useState('')
  const [annAllowComments, setAnnAllowComments] = useState(true)
  const [annError, setAnnError] = useState('')

  // Editing state
  const [editingAnnId, setEditingAnnId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editContent, setEditContent] = useState('')
  const [editAllowComments, setEditAllowComments] = useState(true)

  // --- Book List State ---
  const [bookList, setBookList] = useState<GroupBookListItem[]>(initialBookList)
  const [bookListFilter, setBookListFilter] = useState<'all' | 'reading' | 'completed' | 'upcoming'>('all')
  const [editingBookId, setEditingBookId] = useState<string | null>(null)
  const [editBookNote, setEditBookNote] = useState('')
  const [editBookStatus, setEditBookStatus] = useState<'reading' | 'completed' | 'upcoming'>('upcoming')

  // Search state for adding books
  const [isAddingBook, setIsAddingBook] = useState(false)
  const [bookQuery, setBookQuery] = useState('')
  const [bookResults, setBookResults] = useState<SearchHit[]>([])
  const [searchingBooks, setSearchingBooks] = useState(false)
  const [customBookMode, setCustomBookMode] = useState(false)
  const [newBookNote, setNewBookNote] = useState('')
  const [newBookStatus, setNewBookStatus] = useState<'reading' | 'completed' | 'upcoming'>('upcoming')

  // Custom book manual entry
  const [customTitle, setCustomTitle] = useState('')
  const [customAuthor, setCustomAuthor] = useState('')
  const [customPages, setCustomPages] = useState('')
  const [customChapters, setCustomChapters] = useState('')

  // Synchronize when server props change
  useEffect(() => {
    setAnnouncements(initialAnnouncements)
  }, [initialAnnouncements])

  useEffect(() => {
    setBookList(initialBookList)
  }, [initialBookList])

  // --- Announcements Actions ---
  const handleCreateAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!annContent.trim()) return
    setAnnError('')

    startTransition(async () => {
      const res = await createGroupAnnouncement({
        groupId,
        userId,
        title: annTitle.trim() || undefined,
        content: annContent.trim(),
        allowComments: annAllowComments
      })

      if (res.error) {
        setAnnError(res.error)
      } else if (res.data) {
        setAnnouncements([res.data, ...announcements])
        setAnnTitle('')
        setAnnContent('')
        setAnnAllowComments(true)
        setIsCreatingAnn(false)
        router.refresh()
      }
    })
  }

  const handleStartEditAnnouncement = (ann: GroupAnnouncement) => {
    setEditingAnnId(ann.id)
    setEditTitle(ann.title || '')
    setEditContent(ann.content)
    setEditAllowComments(ann.allow_comments)
  }

  const handleUpdateAnnouncement = async (annId: string) => {
    if (!editContent.trim()) return

    startTransition(async () => {
      const res = await updateGroupAnnouncementContent(
        annId,
        editTitle.trim() || null,
        editContent.trim(),
        editAllowComments,
        groupId
      )

      if (res.error) {
        alert(res.error)
      } else if (res.data) {
        setAnnouncements(
          announcements.map((a) => (a.id === annId ? { ...a, ...res.data } : a))
        )
        setEditingAnnId(null)
        router.refresh()
      }
    })
  }

  const handleDeleteAnnouncement = async (annId: string) => {
    if (!confirm('Are you sure you want to delete this announcement?')) return

    startTransition(async () => {
      const res = await deleteGroupAnnouncement(annId, groupId)
      if (res.error) {
        alert(res.error)
      } else {
        setAnnouncements(announcements.filter((a) => a.id !== annId))
        router.refresh()
      }
    })
  }

  // --- Comments Actions ---
  const toggleComments = async (annId: string) => {
    const isExpanded = expandedComments[annId]
    setExpandedComments((prev) => ({ ...prev, [annId]: !isExpanded }))

    if (!isExpanded && !commentsMap[annId]) {
      // Fetch comments if expanding and not already loaded
      setCommentsLoading((prev) => ({ ...prev, [annId]: true }))
      const res = await getAnnouncementComments(annId)
      setCommentsLoading((prev) => ({ ...prev, [annId]: false }))

      if (res.data) {
        setCommentsMap((prev) => ({ ...prev, [annId]: res.data || [] }))
      }
    }
  }

  const handleAddComment = async (annId: string) => {
    const content = newCommentText[annId] || ''
    if (!content.trim()) return

    startTransition(async () => {
      const res = await addAnnouncementComment({
        announcementId: annId,
        userId,
        content: content.trim(),
        groupId
      })

      if (res.error) {
        alert(res.error)
      } else if (res.data) {
        setCommentsMap((prev) => ({
          ...prev,
          [annId]: [...(prev[annId] || []), res.data!]
        }))
        setNewCommentText((prev) => ({ ...prev, [annId]: '' }))
        
        // Increment comment count locally
        setAnnouncements(
          announcements.map((a) =>
            a.id === annId ? { ...a, comment_count: (a.comment_count || 0) + 1 } : a
          )
        )
        router.refresh()
      }
    })
  }

  const handleDeleteComment = async (annId: string, commentId: string) => {
    if (!confirm('Delete this comment?')) return

    startTransition(async () => {
      const res = await deleteAnnouncementComment(commentId, groupId)
      if (res.error) {
        alert(res.error)
      } else {
        setCommentsMap((prev) => ({
          ...prev,
          [annId]: (prev[annId] || []).filter((c) => c.id !== commentId)
        }))
        
        // Decrement comment count locally
        setAnnouncements(
          announcements.map((a) =>
            a.id === annId ? { ...a, comment_count: Math.max(0, (a.comment_count || 1) - 1) } : a
          )
        )
        router.refresh()
      }
    })
  }

  // --- Book List Actions ---
  const handleSearchBooks = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!bookQuery.trim()) return
    setSearchingBooks(true)
    try {
      const res = await fetch(
        `/api/books/search?q=${encodeURIComponent(bookQuery)}`
      )
      const json = await res.json()
      setBookResults((json.results ?? []).slice(0, 5))
    } catch (err) {
      console.error(err)
      setBookResults([])
    } finally {
      setSearchingBooks(false)
    }
  }

  const handleAddSelectedBook = async (hit: SearchHit) => {
    startTransition(async () => {
      const res = await addGroupBookListItem({
        group_id: groupId,
        book: {
          title: hit.title,
          author: hit.author,
          total_pages: hit.pages ?? undefined,
          cover_image_url: hit.cover ?? undefined,
          total_chapters: hit.pages ? Math.max(1, Math.ceil(hit.pages / 20)) : 10
        },
        status: newBookStatus,
        note: newBookNote.trim() || undefined
      })

      if (res.error) {
        alert(res.error)
      } else if (res.data) {
        setBookList([res.data, ...bookList])
        setIsAddingBook(false)
        setBookQuery('')
        setBookResults([])
        setNewBookNote('')
        setNewBookStatus('upcoming')
        router.refresh()
      }
    })
  }

  const handleAddCustomBook = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!customTitle.trim()) return

    startTransition(async () => {
      const res = await addGroupBookListItem({
        group_id: groupId,
        book: {
          title: customTitle.trim(),
          author: customAuthor.trim() || undefined,
          total_pages: customPages ? Number(customPages) : undefined,
          total_chapters: customChapters ? Number(customChapters) : undefined
        },
        status: newBookStatus,
        note: newBookNote.trim() || undefined
      })

      if (res.error) {
        alert(res.error)
      } else if (res.data) {
        setBookList([res.data, ...bookList])
        setIsAddingBook(false)
        setCustomTitle('')
        setCustomAuthor('')
        setCustomPages('')
        setCustomChapters('')
        setNewBookNote('')
        setNewBookStatus('upcoming')
        setCustomBookMode(false)
        router.refresh()
      }
    })
  }

  const handleStartEditBook = (item: GroupBookListItem) => {
    setEditingBookId(item.id)
    setEditBookNote(item.note || '')
    setEditBookStatus(item.status)
  }

  const handleUpdateBookItem = async (itemId: string) => {
    startTransition(async () => {
      const res = await updateGroupBookListItem(
        itemId,
        {
          status: editBookStatus,
          note: editBookNote.trim() || null
        },
        groupId
      )

      if (res.error) {
        alert(res.error)
      } else {
        setBookList(
          bookList.map((b) =>
            b.id === itemId
              ? { ...b, status: editBookStatus, note: editBookNote.trim() || undefined }
              : b
          )
        )
        setEditingBookId(null)
        router.refresh()
      }
    })
  }

  const handleRemoveBookItem = async (itemId: string) => {
    if (!confirm('Remove this book from the list?')) return

    startTransition(async () => {
      const res = await removeGroupBookListItem(itemId, groupId)
      if (res.error) {
        alert(res.error)
      } else {
        setBookList(bookList.filter((b) => b.id !== itemId))
        router.refresh()
      }
    })
  }

  const filteredBookList = bookList.filter((b) => {
    if (bookListFilter === 'all') return true
    return b.status === bookListFilter
  })

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr)
      return date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    } catch {
      return ''
    }
  }

  return (
    <div className="space-y-6">
      {/* Tab Selectors */}
      <div className="flex border-b border-[var(--border-main)] gap-6">
        <button
          onClick={() => setActiveTab('announcements')}
          className={cn(
            'pb-3 text-sm font-semibold transition-all relative flex items-center border-b-2 cursor-pointer',
            activeTab === 'announcements'
              ? 'text-primary border-primary'
              : 'text-[var(--text-secondary)] border-transparent hover:text-[var(--text-primary)]'
          )}
        >
          <Megaphone className="h-4 w-4 mr-2" />
          Announcements
          <span
            className={cn(
              'ml-2 rounded-full px-2 py-0.5 text-xs font-medium',
              activeTab === 'announcements'
                ? 'bg-primary/10 text-primary'
                : 'bg-[var(--surface-elevated)] text-[var(--text-secondary)]'
            )}
          >
            {announcements.length}
          </span>
        </button>
        <button
          onClick={() => setActiveTab('booklist')}
          className={cn(
            'pb-3 text-sm font-semibold transition-all relative flex items-center border-b-2 cursor-pointer',
            activeTab === 'booklist'
              ? 'text-primary border-primary'
              : 'text-[var(--text-secondary)] border-transparent hover:text-[var(--text-primary)]'
          )}
        >
          <BookMarked className="h-4 w-4 mr-2" />
          Book List
          <span
            className={cn(
              'ml-2 rounded-full px-2 py-0.5 text-xs font-medium',
              activeTab === 'booklist'
                ? 'bg-primary/10 text-primary'
                : 'bg-[var(--surface-elevated)] text-[var(--text-secondary)]'
            )}
          >
            {bookList.length}
          </span>
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'announcements' ? (
        <div className="space-y-4">
          {/* Create Announcement Action */}
          {isMember && (
            <div className="flex justify-between items-center">
              <h3 className="font-serif text-lg font-bold text-[var(--text-primary)]">
                Announcements
              </h3>
              {(!isCreatingAnn && canManage) && (
                <Button size="sm" onClick={() => setIsCreatingAnn(true)}>
                  <Plus className="mr-1.5 h-4 w-4" /> Post Announcement
                </Button>
              )}
            </div>
          )}

          {isCreatingAnn && (
            <Card className="p-5 border-[var(--border-main)] relative animate-in fade-in slide-in-from-top-2 duration-200">
              <button
                onClick={() => setIsCreatingAnn(false)}
                className="absolute top-4 right-4 text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
              >
                <X className="h-5 w-5" />
              </button>
              <h4 className="font-serif font-semibold text-[var(--text-primary)] mb-4">
                Post New Announcement
              </h4>
              <form onSubmit={handleCreateAnnouncement} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="ann-title">Title (Optional)</Label>
                  <Input
                    id="ann-title"
                    placeholder="e.g. Next group meeting details"
                    value={annTitle}
                    onChange={(e) => setAnnTitle(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ann-content">Content *</Label>
                  <textarea
                    id="ann-content"
                    required
                    rows={4}
                    placeholder="Write your announcement content here..."
                    className="w-full rounded-xl border border-[var(--border-main)] bg-[var(--surface)] p-3 text-sm focus:border-primary/50 focus:outline-none text-[var(--text-primary)] resize-y"
                    value={annContent}
                    onChange={(e) => setAnnContent(e.target.value)}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="allow-comments"
                    checked={annAllowComments}
                    onChange={(e) => setAnnAllowComments(e.target.checked)}
                    className="h-4 w-4 rounded border-[var(--border-main)] text-primary focus:ring-primary/30"
                  />
                  <Label htmlFor="allow-comments" className="cursor-pointer font-normal text-sm text-[var(--text-secondary)]">
                    Allow comments on this announcement
                  </Label>
                </div>

                {annError && <p className="text-xs text-[var(--error)]">{annError}</p>}

                <div className="flex gap-2 justify-end">
                  <Button type="button" variant="outline" size="sm" onClick={() => setIsCreatingAnn(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" size="sm" disabled={isPending || !annContent.trim()}>
                    {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                    Post
                  </Button>
                </div>
              </form>
            </Card>
          )}

          {/* Announcements List */}
          {announcements.length === 0 ? (
            <Card className="flex flex-col items-center justify-center p-12 text-center border-dashed">
              <Megaphone className="h-8 w-8 text-[var(--text-tertiary)] mb-3" />
              <h3 className="font-serif text-lg font-medium text-[var(--text-primary)] mb-1">
                No Announcements Yet
              </h3>
              <p className="text-sm text-[var(--text-secondary)] max-w-xl">
                Important club updates and discussions will appear here.
              </p>
            </Card>
          ) : (
            <div className="space-y-4">
              {announcements.map((ann) => {
                const isEditing = editingAnnId === ann.id
                const isCreator = ann.user_id === userId
                const canDelete = isCreator || canManage
                const commentsExpanded = expandedComments[ann.id] || false
                const comments = commentsMap[ann.id] || []
                const commentsLoadingState = commentsLoading[ann.id] || false

                return (
                  <Card key={ann.id} className="p-5 space-y-4 transition-all">
                    {/* User Header */}
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-sm">
                          {(ann.user?.display_name ?? ann.user?.username ?? '?')[0].toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-[var(--text-primary)]">
                            {ann.user?.display_name ?? ann.user?.username}
                          </p>
                          <div className="flex items-center gap-2 text-xs text-[var(--text-tertiary)]">
                            <span>@{ann.user?.username}</span>
                            <span>·</span>
                            <span>{formatDate(ann.created_at)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Management actions */}
                      {!isEditing && (isCreator || canManage) && (
                        <div className="flex gap-2">
                          {isCreator && (
                            <button
                              onClick={() => handleStartEditAnnouncement(ann)}
                              className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-primary hover:bg-[var(--surface-elevated)] transition-colors"
                              title="Edit Announcement"
                            >
                              <Edit2 className="h-4 w-4" />
                            </button>
                          )}
                          {canDelete && (
                            <button
                              onClick={() => handleDeleteAnnouncement(ann.id)}
                              className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--error)] hover:bg-[var(--surface-elevated)] transition-colors"
                              title="Delete Announcement"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Content Section */}
                    {isEditing ? (
                      <div className="space-y-3 pt-2">
                        <div className="space-y-1">
                          <Label htmlFor={`edit-title-${ann.id}`}>Title</Label>
                          <Input
                            id={`edit-title-${ann.id}`}
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor={`edit-content-${ann.id}`}>Content</Label>
                          <textarea
                            id={`edit-content-${ann.id}`}
                            rows={3}
                            className="w-full rounded-xl border border-[var(--border-main)] bg-[var(--surface)] p-3 text-sm focus:border-primary/50 focus:outline-none text-[var(--text-primary)] resize-y"
                            value={editContent}
                            onChange={(e) => setEditContent(e.target.value)}
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id={`edit-allow-comments-${ann.id}`}
                            checked={editAllowComments}
                            onChange={(e) => setEditAllowComments(e.target.checked)}
                            className="h-4 w-4 rounded border-[var(--border-main)] text-primary"
                          />
                          <Label htmlFor={`edit-allow-comments-${ann.id}`} className="font-normal text-sm">
                            Allow comments
                          </Label>
                        </div>
                        <div className="flex gap-2 justify-end">
                          <Button size="sm" variant="outline" onClick={() => setEditingAnnId(null)}>
                            Cancel
                          </Button>
                          <Button size="sm" onClick={() => handleUpdateAnnouncement(ann.id)} disabled={isPending}>
                            Save Changes
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {ann.title && (
                          <h4 className="font-serif text-lg font-bold text-[var(--text-primary)]">
                            {ann.title}
                          </h4>
                        )}
                        <p className="text-sm text-[var(--text-secondary)] whitespace-pre-wrap leading-relaxed">
                          {ann.content}
                        </p>
                      </div>
                    )}

                    {/* Footer Actions / Comments toggle */}
                    {!isEditing && (
                      <div className="pt-2 border-t border-[var(--border-main)] flex items-center justify-between">
                        <button
                          onClick={() => toggleComments(ann.id)}
                          className="flex items-center gap-2 text-xs font-semibold text-[var(--text-secondary)] hover:text-primary transition-colors cursor-pointer"
                        >
                          <MessageSquare className="h-4 w-4" />
                          <span>
                            {ann.comment_count || 0} {ann.comment_count === 1 ? 'Comment' : 'Comments'}
                          </span>
                          {commentsExpanded ? (
                            <ChevronUp className="h-3 w-3" />
                          ) : (
                            <ChevronDown className="h-3 w-3" />
                          )}
                        </button>

                        {!ann.allow_comments && (
                          <span className="text-xs text-[var(--text-tertiary)] italic">
                            Comments disabled
                          </span>
                        )}
                      </div>
                    )}

                    {/* Comments Area */}
                    {commentsExpanded && !isEditing && (
                      <div className="mt-3 pl-4 border-l-2 border-[var(--border-main)] space-y-3 pt-2">
                        {commentsLoadingState ? (
                          <div className="flex justify-center py-2">
                            <Loader2 className="h-5 w-5 animate-spin text-[var(--text-tertiary)]" />
                          </div>
                        ) : (
                          <>
                            {comments.map((comm) => (
                              <div key={comm.id} className="group relative flex gap-3 text-sm py-1.5">
                                <div className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-xs">
                                  {(comm.user?.display_name ?? comm.user?.username ?? '?')[0].toUpperCase()}
                                </div>
                                <div className="flex-1 space-y-0.5">
                                  <div className="flex items-center justify-between">
                                    <span className="font-semibold text-xs text-[var(--text-primary)]">
                                      {comm.user?.display_name ?? comm.user?.username}
                                    </span>
                                    <div className="flex items-center gap-2">
                                      <span className="text-[10px] text-[var(--text-tertiary)]">
                                        {formatDate(comm.created_at)}
                                      </span>
                                      {(comm.user_id === userId || canManage) && (
                                        <button
                                          onClick={() => handleDeleteComment(ann.id, comm.id)}
                                          className="text-[var(--text-tertiary)] hover:text-[var(--error)] opacity-0 group-hover:opacity-100 transition-opacity p-0.5"
                                          title="Delete Comment"
                                        >
                                          <Trash2 className="h-3 w-3" />
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                  <p className="text-sm text-[var(--text-secondary)] whitespace-pre-wrap leading-snug">
                                    {comm.content}
                                  </p>
                                </div>
                              </div>
                            ))}

                            {comments.length === 0 && (
                              <p className="text-xs text-[var(--text-tertiary)] italic py-1">
                                No comments yet.
                              </p>
                            )}

                            {/* Add comment input */}
                            {ann.allow_comments && isMember && (
                              <div className="flex items-center gap-2 mt-2 pt-2 border-t border-[var(--border-main)]/50">
                                <Input
                                  placeholder="Write a comment..."
                                  value={newCommentText[ann.id] || ''}
                                  onChange={(e) =>
                                    setNewCommentText((prev) => ({
                                      ...prev,
                                      [ann.id]: e.target.value
                                    }))
                                  }
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault()
                                      handleAddComment(ann.id)
                                    }
                                  }}
                                  className="flex-1 h-9 px-3 text-xs"
                                />
                                <Button
                                  size="sm"
                                  className="px-3"
                                  onClick={() => handleAddComment(ann.id)}
                                  disabled={isPending || !(newCommentText[ann.id] || '').trim()}
                                >
                                  {isPending ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <Send className="h-3.5 w-3.5" />
                                  )}
                                </Button>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Book List Header & Controls */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <h3 className="font-serif text-lg font-bold text-[var(--text-primary)]">
                Club Book List
              </h3>
            </div>
            
            <div className="flex gap-2 items-center flex-wrap">
              {/* Shelf filter */}
              <div className="flex rounded-lg border border-[var(--border-main)] p-0.5 bg-[var(--surface-elevated)] text-[var(--text-secondary)]">
                {(['all', 'upcoming', 'reading', 'completed'] as const).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setBookListFilter(filter)}
                    className={cn(
                      'px-2.5 py-1 rounded-md text-xs font-medium capitalize transition-all cursor-pointer',
                      bookListFilter === filter
                        ? 'bg-[var(--surface)] text-[var(--text-primary)] shadow-sm font-semibold'
                        : 'hover:text-[var(--text-primary)]'
                    )}
                  >
                    {filter === 'all' ? 'All' : filter}
                  </button>
                ))}
              </div>

              {isMember && !isAddingBook && (
                <Button size="sm" onClick={() => setIsAddingBook(true)}>
                  <Plus className="mr-1.5 h-4 w-4" /> Add Book
                </Button>
              )}
            </div>
          </div>

          {/* Add Book Panel */}
          {isAddingBook && (
            <Card className="p-5 border-[var(--border-main)] relative animate-in fade-in slide-in-from-top-2 duration-200">
              <button
                onClick={() => {
                  setIsAddingBook(false)
                  setBookQuery('')
                  setBookResults([])
                  setCustomBookMode(false)
                }}
                className="absolute top-4 right-4 text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
              >
                <X className="h-5 w-5" />
              </button>
              
              <h4 className="font-serif font-semibold text-[var(--text-primary)] mb-4">
                {customBookMode ? 'Add Book Manually' : 'Search and Add Book'}
              </h4>

              {/* Status and note setup for new book */}
              <div className="grid sm:grid-cols-2 gap-4 mb-4">
                <div className="space-y-1.5">
                  <Label>Status</Label>
                  <div className="flex gap-2">
                    {(['upcoming', 'reading', 'completed'] as const).map((status) => (
                      <button
                        key={status}
                        type="button"
                        onClick={() => setNewBookStatus(status)}
                        className={cn(
                          'flex-1 rounded-lg border py-2 text-xs font-semibold capitalize transition-all',
                          newBookStatus === status
                            ? 'border-primary bg-primary text-[var(--interactive-primary-foreground)]'
                            : 'border-[var(--border-main)] text-[var(--text-secondary)] hover:bg-[var(--surface-elevated)]'
                        )}
                      >
                        {status}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="new-book-note">Note / Recommendation (Optional)</Label>
                  <Input
                    id="new-book-note"
                    placeholder="e.g. Recommended for next month discussion"
                    value={newBookNote}
                    onChange={(e) => setNewBookNote(e.target.value)}
                  />
                </div>
              </div>

              {!customBookMode ? (
                <div className="space-y-4">
                  <form onSubmit={handleSearchBooks} className="relative">
                    <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-tertiary)]" />
                    <input
                      type="text"
                      value={bookQuery}
                      onChange={(e) => setBookQuery(e.target.value)}
                      placeholder="Search OpenLibrary by title, author..."
                      className="w-full rounded-xl border border-[var(--border-main)] bg-[var(--surface)] pl-11 pr-4 py-3 text-sm focus:border-primary/50 focus:outline-none text-[var(--text-primary)]"
                    />
                    <Button
                      type="submit"
                      size="sm"
                      className="absolute right-2 top-1/2 -translate-y-1/2"
                      disabled={searchingBooks}
                    >
                      {searchingBooks ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        'Search'
                      )}
                    </Button>
                  </form>

                  {/* Results */}
                  {bookResults.length > 0 && (
                    <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                      {bookResults.map((hit, idx) => (
                        <Card key={idx} className="flex gap-4 p-3 hover:border-primary/30 transition-colors">
                          <div className="w-12 shrink-0">
                            <BookCover title={hit.title} author={hit.author} src={hit.cover} />
                          </div>
                          <div className="flex-1 min-w-0 flex flex-col justify-between">
                            <div>
                              <h5 className="font-serif font-bold text-sm text-[var(--text-primary)] line-clamp-1">
                                {hit.title}
                              </h5>
                              <p className="text-xs text-[var(--text-secondary)] truncate">
                                {hit.author}
                              </p>
                              {hit.pages && (
                                <p className="text-[10px] text-[var(--text-tertiary)] mt-0.5">
                                  ~{hit.pages} pages
                                </p>
                              )}
                            </div>
                            <Button
                              size="sm"
                              className="w-max mt-1"
                              onClick={() => handleAddSelectedBook(hit)}
                              disabled={isPending}
                            >
                              Add Book
                            </Button>
                          </div>
                        </Card>
                      ))}
                    </div>
                  )}

                  <div className="text-center pt-2">
                    <p className="text-xs text-[var(--text-secondary)] mb-2">Can't find the book?</p>
                    <Button type="button" variant="outline" size="sm" onClick={() => setCustomBookMode(true)}>
                      Register book manually
                    </Button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleAddCustomBook} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="custom-title">Book Title *</Label>
                    <Input
                      id="custom-title"
                      required
                      value={customTitle}
                      onChange={(e) => setCustomTitle(e.target.value)}
                      placeholder="e.g. The Hobbit"
                    />
                  </div>
                  
                  <div className="space-y-1.5">
                    <Label htmlFor="custom-author">Author Name</Label>
                    <Input
                      id="custom-author"
                      value={customAuthor}
                      onChange={(e) => setCustomAuthor(e.target.value)}
                      placeholder="e.g. J.R.R. Tolkien"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="custom-pages">Total Pages</Label>
                      <Input
                        id="custom-pages"
                        type="number"
                        min={1}
                        value={customPages}
                        onChange={(e) => setCustomPages(e.target.value)}
                        placeholder="310"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="custom-chapters">Total Chapters</Label>
                      <Input
                        id="custom-chapters"
                        type="number"
                        min={1}
                        value={customChapters}
                        onChange={(e) => setCustomChapters(e.target.value)}
                        placeholder="19"
                      />
                    </div>
                  </div>

                  <div className="flex gap-2 justify-end pt-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => setCustomBookMode(false)}>
                      Back to Search
                    </Button>
                    <Button type="submit" size="sm" disabled={isPending || !customTitle.trim()}>
                      Save & Add Book
                    </Button>
                  </div>
                </form>
              )}
            </Card>
          )}

          {/* Book List Items */}
          {filteredBookList.length === 0 ? (
            <Card className="flex flex-col items-center justify-center p-12 text-center border-dashed">
              <BookMarked className="h-8 w-8 text-[var(--text-tertiary)] mb-3" />
              <h3 className="font-serif text-lg font-medium text-[var(--text-primary)] mb-1">
                No Books Found
              </h3>
              <p className="text-sm text-[var(--text-secondary)] max-w-xl">
                {bookListFilter !== 'all'
                  ? `There are no books marked as "${bookListFilter}".`
                  : 'Add books to the club list to recommend upcoming readings or track finished books.'}
              </p>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {filteredBookList.map((item) => {
                const isEditing = editingBookId === item.id
                const canEditItem = isMember // let all members edit status/notes if they want, or restrict to creator/admin. Let's restrict to admins or the person who added it if wanted, but simpler: let admins/owners edit anything, members edit status.
                
                return (
                  <Card key={item.id} className="p-4 flex gap-4 relative group/item">
                    <div className="w-16 shrink-0">
                      <BookCover
                        title={item.book.title}
                        author={item.book.author}
                        src={item.book.cover_image_url}
                      />
                    </div>
                    
                    <div className="flex-1 flex flex-col justify-between min-w-0">
                      <div className="space-y-1">
                        <div className="flex justify-between items-start gap-2">
                          <h4 className="font-serif font-bold text-base text-[var(--text-primary)] line-clamp-1">
                            {item.book.title}
                          </h4>
                          <span
                            className={cn(
                              'px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wider uppercase border shrink-0',
                              item.status === 'reading'
                                ? 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-900/50'
                                : item.status === 'completed'
                                ? 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-900/50'
                                : 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-900/50'
                            )}
                          >
                            {item.status}
                          </span>
                        </div>
                        <p className="text-xs text-[var(--text-secondary)] truncate">
                          by {item.book.author || 'Unknown'}
                        </p>
                        
                        {isEditing ? (
                          <div className="space-y-2 pt-1.5 animate-in fade-in duration-100">
                            <div className="space-y-1">
                              <Label className="text-[10px] uppercase font-bold text-[var(--text-tertiary)]">Status</Label>
                              <div className="flex gap-1">
                                {(['upcoming', 'reading', 'completed'] as const).map((status) => (
                                  <button
                                    key={status}
                                    type="button"
                                    onClick={() => setEditBookStatus(status)}
                                    className={cn(
                                      'flex-1 rounded py-1 text-[10px] font-semibold capitalize border transition-all',
                                      editBookStatus === status
                                        ? 'border-primary bg-primary text-[var(--interactive-primary-foreground)]'
                                        : 'border-[var(--border-main)] text-[var(--text-secondary)] hover:bg-[var(--surface-elevated)]'
                                    )}
                                  >
                                    {status}
                                  </button>
                                ))}
                              </div>
                            </div>
                            <div className="space-y-1">
                              <Label htmlFor={`edit-note-${item.id}`} className="text-[10px] uppercase font-bold text-[var(--text-tertiary)]">Note</Label>
                              <Input
                                id={`edit-note-${item.id}`}
                                className="h-7 text-xs"
                                value={editBookNote}
                                onChange={(e) => setEditBookNote(e.target.value)}
                              />
                            </div>
                            <div className="flex gap-1.5 justify-end">
                              <button
                                onClick={() => setEditingBookId(null)}
                                className="px-2 py-1 text-[10px] rounded border border-[var(--border-main)] hover:bg-[var(--surface-elevated)]"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={() => handleUpdateBookItem(item.id)}
                                className="px-2 py-1 text-[10px] rounded bg-primary text-[var(--interactive-primary-foreground)] font-semibold"
                              >
                                Save
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            {item.note && (
                              <p className="text-xs text-[var(--text-secondary)] bg-[var(--surface-elevated)]/60 rounded-lg p-2 mt-1 italic border border-[var(--border-main)]/50">
                                "{item.note}"
                              </p>
                            )}
                            <div className="text-[10px] text-[var(--text-tertiary)] flex items-center gap-1 mt-1.5">
                              <Calendar className="h-3 w-3" />
                              <span>Added {formatDate(item.added_at)}</span>
                            </div>
                          </>
                        )}
                      </div>

                      {/* Hover actions for admins or members */}
                      {!isEditing && isMember && (
                        <div className="mt-2 pt-2 border-t border-[var(--border-main)]/30 flex justify-end items-center gap-1.5 opacity-0 group-hover/item:opacity-100 transition-opacity">
                          {canManage && (
                            <button
                              onClick={() => handleStartEditBook(item)}
                              className="p-1 rounded text-[var(--text-secondary)] hover:text-primary hover:bg-[var(--surface-elevated)] transition-colors"
                              title="Edit item"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                          {canManage && (
                            <button
                              onClick={() => handleRemoveBookItem(item.id)}
                              className="p-1 rounded text-[var(--text-secondary)] hover:text-[var(--error)] hover:bg-[var(--surface-elevated)] transition-colors"
                              title="Remove book"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
