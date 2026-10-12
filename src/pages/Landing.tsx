import { useState } from 'react'
import { professionals, categories, recentJobs } from '../data'
import type { NavigateFn } from '../types'
import jobtecLogo from '../imports/IMG-20260828-WA0004.jpg'
import universusLogo from '../imports/UNIVERSUS-logo.jpg'

function ScoreRing({ score, size = 48 }: { score: number; size?: number }) {
  const r = (size - 6) / 2
  const circ = 2 * Math.PI * r
  const offset = circ * (1 - score / 100)
  const color = score >= 90 ? '#34D399' : score >= 75 ? '#E8A020' : '#FBBF24'
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="4" />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="4"
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 1s ease' }} />
    </svg>
  )
}

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <svg key={i} width="12" height="12" viewBox="0 0 24 24" fill={i <= Math.round(rating) ? '#FBBF24' : 'rgba(255,255,255,0.15)'}>
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
      ))}
    </div>
  )
}

interface LandingProps {
  navigate: NavigateFn
}

export default function Landing({ navigate }: LandingProps) {
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('')

  const handleSearch = () => {
    navigate('explore')
  }

  const featured = [0, 1, 2, 8]
    .map(index => professionals[index])
    .filter((pro): pro is (typeof professionals)[number] => Boolean(pro))

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden pt-20 pb-24 px-4"
        style={{ background: 'linear-gradient(160deg, #061E26 0%, #0D2E38 50%, #061E26 100%)' }}>
        {/* Background decoration */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-20 -right-20 w-96 h-96 rounded-full opacity-10"
            style={{ background: 'radial-gradient(circle, #E8A020, transparent 70%)' }} />
          <div className="absolute bottom-0 -left-20 w-80 h-80 rounded-full opacity-5"
            style={{ background: 'radial-gradient(circle, #38BDF8, transparent 70%)' }} />
        </div>

        <div className="relative max-w-5xl mx-auto text-center">
          {/* Logo mark */}
          <div className="flex justify-center mb-8">
            <div className="inline-block rounded-2xl overflow-hidden p-3 shadow-2xl"
              style={{ background: '#fff', boxShadow: '0 0 60px rgba(232,160,32,0.18)' }}>
              <img
                src={jobtecLogo}
                alt="JOBTEC"
                style={{ height: 120, width: 'auto', objectFit: 'contain', display: 'block' }}
              />
            </div>
          </div>

          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium mb-6"
            style={{ background: 'rgba(232,160,32,0.12)', color: '#E8A020', border: '1px solid rgba(232,160,32,0.25)' }}>
            <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
            Já disponível em Nampula — Expandindo para todo Moçambique
          </div>

          <h1 className="font-serif text-5xl sm:text-6xl lg:text-7xl leading-tight mb-6" style={{ color: '#EDF4F6' }}>
            Quem sabe fazer,
            <br />
            <span style={{ color: '#E8A020' }}>encontra quem precisa.</span>
          </h1>

          <p className="text-lg sm:text-xl max-w-2xl mx-auto mb-10" style={{ color: '#7BAAB8' }}>
            A plataforma que conecta profissionais qualificados, clientes e empresas.
            Contrate com confiança, avalie com transparência.
          </p>

          {/* Search bar */}
          <div className="max-w-2xl mx-auto mb-12">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 relative">
                <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5" style={{ color: '#7BAAB8' }}
                  viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
                </svg>
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSearch()}
                  placeholder="Que serviço precisa? (ex: electricista, desenvolvedor...)"
                  className="w-full pl-12 pr-4 py-4 rounded-xl text-sm outline-none transition-all"
                  style={{
                    background: 'rgba(13,46,56,0.8)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    color: '#EDF4F6',
                  }}
                />
              </div>
              <button
                onClick={handleSearch}
                className="px-8 py-4 rounded-xl font-semibold text-sm whitespace-nowrap transition-all duration-200"
                style={{ background: '#E8A020', color: '#fff' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#EA7C28')}
                onMouseLeave={e => (e.currentTarget.style.background = '#E8A020')}
              >
                Pesquisar
              </button>
            </div>

            <div className="flex flex-wrap gap-2 mt-4 justify-center">
              {['Electricista', 'Desenvolvedor Web', 'Designer', 'Explicador', 'Mecânico'].map(s => (
                <button
                  key={s}
                  onClick={() => { setSearch(s); handleSearch() }}
                  className="px-3 py-1 rounded-full text-xs transition-all"
                  style={{ background: 'rgba(255,255,255,0.06)', color: '#7BAAB8', border: '1px solid rgba(255,255,255,0.1)' }}
                  onMouseEnter={e => { e.currentTarget.style.color = '#EDF4F6'; e.currentTarget.style.borderColor = 'rgba(251,146,60,0.4)' }}
                  onMouseLeave={e => { e.currentTarget.style.color = '#7BAAB8'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)' }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-3xl mx-auto">
            {[
              { value: '500+', label: 'Profissionais' },
              { value: '20+', label: 'Categorias' },
              { value: '98%', label: 'Satisfação' },
              { value: '10+', label: 'Províncias em breve' },
            ].map(stat => (
              <div key={stat.label} className="text-center py-4 px-2 rounded-xl"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="font-serif text-2xl font-bold mb-1" style={{ color: '#E8A020' }}>{stat.value}</div>
                <div className="text-xs" style={{ color: '#7BAAB8' }}>{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="py-16 px-4" style={{ background: '#061E26' }}>
        <div className="max-w-7xl mx-auto">
          <div className="flex items-end justify-between mb-8">
            <div>
              <h2 className="font-serif text-3xl mb-2" style={{ color: '#EDF4F6' }}>Explorar por Categoria</h2>
              <p className="text-sm" style={{ color: '#7BAAB8' }}>Encontre o profissional certo para cada necessidade</p>
            </div>
            <button onClick={() => navigate('explore')}
              className="text-sm font-medium hidden sm:block transition-colors"
              style={{ color: '#E8A020' }}>
              Ver tudo →
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => navigate('explore')}
                className="group p-4 rounded-xl text-left transition-all duration-200"
                style={{ background: 'rgba(13,46,56,0.6)', border: '1px solid rgba(255,255,255,0.06)' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(251,146,60,0.3)'; e.currentTarget.style.background = 'rgba(13,46,56,0.9)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'; e.currentTarget.style.background = 'rgba(13,46,56,0.6)' }}
              >
                <div className="text-2xl mb-2">{cat.icon}</div>
                <div className="text-sm font-medium mb-1" style={{ color: '#EDF4F6' }}>{cat.name}</div>
                <div className="text-xs" style={{ color: '#7BAAB8' }}>{cat.count} profissionais</div>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-16 px-4" style={{ background: '#0D2E38' }}>
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="font-serif text-3xl sm:text-4xl mb-3" style={{ color: '#EDF4F6' }}>Como Funciona</h2>
            <p style={{ color: '#7BAAB8' }}>Simples, rápido e transparente</p>
          </div>
          <div className="grid lg:grid-cols-2 gap-8">
            {/* Client flow */}
            <div className="p-6 rounded-2xl" style={{ background: 'rgba(6,30,38,0.6)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium mb-6"
                style={{ background: 'rgba(56,189,248,0.1)', color: '#38BDF8', border: '1px solid rgba(56,189,248,0.2)' }}>
                Para Clientes & Empresas
              </div>
              <div className="space-y-5">
                {[
                  { step: '01', title: 'Publique ou Pesquise', desc: 'Descreva o serviço que precisa ou explore profissionais disponíveis' },
                  { step: '02', title: 'Compare Perfis', desc: 'Analise JOBTEC Score, portfólio, avaliações e preços' },
                  { step: '03', title: 'Solicite Orçamento', desc: 'Envie proposta ao profissional e negoceie os termos' },
                  { step: '04', title: 'Contrate & Avalie', desc: 'Confirme a contratação, acompanhe e avalie ao final' },
                ].map((item, i) => (
                  <div key={i} className="flex gap-4">
                    <div className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center text-xs font-bold"
                      style={{ background: 'rgba(56,189,248,0.1)', color: '#38BDF8' }}>
                      {item.step}
                    </div>
                    <div>
                      <div className="font-medium text-sm mb-1" style={{ color: '#EDF4F6' }}>{item.title}</div>
                      <div className="text-xs leading-relaxed" style={{ color: '#7BAAB8' }}>{item.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Professional flow */}
            <div className="p-6 rounded-2xl" style={{ background: 'rgba(6,30,38,0.6)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium mb-6"
                style={{ background: 'rgba(251,146,60,0.1)', color: '#E8A020', border: '1px solid rgba(251,146,60,0.2)' }}>
                Para Profissionais
              </div>
              <div className="space-y-5">
                {[
                  { step: '01', title: 'Crie o seu Perfil', desc: 'Cadastre competências, experiência e portfólio profissional' },
                  { step: '02', title: 'Receba Oportunidades', desc: 'O JOBTEC Match conecta-o a oportunidades compatíveis com o seu perfil' },
                  { step: '03', title: 'Apresente Orçamento', desc: 'Envie proposta detalhada com o seu melhor preço e prazo' },
                  { step: '04', title: 'Realize e Cresça', desc: 'Conclua o trabalho, ganhe avaliações e melhore o seu JOBTEC Score' },
                ].map((item, i) => (
                  <div key={i} className="flex gap-4">
                    <div className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center text-xs font-bold"
                      style={{ background: 'rgba(251,146,60,0.1)', color: '#E8A020' }}>
                      {item.step}
                    </div>
                    <div>
                      <div className="font-medium text-sm mb-1" style={{ color: '#EDF4F6' }}>{item.title}</div>
                      <div className="text-xs leading-relaxed" style={{ color: '#7BAAB8' }}>{item.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Featured professionals */}
      <section className="py-16 px-4" style={{ background: '#061E26' }}>
        <div className="max-w-7xl mx-auto">
          <div className="flex items-end justify-between mb-8">
            <div>
              <h2 className="font-serif text-3xl mb-2" style={{ color: '#EDF4F6' }}>Profissionais em Destaque</h2>
              <p className="text-sm" style={{ color: '#7BAAB8' }}>Os mais bem avaliados da plataforma</p>
            </div>
            <button onClick={() => navigate('explore')}
              className="text-sm font-medium hidden sm:block" style={{ color: '#E8A020' }}>
              Ver todos →
            </button>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {featured.map(pro => (
              <button
                key={pro.id}
                onClick={() => navigate('profile', pro.id)}
                className="text-left p-5 rounded-2xl transition-all duration-200 group"
                style={{ background: '#0D2E38', border: '1px solid rgba(255,255,255,0.06)' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(251,146,60,0.3)'; e.currentTarget.style.transform = 'translateY(-2px)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'; e.currentTarget.style.transform = 'translateY(0)' }}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="relative">
                    <img src={pro.avatar} alt={pro.name} data-african-avatar="true" loading="lazy" decoding="async"
                      className="w-14 h-14 rounded-xl object-cover"
                      style={{ background: '#1A4050' }} />
                    {pro.available && (
                      <span className="absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 bg-green-400"
                        style={{ borderColor: '#0D2E38' }} />
                    )}
                  </div>
                  <div className="relative flex items-center justify-center" style={{ width: 48, height: 48 }}>
                    <ScoreRing score={pro.score} size={48} />
                    <span className="absolute text-xs font-bold" style={{ color: '#EDF4F6' }}>{pro.score}</span>
                  </div>
                </div>
                <div className="font-semibold text-sm mb-0.5" style={{ color: '#EDF4F6' }}>{pro.name}</div>
                <div className="text-xs mb-2" style={{ color: '#E8A020' }}>{pro.profession}</div>
                <div className="flex items-center gap-1 mb-3">
                  <StarRating rating={pro.rating} />
                  <span className="text-xs ml-1" style={{ color: '#7BAAB8' }}>{pro.rating} ({pro.reviews})</span>
                </div>
                <div className="flex flex-wrap gap-1 mb-4">
                  {pro.skills.slice(0, 2).map(skill => (
                    <span key={skill} className="text-xs px-2 py-0.5 rounded-full"
                      style={{ background: 'rgba(255,255,255,0.06)', color: '#7BAAB8' }}>
                      {skill}
                    </span>
                  ))}
                </div>
                <div className="flex items-center justify-between pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                  <span className="text-xs" style={{ color: '#7BAAB8' }}>{pro.location}</span>
                  <span className="text-xs font-medium" style={{ color: '#EDF4F6' }}>
                    {pro.hourlyRate.toLocaleString()} MZN/h
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* JOBTEC Features */}
      <section className="py-16 px-4" style={{ background: '#0D2E38' }}>
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="font-serif text-3xl sm:text-4xl mb-3" style={{ color: '#EDF4F6' }}>
              O que nos diferencia
            </h2>
            <p style={{ color: '#7BAAB8' }}>Tecnologia ao serviço do talento moçambicano</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {/* Skill Card */}
            <div className="p-6 rounded-2xl" style={{ background: 'rgba(6,30,38,0.7)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div className="w-12 h-12 rounded-xl flex items-center justify-center text-xl mb-5"
                style={{ background: 'rgba(251,146,60,0.12)' }}>
                🪪
              </div>
              <h3 className="font-serif text-xl mb-3" style={{ color: '#EDF4F6' }}>JOBTEC Skill Card</h3>
              <p className="text-sm leading-relaxed mb-4" style={{ color: '#7BAAB8' }}>
                Carteira digital de competências verificadas. Cada profissional tem um Skill Card com todas as suas qualificações, experiência e portfólio num só lugar.
              </p>
              {/* Mini Skill Card preview */}
              <div className="rounded-xl p-3 text-xs"
                style={{ background: 'linear-gradient(135deg, #1A4050, #0D2E38)', border: '1px solid rgba(251,146,60,0.2)' }}>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 rounded bg-orange-500 flex items-center justify-center text-white text-xs font-bold">JT</div>
                  <span style={{ color: '#E8A020' }} className="font-bold text-xs">JOBTEC SKILL CARD</span>
                </div>
                <div style={{ color: '#EDF4F6' }} className="font-medium">Armindo Cossa</div>
                <div style={{ color: '#7BAAB8' }}>Engenheiro Eléctrico • Nampula</div>
                <div className="flex gap-1 mt-2">
                  {['Solar', 'Automação'].map(s => (
                    <span key={s} className="px-1.5 py-0.5 rounded text-xs"
                      style={{ background: 'rgba(251,146,60,0.15)', color: '#E8A020' }}>{s}</span>
                  ))}
                </div>
              </div>
            </div>

            {/* JOBTEC Score */}
            <div className="p-6 rounded-2xl" style={{ background: 'rgba(6,30,38,0.7)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div className="w-12 h-12 rounded-xl flex items-center justify-center text-xl mb-5"
                style={{ background: 'rgba(52,211,153,0.12)' }}>
                ⭐
              </div>
              <h3 className="font-serif text-xl mb-3" style={{ color: '#EDF4F6' }}>JOBTEC Score</h3>
              <p className="text-sm leading-relaxed mb-4" style={{ color: '#7BAAB8' }}>
                Sistema de reputação calculado com base em avaliações, pontualidade, qualidade e histórico. Transparente para clientes e motivador para profissionais.
              </p>
              <div className="flex items-center justify-center gap-6">
                {[{ score: 94, name: 'Excelente', color: '#34D399' }, { score: 79, name: 'Bom', color: '#E8A020' }, { score: 61, name: 'Em crescimento', color: '#FBBF24' }].map(item => (
                  <div key={item.name} className="text-center">
                    <div className="relative inline-flex items-center justify-center w-12 h-12 mb-1">
                      <ScoreRing score={item.score} size={48} />
                      <span className="absolute text-xs font-bold" style={{ color: '#EDF4F6' }}>{item.score}</span>
                    </div>
                    <div className="text-xs" style={{ color: item.color }}>{item.name}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* JOBTEC Match */}
            <div className="p-6 rounded-2xl" style={{ background: 'rgba(6,30,38,0.7)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div className="w-12 h-12 rounded-xl flex items-center justify-center text-xl mb-5"
                style={{ background: 'rgba(56,189,248,0.12)' }}>
                🎯
              </div>
              <h3 className="font-serif text-xl mb-3" style={{ color: '#EDF4F6' }}>JOBTEC Match</h3>
              <p className="text-sm leading-relaxed mb-4" style={{ color: '#7BAAB8' }}>
                Algoritmo de matching inteligente que considera competência, localização, disponibilidade e reputação para sugerir o profissional mais adequado.
              </p>
              <div className="space-y-2">
                {[
                  { label: 'Competência', pct: 90 },
                  { label: 'Localização', pct: 75 },
                  { label: 'Disponibilidade', pct: 100 },
                  { label: 'JOBTEC Score', pct: 94 },
                ].map(m => (
                  <div key={m.label} className="flex items-center gap-3">
                    <span className="text-xs w-28" style={{ color: '#7BAAB8' }}>{m.label}</span>
                    <div className="flex-1 h-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.08)' }}>
                      <div className="h-1.5 rounded-full transition-all"
                        style={{ width: `${m.pct}%`, background: 'linear-gradient(90deg, #38BDF8, #0EA5E9)' }} />
                    </div>
                    <span className="text-xs w-8 text-right" style={{ color: '#38BDF8' }}>{m.pct}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Recent Jobs */}
      <section className="py-16 px-4" style={{ background: '#061E26' }}>
        <div className="max-w-7xl mx-auto">
          <div className="flex items-end justify-between mb-8">
            <div>
              <h2 className="font-serif text-3xl mb-2" style={{ color: '#EDF4F6' }}>Serviços Publicados</h2>
              <p className="text-sm" style={{ color: '#7BAAB8' }}>Oportunidades recentes aguardando profissionais</p>
            </div>
            <button onClick={() => navigate('explore')}
              className="text-sm font-medium hidden sm:block" style={{ color: '#E8A020' }}>
              Ver todos →
            </button>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            {recentJobs.map(job => {
              const cat = categories.find(c => c.id === job.category)
              return (
                <div key={job.id} className="p-5 rounded-2xl transition-all duration-200"
                  style={{ background: '#0D2E38', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{cat?.icon}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full"
                        style={{ background: 'rgba(255,255,255,0.06)', color: '#7BAAB8' }}>
                        {cat?.name}
                      </span>
                    </div>
                    {job.urgent && (
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                        style={{ background: 'rgba(251,146,60,0.15)', color: '#E8A020' }}>
                        Urgente
                      </span>
                    )}
                  </div>
                  <h4 className="font-semibold mb-2" style={{ color: '#EDF4F6' }}>{job.title}</h4>
                  <p className="text-sm mb-4 leading-relaxed" style={{ color: '#7BAAB8' }}>{job.description}</p>
                  <div className="flex items-center justify-between text-xs" style={{ color: '#7BAAB8' }}>
                    <div className="flex items-center gap-3">
                      <span>📍 {job.location}</span>
                      <span>🕐 {job.postedAt}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span style={{ color: '#34D399' }} className="font-medium">{job.budget}</span>
                      <span>{job.proposals} propostas</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4" style={{ background: 'linear-gradient(135deg, #0D2E38, #1A4050)' }}>
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="font-serif text-4xl sm:text-5xl mb-4" style={{ color: '#EDF4F6' }}>
            Pronto para começar?
          </h2>
          <p className="text-lg mb-10" style={{ color: '#7BAAB8' }}>
            Junte-se a centenas de profissionais e clientes em Nampula que já estão na plataforma.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => navigate('post')}
              className="px-8 py-4 rounded-xl font-semibold text-base transition-all duration-200"
              style={{ background: '#E8A020', color: '#fff' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#EA7C28')}
              onMouseLeave={e => (e.currentTarget.style.background = '#E8A020')}
            >
              Publicar um Serviço
            </button>
            <button
              onClick={() => navigate('explore')}
              className="px-8 py-4 rounded-xl font-semibold text-base transition-all duration-200"
              style={{ background: 'rgba(255,255,255,0.08)', color: '#EDF4F6', border: '1px solid rgba(255,255,255,0.15)' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.12)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
            >
              Encontrar Profissional
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4" style={{ background: '#061E26', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="max-w-7xl mx-auto">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-10">
            <div>
              <div className="mb-4">
                <div className="inline-block rounded-xl overflow-hidden p-1.5"
                  style={{ background: '#fff' }}>
                  <img
                    src={jobtecLogo}
                    alt="JOBTEC"
                    style={{ height: 52, width: 'auto', objectFit: 'contain', display: 'block' }}
                  />
                </div>
              </div>
              <p className="text-sm leading-relaxed" style={{ color: '#7BAAB8' }}>
                Conectando talento e oportunidade em Moçambique.
              </p>
              <p className="text-xs mt-4" style={{ color: '#3D6878' }}>Nampula, Moçambique</p>
            </div>
            {[
              { title: 'Plataforma', links: ['Explorar Profissionais', 'Publicar Serviço', 'Como Funciona', 'JOBTEC Match'] },
              { title: 'Profissionais', links: ['Cadastrar Perfil', 'JOBTEC Score', 'Skill Card', 'Central de Ajuda'] },
              { title: 'Empresa', links: ['Sobre Nós', 'Carreiras', 'Imprensa', 'Contacto'] },
            ].map(col => (
              <div key={col.title}>
                <div className="font-semibold text-sm mb-4" style={{ color: '#EDF4F6' }}>{col.title}</div>
                <div className="space-y-2.5">
                  {col.links.map(link => (
                    <div key={link} className="text-sm cursor-pointer transition-colors"
                      style={{ color: '#7BAAB8' }}
                      onMouseEnter={e => (e.currentTarget.style.color = '#EDF4F6')}
                      onMouseLeave={e => (e.currentTarget.style.color = '#7BAAB8')}>
                      {link}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-between pt-8 gap-4"
            style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <p className="text-xs" style={{ color: '#3D6878' }}>© 2026 JOBTEC. Todos os direitos reservados.</p>
            <p className="text-xs" style={{ color: '#3D6878' }}>Quem sabe fazer, encontra quem precisa.</p>
          </div>
          <div className="text-center mt-6">
            <button
              onClick={() => { localStorage.removeItem('jdb.all'); location.reload() }}
              className="text-[10px] underline opacity-50 hover:opacity-100 transition-opacity"
              style={{ color: '#3D6878' }}
            >
              Repor dados de demonstração
            </button>
          </div>
          <div className="text-center mt-4 flex flex-col items-center gap-2">
            <p className="text-xs font-medium" style={{ color: '#3D6878' }}>Desenvolvido por</p>
            <div className="inline-flex items-center rounded-xl overflow-hidden px-2 py-1" style={{ background: '#fff' }}>
              <img
                src={universusLogo}
                alt="UNIVERSUS Design&Tecnologia"
                style={{ height: 36, width: 'auto', objectFit: 'contain', display: 'block' }}
              />
            </div>
            <a
              href="https://mateus-mabolacha.vercel.app"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs underline transition-opacity hover:opacity-100"
              style={{ color: '#7BAAB8' }}
            >
              Ver portfólio do desenvolvedor
            </a>
          </div>
        </div>
      </footer>
    </div>
  )
}
