'use client'

import { useRouter, useParams } from 'next/navigation'
import { useCallback, useState } from 'react'
import { useSourceChat } from '@/lib/hooks/useSourceChat'
import { ChatPanel } from '@/components/source/ChatPanel'
import { useNavigation } from '@/lib/hooks/use-navigation'
import { SourceDetailContent } from '@/components/source/SourceDetailContent'
import { AppShell } from '@/components/layout/AppShell'
import { ResizableChatWrapper } from '@/components/chat/ResizableChatWrapper'

export default function SourceDetailPage() {
  const router = useRouter()
  const params = useParams()
  const sourceId = params?.id ? decodeURIComponent(params.id as string) : ''
  const navigation = useNavigation()
  const [chatOpen, setChatOpen] = useState(true)

  // Initialize source chat
  const chat = useSourceChat(sourceId)

  const handleBack = useCallback(() => {
    const returnPath = navigation.getReturnPath()
    router.push(returnPath)
    navigation.clearReturnTo()
  }, [navigation, router])

  const quickPrompts = [
    'Tóm tắt tài liệu này bằng ngôn ngữ dễ hiểu',
    'Liệt kê những điểm chính từ tài liệu này',
    'Những khẳng định hoặc dữ kiện quan trọng nhất là gì?',
    'Chuyển tài liệu này thành ghi chú học tập',
  ]

  return (
    <AppShell>
      <div className="flex flex-1 h-full overflow-hidden">
        {/* Document Content */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          {/* Source detail content */}
          <div className="flex-1 overflow-y-auto px-1 pb-1 pt-0.5">
            <SourceDetailContent
              sourceId={sourceId}
              showChatButton={!chatOpen}
              onChatClick={() => setChatOpen(true)}
              onClose={handleBack}
              onBack={handleBack}
              backLabel={navigation.getReturnLabel()}
            />
          </div>
        </div>

        {/* Chat Panel — resizable */}
        {chatOpen && (
          <ResizableChatWrapper
            minWidth={340}
            maxWidth={960}
            onClose={() => setChatOpen(false)}
          >
            <ChatPanel
              messages={chat.messages}
              isStreaming={chat.isStreaming}
              contextIndicators={chat.contextIndicators}
              onSendMessage={(message, model) => chat.sendMessage(message, model)}
              modelOverride={chat.currentSession?.model_override}
              onModelChange={(model) => {
                if (chat.currentSessionId) {
                  chat.updateSession(chat.currentSessionId, { model_override: model })
                }
              }}
              sessions={chat.sessions}
              currentSessionId={chat.currentSessionId}
              onCreateSession={(title) => chat.createSession({ title })}
              onSelectSession={chat.switchSession}
              onUpdateSession={(sessionId, title) => chat.updateSession(sessionId, { title })}
              onDeleteSession={chat.deleteSession}
              loadingSessions={chat.loadingSessions}
              quickPrompts={quickPrompts}
            />
          </ResizableChatWrapper>
        )}

        {/* Re-open chat button when closed */}
        {!chatOpen && (
          <button
            onClick={() => setChatOpen(true)}
            className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-2xl bg-primary hover:bg-primary/90 text-primary-foreground font-medium text-sm shadow-lg transition-all hover:scale-105 active:scale-100"
          >
            <span>💬</span>
            Chat
          </button>
        )}
      </div>
    </AppShell>
  )
}
