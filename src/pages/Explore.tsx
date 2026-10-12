import { useState, useMemo } from 'react'
import { categories } from '../data'
import { useStore } from '../context/store'
import type { NavigateFn } from '../types'

function ScoreRing({ score, size = 44 }: { score: number; size?: number }) {
  const r = (size - 6) / 2
  const circ = 2 * Math.PI * r
  const offset = circ * (1 - score / 100)
  const color = score >= 90 ? '#34D399' : score >= 75 ? '#E8A020' : '#FBBF24'
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="3.5" />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="3.5"
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" />
    </svg>
  )
}

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <svg key={i} width="11" height="11" viewBox="0 0 24 24" fill={i <= Math.round(rating) ? '#FBBF24' : 'rgba(255,255,255,0.15)'}>
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
      ))}
    </div>
  )
}

interface ExploreProps {
  navigate: NavigateFn
}

export default function Explore({ navigate }: ExploreProps) {
  const { professionals } = useStore()
  const [search, setSearch] = useState('')
  const [selectedCat, setSelectedCat] = useState('all')
  const [onlyAvailable, setOnlyAvailable] = useState(false)
  const [sortBy, setSortBy] = useState<'score' | 'rating' | 'price' | 'jobs'>('score')
  const [showProposal, setShowProposal] = useState<number | null>(null)
  const [proposalSent, setProposalSent] = useState<number[]>([])

  const filtered = useMemo(() => {
    let list = [...professionals]
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.profession.toLowerCase().includes(q) ||
        p.skills.some(s => s.toLowerCase().includes(q))
      )
    }
    if (selectedCat !== 'all') list = list.filter(p => p.category === selectedCat)
    if (onlyAvailable) list = list.filter(p => p.available)
    list.sort((a, b) => {
      if (sortBy === 'score') return b.score - a.score
      if (sortBy === 'rating') return b.rating - a.rating
      if (sortBy === 'price') return a.hourlyRate - b.hourlyRate
      if (sortBy === 'jobs') return b.jobsCompleted - a.jobsCompleted
      return 0
    })
    return list
  }, [search, selectedCat, onlyAvailable, sortBy])

  return (
    <div className="min-h-screen" style={{ background: '#061E26' }}>
      {/* Header */}
      <div className="py-10 px-4" style={{ background: 'linear-gradient(180deg, #0D2E38, #061E26)' }}>
        <div className="max-w-7xl mx-auto">
          <h1 className="font-serif text-3xl sm:text-4xl mb-6" style={{ color: '#EDF4F6' }}>
            Explorar Profissionais
          </h1>
          {/* Search */}
          <div className="relative max-w-xl">
            <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#7BAAB8' }}
              viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Nome, profissão ou competência..."
              className="w-full pl-10 pr-4 py-3 rounded-xl text-sm outline-none"
              style={{
                background: 'rgba(13,46,56,0.8)',
                border: '1px solid rgba(255,255,255,0.12)',
                color: '#EDF4F6',
              }}
            />
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Filters row */}
        <div className="flex flex-wrap gap-3 mb-6">
          {/* Categories */}
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setSelectedCat('all')}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
              style={{
                background: selectedCat === 'all' ? '#E8A020' : 'rgba(13,46,56,0.8)',
                color: selectedCat === 'all' ? '#fff' : '#7BAAB8',
                border: selectedCat === 'all' ? 'none' : '1px solid rgba(255,255,255,0.08)',
              }}
            >
              Todos
            </button>
            {categories.slice(0, 5).map(cat => (
              <button
                key={cat.id}
                onClick={() => setSelectedCat(cat.id === selectedCat ? 'all' : cat.id)}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
                style={{
                  background: selectedCat === cat.id ? '#E8A020' : 'rgba(13,46,56,0.8)',
                  color: selectedCat === cat.id ? '#fff' : '#7BAAB8',
                  border: selectedCat === cat.id ? 'none' : '1px solid rgba(255,255,255,0.08)',
                }}
              >
                {cat.icon} {cat.name}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 mb-6">
          {/* Sort */}
          <div className="flex items-center gap-2">
            <span className="text-xs" style={{ color: '#7BAAB8' }}>Ordenar:</span>
            {([
              { id: 'score', label: 'Score' },
              { id: 'rating', label: 'Avaliação' },
              { id: 'price', label: 'Menor preço' },
              { id: 'jobs', label: 'Mais trabalhos' },
            ] as const).map(opt => (
              <button
                key={opt.id}
                onClick={() => setSortBy(opt.id)}
                className="px-3 py-1 rounded-lg text-xs transition-all"
                style={{
                  background: sortBy === opt.id ? 'rgba(232,160,32,0.15)' : 'transparent',
                  color: sortBy === opt.id ? '#E8A020' : '#7BAAB8',
                  border: sortBy === opt.id ? '1px solid rgba(232,160,32,0.3)' : '1px solid transparent',
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Available toggle */}
          <button
            onClick={() => setOnlyAvailable(!onlyAvailable)}
            className="flex items-center gap-2 px-3 py-1 rounded-lg text-xs transition-all"
            style={{
              background: onlyAvailable ? 'rgba(52,211,153,0.1)' : 'transparent',
              color: onlyAvailable ? '#34D399' : '#7BAAB8',
              border: `1px solid ${onlyAvailable ? 'rgba(52,211,153,0.3)' : 'rgba(255,255,255,0.08)'}`,
            }}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${onlyAvailable ? 'bg-green-400' : 'bg-gray-500'}`} />
            Disponíveis agora
          </button>

          <span className="text-xs ml-auto" style={{ color: '#7BAAB8' }}>
            {filtered.length} profissiona{filtered.length !== 1 ? 'is' : 'l'} encontrado{filtered.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Results grid */}
        {filtered.length === 0 ? (
          <div className="text-center py-20" style={{ color: '#7BAAB8' }}>
            <div className="text-4xl mb-4">🔍</div>
            <p className="font-medium mb-2" style={{ color: '#EDF4F6' }}>Nenhum resultado encontrado</p>
            <p className="text-sm">Tente ajustar os filtros ou a pesquisa</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(pro => (
              <div
                key={pro.id}
                className="rounded-2xl overflow-hidden transition-all duration-200"
                style={{ background: '#0D2E38', border: '1px solid rgba(255,255,255,0.06)' }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(232,160,32,0.25)')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)')}
              >
                <div className="p-5">
                  <div className="flex items-start gap-3 mb-4">
                    <div className="relative flex-shrink-0">
                      <img src={pro.avatar} alt={pro.name} data-african-avatar="true" loading="lazy" decoding="async"
                        className="w-16 h-16 rounded-xl object-cover"
                        style={{ background: '#1A4050' }} />
                      {pro.available && (
                        <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 bg-green-400"
                          style={{ borderColor: '#0D2E38' }} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-semibold text-sm flex items-center gap-1.5" style={{ color: '#EDF4F6' }}>
                            {pro.name}
                            {pro.verified && (
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="#38BDF8">
                                <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" fill="none" stroke="#38BDF8" strokeWidth="2.5" />
                              </svg>
                            )}
                          </div>
                          <div className="text-xs mt-0.5" style={{ color: '#E8A020' }}>{pro.profession}</div>
                          <div className="flex items-center gap-1 mt-1">
                            <StarRating rating={pro.rating} />
                            <span className="text-xs ml-1" style={{ color: '#7BAAB8' }}>{pro.rating} ({pro.reviews})</span>
                          </div>
                        </div>
                        <div className="relative flex-shrink-0" style={{ width: 44, height: 44 }}>
                          <ScoreRing score={pro.score} size={44} />
                          <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className="text-xs font-bold leading-none" style={{ color: '#EDF4F6' }}>{pro.score}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <p className="text-xs leading-relaxed mb-3 line-clamp-2" style={{ color: '#7BAAB8' }}>{pro.bio}</p>

                  <div className="flex flex-wrap gap-1 mb-4">
                    {pro.skills.slice(0, 3).map(skill => (
                      <span key={skill} className="text-xs px-2 py-0.5 rounded-full"
                        style={{ background: 'rgba(255,255,255,0.05)', color: '#7BAAB8', border: '1px solid rgba(255,255,255,0.08)' }}>
                        {skill}
                      </span>
                    ))}
                    {pro.skills.length > 3 && (
                      <span className="text-xs px-2 py-0.5 rounded-full" style={{ color: '#7BAAB8' }}>
                        +{pro.skills.length - 3}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-xs mb-4" style={{ color: '#7BAAB8' }}>
                    <span>📍 {pro.location}</span>
                    <span>✅ {pro.jobsCompleted} trabalhos</span>
                    <span>⏱ {pro.responseTime}</span>
                  </div>

                  <div className="flex items-center justify-between pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                    <div>
                      <span className="font-semibold text-sm" style={{ color: '#EDF4F6' }}>
                        {pro.hourlyRate.toLocaleString()} MZN
                      </span>
                      <span className="text-xs ml-1" style={{ color: '#7BAAB8' }}>/hora</span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => navigate('profile', pro.id)}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                        style={{ background: 'rgba(255,255,255,0.06)', color: '#EDF4F6', border: '1px solid rgba(255,255,255,0.1)' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.1)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
                      >
                        Ver perfil
                      </button>
                      <button
                        onClick={() => setShowProposal(proposalSent.includes(pro.id) ? null : pro.id)}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                        style={{
                          background: proposalSent.includes(pro.id) ? 'rgba(52,211,153,0.15)' : '#E8A020',
                          color: proposalSent.includes(pro.id) ? '#34D399' : '#fff',
                        }}
                        onMouseEnter={e => { if (!proposalSent.includes(pro.id)) e.currentTarget.style.background = '#D08C10' }}
                        onMouseLeave={e => { if (!proposalSent.includes(pro.id)) e.currentTarget.style.background = '#E8A020' }}
                      >
                        {proposalSent.includes(pro.id) ? '✓ Enviada' : 'Proposta'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Proposal modal */}
      {showProposal !== null && (
        <ProposalModal
          pro={professionals.find(p => p.id === showProposal)!}
          onClose={() => setShowProposal(null)}
          onSend={() => {
            setProposalSent(prev => [...prev, showProposal!])
            setShowProposal(null)
          }}
        />
      )}
    </div>
  )
}

function ProposalModal({ pro, onClose, onSend }: { pro: { name: string; profession: string }; onClose: () => void; onSend: () => void }) {
  const [desc, setDesc] = useState('')
  const [budget, setBudget] = useState('')
  const [deadline, setDeadline] = useState('')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-md rounded-2xl overflow-hidden" style={{ background: '#0D2E38', border: '1px solid rgba(255,255,255,0.1)' }}>
        <div className="flex items-center justify-between p-5" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div>
            <h3 className="font-semibold" style={{ color: '#EDF4F6' }}>Enviar Proposta</h3>
            <p className="text-xs mt-0.5" style={{ color: '#7BAAB8' }}>Para {pro.name} — {pro.profession}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center transition-all"
            style={{ background: 'rgba(255,255,255,0.06)', color: '#7BAAB8' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: '#7BAAB8' }}>
              Descrição do serviço *
            </label>
            <textarea
              value={desc}
              onChange={e => setDesc(e.target.value)}
              rows={3}
              placeholder="Descreva o que precisa com o máximo de detalhe..."
              className="w-full px-3 py-2.5 rounded-lg text-sm outline-none resize-none"
              style={{ background: 'rgba(6,30,38,0.8)', border: '1px solid rgba(255,255,255,0.1)', color: '#EDF4F6' }}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: '#7BAAB8' }}>Orçamento (MZN)</label>
              <input
                type="text"
                value={budget}
                onChange={e => setBudget(e.target.value)}
                placeholder="Ex: 15.000"
                className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
                style={{ background: 'rgba(6,30,38,0.8)', border: '1px solid rgba(255,255,255,0.1)', color: '#EDF4F6' }}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: '#7BAAB8' }}>Prazo</label>
              <input
                type="text"
                value={deadline}
                onChange={e => setDeadline(e.target.value)}
                placeholder="Ex: 2 semanas"
                className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
                style={{ background: 'rgba(6,30,38,0.8)', border: '1px solid rgba(255,255,255,0.1)', color: '#EDF4F6' }}
              />
            </div>
          </div>
          <button
            onClick={onSend}
            disabled={!desc.trim()}
            className="w-full py-3 rounded-xl font-semibold text-sm transition-all"
            style={{
              background: desc.trim() ? '#E8A020' : 'rgba(255,255,255,0.06)',
              color: desc.trim() ? '#fff' : '#3D6878',
            }}
          >
            Enviar Proposta
          </button>
        </div>
      </div>
    </div>
  )
}
