export function RagLogo({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizes = { sm: 'text-lg', md: 'text-2xl', lg: 'text-4xl' }
  return (
    <div className={`font-black tracking-tighter ${sizes[size]} select-none`}>
      <span className="text-violet-600">R</span>
      <span className="text-violet-500">A</span>
      <span className="text-violet-400">G</span>
    </div>
  )
}
