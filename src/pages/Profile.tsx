import { useState } from 'react'
import jobtecLogo from '../imports/IMG-20260828-WA0004.jpg'
import { useStore } from '../context/store'
import type { Professional, NavigateFn } from '../types'

function ScoreRing({ score, size = 80 }: { score: number; size?: number }) {
  const r = (size - 8) / 2
  const circ = 2 * Math.PI * r
  const offset = circ * (1 - score / 100)
  const color = score >= 90 ? '#34D399' : score >= 75 ? '#E8A020' : '#FBBF24'
  const label = score >= 90 ? 'Excelente' : score >= 75 ? 'Muito Bom' : 'Bom'
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="6"
            strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-bold text-xl leading-none" style={{ color: '#EDF4F6' }}>{score}</span>
          <span className="text-xs leading-none mt-0.5" style={{ color: '#7BAAB8' }}>/100</span>
        </div>
      </div>
      <span className="text-xs font-medium" style={{ color }}>{label}</span>
    </div>
  )
}

function StarFull({ filled }: { filled: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill={filled ? '#FBBF24' : 'rgba(255,255,255,0.15)'}>
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  )
}

interface ProfileProps {
  pro: Professional
  navigate: NavigateFn
}

type ContractPhase = 'none' | 'proposed' | 'hired' | 'completed' | 'cancelled'

export default function Profile({ pro, navigate }: ProfileProps) {
  const { professionals, setReview, setContract, contracts, sendProposal } = useStore()
  const activePro = professionals.find(p => p.id === pro.id) ?? pro
  const [activeTab, setActiveTab] = useState<'about' | 'portfolio' | 'reviews'>('about')
  const [showProposal, setShowProposal] = useState(false)
  const [proposalSent, setProposalSent] = useState(false)
  const [proposalDesc, setProposalDesc] = useState('')
  const [proposalBudget, setProposalBudget] = useState('')
  const [rating, setRating] = useState(0)
  const [reviewText, setReviewText] = useState('')
  const [reviewSent, setReviewSent] = useState(false)
  const [lightboxImg, setLightboxImg] = useState<string | null>(null)

  // Flujo contratar -> concluir -> avaliar (global, persistido)
  const storedContract = contracts.find(c => c.proId === activePro.id)
  const [phase, setPhase] = useState<ContractPhase>(storedContract?.phase ?? 'none')
  const [showHire, setShowHire] = useState(false)
  const [hireDetails, setHireDetails] = useState({
    budget: storedContract?.budget ?? '',
    deadline: storedContract?.deadline ?? '',
    scope: storedContract?.scope ?? '',
  })
  const [showComplete, setShowComplete] = useState(false)
  const [completedNote, setCompletedNote] = useState('')
  const [justCompleted, setJustCompleted] = useState(storedContract?.phase === 'completed')
  const [erro, setErro] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)

  const hireBudget = hireDetails.budget.trim()
  const hireDeadline = hireDetails.deadline.trim()
  const hireScope = hireDetails.scope.trim()
  const canHire = hireBudget && hireDeadline && hireScope

  const handleHire = async () => {
    if (!canHire || ocupado) return
    setOcupado(true)
    setErro(null)
    try {
      await setContract(activePro.id, {
        proId: activePro.id,
        phase: 'hired',
        budget: hireBudget,
        deadline: hireDeadline,
        scope: hireScope,
        hiredAt: new Date().toISOString(),
      })
      setPhase('hired')
      setShowHire(false)
    } catch (e) {
      setErro((e as Error)?.message || 'Não foi possível criar o contrato.')
    } finally {
      setOcupado(false)
    }
  }

  const handleComplete = async () => {
    if (ocupado) return
    setOcupado(true)
    setErro(null)
    try {
      await setContract(activePro.id, {
        proId: activePro.id,
        phase: 'completed',
        budget: hireBudget,
        deadline: hireDeadline,
        scope: hireScope,
        hiredAt: storedContract?.hiredAt ?? new Date().toISOString(),
      })
      setPhase('completed')
      setShowComplete(false)
      setJustCompleted(true)
      setActiveTab('reviews')
      setReviewSent(false)
      setRating(0)
      setReviewText('')
    } catch (e) {
      setErro((e as Error)?.message || 'Não foi possível concluir o serviço.')
    } finally {
      setOcupado(false)
    }
  }

  const handleReviewPublish = async () => {
    if (rating === 0 || !reviewText.trim() || ocupado) return
    setOcupado(true)
    setErro(null)
    try {
      await setReview(activePro.id, {
        rating,
        text: reviewText.trim(),
        date: new Date().toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' }),
      })
      setReviewSent(true)
    } catch (e) {
      setErro((e as Error)?.message || 'Não foi possível publicar a avaliação.')
    } finally {
      setOcupado(false)
    }
  }

  return (
    <div className="min-h-screen" style={{ background: '#061E26' }}>
      {/* Breadcrumb */}
      <div className="max-w-5xl mx-auto px-4 pt-6 pb-2">
        <button onClick={() => navigate('explore')}
          className="flex items-center gap-1.5 text-sm transition-colors"
          style={{ color: '#7BAAB8' }}
          onMouseEnter={e => (e.currentTarget.style.color = '#EDF4F6')}
          onMouseLeave={e => (e.currentTarget.style.color = '#7BAAB8')}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="m15 18-6-6 6-6" />
          </svg>
          Voltar aos resultados
        </button>
      </div>

      <div className="max-w-5xl mx-auto px-4 pb-16">
        {/* Hero section */}
        <div className="rounded-2xl overflow-hidden mb-6" style={{ background: '#0D2E38', border: '1px solid rgba(255,255,255,0.06)' }}>
          {/* Banner */}
          <div className="h-28 relative"
            style={{ background: 'linear-gradient(135deg, #1A4050 0%, #0D3545 50%, #1A3D4A 100%)' }}>
            <div className="absolute inset-0 opacity-20"
              style={{ backgroundImage: 'radial-gradient(circle at 20% 50%, #E8A020 0%, transparent 60%), radial-gradient(circle at 80% 20%, #38BDF8 0%, transparent 50%)' }} />
          </div>

          <div className="px-6 pb-6">
            <div className="flex flex-col sm:flex-row sm:items-end gap-4 -mt-10 mb-5">
              <div className="relative">
                <img src={activePro.avatar} alt={activePro.name} data-african-avatar="true" loading="lazy" decoding="async"
                  className="w-20 h-20 rounded-2xl object-cover ring-4 ring-[#0D2E38]"
                  style={{ background: '#1A4050' }} />
                {activePro.available && (
                  <span className="absolute -bottom-1 -right-1 flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
                    style={{ background: 'rgba(52,211,153,0.15)', color: '#34D399', border: '1px solid rgba(52,211,153,0.3)' }}>
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                    Disponível
                  </span>
                )}
              </div>

              <div className="flex-1">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h1 className="font-serif text-2xl flex items-center gap-2" style={{ color: '#EDF4F6' }}>
                      {activePro.name}
                      {activePro.verified && (
                        <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-sans"
                          style={{ background: 'rgba(56,189,248,0.12)', color: '#38BDF8', border: '1px solid rgba(56,189,248,0.25)' }}>
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <path d="M9 12l2 2 4-4" />
                          </svg>
                          Verificado
                        </span>
                      )}
                    </h1>
                    <p style={{ color: '#E8A020' }} className="font-medium">{activePro.profession}</p>
                    <div className="flex items-center gap-3 mt-1 text-xs" style={{ color: '#7BAAB8' }}>
                      <span>📍 {activePro.location}</span>
                      <span>⏱ Responde {activePro.responseTime}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map(i => <StarFull key={i} filled={i <= Math.round(activePro.rating)} />)}
                      <span className="text-sm ml-1" style={{ color: '#EDF4F6' }}>{activePro.rating}</span>
                      <span className="text-xs" style={{ color: '#7BAAB8' }}>({activePro.reviews} avaliações)</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Stats + Score + CTA */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
              <div className="flex gap-6">
                <div className="text-center">
                  <div className="font-bold text-lg" style={{ color: '#EDF4F6' }}>{activePro.jobsCompleted}</div>
                  <div className="text-xs" style={{ color: '#7BAAB8' }}>Trabalhos</div>
                </div>
                <div className="text-center">
                  <div className="font-bold text-lg" style={{ color: '#EDF4F6' }}>{activePro.reviews}</div>
                  <div className="text-xs" style={{ color: '#7BAAB8' }}>Avaliações</div>
                </div>
                <div className="text-center">
                  <div className="font-bold text-lg" style={{ color: '#EDF4F6' }}>
                    {activePro.hourlyRate.toLocaleString()}
                  </div>
                  <div className="text-xs" style={{ color: '#7BAAB8' }}>MZN/hora</div>
                </div>
              </div>

              <div className="sm:ml-auto flex items-center gap-4">
                <ScoreRing score={activePro.score} size={76} />
                {phase === 'completed' ? (
                  <span className="flex items-center gap-2 px-6 py-3 rounded-xl font-semibold"
                    style={{ background: 'rgba(52,211,153,0.12)', color: '#34D399', border: '1px solid rgba(52,211,153,0.3)' }}>
                    ✅ Trabalho Concluído
                  </span>
                ) : phase === 'hired' ? (
                  <button
                    onClick={() => setShowComplete(true)}
                    className="px-6 py-3 rounded-xl font-semibold transition-all duration-200"
                    style={{ background: '#34D399', color: '#063A33' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#2BBF85')}
                    onMouseLeave={e => (e.currentTarget.style.background = '#34D399')}
                  >
                    ✓ Marcar como Concluído
                  </button>
                ) : (
                  <button
                    onClick={() => phase === 'proposed' ? setShowHire(true) : setShowProposal(true)}
                    className="px-6 py-3 rounded-xl font-semibold transition-all duration-200"
                    style={{ background: phase === 'proposed' ? '#38BDF8' : '#E8A020', color: '#fff' }}
                    onMouseEnter={e => (e.currentTarget.style.background = phase === 'proposed' ? '#0EA5E9' : '#D08C10')}
                    onMouseLeave={e => (e.currentTarget.style.background = phase === 'proposed' ? '#38BDF8' : '#E8A020')}
                  >
                    {phase === 'proposed' ? 'Contratar' : 'Solicitar Orçamento'}
                  </button>
                )}
                {/* Nampula fecha-se por chamada, não por formulaire. O WhatsApp é o
                    canal real: o botão só aparece se o técnico deixou o número público. */}
                {activePro.whatsapp && (
                  <a
                    href={activePro.whatsapp}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-5 py-3 rounded-xl font-semibold border transition-colors"
                    style={{ color: '#34D399', borderColor: 'rgba(52,211,153,0.35)' }}
                  >
                    WhatsApp
                  </a>
                )}
                {activePro.phone && (
                  <a
                    href={`tel:${activePro.phone.replace(/\s/g, '')}`}
                    className="px-5 py-3 rounded-xl font-semibold border transition-colors"
                    style={{ color: '#7BAAB8', borderColor: 'rgba(255,255,255,0.15)' }}
                  >
                    Ligar
                  </a>
                )}
                {/* `erro` é preenchido por cada acção e sem isto o utilizador
                    carregava no botão e nãovia nada acontecer. */}
                {erro && (
                  <p className="w-full text-sm font-medium" style={{ color: '#F87171' }} role="alert">
                    {erro}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Main content */}
          <div className="lg:col-span-2">
            {/* Tabs */}
            <div className="flex gap-1 mb-5 p-1 rounded-xl" style={{ background: '#0D2E38' }}>
              {([
                { id: 'about', label: 'Sobre' },
                { id: 'portfolio', label: `Portfólio (${activePro.portfolio.length})` },
                { id: 'reviews', label: `Avaliações (${activePro.reviews})` },
              ] as const).map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className="flex-1 py-2 rounded-lg text-sm font-medium transition-all"
                  style={{
                    background: activeTab === tab.id ? 'rgba(232,160,32,0.15)' : 'transparent',
                    color: activeTab === tab.id ? '#E8A020' : '#7BAAB8',
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {activeTab === 'about' && (
              <div className="space-y-5">
                <div className="p-5 rounded-2xl" style={{ background: '#0D2E38', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <h3 className="font-semibold mb-3" style={{ color: '#EDF4F6' }}>Sobre</h3>
                  <p className="text-sm leading-relaxed" style={{ color: '#7BAAB8' }}>{activePro.bio}</p>
                </div>

                <div className="p-5 rounded-2xl" style={{ background: '#0D2E38', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <h3 className="font-semibold mb-3" style={{ color: '#EDF4F6' }}>Competências</h3>
                  <div className="flex flex-wrap gap-2">
                    {activePro.skills.map(skill => (
                      <span key={skill} className="px-3 py-1.5 rounded-lg text-sm"
                        style={{ background: 'rgba(232,160,32,0.08)', color: '#E8A020', border: '1px solid rgba(232,160,32,0.2)' }}>
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'portfolio' && (
              <div>
                {activePro.portfolio.length === 0 ? (
                  <div className="p-12 rounded-2xl text-center" style={{ background: '#0D2E38', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <p style={{ color: '#7BAAB8' }}>Portfólio ainda não adicionado.</p>
                  </div>
                ) : (
                  <div className="grid sm:grid-cols-2 gap-4">
                    {activePro.portfolio.map(item => (
                      <div key={item.id} className="rounded-2xl overflow-hidden cursor-pointer group"
                        style={{ background: '#0D2E38', border: '1px solid rgba(255,255,255,0.06)' }}
                        onClick={() => setLightboxImg(item.image)}>
                        <div className="relative overflow-hidden">
                          <img src={item.image} alt={item.title} loading="lazy" decoding="async"
                            className="w-full h-44 object-cover transition-transform duration-300 group-hover:scale-105"
                            style={{ background: '#1A4050' }} />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all duration-300 flex items-center justify-center">
                            <svg className="opacity-0 group-hover:opacity-100 transition-opacity duration-300" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
                              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                            </svg>
                          </div>
                        </div>
                        <div className="p-4">
                          <div className="font-medium text-sm mb-1" style={{ color: '#EDF4F6' }}>{item.title}</div>
                          <div className="text-xs" style={{ color: '#7BAAB8' }}>{item.description}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'reviews' && (
              <div className="space-y-4">
                {activePro.testimonials.map(t => (
                  <div key={t.id} className="p-5 rounded-2xl" style={{ background: '#0D2E38', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <div className="flex items-start gap-3 mb-3">
                      <img src={t.avatar} alt={t.author} loading="lazy" decoding="async"
                        className="w-10 h-10 rounded-xl object-cover flex-shrink-0"
                        style={{ background: '#1A4050' }} />
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-sm" style={{ color: '#EDF4F6' }}>{t.author}</span>
                          <span className="text-xs" style={{ color: '#7BAAB8' }}>{t.date}</span>
                        </div>
                        <div className="flex gap-0.5 mt-1">
                          {[1, 2, 3, 4, 5].map(i => <StarFull key={i} filled={i <= t.rating} />)}
                        </div>
                      </div>
                    </div>
                    <p className="text-sm leading-relaxed" style={{ color: '#7BAAB8' }}>{t.text}</p>
                  </div>
                ))}

                {/* Leave review */}
                {!reviewSent ? (
                  <div className="p-5 rounded-2xl" style={{ background: '#0D2E38', border: '1px solid rgba(232,160,32,0.15)' }}>
                    <h4 className="font-semibold text-sm mb-4" style={{ color: '#EDF4F6' }}>Deixar Avaliação</h4>
                    <div className="flex gap-1 mb-3">
                      {[1, 2, 3, 4, 5].map(i => (
                        <button key={i} onClick={() => setRating(i)}>
                          <svg width="22" height="22" viewBox="0 0 24 24"
                            fill={i <= rating ? '#FBBF24' : 'rgba(255,255,255,0.12)'}
                            className="transition-transform hover:scale-110">
                            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                          </svg>
                        </button>
                      ))}
                    </div>
                    <textarea
                      value={reviewText}
                      onChange={e => setReviewText(e.target.value)}
                      rows={3}
                      placeholder="Conte como foi a sua experiência..."
                      className="w-full px-3 py-2.5 rounded-lg text-sm outline-none resize-none mb-3"
                      style={{ background: 'rgba(6,30,38,0.8)', border: '1px solid rgba(255,255,255,0.1)', color: '#EDF4F6' }}
                    />
                    <button
                      onClick={handleReviewPublish}
                      disabled={rating === 0 || !reviewText.trim()}
                      className="px-6 py-2 rounded-lg text-sm font-medium transition-all"
                      style={{
                        background: rating > 0 && reviewText.trim() ? '#E8A020' : 'rgba(255,255,255,0.06)',
                        color: rating > 0 && reviewText.trim() ? '#fff' : '#3D6878',
                      }}
                    >
                      Publicar avaliação
                    </button>
                  </div>
                ) : (
                  <div className="p-5 rounded-2xl text-center" style={{ background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.2)' }}>
                    <div className="text-2xl mb-2">✅</div>
                    <p className="font-medium text-sm" style={{ color: '#34D399' }}>Avaliação publicada! Obrigado pelo feedback.</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* JOBTEC Skill Card */}
            <div className="rounded-2xl overflow-hidden"
              style={{ background: 'linear-gradient(135deg, #1A4050 0%, #0D2E38 60%, #132C37 100%)', border: '1px solid rgba(232,160,32,0.2)' }}>
              {/* Card header */}
              <div className="flex items-center justify-between px-4 py-3"
                style={{ borderBottom: '1px solid rgba(232,160,32,0.15)' }}>
                <div className="flex items-center gap-2">
                  <div className="rounded overflow-hidden px-1 py-0.5" style={{ background: '#fff' }}>
                    <img src={jobtecLogo} alt="JOBTEC"
                      style={{ height: 18, width: 'auto', objectFit: 'contain', display: 'block' }} />
                  </div>
                  <span className="text-xs font-bold tracking-widest" style={{ color: '#E8A020' }}>SKILL CARD</span>
                </div>
                <span className="text-xs" style={{ color: '#3D6878' }}>JOBTEC™</span>
              </div>

              <div className="p-4">
                <div className="flex items-center gap-3 mb-4">
                  <img src={activePro.avatar} alt={activePro.name} loading="lazy" decoding="async"
                    className="w-12 h-12 rounded-xl object-cover"
                    style={{ background: '#1A4050' }} />
                  <div>
                    <div className="font-semibold text-sm" style={{ color: '#EDF4F6' }}>{activePro.name}</div>
                    <div className="text-xs" style={{ color: '#E8A020' }}>{activePro.profession}</div>
                    <div className="text-xs mt-0.5" style={{ color: '#7BAAB8' }}>{activePro.location} • {activePro.province}</div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5 mb-4">
                  {activePro.skills.map(skill => (
                    <span key={skill} className="text-xs px-2 py-0.5 rounded-full"
                      style={{ background: 'rgba(232,160,32,0.12)', color: '#E8A020', border: '1px solid rgba(232,160,32,0.2)' }}>
                      {skill}
                    </span>
                  ))}
                </div>

                <div className="flex items-center justify-between pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                  <div>
                    <div className="text-xs mb-1" style={{ color: '#7BAAB8' }}>JOBTEC Score</div>
                    <div className="font-bold text-2xl" style={{
                      color: activePro.score >= 90 ? '#34D399' : activePro.score >= 75 ? '#E8A020' : '#FBBF24'
                    }}>
                      {activePro.score}
                      <span className="text-xs font-normal ml-1" style={{ color: '#7BAAB8' }}>/100</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs" style={{ color: '#7BAAB8' }}>Trabalhos</div>
                    <div className="font-bold text-xl" style={{ color: '#EDF4F6' }}>{activePro.jobsCompleted}</div>
                    {activePro.verified && (
                      <div className="text-xs mt-1" style={{ color: '#38BDF8' }}>✓ Verificado</div>
                    )}
                  </div>
                </div>

                {/* QR placeholder */}
                <div className="mt-3 flex items-center gap-2">
                  <div className="w-10 h-10 rounded-lg grid grid-cols-3 grid-rows-3 gap-0.5 p-1"
                    style={{ background: 'rgba(255,255,255,0.06)' }}>
                    {Array.from({ length: 9 }).map((_, i) => (
                      <div key={i} className="rounded-sm"
                        style={{ background: [0, 2, 6, 8, 4].includes(i) ? '#E8A020' : 'rgba(255,255,255,0.15)' }} />
                    ))}
                  </div>
                  <span className="text-xs" style={{ color: '#3D6878' }}>ID: JT-{String(activePro.id).padStart(4, '0')}-NMP</span>
                </div>
              </div>
            </div>

            {/* Pricing card */}
            <div className="p-4 rounded-2xl" style={{ background: '#0D2E38', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="font-bold text-2xl" style={{ color: '#EDF4F6' }}>
                    {activePro.hourlyRate.toLocaleString()} MZN
                  </div>
                  <div className="text-xs" style={{ color: '#7BAAB8' }}>por hora</div>
                </div>
                <span className="text-xs px-2 py-1 rounded-lg"
                  style={{ background: 'rgba(255,255,255,0.06)', color: '#7BAAB8' }}>
                  Negociável
                </span>
              </div>
              <button
                onClick={() => setShowProposal(true)}
                disabled={proposalSent || phase === 'hired' || phase === 'completed'}
                className="w-full py-3 rounded-xl font-semibold text-sm mb-2 transition-all"
                style={{
                  background: phase === 'completed' ? 'rgba(52,211,153,0.15)' : phase === 'hired' ? 'rgba(56,189,248,0.15)' : proposalSent ? 'rgba(52,211,153,0.15)' : '#E8A020',
                  color: phase === 'completed' ? '#34D399' : phase === 'hired' ? '#38BDF8' : proposalSent ? '#34D399' : '#fff',
                }}
                onMouseEnter={e => { if (!proposalSent && phase === 'none') e.currentTarget.style.background = '#D08C10' }}
                onMouseLeave={e => { if (!proposalSent && phase === 'none') e.currentTarget.style.background = '#E8A020' }}
              >
                {phase === 'completed' ? '✓ Trabalho Concluído' : phase === 'hired' ? '🔵 Contrato Activo' : proposalSent ? '✓ Proposta Enviada' : 'Solicitar Orçamento'}
              </button>
              {phase !== 'none' && phase !== 'proposed' && (
                <button
                  onClick={() => phase === 'hired' ? setShowComplete(true) : null}
                  className="w-full py-3 rounded-xl font-semibold text-sm transition-all"
                  style={{
                    background: phase === 'hired' ? '#34D399' : 'rgba(52,211,153,0.12)',
                    color: phase === 'hired' ? '#063A33' : '#34D399',
                    border: phase === 'completed' ? '1px solid rgba(52,211,153,0.3)' : 'none',
                  }}
                  onMouseEnter={e => { if (phase === 'hired') e.currentTarget.style.background = '#2BBF85' }}
                  onMouseLeave={e => { if (phase === 'hired') e.currentTarget.style.background = '#34D399' }}
                >
                  {phase === 'hired' ? '✓ Marcar como Concluído' : '✅ Serviço Concluído'}
                </button>
              )}
              {phase === 'proposed' && (
                <button
                  onClick={() => setShowHire(true)}
                  className="w-full py-3 rounded-xl font-semibold text-sm mb-2 transition-all"
                  style={{ background: '#38BDF8', color: '#fff' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#0EA5E9')}
                  onMouseLeave={e => (e.currentTarget.style.background = '#38BDF8')}
                >
                  Assinar Contrato & Contratar
                </button>
              )}
              <div className="text-xs text-center" style={{ color: '#3D6878' }}>
                Sem compromisso • Resposta rápida
              </div>
            </div>

            {/* Quick info */}
            <div className="p-4 rounded-2xl space-y-3" style={{ background: '#0D2E38', border: '1px solid rgba(255,255,255,0.06)' }}>
              {[
                { icon: '📍', label: 'Localização', value: activePro.location },
                { icon: '⏱', label: 'Tempo de resposta', value: activePro.responseTime },
                { icon: '✅', label: 'Trabalhos concluídos', value: `${activePro.jobsCompleted}` },
                { icon: '🌐', label: 'Línguas', value: 'Português, Emakhuwa' },
              ].map(info => (
                <div key={info.label} className="flex items-center justify-between text-sm">
                  <span style={{ color: '#7BAAB8' }}>{info.icon} {info.label}</span>
                  <span className="font-medium" style={{ color: '#EDF4F6' }}>{info.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Proposal modal */}
      {showProposal && !proposalSent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
          onClick={e => e.target === e.currentTarget && setShowProposal(false)}>
          <div className="w-full max-w-md rounded-2xl overflow-hidden" style={{ background: '#0D2E38', border: '1px solid rgba(255,255,255,0.1)' }}>
            <div className="flex items-center justify-between p-5" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <div>
                <h3 className="font-semibold" style={{ color: '#EDF4F6' }}>Solicitar Orçamento</h3>
                <p className="text-xs mt-0.5" style={{ color: '#7BAAB8' }}>Para {activePro.name}</p>
              </div>
              <button onClick={() => setShowProposal(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: 'rgba(255,255,255,0.06)', color: '#7BAAB8' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: '#7BAAB8' }}>
                  Descreva o serviço *
                </label>
                <textarea
                  value={proposalDesc}
                  onChange={e => setProposalDesc(e.target.value)}
                  rows={4}
                  placeholder="Descreva detalhadamente o que precisa..."
                  className="w-full px-3 py-2.5 rounded-lg text-sm outline-none resize-none"
                  style={{ background: 'rgba(6,30,38,0.8)', border: '1px solid rgba(255,255,255,0.1)', color: '#EDF4F6' }}
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: '#7BAAB8' }}>
                  Orçamento disponível (MZN)
                </label>
                <input
                  type="text"
                  value={proposalBudget}
                  onChange={e => setProposalBudget(e.target.value)}
                  placeholder="Ex: 20.000"
                  className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
                  style={{ background: 'rgba(6,30,38,0.8)', border: '1px solid rgba(255,255,255,0.1)', color: '#EDF4F6' }}
                />
              </div>
              <button
                onClick={async () => {
                  if (ocupado) return
                  setOcupado(true)
                  setErro(null)
                  try {
                    await sendProposal(activePro.id, {
                      valor: parseInt(proposalBudget.replace(/[^\d]/g, '')) || activePro.hourlyRate,
                      prazo: 'A combinar',
                      descricao: proposalDesc.trim(),
                    })
                    setProposalSent(true)
                    setShowProposal(false)
                    setPhase('proposed')
                  } catch (e) {
                    setErro((e as Error)?.message || 'Não foi possível enviar a solicitação.')
                  } finally {
                    setOcupado(false)
                  }
                }}
                disabled={!proposalDesc.trim() || ocupado}
                className="w-full py-3 rounded-xl font-semibold text-sm transition-all disabled:opacity-60"
                style={{
                  background: proposalDesc.trim() ? '#E8A020' : 'rgba(255,255,255,0.06)',
                  color: proposalDesc.trim() ? '#fff' : '#3D6878',
                }}
              >
                {ocupado ? 'A enviar…' : 'Enviar Solicitação'}
              </button>
            </div>
          </div>
        </div>
      )}

      {proposalSent && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-4 rounded-2xl shadow-2xl"
          style={{ background: '#0D2E38', border: '1px solid rgba(52,211,153,0.3)' }}>
          <span className="text-xl">✅</span>
          <div>
            <div className="font-semibold text-sm" style={{ color: '#34D399' }}>Solicitação enviada!</div>
            <div className="text-xs" style={{ color: '#7BAAB8' }}>{activePro.name} responderá em breve</div>
          </div>
        </div>
      )}

      {/* Hire modal */}
      {showHire && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
          onClick={e => e.target === e.currentTarget && setShowHire(false)}>
          <div className="w-full max-w-md rounded-2xl overflow-hidden" style={{ background: '#0D2E38', border: '1px solid rgba(56,189,248,0.2)' }}>
            <div className="flex items-center justify-between p-5" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <div>
                <h3 className="font-semibold" style={{ color: '#EDF4F6' }}>Contratar {activePro.name}</h3>
                <p className="text-xs mt-0.5" style={{ color: '#7BAAB8' }}>Defina os termos do contrato</p>
              </div>
              <button onClick={() => setShowHire(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: 'rgba(255,255,255,0.06)', color: '#7BAAB8' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: '#7BAAB8' }}>Orçamento acordado (MZN) *</label>
                <input
                  type="text"
                  value={hireDetails.budget}
                  onChange={e => setHireDetails(prev => ({ ...prev, budget: e.target.value }))}
                  placeholder="Ex: 25.000"
                  className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
                  style={{ background: 'rgba(6,30,38,0.8)', border: '1px solid rgba(255,255,255,0.1)', color: '#EDF4F6' }}
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: '#7BAAB8' }}>Prazo de entrega *</label>
                <input
                  type="text"
                  value={hireDetails.deadline}
                  onChange={e => setHireDetails(prev => ({ ...prev, deadline: e.target.value }))}
                  placeholder="Ex: 3 semanas"
                  className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
                  style={{ background: 'rgba(6,30,38,0.8)', border: '1px solid rgba(255,255,255,0.1)', color: '#EDF4F6' }}
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: '#7BAAB8' }}>Âmbito do trabalho *</label>
                <textarea
                  value={hireDetails.scope}
                  onChange={e => setHireDetails(prev => ({ ...prev, scope: e.target.value }))}
                  rows={3}
                  placeholder="Descreva exactamente o que será feito..."
                  className="w-full px-3 py-2.5 rounded-lg text-sm outline-none resize-none"
                  style={{ background: 'rgba(6,30,38,0.8)', border: '1px solid rgba(255,255,255,0.1)', color: '#EDF4F6' }}
                />
              </div>
              <button
                onClick={handleHire}
                disabled={!canHire}
                className="w-full py-3 rounded-xl font-semibold text-sm transition-all"
                style={{
                  background: canHire ? '#38BDF8' : 'rgba(255,255,255,0.06)',
                  color: canHire ? '#fff' : '#3D6878',
                }}
                onMouseEnter={e => { if (canHire) e.currentTarget.style.background = '#0EA5E9' }}
                onMouseLeave={e => { if (canHire) e.currentTarget.style.background = '#38BDF8' }}
              >
                Confirmar Contratação
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Complete modal */}
      {showComplete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
          onClick={e => e.target === e.currentTarget && setShowComplete(false)}>
          <div className="w-full max-w-md rounded-2xl overflow-hidden" style={{ background: '#0D2E38', border: '1px solid rgba(52,211,153,0.25)' }}>
            <div className="flex items-center justify-between p-5" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <div>
                <h3 className="font-semibold" style={{ color: '#EDF4F6' }}>Concluir Trabalho</h3>
                <p className="text-xs mt-0.5" style={{ color: '#7BAAB8' }}>Com {activePro.name} — confirme que o serviço terminou</p>
              </div>
              <button onClick={() => setShowComplete(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: 'rgba(255,255,255,0.06)', color: '#7BAAB8' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-5">
              <p className="text-sm mb-4 leading-relaxed" style={{ color: '#7BAAB8' }}>
                Ao confirmar, o trabalho será marcado como concluído e poderá avaliar o profissional.
              </p>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: '#7BAAB8' }}>Nota (opcional)</label>
                <textarea
                  value={completedNote}
                  onChange={e => setCompletedNote(e.target.value)}
                  rows={3}
                  placeholder="Como correu o trabalho?"
                  className="w-full px-3 py-2.5 rounded-lg text-sm outline-none resize-none mb-4"
                  style={{ background: 'rgba(6,30,38,0.8)', border: '1px solid rgba(255,255,255,0.1)', color: '#EDF4F6' }}
                />
              </div>
              <button
                onClick={handleComplete}
                className="w-full py-3 rounded-xl font-semibold text-sm transition-all"
                style={{ background: '#34D399', color: '#063A33' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#2BBF85')}
                onMouseLeave={e => (e.currentTarget.style.background = '#34D399')}
              >
                ✓ Confirmar Conclusão
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Completed toast */}
      {justCompleted && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-4 rounded-2xl shadow-2xl"
          style={{ background: '#0D2E38', border: '1px solid rgba(52,211,153,0.3)' }}
          onClick={() => setJustCompleted(false)}>
          <span className="text-xl">🎉</span>
          <div>
            <div className="font-semibold text-sm" style={{ color: '#34D399' }}>Trabalho concluído!</div>
            <div className="text-xs" style={{ color: '#7BAAB8' }}>Avalie o serviço abaixo • Clique para fechar</div>
          </div>
        </div>
      )}

      {/* Portfolio lightbox */}
      {lightboxImg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)' }}
          onClick={() => setLightboxImg(null)}>
          <button onClick={() => setLightboxImg(null)}
            className="absolute top-4 right-4 w-10 h-10 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(255,255,255,0.1)', color: '#EDF4F6' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
          <img src={lightboxImg} alt="Portfólio" className="max-w-full max-h-[85vh] rounded-2xl object-contain"
            style={{ background: '#0D2E38' }}
            onClick={e => e.stopPropagation()} />
        </div>
      )}
    </div>
  )
}
