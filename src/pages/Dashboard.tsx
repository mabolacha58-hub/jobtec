import { useMemo, useState } from 'react'
import { useStore } from '../context/store'
import AdminPanel from './AdminPanel'
import type { NavigateFn } from '../types'

interface DashboardProps {
  navigate: NavigateFn
}

export default function Dashboard({ navigate }: DashboardProps) {
  const { professionals, publishedJobs, contracts, userReviews, proposals, setProposalStatus, authUser } = useStore()
  const [tab, setTab] = useState<'matches' | 'jobs' | 'contracts' | 'reviews' | 'proposals'>('matches')
  // Proposta que está com o campo de valor acordado aberto.
  const [abrirValor, setAbrirValor] = useState<number | null>(null)
  const [valorAcordado, setValorAcordado] = useState('')

  if (authUser?.tipo === 'admin') {
    return <AdminPanel />
  }

  if (!authUser) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: '#061E26' }}>
        <div className="w-full max-w-md p-8 rounded-3xl text-center" style={{ background: '#0D2E38', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="text-4xl mb-4">🔐</div>
          <h1 className="font-serif text-3xl mb-2" style={{ color: '#EDF4F6' }}>Entre para ver o seu painel</h1>
          <p className="text-sm mb-6" style={{ color: '#7BAAB8' }}>
            O dashboard contém os seus serviços, propostas, contratos e avaliações.
          </p>
          <button
            onClick={() => navigate('home')}
            className="w-full py-3 rounded-xl text-sm font-semibold"
            style={{ background: '#E8A020', color: '#fff' }}
          >
            Voltar à página inicial
          </button>
        </div>
      </div>
    )
  }

  const myJobs = publishedJobs.filter(job => job.clientId === authUser.id)
  const myContracts = useMemo(
    () => contracts
      .filter(contract => contract.clientId === authUser.id)
      .map(c => ({ contract: c, pro: professionals.find(p => p.id === c.proId) }))
      .filter(x => x.pro),
    [authUser.id, contracts, professionals],
  )
  // O dashboard serve os dois lados do marketplace: o cliente envia pedidos
  // directos e recebe propostas para os seus serviços; o profissional recebe
  // pedidos directos e envia propostas. A API já diz quem pode decidir.
  const recebidas = proposals.filter(p => p.podeDecidir)
  const enviadas = proposals.filter(p => !p.podeDecidir)
  const myProposals = [...recebidas, ...enviadas]

  const activeContracts = myContracts.filter(x => x.contract.phase === 'hired')
  const completedContracts = myContracts.filter(x => x.contract.phase === 'completed')

  const matchesByJob = useMemo(() => {
    const map = new Map<string, ReturnType<typeof professionals.filter>>()
    for (const job of publishedJobs) {
      map.set(
        job.id,
        professionals
          .filter(p => p.category === job.category)
          .sort((a, b) => (b.available ? 1 : 0) - (a.available ? 1 : 0) || b.score - a.score)
          .slice(0, 2),
      )
    }
    return map
  }, [publishedJobs, professionals])

  const tabItems = [
    { id: 'matches' as const, label: 'Matches' },
    { id: 'jobs' as const, label: `Serviços (${myJobs.length})` },
    { id: 'proposals' as const, label: `Propostas (${recebidas.filter(p => p.status === 'enviada').length})` },
    { id: 'contracts' as const, label: `Contratos (${myContracts.length})` },
    { id: 'reviews' as const, label: `Avaliações (${Object.keys(userReviews).length})` },
  ]

  return (
    <div className="min-h-screen dashboard-shell" style={{ background: '#061E26' }}>
      {/* Header */}
      <div className="relative overflow-hidden px-4 pt-10 pb-12 dashboard-hero">
        <div className="dashboard-orb dashboard-orb-one" />
        <div className="dashboard-orb dashboard-orb-two" />
        <div className="max-w-6xl mx-auto relative">
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-7">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-semibold uppercase tracking-[0.14em] mb-5"
                style={{ color: '#8DE7C2', background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.22)' }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#34D399', boxShadow: '0 0 10px #34D399' }} />
                Conta activa
              </div>
              <p className="text-sm mb-2" style={{ color: '#8DB4BF' }}>Bom dia, {authUser.nome.split(' ')[0]}.</p>
              <h1 className="font-serif text-4xl sm:text-5xl leading-tight" style={{ color: '#F5FAFB' }}>O seu espaço de trabalho.</h1>
              <p className="max-w-xl mt-3 text-sm sm:text-base" style={{ color: '#8DB4BF' }}>
                Acompanhe serviços, encontre os profissionais certos e mantenha tudo sob controlo.
              </p>
            </div>
            <button
              onClick={() => navigate('post')}
              className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold transition-all dashboard-primary-button"
            >
              <span className="text-lg leading-none">+</span>
              Publicar serviço
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 pb-12 -mt-4 relative">
        {/* Summary stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-8">
          {[
            { label: 'Serviços publicados', value: myJobs.length, icon: '↗', tone: '#38BDF8', note: 'No seu histórico' },
            { label: 'Contratos activos', value: activeContracts.length, icon: '◉', tone: '#E8A020', note: 'Em andamento' },
            { label: 'Trabalhos concluídos', value: completedContracts.length, icon: '✓', tone: '#34D399', note: 'Entregas realizadas' },
            { label: 'Avaliações dadas', value: Object.keys(userReviews).length, icon: '★', tone: '#C4A7FF', note: 'A sua reputação' },
          ].map(s => (
            <div key={s.label} className="p-5 rounded-2xl dashboard-card dashboard-stat-card">
              <div className="flex items-start justify-between mb-5">
                <span className="w-9 h-9 rounded-xl flex items-center justify-center text-lg font-semibold"
                  style={{ color: s.tone, background: `${s.tone}18`, border: `1px solid ${s.tone}35` }}>
                  {s.icon}
                </span>
                <span className="text-[10px] uppercase tracking-wider" style={{ color: '#557F8B' }}>01</span>
              </div>
              <div className="font-bold text-3xl leading-none mb-2" style={{ color: '#F5FAFB' }}>{s.value}</div>
              <div className="text-xs font-medium" style={{ color: '#A5C2C9' }}>{s.label}</div>
              <div className="text-[11px] mt-1" style={{ color: '#527B87' }}>{s.note}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-8 p-1.5 rounded-2xl overflow-x-auto dashboard-card" style={{ background: 'rgba(13,46,56,0.8)' }}>
          {tabItems.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className="flex-shrink-0 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all dashboard-tab"
              style={{
                background: tab === t.id ? '#E8A020' : 'transparent',
                color: tab === t.id ? '#06242C' : '#7BAAB8',
                boxShadow: tab === t.id ? '0 6px 20px rgba(232,160,32,0.2)' : 'none',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Matches */}
        {tab === 'matches' && (
          <div className="space-y-3">
            <div className="flex items-end justify-between gap-4 mb-4">
              <div>
                <p className="text-lg font-semibold" style={{ color: '#EDF4F6' }}>Profissionais recomendados</p>
                <p className="text-sm mt-1" style={{ color: '#7BAAB8' }}>Correspondências inteligentes para os seus serviços.</p>
              </div>
              <span className="hidden sm:block text-xs" style={{ color: '#527B87' }}>Actualizado agora</span>
            </div>
            {myJobs.length === 0 ? (
              <EmptyState
                title="Sem serviços publicados"
                desc="Publique um serviço para receber recomendações."
                action={{ label: 'Publicar Serviço', onClick: () => navigate('post') }}
              />
            ) : (
              myJobs.map(job => {
                const matched = matchesByJob.get(job.id) ?? []
                return (
                  <div key={job.id} className="p-4 rounded-2xl" style={{ background: '#0D2E38', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <div className="font-medium text-sm" style={{ color: '#EDF4F6' }}>{job.title}</div>
                        <div className="text-xs" style={{ color: '#7BAAB8' }}>
                          {job.budget} MZN • {job.location} {job.urgent && '• ⚡'}
                        </div>
                      </div>
                      <span className="text-xs px-2 py-1 rounded-lg" style={{ background: 'rgba(56,189,248,0.1)', color: '#38BDF8' }}>
                        {job.id}
                      </span>
                    </div>
                    <div className="space-y-2">
                      {matched.map(pro => (
                        <button
                          key={pro.id}
                          onClick={() => navigate('profile', pro.id)}
                          className="w-full flex items-center gap-3 p-2.5 rounded-xl text-left transition-all hover:bg-white/5"
                          style={{ background: 'rgba(6,30,38,0.6)', border: '1px solid rgba(255,255,255,0.06)' }}
                        >
                          <img src={pro.avatar} alt={pro.name} data-african-avatar="true" loading="lazy" decoding="async"
                            className="w-10 h-10 rounded-xl object-cover"
                            style={{ background: '#1A4050' }} />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium" style={{ color: '#EDF4F6' }}>{pro.name}</div>
                            <div className="text-xs" style={{ color: '#E8A020' }}>{pro.profession}</div>
                          </div>
                          <span className="text-xs px-2 py-1 rounded-lg"
                            style={{ background: pro.available ? 'rgba(52,211,153,0.12)' : 'rgba(255,255,255,0.06)', color: pro.available ? '#34D399' : '#7BAAB8' }}>
                            {pro.available ? 'Disponível' : 'Score ' + pro.score}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        )}

        {/* Jobs */}
        {tab === 'jobs' && (
          <div className="space-y-3">
            {myJobs.length === 0 ? (
              <EmptyState
                title="Nenhum serviço publicado"
                desc="Os serviços que publicar aparecerão aqui."
                action={{ label: 'Publicar Serviço', onClick: () => navigate('post') }}
              />
            ) : (
              myJobs.map(job => (
                <div key={job.id} className="p-4 rounded-2xl" style={{ background: '#0D2E38', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="font-medium text-sm" style={{ color: '#EDF4F6' }}>{job.title}</div>
                    {job.urgent && <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(248,113,113,0.15)', color: '#F87171' }}>⚡ Urgente</span>}
                  </div>
                  <p className="text-xs mb-2 line-clamp-2" style={{ color: '#7BAAB8' }}>{job.description}</p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs" style={{ color: '#7BAAB8' }}>
                    <span>💰 {job.budget}{job.budgetMax ? `–${job.budgetMax}` : ''} MZN</span>
                    <span>📍 {job.location}</span>
                    <span>👤 {job.type === 'company' ? 'Empresa' : 'Particular'}: {job.name}</span>
                    <span style={{ color: '#3D6878' }}>{new Date(job.postedAt).toLocaleDateString('pt-PT')}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Contracts */}
        {tab === 'contracts' && (
          <div className="space-y-3">
            {myContracts.length === 0 ? (
              <EmptyState
                title="Sem contratos"
                desc="Quando contratar um profissional, o contrato aparecerá aqui."
                action={{ label: 'Explorar Profissionais', onClick: () => navigate('explore') }}
              />
            ) : (
              myContracts.map(({ contract, pro }) => {
                const phaseLabel =
                  contract.phase === 'hired' ? { text: 'Contrato Activo', color: '#38BDF8', bg: 'rgba(56,189,248,0.12)' }
                  : contract.phase === 'completed' ? { text: 'Concluído', color: '#34D399', bg: 'rgba(52,211,153,0.12)' }
                  : contract.phase === 'cancelled' ? { text: 'Cancelado', color: '#F87171', bg: 'rgba(248,113,113,0.12)' }
                  : { text: 'Proposta', color: '#E8A020', bg: 'rgba(232,160,32,0.12)' }
                return (
                  <div key={contract.proId} className="p-4 rounded-2xl flex items-center gap-3"
                    style={{ background: '#0D2E38', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <img src={pro!.avatar} alt={pro!.name} loading="lazy" decoding="async"
                      className="w-12 h-12 rounded-xl object-cover"
                      style={{ background: '#1A4050' }} />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm" style={{ color: '#EDF4F6' }}>{pro!.name}</div>
                      <div className="text-xs" style={{ color: '#7BAAB8' }}>
                        {contract.budget} MZN • {contract.deadline}
                      </div>
                    </div>
                    <span className="text-xs px-2.5 py-1 rounded-lg flex-shrink-0" style={{ background: phaseLabel.bg, color: phaseLabel.color }}>
                      {phaseLabel.text}
                    </span>
                  </div>
                )
              })
            )}
          </div>
        )}

        {/* Reviews */}
        {tab === 'reviews' && (
          <div className="space-y-3">
            {Object.keys(userReviews).length === 0 ? (
              <EmptyState
                title="Sem avaliações"
                desc="As avaliações que der aos profissionais aparecerão aqui."
                action={{ label: 'Explorar Profissionais', onClick: () => navigate('explore') }}
              />
            ) : (
              Object.entries(userReviews).map(([proId, rev]) => {
                const pro = professionals.find(p => p.id === Number(proId))
                return (
                  <div key={proId} className="p-4 rounded-2xl" style={{ background: '#0D2E38', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <div className="flex items-center gap-3 mb-2">
                      <img src={pro?.avatar} alt={pro?.name} loading="lazy" decoding="async"
                        className="w-10 h-10 rounded-xl object-cover"
                        style={{ background: '#1A4050' }} />
                      <div className="flex-1">
                        <div className="text-sm font-medium" style={{ color: '#EDF4F6' }}>{pro?.name}</div>
                        <div className="flex gap-0.5 mt-0.5">
                          {[1, 2, 3, 4, 5].map(i => (
                            <span key={i} style={{ color: i <= rev.rating ? '#FBBF24' : 'rgba(255,255,255,0.15)' }}>★</span>
                          ))}
                          <span className="text-xs ml-1" style={{ color: '#7BAAB8' }}>{rev.date}</span>
                        </div>
                      </div>
                    </div>
                    <p className="text-sm" style={{ color: '#7BAAB8' }}>{rev.text}</p>
                  </div>
                )
              })
            )}
          </div>
        )}

        {/* Propostas */}
        {tab === 'proposals' && (
          <div className="space-y-3">
            {myProposals.length === 0 ? (
              <EmptyState
                title="Sem propostas"
                desc="Quando solicitar um orçamento, a proposta aparecerá aqui para aceitar ou recusar."
                action={{ label: 'Explorar Profissionais', onClick: () => navigate('explore') }}
              />
            ) : (
              myProposals.map(p => (
                <div key={p.id} className="p-4 rounded-2xl" style={{ background: '#0D2E38', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div className="flex items-start gap-3">
                    <img src={p.proAvatar} alt={p.proName} loading="lazy" decoding="async"
                      className="w-12 h-12 rounded-xl object-cover"
                      style={{ background: '#1A4050' }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm" style={{ color: '#EDF4F6' }}>
                          {/* Numa proposta que enviamos, quem decide é a outra
                              parte — mostramos o cliente, não o profissional. */}
                          {p.podeDecidir ? p.proName : p.clienteNome || p.proName}
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded-full flex-shrink-0"
                          style={
                            p.status === 'aceita' ? { background: 'rgba(52,211,153,0.12)', color: '#34D399' }
                            : p.status === 'recusada' ? { background: 'rgba(248,113,113,0.12)', color: '#F87171' }
                            : { background: 'rgba(232,160,32,0.12)', color: '#E8A020' }
                          }>
                          {p.status === 'aceita' ? 'Aceita' : p.status === 'recusada' ? 'Recusada' : 'Enviada'}
                        </span>
                      </div>
                      <div className="text-xs" style={{ color: '#E8A020' }}>{p.proProfession}</div>
                      <p className="text-xs mt-1.5 leading-relaxed" style={{ color: '#7BAAB8' }}>{p.descricao}</p>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs" style={{ color: '#7BAAB8' }}>
                        <span>💰 {p.valor.toLocaleString()} MZN</span>
                        <span>⏱ {p.prazo}</span>
                        <span style={{ color: '#3D6878' }}>{new Date(p.criadaEm).toLocaleDateString('pt-PT')}</span>
                      </div>
                      {!p.podeDecidir && p.status === 'enviada' && (
                        <p className="text-xs mt-3" style={{ color: '#3D6878' }}>A aguardar resposta.</p>
                      )}
                      {p.podeDecidir && p.status === 'enviada' && (
                        <div className="mt-3">
                          <label className="flex items-start gap-2 text-xs cursor-pointer" style={{ color: '#7BAAB8' }}>
                            <input type="checkbox" checked={abrirValor === p.id} onChange={e => setAbrirValor(e.target.checked ? p.id : null)}
                              className="w-4 h-4 mt-0.5 accent-[#34D399]" />
                            <span>Fechámos noutro valor. Qual foi o acordado?</span>
                          </label>
                          {abrirValor === p.id && (
                            <div className="flex flex-wrap items-center gap-2 mt-2">
                              <input type="number" min={0} value={valorAcordado} placeholder={String(p.valor)}
                                onChange={e => setValorAcordado(e.target.value)}
                                className="w-32 px-3 py-2 rounded-lg text-sm outline-none"
                                style={{ background: 'rgba(4,24,31,0.58)', border: '1px solid rgba(255,255,255,0.12)', color: '#EDF4F6' }} />
                              <span className="text-xs" style={{ color: '#5C8894' }}>MZN</span>
                            </div>
                          )}
                          <div className="flex gap-2 mt-3">
                            <button
                              onClick={() => setProposalStatus(p.id, 'aceita', valorAcordado ? Number(valorAcordado) : undefined)}
                              className="px-4 py-2 rounded-lg text-xs font-semibold"
                              style={{ background: '#34D399', color: '#063A33' }}
                            >
                              ✓ Aceitar e Contratar
                            </button>
                            <button
                              onClick={() => setProposalStatus(p.id, 'recusada')}
                              className="px-4 py-2 rounded-lg text-xs font-medium"
                              style={{ background: 'rgba(255,255,255,0.06)', color: '#7BAAB8', border: '1px solid rgba(255,255,255,0.1)' }}
                            >
                              Recusar
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function EmptyState({ title, desc, action }: { title: string; desc: string; action: { label: string; onClick: () => void } }) {
  return (
    <div className="p-10 rounded-2xl text-center" style={{ background: '#0D2E38', border: '1px solid rgba(255,255,255,0.06)' }}>
      <div className="text-3xl mb-3">📭</div>
      <div className="font-medium mb-1" style={{ color: '#EDF4F6' }}>{title}</div>
      <p className="text-sm mb-4" style={{ color: '#7BAAB8' }}>{desc}</p>
      <button
        onClick={action.onClick}
        className="px-5 py-2.5 rounded-xl text-sm font-semibold"
        style={{ background: '#E8A020', color: '#fff' }}
      >
        {action.label}
      </button>
    </div>
  )
}
