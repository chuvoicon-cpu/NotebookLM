'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { ArrowLeft, ChevronsUpDown } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import { sourcesApi } from '@/lib/api/sources'
import { insightsApi, SourceInsightResponse } from '@/lib/api/insights'
import { transformationsApi } from '@/lib/api/transformations'
import { embeddingApi } from '@/lib/api/embedding'
import { SourceDetailResponse } from '@/lib/types/api'
import { Transformation } from '@/lib/types/transformations'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'
import { InlineEdit } from '@/components/common/InlineEdit'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Link as LinkIcon,
  Upload,
  AlignLeft,
  ExternalLink,
  Download,
  Copy,
  CheckCircle,
  MoreVertical,
  Trash2,
  Sparkles,
  Plus,
  Lightbulb,
  Database,
  AlertCircle,
  MessageSquare,
  RefreshCw,
  FileSearch,
  Info,
  FileText,
  CircleCheck,
  Clock,
  XCircle,
  Clipboard,
  Search,
  BookOpen,
  Hash,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

/** Safely format a date value — returns fallback text if the date is invalid */
function safeFormatDistanceToNow(
  dateValue: string | number | Date | null | undefined,
  options?: Parameters<typeof formatDistanceToNow>[1]
): string {
  if (!dateValue) return '—'
  const d = new Date(dateValue)
  if (isNaN(d.getTime())) return '—'
  return formatDistanceToNow(d, options)
}
import { getDateLocale } from '@/lib/utils/date-locale'
import { toast } from 'sonner'
import { useTranslation } from '@/lib/hooks/use-translation'
import { SourceInsightDialog } from '@/components/source/SourceInsightDialog'
import { NotebookAssociations } from '@/components/source/NotebookAssociations'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

interface SourceDetailContentProps {
  sourceId: string
  showChatButton?: boolean
  onChatClick?: () => void
  onClose?: () => void
  onBack?: () => void
  backLabel?: string
}

function SourceContentErrorFallback({
  error,
  resetError,
  onRefresh,
  loadFailedLabel,
}: {
  error?: Error
  resetError: () => void
  onRefresh: () => void
  loadFailedLabel: string
}) {
  useEffect(() => {
    console.error('[SourceDetailContent] Content render crashed', error)
  }, [error])

  return (
    <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <AlertCircle className="h-10 w-10 text-destructive" />
        <div>
          <p className="font-medium text-foreground">{loadFailedLabel}</p>
          <p className="text-sm text-muted-foreground">{error?.message}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={resetError}>Retry render</Button>
          <Button onClick={onRefresh}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>
    </div>
  )
}

export function SourceDetailContent({
  sourceId,
  showChatButton = false,
  onChatClick,
  onClose,
  onBack,
  backLabel,
}: SourceDetailContentProps) {
  const { t, language } = useTranslation()
  const queryClient = useQueryClient()
  const [source, setSource] = useState<SourceDetailResponse | null>(null)
  const [insights, setInsights] = useState<SourceInsightResponse[]>([])
  const [transformations, setTransformations] = useState<Transformation[]>([])
  const [selectedTransformation, setSelectedTransformation] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [loadingInsights, setLoadingInsights] = useState(false)
  const [creatingInsight, setCreatingInsight] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [isEmbedding, setIsEmbedding] = useState(false)
  const [isDownloadingFile, setIsDownloadingFile] = useState(false)
  const [fileAvailable, setFileAvailable] = useState<boolean | null>(null)
  const [selectedInsight, setSelectedInsight] = useState<SourceInsightResponse | null>(null)
  const [insightToDelete, setInsightToDelete] = useState<string | null>(null)
  const [deletingInsight, setDeletingInsight] = useState(false)
  const [pdfViewMode, setPdfViewMode] = useState<'pdf' | 'text'>('pdf')
  const [contentSearch, setContentSearch] = useState('')
  const [headerCollapsed, setHeaderCollapsed] = useState(false)
  const [activeTab, setActiveTab] = useState<'content' | 'insights' | 'details'>('content')
  const [toolbarVisible, setToolbarVisible] = useState(false)
  const toolbarTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)


  const fetchSource = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await sourcesApi.get(sourceId)
      if (!data) {
        console.error('[SourceDetailContent] Source API returned an empty payload', { sourceId, data })
      } else if (!data.full_text?.trim()) {
        console.error('[SourceDetailContent] Source content is empty after fetch', {
          sourceId,
          status: data.status,
          asset: data.asset,
          title: data.title,
        })
      }
      setSource(data)
      if (typeof data.file_available === 'boolean') {
        setFileAvailable(data.file_available)
      } else if (!data.asset?.file_path) {
        setFileAvailable(null)
      } else {
        setFileAvailable(null)
      }
    } catch (err) {
      console.error('Failed to fetch source:', err)
      setError(t('sources.loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [sourceId, t])

  const fetchInsights = useCallback(async () => {
    try {
      setLoadingInsights(true)
      const data = await insightsApi.listForSource(sourceId)
      setInsights(data)
    } catch (err) {
      console.error('Failed to fetch insights:', err)
    } finally {
      setLoadingInsights(false)
    }
  }, [sourceId])

  const fetchTransformations = useCallback(async () => {
    try {
      const data = await transformationsApi.list()
      setTransformations(data)
    } catch (err) {
      console.error('Failed to fetch transformations:', err)
    }
  }, [])

  useEffect(() => {
    if (sourceId) {
      void fetchSource()
      void fetchInsights()
      void fetchTransformations()
    }
  }, [fetchInsights, fetchSource, fetchTransformations, sourceId])

  const createInsight = async (transformationId = selectedTransformation) => {
    if (!transformationId) {
      toast.error(t('sources.selectTransformation'))
      return
    }

    try {
      setCreatingInsight(true)
      const response = await insightsApi.create(sourceId, {
        transformation_id: transformationId
      })
      // Show toast for async operation
      toast.success(t('sources.insightGenerationStarted'))
      setSelectedTransformation('')

      // Poll for command completion if we have a command_id
      if (response.command_id) {
        // Poll in background (don't block UI)
        insightsApi.waitForCommand(response.command_id, {
          maxAttempts: 120, // Up to 4 minutes (120 * 2s)
          intervalMs: 2000
        }).then(success => {
          if (success) {
            void fetchInsights()
            // Invalidate sources queries so notebook page refreshes with updated insights_count
            queryClient.invalidateQueries({ queryKey: ['sources'] })
          }
        }).catch(err => {
          console.error('Error waiting for insight command:', err)
        })
      } else {
        // Fallback: refresh after delay if no command_id
        setTimeout(() => {
          void fetchInsights()
          // Also invalidate sources queries
          queryClient.invalidateQueries({ queryKey: ['sources'] })
        }, 5000)
      }
    } catch (err) {
      console.error('Failed to create insight:', err)
      toast.error(t('common.error'))
    } finally {
      setCreatingInsight(false)
    }
  }

  const handleDeleteInsight = async (e?: React.MouseEvent) => {
    e?.preventDefault()
    if (!insightToDelete) return

    try {
      setDeletingInsight(true)
      await insightsApi.delete(insightToDelete)
      toast.success(t('common.success'))
      setInsightToDelete(null)
      await fetchInsights()
    } catch (err) {
      console.error('Failed to delete insight:', err)
      toast.error(t('common.error'))
    } finally {
      setDeletingInsight(false)
    }
  }

  const handleUpdateTitle = async (title: string) => {
    if (!source || title === source.title) return

    try {
      await sourcesApi.update(sourceId, { title })
      toast.success(t('common.success'))
      setSource({ ...source, title })
    } catch (err) {
      console.error('Failed to update source title:', err)
      toast.error(t('common.error'))
      await fetchSource()
    }
  }

  const handleEmbedContent = async () => {
    if (!source) return

    try {
      setIsEmbedding(true)
      const response = await embeddingApi.embedContent(sourceId, 'source')
      toast.success(response.message || t('common.success'))
      await fetchSource()
    } catch (err) {
      console.error('Failed to embed content:', err)
      toast.error(t('common.error'))
    } finally {
      setIsEmbedding(false)
    }
  }

  const extractFilename = (pathOrUrl: string | undefined, fallback: string) => {
    if (!pathOrUrl) {
      return fallback
    }
    const segments = pathOrUrl.split(/[/\\]/)
    return segments.pop() || fallback
  }

  const parseContentDisposition = (header?: string | null) => {
    if (!header) {
      return null
    }
    const match = header.match(/filename\*?=([^;]+)/i)
    if (!match) {
      return null
    }
    const value = match[1].trim()
    if (value.toLowerCase().startsWith("utf-8''")) {
      return decodeURIComponent(value.slice(7))
    }
    return value.replace(/^["']|["']$/g, '')
  }

  const handleDownloadFile = async () => {
    if (!source?.asset?.file_path || isDownloadingFile || fileAvailable === false) {
      return
    }

    try {
      setIsDownloadingFile(true)
      const response = await sourcesApi.downloadFile(source.id)
      const filenameFromHeader = parseContentDisposition(
        response.headers?.['content-disposition'] as string | undefined
      )
      const fallbackName = extractFilename(source.asset.file_path, `source-${source.id}`)
      const filename = filenameFromHeader || fallbackName

      const blobUrl = window.URL.createObjectURL(response.data)
      const link = document.createElement('a')
      link.href = blobUrl
      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(blobUrl)
      setFileAvailable(true)
      toast.success(t('common.success'))
    } catch (err) {
      console.error('Failed to download file:', err)
      if (isAxiosError(err) && err.response?.status === 404) {
        setFileAvailable(false)
        toast.error(t('sources.fileUnavailable'))
      } else {
        toast.error(t('common.error'))
      }
    } finally {
      setIsDownloadingFile(false)
    }
  }

  const getSourceIcon = () => {
    if (!source) return null
    if (source.asset?.url) return <LinkIcon className="h-5 w-5" />
    if (source.asset?.file_path) return <Upload className="h-5 w-5" />
    return <AlignLeft className="h-5 w-5" />
  }

  const getSourceType = () => {
    if (!source) return 'unknown'
    if (source.asset?.url) return 'link'
    if (source.asset?.file_path) return 'file'
    return 'text'
  }

  const handleCopyUrl = useCallback(() => {
    if (source?.asset?.url) {
      navigator.clipboard.writeText(source.asset.url)
      setCopied(true)
      toast.success(t('sources.urlCopied'))
      setTimeout(() => setCopied(false), 2000)
    }
  }, [source, t])

  const handleOpenExternal = useCallback(() => {
    if (source?.asset?.url) {
      window.open(source.asset.url, '_blank')
    }
  }, [source])

  const getYouTubeVideoId = (url: string): string | null => {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
      /youtube\.com\/watch\?.*v=([^&\n?#]+)/
    ]

    for (const pattern of patterns) {
      const match = url.match(pattern)
      if (match) return match[1]
    }
    return null
  }

  const isYouTubeUrl = useMemo(() => {
    if (!source?.asset?.url) return false
    return !!(getYouTubeVideoId(source.asset.url))
  }, [source?.asset?.url])

  const youTubeVideoId = useMemo(() => {
    if (!source?.asset?.url) return null
    return getYouTubeVideoId(source.asset.url)
  }, [source?.asset?.url])

  const isPdfFile = useMemo(() => {
    if (!source?.asset?.file_path) return false
    return source.asset.file_path.toLowerCase().endsWith('.pdf')
  }, [source?.asset?.file_path])

  // Auto-collapse header when viewing PDF to maximize document space
  useEffect(() => {
    if (isPdfFile && pdfViewMode === 'pdf' && activeTab === 'content') {
      setHeaderCollapsed(true)
    }
  }, [pdfViewMode, activeTab, isPdfFile])

  const contentText = source?.full_text?.trim() || ''
  const hasContentText = contentText.length > 0
  const sourceStatus = source?.status?.toLowerCase() || ''
  const contentStillProcessing = ['preparing', 'queued', 'processing'].includes(sourceStatus)
  const sourceType = getSourceType()
  const sourceTypeLabel = t(`sources.type.${sourceType}`) || sourceType
  const sourceStatusLabel = sourceStatus
    ? t(`sources.status${sourceStatus.charAt(0).toUpperCase()}${sourceStatus.slice(1)}`) || sourceStatus
    : t('common.unknown')
  const wordCount = hasContentText ? contentText.split(/\s+/).filter(Boolean).length : 0
  const charCount = contentText.length
  const notebookCount = source?.notebooks?.length || 0
  const uploadedFilename = source?.asset?.file_path
    ? extractFilename(source.asset.file_path, `source-${source.id}`)
    : null
  const quickTransformations = transformations.filter((transformation) => {
    const haystack = `${transformation.name} ${transformation.title} ${transformation.description}`.toLowerCase()
    return ['summary', 'summar', 'key', 'topic', 'question', 'takeaway'].some((term) => haystack.includes(term))
  }).slice(0, 3)
  const insightSummary = insights.length === 1
    ? t('sources.insightCountSingle')
    : t('sources.insightCountPlural', { count: insights.length })

  const handleRefreshSource = useCallback(() => {
    console.error('[SourceDetailContent] Refreshing source content state', { sourceId, status: source?.status })
    void fetchSource()
  }, [fetchSource, source?.status, sourceId])

  const handleCopyContent = useCallback(async () => {
    if (!contentText) return
    await navigator.clipboard.writeText(contentText)
    toast.success(t('common.copyToClipboard'))
  }, [contentText, t])

  const handleCopyInsight = useCallback(async (content: string) => {
    await navigator.clipboard.writeText(content)
    toast.success(t('common.copyToClipboard'))
  }, [t])

  const handleFindInContent = useCallback(() => {
    if (!contentSearch.trim()) return
    const findInWindow = (window as Window & { find?: (query: string) => boolean }).find
    findInWindow?.(contentSearch.trim())
  }, [contentSearch])

  const getStatusBadgeClass = () => {
    if (sourceStatus === 'completed') return 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
    if (sourceStatus === 'failed') return 'border-destructive/40 bg-destructive/10 text-destructive'
    if (contentStillProcessing) return 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300'
    return 'border-muted-foreground/30 bg-muted text-muted-foreground'
  }

  const getStatusIcon = () => {
    if (sourceStatus === 'completed') return <CircleCheck className="h-3.5 w-3.5" />
    if (sourceStatus === 'failed') return <XCircle className="h-3.5 w-3.5" />
    return <Clock className="h-3.5 w-3.5" />
  }

  const handleDelete = async () => {
    if (!source) return

    if (confirm(t('sources.deleteSourceConfirm') || t('common.confirm'))) {
      try {
        await sourcesApi.delete(source.id)
        toast.success(t('common.success'))
        onClose?.()
      } catch (error) {
        console.error('Failed to delete source:', error)
        toast.error(t('common.error'))
      }
    }
  }

  // Determine if we're in full reading mode (PDF viewing on content tab)
  const isReadingMode = isPdfFile && pdfViewMode === 'pdf' && activeTab === 'content' && fileAvailable !== false

  // Mouse-hover toolbar reveal for reading mode
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isReadingMode) return
    if (e.clientY < 48) {
      setToolbarVisible(true)
      if (toolbarTimeoutRef.current) clearTimeout(toolbarTimeoutRef.current)
    } else if (toolbarVisible) {
      if (toolbarTimeoutRef.current) clearTimeout(toolbarTimeoutRef.current)
      toolbarTimeoutRef.current = setTimeout(() => setToolbarVisible(false), 600)
    }
  }, [isReadingMode, toolbarVisible])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => { if (toolbarTimeoutRef.current) clearTimeout(toolbarTimeoutRef.current) }
  }, [])

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="flex flex-col items-center gap-3 text-center">
          <LoadingSpinner />
          <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
        </div>
      </div>
    )
  }

  if (error || !source) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
        <AlertCircle className="h-10 w-10 text-destructive" />
        <p className="text-red-500">{error || t('sources.notFound')}</p>
        <Button variant="outline" onClick={handleRefreshSource}>
          <RefreshCw className="mr-2 h-4 w-4" />
          {t('common.refresh')}
        </Button>
      </div>
    )
  }

  // Render the compact toolbar (shared between collapsed header and reading-mode hover)
  const renderCompactToolbar = () => (
    <div className="flex items-center gap-1.5 h-9 border-b">
      {onBack && (
        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={onBack} title={backLabel}>
          <ArrowLeft className="h-3.5 w-3.5" />
        </Button>
      )}
      <span className="min-w-0 flex-1 truncate text-sm font-medium" title={source.title || ''}>
        {source.title || t('sources.untitledSource')}
      </span>
      <div className="flex items-center bg-muted/60 rounded-md p-0.5 gap-0.5 shrink-0">
        {(['content', 'insights', 'details'] as const).map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)} className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${activeTab === tab ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
            {tab === 'content' ? t('sources.content') : tab === 'insights' ? `${t('common.insights')}${insights.length > 0 ? ` (${insights.length})` : ''}` : t('sources.details')}
          </button>
        ))}
      </div>
      {isPdfFile && fileAvailable !== false && (
        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => setPdfViewMode(pdfViewMode === 'pdf' ? 'text' : 'pdf')} title={pdfViewMode === 'pdf' ? 'Text' : 'PDF'}>
          <FileText className="h-3.5 w-3.5" />
        </Button>
      )}
      {showChatButton && onChatClick && (
        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={onChatClick}><MessageSquare className="h-3.5 w-3.5" /></Button>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7 shrink-0"><MoreVertical className="h-3.5 w-3.5" /></Button></DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {source.asset?.file_path && (<><DropdownMenuItem onClick={handleDownloadFile} disabled={isDownloadingFile || fileAvailable === false}><Download className="mr-2 h-4 w-4" />{fileAvailable === false ? t('sources.fileUnavailable') : isDownloadingFile ? t('sources.preparing') : t('sources.downloadFile')}</DropdownMenuItem><DropdownMenuSeparator /></>)}
          <DropdownMenuItem onClick={handleEmbedContent} disabled={isEmbedding || source.embedded}><Database className="mr-2 h-4 w-4" />{isEmbedding ? t('sources.embedding') : source.embedded ? t('sources.alreadyEmbedded') : t('sources.embedContent')}</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="text-destructive" onClick={handleDelete}><Trash2 className="mr-2 h-4 w-4" />{t('sources.deleteSource')}</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {!isReadingMode && (
        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground" onClick={() => setHeaderCollapsed(false)} title="Expand header">
          <ChevronsUpDown className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  )

  return (
    <div className="flex flex-col h-full relative" onMouseMove={handleMouseMove}>
      {/* Reading mode: floating toolbar on hover */}
      {isReadingMode && (
        <div
          className={`absolute top-0 left-0 right-0 z-30 -mx-1 px-1 bg-background/95 backdrop-blur shadow-md transition-all duration-200 ${toolbarVisible ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0 pointer-events-none'}`}
          onMouseEnter={() => { setToolbarVisible(true); if (toolbarTimeoutRef.current) clearTimeout(toolbarTimeoutRef.current) }}
          onMouseLeave={() => { toolbarTimeoutRef.current = setTimeout(() => setToolbarVisible(false), 400) }}
        >
          {renderCompactToolbar()}
        </div>
      )}

      {/* Normal mode header */}
      {!isReadingMode && (
        <div className="sticky top-0 z-20 -mx-3 bg-background/95 px-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
          {headerCollapsed ? (
            renderCompactToolbar()
          ) : (
            <>
              <div className="flex items-center gap-2 pt-1.5 pb-1">
                {onBack && (
                  <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={onBack} title={backLabel}><ArrowLeft className="h-4 w-4" /></Button>
                )}
                <div className="min-w-0 flex-1">
                  <InlineEdit value={source.title || ''} onSave={handleUpdateTitle} className="truncate text-lg font-semibold leading-tight" inputClassName="text-lg font-semibold" placeholder={t('sources.titlePlaceholder')} emptyText={t('sources.untitledSource')} />
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => setHeaderCollapsed(true)} title="Collapse header"><ChevronsUpDown className="h-3.5 w-3.5" /></Button>
                  {showChatButton && onChatClick && (<Button variant="ghost" size="icon" className="h-7 w-7" onClick={onChatClick}><MessageSquare className="h-3.5 w-3.5" /></Button>)}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {source.asset?.file_path && (<><DropdownMenuItem onClick={handleDownloadFile} disabled={isDownloadingFile || fileAvailable === false}><Download className="mr-2 h-4 w-4" />{fileAvailable === false ? t('sources.fileUnavailable') : isDownloadingFile ? t('sources.preparing') : t('sources.downloadFile')}</DropdownMenuItem><DropdownMenuSeparator /></>)}
                      <DropdownMenuItem onClick={handleEmbedContent} disabled={isEmbedding || source.embedded}><Database className="mr-2 h-4 w-4" />{isEmbedding ? t('sources.embedding') : source.embedded ? t('sources.alreadyEmbedded') : t('sources.embedContent')}</DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-destructive" onClick={handleDelete}><Trash2 className="mr-2 h-4 w-4" />{t('sources.deleteSource')}</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
              <div className="pb-1.5 flex items-center gap-2 border-b">
                <div className="flex-1 flex flex-wrap items-center gap-1.5 text-xs">
                  <Badge variant="outline" className={`gap-1 ${getStatusBadgeClass()}`}>{getStatusIcon()}{sourceStatusLabel}</Badge>
                  <Badge variant="secondary" className="gap-1">{getSourceIcon()}{sourceTypeLabel}</Badge>
                  <Badge variant={source.embedded ? 'default' : 'secondary'} className="gap-1"><Database className="h-3.5 w-3.5" />{source.embedded ? t('sources.embedded') : t('sources.notEmbedded')}</Badge>
                  <Badge variant="outline" className="gap-1"><Lightbulb className="h-3.5 w-3.5" />{insightSummary}</Badge>
                  <Badge variant="outline" className="gap-1"><BookOpen className="h-3.5 w-3.5" />{`${notebookCount} ${notebookCount === 1 ? 'notebook' : 'notebooks'}`}</Badge>
                </div>
                <Button variant="outline" size="sm" className="hidden h-7 text-xs sm:inline-flex shrink-0" onClick={handleEmbedContent} disabled={isEmbedding || source.embedded}>
                  <Database className="mr-1.5 h-3.5 w-3.5" />{isEmbedding ? t('sources.embedding') : source.embedded ? t('sources.embedded') : t('sources.embedContent')}
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Controlled Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)} className="flex-1 flex flex-col min-h-0">
        {!headerCollapsed && !isReadingMode && (
          <div className="px-1 shrink-0">
            <div className="flex items-center gap-1">
              <TabsList className="grid flex-1 grid-cols-3 h-9 bg-muted/70">
                <TabsTrigger value="content" className="text-xs h-8">{t('sources.content')}</TabsTrigger>
                <TabsTrigger value="insights" className="text-xs h-8">{t('common.insights')} {insights.length > 0 && `(${insights.length})`}</TabsTrigger>
                <TabsTrigger value="details" className="text-xs h-8">{t('sources.details')}</TabsTrigger>
              </TabsList>
              {isPdfFile && fileAvailable !== false && (
                <Button variant="outline" size="sm" className="h-8 text-xs shrink-0" onClick={() => setPdfViewMode(pdfViewMode === 'pdf' ? 'text' : 'pdf')}>
                  {pdfViewMode === 'pdf' ? t('sources.viewAsText') || 'Text' : t('sources.viewAsPdf') || 'PDF'}
                </Button>
              )}
            </div>
          </div>
        )}

        <div className={`flex-1 flex flex-col min-h-0 ${isPdfFile && pdfViewMode === 'pdf' ? 'overflow-hidden p-0' : 'overflow-y-auto px-1 pb-2 mt-1.5'}`}>
          <TabsContent value="content" className={`mt-0 ${isPdfFile && pdfViewMode === 'pdf' ? 'flex-1 flex flex-col min-h-0' : 'space-y-2'}`}>
            {!headerCollapsed && !isReadingMode && (
              <div className="flex flex-col gap-2 rounded-lg border bg-card/80 p-2 shadow-sm sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1"><FileText className="h-3.5 w-3.5" />{`${wordCount.toLocaleString()} words`}</span>
                  <span className="inline-flex items-center gap-1"><Hash className="h-3.5 w-3.5" />{`${charCount.toLocaleString()} chars`}</span>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <div className="flex h-8 items-center rounded-md border bg-background px-2">
                    <Search className="mr-1.5 h-3.5 w-3.5 text-muted-foreground" />
                    <input value={contentSearch} onChange={(event) => setContentSearch(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') handleFindInContent() }} placeholder="Search source" className="h-7 w-28 bg-transparent text-xs outline-none sm:w-40" />
                  </div>
                  <Button variant="outline" size="sm" className="h-8 text-xs" onClick={handleFindInContent} disabled={!contentSearch.trim()}>{t('common.search').replace('...', '')}</Button>
                  <Button variant="outline" size="sm" className="h-8 text-xs" onClick={handleCopyContent} disabled={!hasContentText}><Clipboard className="mr-1.5 h-3.5 w-3.5" />{t('common.copyToClipboard')}</Button>
                  <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={handleRefreshSource}><RefreshCw className="mr-1.5 h-3.5 w-3.5" />{t('common.refresh')}</Button>
                </div>
              </div>
            )}
            {/* URL bar for link sources */}
            {source.asset?.url && !isYouTubeUrl && (
              <div className="flex items-center gap-1.5 mb-2 text-xs text-muted-foreground">
                <LinkIcon className="h-3 w-3 shrink-0" />
                <a
                  href={source.asset.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:underline text-blue-600 truncate"
                >
                  {source.asset.url}
                </a>
              </div>
            )}

            {isYouTubeUrl && youTubeVideoId && (
              <div className="mb-4">
                <div className="aspect-video rounded-lg overflow-hidden bg-black">
                  <iframe
                    src={`https://www.youtube.com/embed/${youTubeVideoId}`}
                    title={t('common.accessibility.ytVideo')}
                    className="w-full h-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
                {source.asset?.url && (
                  <div className="mt-1">
                    <a
                      href={source.asset.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-muted-foreground hover:underline inline-flex items-center gap-1"
                    >
                      <ExternalLink className="h-3 w-3" />
                      {t('sources.openOnYoutube')}
                    </a>
                  </div>
                )}
              </div>
            )}
            {isPdfFile && pdfViewMode === 'pdf' && fileAvailable !== false ? (
              <div className="flex-1 w-full min-h-0">
                <iframe
                  src={`/api/sources/${encodeURIComponent(source.id)}/download?view=inline`}
                  className="w-full h-full border-0"
                  title="PDF Viewer"
                />
              </div>
            ) : !hasContentText ? (
              <div className="rounded-lg border border-dashed bg-muted/20 p-6">
                <div className="flex flex-col items-center gap-2 text-center">
                  <FileSearch className="h-8 w-8 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium text-foreground">{t('sources.contentProcessingMessage')}</p>
                    <p className="text-xs text-muted-foreground">
                      {contentStillProcessing ? t('common.processing') : t('sources.noContent')}
                    </p>
                  </div>
                  <Button variant="outline" size="sm" onClick={handleRefreshSource}>
                    <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                    {t('common.refresh')}
                  </Button>
                </div>
              </div>
            ) : (
              <ErrorBoundary
                fallback={({ error, resetError }) => (
                  <SourceContentErrorFallback
                    error={error}
                    resetError={resetError}
                    onRefresh={handleRefreshSource}
                    loadFailedLabel={t('sources.contentLoadFailed')}
                  />
                )}
              >
                <div className="prose prose-sm prose-neutral dark:prose-invert max-w-none prose-headings:font-semibold prose-a:text-blue-600 prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-p:mb-4 prose-p:leading-7 prose-li:mb-2">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm, remarkMath]}
                    rehypePlugins={[rehypeKatex]}
                    components={{
                      p: ({ children }) => <p className="mb-4">{children}</p>,
                      h1: ({ children }) => <h1 className="text-2xl font-bold mt-6 mb-4">{children}</h1>,
                      h2: ({ children }) => <h2 className="text-xl font-bold mt-5 mb-3">{children}</h2>,
                      h3: ({ children }) => <h3 className="text-lg font-semibold mt-4 mb-2">{children}</h3>,
                      ul: ({ children }) => <ul className="mb-4 list-disc pl-6">{children}</ul>,
                      ol: ({ children }) => <ol className="mb-4 list-decimal pl-6">{children}</ol>,
                      li: ({ children }) => <li className="mb-1">{children}</li>,
                      table: ({ children }) => (
                        <div className="my-4 overflow-x-auto">
                          <table className="min-w-full border-collapse border border-border">{children}</table>
                        </div>
                      ),
                      thead: ({ children }) => <thead className="bg-muted">{children}</thead>,
                      tbody: ({ children }) => <tbody>{children}</tbody>,
                      tr: ({ children }) => <tr className="border-b border-border">{children}</tr>,
                      th: ({ children }) => <th className="border border-border px-3 py-2 text-left font-semibold">{children}</th>,
                      td: ({ children }) => <td className="border border-border px-3 py-2">{children}</td>,
                    }}
                  >
                    {contentText}
                  </ReactMarkdown>
                </div>
              </ErrorBoundary>
            )}
          </TabsContent>

          <TabsContent value="insights" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Lightbulb className="h-5 w-5" />
                    {t('common.insights')}
                  </span>
                  <Badge variant="secondary">{insights.length}</Badge>
                </CardTitle>
                <CardDescription>
                  {t('sources.insightsDesc')}
                  {insights.length > 0 ? ` - ${insightSummary}` : ''}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Create New Insight */}
                <div className="rounded-xl border bg-muted/30 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <Label 
                        htmlFor="transformation-select"
                        className="mb-2 text-sm font-semibold flex items-center gap-2"
                      >
                        <Sparkles className="h-4 w-4" />
                        {t('sources.generateNewInsight')}
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        {t('sources.insightDefinition')}
                      </p>
                    </div>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                          <Info className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{t('sources.insightDefinition')}</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  {quickTransformations.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {quickTransformations.map((transformation) => (
                        <Button
                          key={transformation.id}
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs"
                          disabled={creatingInsight}
                          onClick={() => void createInsight(transformation.id)}
                        >
                          <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                          {transformation.title || transformation.name}
                        </Button>
                      ))}
                    </div>
                  )}
                  <div className="mt-3 flex gap-2">
                    <Select
                      name="transformation"
                      value={selectedTransformation}
                      onValueChange={setSelectedTransformation}
                      disabled={creatingInsight}
                    >
                      <SelectTrigger id="transformation-select" className="flex-1">
                        <SelectValue placeholder={t('sources.selectTransformation')} />
                      </SelectTrigger>
                      <SelectContent>
                        {transformations.map((trans) => (
                          <SelectItem key={trans.id} value={trans.id}>
                            {trans.title || trans.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      size="sm"
                      onClick={() => void createInsight()}
                      disabled={!selectedTransformation || creatingInsight}
                    >
                      {creatingInsight ? (
                        <>
                          <LoadingSpinner className="mr-2 h-3 w-3" />
                          {t('common.creating')}
                        </>
                      ) : (
                        <>
                          <Plus className="mr-2 h-4 w-4" />
                          {t('common.create')}
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                {/* Insights List */}
                {loadingInsights ? (
                  <div className="flex items-center justify-center py-8">
                    <LoadingSpinner />
                  </div>
                ) : insights.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Lightbulb className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p className="text-sm">{t('sources.noInsightsYet')}</p>
                    <p className="text-xs mt-1">{t('sources.createFirstInsight')}</p>
                  </div>
                ) : (
                  <div className="grid gap-3 lg:grid-cols-2">
                    {insights.map((insight) => (
                      <div key={insight.id} className="rounded-xl border bg-background p-4 shadow-sm transition-colors hover:border-border/80">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <Badge variant="outline" className="text-xs uppercase">
                              {insight.insight_type}
                            </Badge>
                            <p className="mt-2 text-xs text-muted-foreground">
                              {safeFormatDistanceToNow(insight.created, {
                                addSuffix: true,
                                locale: getDateLocale(language)
                              })}
                            </p>
                          </div>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            onClick={() => void handleCopyInsight(insight.content)}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                        <p className="mt-3 line-clamp-4 text-sm leading-6 text-foreground/85">
                          {insight.content}
                        </p>
                        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t pt-3">
                          <Button size="sm" variant="outline" onClick={() => setSelectedInsight(insight)}>
                            {t('sources.viewInsight')}
                          </Button>
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-xs"
                              onClick={() => void handleCopyInsight(insight.content)}
                            >
                              <Clipboard className="mr-1.5 h-3.5 w-3.5" />
                              {t('common.copyToClipboard')}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setInsightToDelete(insight.id)}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="details" className="mt-6 space-y-4">
            {!source.embedded && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>{t('sources.notEmbeddedAlert')}</AlertTitle>
                <AlertDescription>
                  {t('sources.notEmbeddedDesc')}
                  <div className="mt-3">
                    <Button
                      onClick={handleEmbedContent}
                      disabled={isEmbedding}
                      size="sm"
                    >
                      <Database className="mr-2 h-4 w-4" />
                      {isEmbedding ? t('sources.embedding') : t('sources.embedContent')}
                    </Button>
                  </div>
                </AlertDescription>
              </Alert>
            )}

            <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
              <Card>
                <CardHeader>
                  <CardTitle>{t('sources.details')}</CardTitle>
                  <CardDescription>Operational details, access, and storage state for this source.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border bg-muted/20 p-4">
                      <p className="text-xs font-medium text-muted-foreground">{t('sources.content')}</p>
                      <p className="mt-1 text-base font-semibold">{wordCount.toLocaleString()} words</p>
                      <p className="text-xs text-muted-foreground">{charCount.toLocaleString()} characters extracted</p>
                    </div>
                    <div className="rounded-xl border bg-muted/20 p-4">
                      <p className="text-xs font-medium text-muted-foreground">{t('sources.metadata')}</p>
                      <p className="mt-1 text-base font-semibold">{sourceStatusLabel}</p>
                      <p className="text-xs text-muted-foreground">{source.embedded ? t('sources.embedded') : t('sources.notEmbedded')}</p>
                    </div>
                  </div>

                  {source.asset?.url && (
                    <div className="rounded-xl border p-4">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <h3 className="text-sm font-semibold">{t('common.url')}</h3>
                        <div className="flex items-center gap-2">
                          <Button size="sm" variant="outline" onClick={handleCopyUrl}>
                            {copied ? <CheckCircle className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                          </Button>
                          <Button size="sm" variant="outline" onClick={handleOpenExternal}>
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <code className="block rounded-lg bg-muted px-3 py-2 text-sm break-all">
                        {source.asset.url}
                      </code>
                    </div>
                  )}

                  {source.asset?.file_path && (
                    <div className="rounded-xl border p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="text-sm font-semibold">{t('sources.uploadedFile')}</h3>
                          <p className="mt-1 text-sm font-medium">{uploadedFilename}</p>
                          <p className="mt-1 text-xs text-muted-foreground break-all">{source.asset.file_path}</p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleDownloadFile}
                          disabled={isDownloadingFile || fileAvailable === false}
                        >
                          <Download className="mr-2 h-4 w-4" />
                          {fileAvailable === false
                            ? t('sources.fileUnavailable')
                            : isDownloadingFile
                              ? t('sources.preparing')
                              : t('common.download')}
                        </Button>
                      </div>
                      {fileAvailable === false ? (
                        <p className="mt-2 text-xs text-muted-foreground">
                          {t('sources.fileUnavailableDesc')}
                        </p>
                      ) : null}
                    </div>
                  )}

                  {source.topics && source.topics.length > 0 && (
                    <div className="rounded-xl border p-4">
                      <h3 className="mb-2 text-sm font-semibold">{t('sources.topics')}</h3>
                      <div className="flex flex-wrap gap-2">
                        {source.topics.map((topic, idx) => (
                          <Badge key={idx} variant="outline">
                            {topic}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>{t('sources.metadata')}</CardTitle>
                  <CardDescription>Audit trail and source state at a glance.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="rounded-xl border p-4">
                    <p className="text-xs font-medium text-muted-foreground">{t('common.created_label')}</p>
                    <p className="mt-1 text-sm font-semibold">
                      {safeFormatDistanceToNow(source.created, {
                        addSuffix: true,
                        locale: getDateLocale(language)
                      })}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {source.created ? new Date(source.created).toLocaleString() : '—'}
                    </p>
                  </div>
                  <div className="rounded-xl border p-4">
                    <p className="text-xs font-medium text-muted-foreground">{t('common.updated_label')}</p>
                    <p className="mt-1 text-sm font-semibold">
                      {safeFormatDistanceToNow(source.updated, {
                        addSuffix: true,
                        locale: getDateLocale(language)
                      })}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {source.updated ? new Date(source.updated).toLocaleString() : '—'}
                    </p>
                  </div>
                  <div className="rounded-xl border p-4">
                    <p className="text-xs font-medium text-muted-foreground">{t('sources.id')}</p>
                    <code className="mt-1 block break-all text-xs text-foreground/80">{source.id}</code>
                  </div>
                </CardContent>
              </Card>
            </div>

            <NotebookAssociations
              sourceId={sourceId}
              currentNotebookIds={source.notebooks || []}
              onSave={fetchSource}
            />
          </TabsContent>
        </div>
      </Tabs>

      <SourceInsightDialog
        open={Boolean(selectedInsight)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedInsight(null)
          }
        }}
        insight={selectedInsight ?? undefined}
        onDelete={async (insightId) => {
          try {
            await insightsApi.delete(insightId)
            toast.success(t('common.success'))
            setSelectedInsight(null)
            await fetchInsights()
          } catch (err) {
            console.error('Failed to delete insight:', err)
            toast.error(t('common.error'))
          }
        }}
      />

      <AlertDialog open={!!insightToDelete} onOpenChange={() => setInsightToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('sources.deleteInsight')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('sources.deleteInsightConfirm')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingInsight}>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button
                onClick={handleDeleteInsight}
                disabled={deletingInsight}
                variant="destructive"
              >
                {deletingInsight ? t('common.deleting') : t('common.delete')}
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
