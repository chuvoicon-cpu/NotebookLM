'use client'
import { useState, useRef, useCallback, useEffect } from 'react'
import { ChevronLeft, ChevronRight, Maximize2, Minimize2, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface ResizableChatWrapperProps {
  children: React.ReactNode
  defaultWidth?: number
  minWidth?: number
  maxWidth?: number
  onClose?: () => void
}

export function ResizableChatWrapper({
  children,
  defaultWidth,
  minWidth = 280,
  maxWidth = 760,
  onClose,
}: ResizableChatWrapperProps) {
  const getInitialWidth = useCallback(() => {
    if (defaultWidth) return defaultWidth
    if (typeof window === 'undefined') return Math.max(minWidth, 380)
    return Math.min(maxWidth, Math.max(minWidth, Math.round(window.innerWidth / 2)))
  }, [defaultWidth, maxWidth, minWidth])

  const [width, setWidth] = useState(getInitialWidth)
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [isMaximized, setIsMaximized] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const dragStartX = useRef(0)
  const dragStartWidth = useRef(0)
  const COLLAPSED_WIDTH = 40

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    dragStartX.current = e.clientX
    dragStartWidth.current = width
    setIsDragging(true)
  }, [width])

  useEffect(() => {
    if (!isDragging) return
    const handleMouseMove = (e: MouseEvent) => {
      const delta = dragStartX.current - e.clientX
      const newWidth = Math.min(maxWidth, Math.max(minWidth, dragStartWidth.current + delta))
      setWidth(newWidth)
    }
    const handleMouseUp = () => setIsDragging(false)
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, maxWidth, minWidth])

  const toggleCollapse = () => {
    setIsCollapsed(!isCollapsed)
    if (isMaximized) setIsMaximized(false)
  }

  const toggleMaximize = () => {
    setIsMaximized(!isMaximized)
    if (isCollapsed) setIsCollapsed(false)
    if (!isMaximized) setWidth(maxWidth)
    else setWidth(getInitialWidth())
  }

  const currentWidth = isCollapsed ? COLLAPSED_WIDTH : isMaximized ? maxWidth : width

  return (
    <div
      ref={panelRef}
      className={cn(
        'relative flex flex-col h-full bg-background border-l border-border/50',
        'transition-[width] duration-300 ease-in-out shrink-0',
        isDragging && 'select-none transition-none',
        isMaximized && 'shadow-2xl z-10'
      )}
      style={{ width: currentWidth }}
    >
      {/* Drag Handle */}
      {!isCollapsed && (
        <div
          onMouseDown={handleMouseDown}
          className={cn(
            'absolute left-0 top-0 w-1.5 h-full cursor-col-resize z-20',
            'hover:bg-violet-400/60 transition-colors duration-150 group',
            isDragging && 'bg-violet-500'
          )}
        >
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-4 h-8 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="flex flex-col gap-0.5">
              {[0,1,2].map(i => <div key={i} className="w-0.5 h-4 bg-violet-400 rounded-full" />)}
            </div>
          </div>
        </div>
      )}

      {/* Panel Controls */}
      <div className={cn(
        'flex items-center border-b border-border/40 shrink-0',
        isCollapsed ? 'flex-col py-3 px-2 gap-3' : 'px-3 py-1.5 gap-2 justify-end'
      )}>

        <div className={cn('flex gap-1', isCollapsed && 'flex-col')}>
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                onClick={toggleCollapse}
              >
                {isCollapsed ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
              </Button>
            </TooltipTrigger>
            <TooltipContent side={isCollapsed ? 'left' : 'bottom'} className="text-xs">
              {isCollapsed ? 'Expand chat' : 'Collapse chat'}
            </TooltipContent>
          </Tooltip>

          {!isCollapsed && (
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-foreground"
                  onClick={toggleMaximize}
                >
                  {isMaximized ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                {isMaximized ? 'Restore' : 'Maximize'}
              </TooltipContent>
            </Tooltip>
          )}

          {onClose && !isCollapsed && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-destructive"
              onClick={onClose}
            >
              <X size={14} />
            </Button>
          )}
        </div>
      </div>

      {/* Content */}
      {isCollapsed ? (
        <div
          className="flex-1 flex items-center justify-center cursor-pointer"
          onClick={toggleCollapse}
        >
          <span
            className="text-muted-foreground/50 text-[10px] tracking-widest uppercase font-semibold"
            style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
          >
            Chat
          </span>
        </div>
      ) : (
        <div className="flex-1 overflow-hidden flex flex-col">
          {children}
        </div>
      )}
    </div>
  )
}
