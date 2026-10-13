import { useState, useEffect, useMemo, useCallback, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import {
  db,
  initDB,
  generateId,
  type Project,
  type ProjectStatus,
  type Draft,
  type ScreenplayDocument,
  DEFAULT_PAGE_FORMAT,
  CURRENT_SCHEMA_VERSION,
  type Timestamp,
  type EntityId,
} from '@/lib'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Plus,
  Search,
  Trash2,
  FileText,
  Clock,
  Sparkles,
  Layers,
  BookOpen,
  ArrowRight,
  Filter,
} from 'lucide-react'
import { cn } from 'cn'

const STATUS_CONFIG: Record<
  ProjectStatus,
  { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive'; badgeClass: string }
> = {
  concept: {
    label: 'Concept',
    variant: 'secondary',
    badgeClass: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
  },
  outline: {
    label: 'Outline',
    variant: 'secondary',
    badgeClass: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
  },
  drafting: {
    label: 'Drafting',
    variant: 'default',
    badgeClass: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
  },
  polishing: {
    label: 'Polishing',
    variant: 'secondary',
    badgeClass: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
  },
  production: {
    label: 'Production',
    variant: 'secondary',
    badgeClass: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20',
  },
  archived: {
    label: 'Archived',
    variant: 'outline',
    badgeClass: 'bg-muted text-muted-foreground border-border',
  },
}

interface ProjectWithStats extends Project {
  wordCount: number
  draftName?: string
}

export function ProjectsPage() {
  const navigate = useNavigate()
  const [projects, setProjects] = useState<ProjectWithStats[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  // Create Project Dialog State
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newLogline, setNewLogline] = useState('')
  const [newGenre, setNewGenre] = useState('Drama')
  const [newTargetLength, setNewTargetLength] = useState(110)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Delete Confirmation Dialog State
  const [projectToDelete, setProjectToDelete] = useState<ProjectWithStats | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // Load projects from Dexie DB
  const loadProjects = useCallback(async () => {
    try {
      setIsLoading(true)
      await initDB()

      const projectList = await db.projects.orderBy('updatedAt').reverse().toArray()

      // Fetch word count for each project from its current draft and screenplay
      const withStats: ProjectWithStats[] = await Promise.all(
        projectList.map(async (p) => {
          let words = 0
          let draftName = 'Draft 1'
          try {
            const currentDraft = await db.drafts
              .where('projectId')
              .equals(p.id)
              .and((d) => d.isCurrent)
              .first()

            if (currentDraft) {
              draftName = currentDraft.name
              const sp = await db.screenplays.where('draftId').equals(currentDraft.id).first()
              if (sp && sp.elements) {
                for (const el of sp.elements) {
                  const anyEl = el as unknown as Record<string, unknown>
                  if (typeof anyEl.text === 'string') {
                    words += anyEl.text.trim().split(/\s+/).filter(Boolean).length
                  }
                }
              }
            }
          } catch (e) {
            console.error('Error fetching stats for project', p.id, e)
          }

          return {
            ...p,
            wordCount: words,
            draftName,
          }
        })
      )

      setProjects(withStats)
    } catch (error) {
      console.error('[ProjectsPage] Failed to load projects:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadProjects()
  }, [loadProjects])

  // Filtered projects
  const filteredProjects = useMemo(() => {
    return projects.filter((p) => {
      const matchesSearch =
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.genre && p.genre.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (p.logline && p.logline.toLowerCase().includes(searchQuery.toLowerCase()))

      const matchesStatus =
        statusFilter === 'all' || p.status === statusFilter

      return matchesSearch && matchesStatus
    })
  }, [projects, searchQuery, statusFilter])

  // Handle Project Creation
  const handleCreateProject = async (e: FormEvent) => {
    e.preventDefault()
    if (!newTitle.trim()) return

    try {
      setIsSubmitting(true)
      const projectId = generateId()
      const draftId = generateId()
      const screenplayId = generateId()
      const now = Date.now() as Timestamp

      const project: Project = {
        id: projectId,
        name: newTitle.trim(),
        status: 'concept',
        logline: newLogline.trim() || undefined,
        genre: newGenre.trim() || undefined,
        targetLength: Number(newTargetLength) || 110,
        createdAt: now,
        updatedAt: now,
        settings: {
          pageFormat: DEFAULT_PAGE_FORMAT,
          autoSaveInterval: 2000,
          revisionTracking: true,
        },
      }

      const draft: Draft = {
        id: draftId,
        projectId,
        name: 'First Draft',
        isCurrent: true,
        screenplayId,
        createdAt: now,
        updatedAt: now,
      }

      const screenplay: ScreenplayDocument = {
        id: screenplayId,
        projectId,
        draftId,
        metadata: {
          title: newTitle.trim(),
          author: 'Screenplay Studio',
          draftDate: new Date().toISOString().split('T')[0],
        },
        elements: [],
        schemaVersion: CURRENT_SCHEMA_VERSION,
        createdAt: now,
        updatedAt: now,
      }

      await db.transaction('rw', [db.projects, db.drafts, db.screenplays], async () => {
        await db.projects.add(project)
        await db.drafts.add(draft)
        await db.screenplays.add(screenplay)
      })

      setIsCreateOpen(false)
      setNewTitle('')
      setNewLogline('')
      setNewGenre('Drama')
      setNewTargetLength(110)

      await loadProjects()

      // Navigate directly into new project
      navigate(`/project/${projectId}`)
    } catch (err) {
      console.error('[ProjectsPage] Failed to create project:', err)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Handle Delete Confirmation
  const handleDeleteProject = async () => {
    if (!projectToDelete) return

    try {
      setIsDeleting(true)
      const pid = projectToDelete.id

      await db.transaction(
        'rw',
        [
          db.projects,
          db.drafts,
          db.screenplays,
          db.characters,
          db.locations,
          db.props,
          db.notes,
          db.revisions,
          db.sceneCards,
          db.writingSessions,
          db.activityEvents,
        ],
        async () => {
          await db.projects.delete(pid)
          await db.drafts.where('projectId').equals(pid).delete()
          await db.screenplays.where('projectId').equals(pid).delete()
          await db.characters.where('projectId').equals(pid).delete()
          await db.locations.where('projectId').equals(pid).delete()
          await db.props.where('projectId').equals(pid).delete()
          await db.notes.where('projectId').equals(pid).delete()
          await db.revisions.where('projectId').equals(pid).delete()
          await db.sceneCards.where('projectId').equals(pid).delete()
          await db.writingSessions.where('projectId').equals(pid).delete()
          await db.activityEvents.where('projectId').equals(pid).delete()
        }
      )

      setProjectToDelete(null)
      await loadProjects()
    } catch (err) {
      console.error('[ProjectsPage] Failed to delete project:', err)
    } finally {
      setIsDeleting(false)
    }
  }

  // Quick Seed Demo Project
  const handleSeedDemoProject = async () => {
    const projectId = generateId()
    const draftId = generateId()
    const screenplayId = generateId()
    const now = Date.now() as Timestamp

    const sampleProject: Project = {
      id: projectId,
      name: 'The Midnight Heist',
      status: 'drafting',
      logline: 'An aging master thief is forced out of retirement for one final, impossible job in Tokyo.',
      genre: 'Thriller / Action',
      targetLength: 110,
      createdAt: now,
      updatedAt: now,
      settings: {
        pageFormat: DEFAULT_PAGE_FORMAT,
        autoSaveInterval: 2000,
        revisionTracking: true,
      },
    }

    const sampleDraft: Draft = {
      id: draftId,
      projectId,
      name: 'Working Draft',
      isCurrent: true,
      screenplayId,
      createdAt: now,
      updatedAt: now,
    }

    const sampleScreenplay: ScreenplayDocument = {
      id: screenplayId,
      projectId,
      draftId,
      metadata: {
        title: 'The Midnight Heist',
        author: 'Screenplay Studio',
      },
      elements: [
        {
          id: generateId(),
          type: 'scene-heading',
          interior: 'EXT',
          location: 'TOKYO SKYLINE',
          timeOfDay: 'NIGHT',
          createdAt: now,
          updatedAt: now,
          schemaVersion: CURRENT_SCHEMA_VERSION,
        },
        {
          id: generateId(),
          type: 'action',
          text: 'Rain lashes against obsidian skyscrapers. Neon reflections bleed through the wet streets below.',
          createdAt: now,
          updatedAt: now,
          schemaVersion: CURRENT_SCHEMA_VERSION,
        },
        {
          id: generateId(),
          type: 'character',
          name: 'KENJI',
          createdAt: now,
          updatedAt: now,
          schemaVersion: CURRENT_SCHEMA_VERSION,
        },
        {
          id: generateId(),
          type: 'dialogue',
          characterId: 'char_kenji' as EntityId,
          text: 'The grid goes dark in thirty seconds. Move.',
          createdAt: now,
          updatedAt: now,
          schemaVersion: CURRENT_SCHEMA_VERSION,
        },
      ],
      schemaVersion: CURRENT_SCHEMA_VERSION,
      createdAt: now,
      updatedAt: now,
    }

    await db.transaction('rw', [db.projects, db.drafts, db.screenplays], async () => {
      await db.projects.add(sampleProject)
      await db.drafts.add(sampleDraft)
      await db.screenplays.add(sampleScreenplay)
    })

    await loadProjects()
  }

  // Format relative date
  const formatLastEdited = (timestamp: number) => {
    const diff = Date.now() - timestamp
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'Just now'
    if (mins < 60) return `${mins}m ago`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    if (days < 30) return `${days}d ago`
    return new Date(timestamp).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-7 font-sans">
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            Projects
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Manage your screenplay library, outlines, and scripts.
          </p>
        </div>

        <Button
          onClick={() => setIsCreateOpen(true)}
          className="rounded-full bg-neutral-900 text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-100 px-4 h-9 gap-2 shadow-xs cursor-pointer font-medium self-start sm:self-auto text-xs"
        >
          <Plus className="w-4 h-4" />
          <span>New Screenplay</span>
        </Button>
      </div>

      {/* Search & Filter Bar (Apple Pill Style) */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search projects by title, genre, logline..."
            className="pl-10 w-full bg-card rounded-full border-black/[0.08] dark:border-white/[0.1] text-xs h-9"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-4 h-4 text-muted-foreground shrink-0 hidden sm:block" />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[160px] bg-card rounded-full border-black/[0.08] dark:border-white/[0.1] text-xs h-9">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="concept">Concept</SelectItem>
              <SelectItem value="outline">Outline</SelectItem>
              <SelectItem value="drafting">Drafting</SelectItem>
              <SelectItem value="polishing">Polishing</SelectItem>
              <SelectItem value="production">Production</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Projects Grid / Content Area */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse bg-muted/30 border-black/[0.05] dark:border-white/[0.06] rounded-2xl">
              <CardHeader className="space-y-2">
                <div className="h-5 bg-muted rounded-xl w-2/3" />
                <div className="h-4 bg-muted rounded-xl w-1/3" />
              </CardHeader>
              <CardContent className="h-20 bg-muted/20" />
              <CardFooter className="h-10 bg-muted/40" />
            </Card>
          ))}
        </div>
      ) : filteredProjects.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredProjects.map((project) => {
            const statusConfig = STATUS_CONFIG[project.status] || STATUS_CONFIG.concept

            return (
              <Card
                key={project.id}
                className="group relative flex flex-col justify-between rounded-2xl border border-black/[0.06] dark:border-white/[0.08] hover:border-black/[0.15] dark:hover:border-white/[0.2] transition-all hover:shadow-md hover:-translate-y-0.5 bg-card overflow-hidden"
              >
                <div>
                  <CardHeader className="pb-3 border-b border-black/[0.04] dark:border-white/[0.05]">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <CardTitle
                          className="text-base font-bold text-foreground truncate cursor-pointer hover:text-primary transition-colors"
                          onClick={() => navigate(`/project/${project.id}`)}
                        >
                          {project.name}
                        </CardTitle>
                        {project.genre && (
                          <CardDescription className="text-xs text-muted-foreground mt-0.5 truncate">
                            {project.genre}
                          </CardDescription>
                        )}
                      </div>

                      <Badge
                        variant={statusConfig.variant}
                        className={cn('shrink-0 border font-semibold rounded-full text-[10px] px-2.5 py-0.5', statusConfig.badgeClass)}
                      >
                        {statusConfig.label}
                      </Badge>
                    </div>
                  </CardHeader>

                  <CardContent className="py-3.5 space-y-3">
                    <p className="text-xs text-muted-foreground line-clamp-2 min-h-[2rem]">
                      {project.logline || 'No logline added yet. Click to open and begin writing.'}
                    </p>

                    <div className="grid grid-cols-2 gap-2 py-2 px-3 rounded-xl bg-neutral-50/70 dark:bg-neutral-800/40 border border-black/[0.04] dark:border-white/[0.05] text-xs">
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <FileText className="w-3.5 h-3.5 text-primary" />
                        <span>
                          <strong className="text-foreground">{project.wordCount.toLocaleString()}</strong> words
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Layers className="w-3.5 h-3.5 text-primary" />
                        <span>
                          Target: <strong className="text-foreground">{project.targetLength || 110}</strong> pgs
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </div>

                <CardFooter className="pt-3 border-t border-black/[0.04] dark:border-white/[0.05] flex items-center justify-between text-xs text-muted-foreground">
                  <div className="flex items-center gap-1.5 text-[11px]">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{formatLastEdited(project.updatedAt)}</span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={(e) => {
                        e.stopPropagation()
                        setProjectToDelete(project)
                      }}
                      className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-full w-7 h-7 p-0"
                      title="Delete project"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>

                    <Button
                      size="xs"
                      onClick={() => navigate(`/project/${project.id}`)}
                      className="gap-1 font-semibold rounded-full px-3 text-xs h-7 bg-neutral-900 text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-900 shadow-2xs"
                    >
                      <span>Open</span>
                      <ArrowRight className="w-3 h-3" />
                    </Button>
                  </div>
                </CardFooter>
              </Card>
            )
          })}
        </div>
      ) : (
        /* Empty State */
        <div className="text-center py-16 px-4 border border-dashed border-border rounded-2xl bg-card/40">
          <div className="mx-auto flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 text-primary mb-4">
            <BookOpen className="w-7 h-7" />
          </div>

          <h3 className="text-lg font-bold text-foreground">
            {searchQuery || statusFilter !== 'all' ? 'No matching screenplays found' : 'No screenplays yet'}
          </h3>

          <p className="text-sm text-muted-foreground max-w-md mx-auto mt-1.5 mb-6">
            {searchQuery || statusFilter !== 'all'
              ? 'Try clearing your search query or status filter to see other projects.'
              : 'Every great movie starts with a blank page. Create your first project or load a sample screenplay.'}
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3">
            {searchQuery || statusFilter !== 'all' ? (
              <Button
                variant="outline"
                onClick={() => {
                  setSearchQuery('')
                  setStatusFilter('all')
                }}
              >
                Clear Filters
              </Button>
            ) : (
              <>
                <Button onClick={() => setIsCreateOpen(true)} className="gap-2">
                  <Plus className="w-4 h-4" />
                  <span>Create Screenplay</span>
                </Button>
                <Button variant="outline" onClick={handleSeedDemoProject} className="gap-2">
                  <Sparkles className="w-4 h-4" />
                  <span>Load Sample Project</span>
                </Button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Create Project Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleCreateProject}>
            <DialogHeader>
              <DialogTitle>New Screenplay Project</DialogTitle>
              <DialogDescription>
                Set up your project details to begin your writing journey.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Project Title *</label>
                <Input
                  required
                  placeholder="e.g. Chinatown, Inception, Lady Bird"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  autoFocus
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Logline</label>
                <textarea
                  className="w-full h-20 rounded-lg border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 outline-none transition-all dark:bg-input/30"
                  placeholder="A one-sentence summary of the core premise and protagonist journey..."
                  value={newLogline}
                  onChange={(e) => setNewLogline(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Genre</label>
                  <Select value={newGenre} onValueChange={setNewGenre}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Genre" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Action">Action</SelectItem>
                      <SelectItem value="Comedy">Comedy</SelectItem>
                      <SelectItem value="Drama">Drama</SelectItem>
                      <SelectItem value="Horror">Horror</SelectItem>
                      <SelectItem value="Sci-Fi">Sci-Fi</SelectItem>
                      <SelectItem value="Thriller">Thriller</SelectItem>
                      <SelectItem value="Romance">Romance</SelectItem>
                      <SelectItem value="Animation">Animation</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Target Pages</label>
                  <Input
                    type="number"
                    min={1}
                    max={500}
                    value={newTargetLength}
                    onChange={(e) => setNewTargetLength(Number(e.target.value))}
                  />
                </div>
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCreateOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting || !newTitle.trim()}>
                {isSubmitting ? 'Creating...' : 'Create Project'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={!!projectToDelete}
        onOpenChange={(open: boolean) => !open && setProjectToDelete(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <Trash2 className="w-5 h-5" />
              <span>Delete Screenplay?</span>
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete{' '}
              <strong className="text-foreground">{projectToDelete?.name}</strong>? All drafts,
              characters, and writing history will be permanently deleted from local storage.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="gap-2 sm:gap-0 mt-4">
            <Button
              variant="outline"
              onClick={() => setProjectToDelete(null)}
              disabled={isDeleting}
            >
              Keep Screenplay
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteProject}
              disabled={isDeleting}
            >
              {isDeleting ? 'Deleting...' : 'Delete Permanently'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
