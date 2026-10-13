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
    <div className="relative p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-8 font-matter overflow-hidden">
      {/* Sarvam Signature Hero Gradient Glow (from image.png) */}
      <div
        className="absolute -top-20 left-1/2 -translate-x-1/2 -z-10 w-[95%] max-w-5xl h-80 pointer-events-none opacity-35 dark:opacity-15 blur-[90px] rounded-full"
        style={{
          background: 'radial-gradient(ellipse, #FF8A34 0%, #FFA24C 25%, #C7D2FE 55%, transparent 75%)',
        }}
        aria-hidden="true"
      />

      {/* Hero Header Area (matching image.png aesthetic) */}
      <div className="flex flex-col items-center text-center space-y-4 pt-4 pb-2">
        {/* Motif hairline divider */}
        <div className="flex flex-col items-center gap-2 w-full max-w-md mx-auto">
          <div className="w-full h-px" style={{ background: 'radial-gradient(circle, #6a88e2 0%, transparent 100%)' }} />
          <p className="px-6 font-matter text-sr-indigo-900 dark:text-sr-indigo-300 text-xs sm:text-sm font-semibold tracking-wider uppercase">
            India's Sovereign Screenplay Studio
          </p>
          <div className="w-full h-px" style={{ background: 'radial-gradient(circle, #6a88e2 0%, transparent 100%)' }} />
        </div>

        <h1 className="font-season-mix text-3xl sm:text-5xl md:text-6xl text-tx leading-[1.08] tracking-tight max-w-3xl">
          Stories Crafted for the Big Screen
        </h1>

        <p className="font-matter text-tx-secondary text-sm sm:text-base max-w-2xl leading-relaxed">
          Distraction-free offline screenwriting backed by Dexie IndexedDB, with real-time cloud backups to Google Drive.
        </p>

        {/* Hero Action Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <Button
            onClick={() => setIsCreateOpen(true)}
            className="btn-sarvam-dark px-6 py-2.5 h-10 gap-2 cursor-pointer font-medium text-sm shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>New Screenplay</span>
          </Button>

          <Button
            variant="outline"
            onClick={handleSeedDemoProject}
            className="btn-sarvam-light px-5 py-2.5 h-10 gap-2 cursor-pointer font-medium text-sm"
          >
            <Sparkles className="w-4 h-4 text-sr-orange-500" />
            <span>Load Demo Screenplay</span>
          </Button>
        </div>
      </div>

      {/* Search & Filter Bar (Sarvam Pill Style) */}
      <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-tx-tertiary" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search projects by title, genre, logline..."
            className="pl-10 w-full bg-white dark:bg-[#141728] rounded-full border-st text-xs h-10 font-matter focus-visible:ring-sr-indigo-600 shadow-2xs"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-4 h-4 text-tx-tertiary shrink-0 hidden sm:block" />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[170px] bg-white dark:bg-[#141728] rounded-full border-st text-xs h-10 font-matter shadow-2xs">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent className="rounded-2xl border-st font-matter">
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
            <Card key={i} className="animate-pulse bg-sf-secondary/50 border-st rounded-2xl">
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
                className="group relative flex flex-col justify-between rounded-2xl border border-st bg-white/95 dark:bg-[#141728]/95 backdrop-blur-xl hover:border-black/15 dark:hover:border-white/20 transition-all duration-350 ease-[cubic-bezier(0.2,0,0,1)] hover:shadow-md hover:-translate-y-0.5 overflow-hidden font-matter shadow-2xs"
              >
                <div>
                  <CardHeader className="pb-3 border-b border-st-secondary">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <CardTitle
                          className="font-season-mix text-lg font-medium text-tx truncate cursor-pointer hover:text-sr-indigo-700 dark:hover:text-sr-indigo-400 transition-colors"
                          onClick={() => navigate(`/project/${project.id}`)}
                        >
                          {project.name}
                        </CardTitle>
                        {project.genre && (
                          <CardDescription className="text-xs text-tx-tertiary mt-0.5 truncate font-matter">
                            {project.genre}
                          </CardDescription>
                        )}
                      </div>

                      <Badge
                        variant={statusConfig.variant}
                        className={cn('shrink-0 border font-semibold rounded-full text-[10px] px-2.5 py-0.5 font-matter', statusConfig.badgeClass)}
                      >
                        {statusConfig.label}
                      </Badge>
                    </div>
                  </CardHeader>

                  <CardContent className="py-3.5 space-y-3">
                    <p className="text-xs text-tx-secondary line-clamp-2 min-h-[2rem] font-matter">
                      {project.logline || 'No logline added yet. Click to open and begin writing.'}
                    </p>

                    <div className="grid grid-cols-2 gap-2 py-2 px-3 rounded-xl bg-sf-secondary/70 border border-st-secondary text-xs font-matter">
                      <div className="flex items-center gap-1.5 text-tx-secondary">
                        <FileText className="w-3.5 h-3.5 text-sr-indigo-600 dark:text-sr-indigo-400" />
                        <span>
                          <strong className="text-tx">{project.wordCount.toLocaleString()}</strong> words
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-tx-secondary">
                        <Layers className="w-3.5 h-3.5 text-sr-indigo-600 dark:text-sr-indigo-400" />
                        <span>
                          Target: <strong className="text-tx">{project.targetLength || 110}</strong> pgs
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </div>

                <CardFooter className="pt-3 border-t border-st-secondary flex items-center justify-between text-xs text-tx-tertiary">
                  <div className="flex items-center gap-1.5 text-[11px] font-matter">
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
                      className="text-tx-tertiary hover:text-destructive hover:bg-destructive/10 rounded-full w-7 h-7 p-0 cursor-pointer"
                      title="Delete project"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>

                    <Button
                      size="xs"
                      onClick={() => navigate(`/project/${project.id}`)}
                      className="btn-sarvam-dark gap-1 font-semibold px-3 text-xs h-7 shadow-xs cursor-pointer"
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
