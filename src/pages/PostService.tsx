import { useState } from 'react'
import { categories, professionals } from '../data'
import { useStore } from '../context/store'
import type { NavigateFn } from '../types'

interface PostServiceProps {
  navigate: NavigateFn
}

function matchScore(category: string, location: string): Array<{ pro: (typeof professionals)[number]; score: number }> {
  return professionals
    .map(pro => {
      let score = 0
      if (pro.category === category) score += 50
      if (pro.available) score += 20
      score += Math.min(25, Math.round(pro.score / 100 * 25))
      if (location !== 'Remoto (à distância)' && pro.location === location) score += 10
      if (location === 'Remoto (à distância)') score += 5
      score += Math.min(10, pro.jobsCompleted / 10)
      return { pro, score }
    })
    .filter(m => m.score > 30)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
}

export default function PostService({ navigate }: PostServiceProps) {
  const { addPublishedJob } = useStore()
  const [step, setStep] = useState(1)
  const [form, setForm] = useState({
    title: '',
    category: '',
    description: '',
    budget: '',
    budgetMax: '',
    location: 'Nampula Cidade',
    deadline: '',
    urgent: false,
    type: 'client' as 'client' | 'company',
    name: '',
    email: '',
    phone: '',
  })
  const [submitted, setSubmitted] = useState(false)

  const update = (key: keyof typeof form, value: string | boolean) =>
    setForm(prev => ({ ...prev, [key]: value }))

  const canNext1 = form.title.trim() && form.category && form.description.trim()
  const canNext2 = form.budget && form.location
  const canSubmit = form.name.trim() && (form.email.trim() || form.phone.trim())

  if (submitted) {
    const matches = matchScore(form.category, form.location)
    return (
      <div className="min-h-screen flex items-center justify-center px-4 py-10" style={{ background: '#061E26' }}>
        <div className="max-w-lg w-full text-center">
          <div className="w-20 h-20 rounded-full flex items-center justify-center text-4xl mx-auto mb-6"
            style={{ background: 'rgba(52,211,153,0.12)', border: '2px solid rgba(52,211,153,0.3)' }}>
            ✅
          </div>
          <h2 className="font-serif text-3xl mb-3" style={{ color: '#EDF4F6' }}>Serviço Publicado!</h2>
          <p className="mb-2" style={{ color: '#7BAAB8' }}>
            O seu serviço <strong style={{ color: '#EDF4F6' }}>"{form.title}"</strong> foi publicado com sucesso.
          </p>
          <p className="text-sm mb-6" style={{ color: '#7BAAB8' }}>
            O JOBTEC Match encontrou profissionais ideais para si.
          </p>

          {/* JOBTEC Match */}
          <div className="rounded-2xl overflow-hidden mb-6 text-left"
            style={{ background: '#0D2E38', border: '1px solid rgba(56,189,248,0.2)' }}>
            <div className="flex items-center gap-2 px-4 py-3"
              style={{ background: 'rgba(56,189,248,0.08)', borderBottom: '1px solid rgba(56,189,248,0.15)' }}>
              <span className="text-base">🎯</span>
              <span className="text-sm font-bold" style={{ color: '#38BDF8' }}>JOBTEC MATCH</span>
              <span className="text-xs ml-auto" style={{ color: '#7BAAB8' }}>Melhores correspondências</span>
            </div>
            <div className="p-4 space-y-3">
              {matches.length === 0 ? (
                <p className="text-sm text-center" style={{ color: '#7BAAB8' }}>
                  Ainda sem matches nesta categoria. Novos profissionais chegam em breve.
                </p>
              ) : (
                matches.map(({ pro, score }) => (
                  <button
                    key={pro.id}
                    onClick={() => navigate('profile', pro.id)}
                    className="w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all hover:bg-white/5"
                    style={{ background: 'rgba(6,30,38,0.6)', border: '1px solid rgba(255,255,255,0.06)' }}
                  >
                    <img src={pro.avatar} alt={pro.name} data-african-avatar="true"
                      className="w-11 h-11 rounded-xl object-cover"
                      style={{ background: '#1A4050' }} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium flex items-center gap-1.5" style={{ color: '#EDF4F6' }}>
                        {pro.name}
                        {pro.verified && <span className="text-[10px] text-sky-400">✔</span>}
                      </div>
                      <div className="text-xs" style={{ color: '#E8A020' }}>{pro.profession}</div>
                      <div className="text-[11px]" style={{ color: '#7BAAB8' }}>
                        📍 {pro.location} • ✅ {pro.jobsCompleted} trabalhos
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-xs font-bold" style={{ color: '#38BDF8' }}>{score}% match</div>
                      <div className="text-[10px]" style={{ color: '#7BAAB8' }}>{pro.hourlyRate.toLocaleString()} MZN/h</div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          <div className="p-4 rounded-xl mb-6 text-left space-y-2"
            style={{ background: '#0D2E38', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="flex justify-between text-sm">
              <span style={{ color: '#7BAAB8' }}>Categoria</span>
              <span style={{ color: '#EDF4F6' }}>{categories.find(c => c.id === form.category)?.name}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span style={{ color: '#7BAAB8' }}>Orçamento</span>
              <span style={{ color: '#EDF4F6' }}>{form.budget}{form.budgetMax ? ` – ${form.budgetMax}` : ''} MZN</span>
            </div>
            <div className="flex justify-between text-sm">
              <span style={{ color: '#7BAAB8' }}>Localização</span>
              <span style={{ color: '#EDF4F6' }}>{form.location}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span style={{ color: '#7BAAB8' }}>Referência</span>
              <span style={{ color: '#E8A020' }}>JT-SRV-{Date.now().toString().slice(-5)}</span>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => navigate('explore')}
              className="flex-1 py-3 rounded-xl font-semibold text-sm transition-all"
              style={{ background: '#E8A020', color: '#fff' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#D08C10')}
              onMouseLeave={e => (e.currentTarget.style.background = '#E8A020')}
            >
              Ver Profissionais
            </button>
            <button
              onClick={() => navigate('home')}
              className="flex-1 py-3 rounded-xl font-semibold text-sm"
              style={{ background: 'rgba(255,255,255,0.06)', color: '#EDF4F6', border: '1px solid rgba(255,255,255,0.1)' }}
            >
              Início
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen py-10 px-4" style={{ background: '#061E26' }}>
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button onClick={() => navigate('home')}
            className="flex items-center gap-1.5 text-sm mb-4 transition-colors"
            style={{ color: '#7BAAB8' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#EDF4F6')}
            onMouseLeave={e => (e.currentTarget.style.color = '#7BAAB8')}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="m15 18-6-6 6-6" />
            </svg>
            Voltar
          </button>
          <h1 className="font-serif text-3xl sm:text-4xl mb-2" style={{ color: '#EDF4F6' }}>Publicar Serviço</h1>
          <p className="text-sm" style={{ color: '#7BAAB8' }}>Descreva o que precisa e receba propostas de profissionais qualificados</p>
        </div>

        {/* Steps indicator */}
        <div className="flex items-center gap-2 mb-8">
          {[1, 2, 3].map(s => (
            <div key={s} className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all"
                style={{
                  background: step >= s ? '#E8A020' : 'rgba(255,255,255,0.06)',
                  color: step >= s ? '#fff' : '#7BAAB8',
                }}>
                {step > s ? '✓' : s}
              </div>
              <span className="text-xs hidden sm:block" style={{ color: step >= s ? '#EDF4F6' : '#7BAAB8' }}>
                {s === 1 ? 'Serviço' : s === 2 ? 'Detalhes' : 'Contacto'}
              </span>
              {s < 3 && <div className="flex-1 h-px w-8" style={{ background: step > s ? '#E8A020' : 'rgba(255,255,255,0.08)' }} />}
            </div>
          ))}
        </div>

        {/* Form */}
        <div className="rounded-2xl p-6" style={{ background: '#0D2E38', border: '1px solid rgba(255,255,255,0.06)' }}>
          {step === 1 && (
            <div className="space-y-5">
              <h2 className="font-semibold text-lg mb-1" style={{ color: '#EDF4F6' }}>Que serviço precisa?</h2>

              {/* Type */}
              <div>
                <label className="block text-xs font-medium mb-2" style={{ color: '#7BAAB8' }}>Você é</label>
                <div className="grid grid-cols-2 gap-3">
                  {([
                    { id: 'client', label: '👤 Particular', desc: 'Pessoa individual' },
                    { id: 'company', label: '🏢 Empresa', desc: 'Empresa ou organização' },
                  ] as const).map(opt => (
                    <button
                      key={opt.id}
                      onClick={() => update('type', opt.id)}
                      className="p-3 rounded-xl text-left transition-all"
                      style={{
                        background: form.type === opt.id ? 'rgba(232,160,32,0.1)' : 'rgba(6,30,38,0.6)',
                        border: `1px solid ${form.type === opt.id ? 'rgba(232,160,32,0.4)' : 'rgba(255,255,255,0.08)'}`,
                      }}
                    >
                      <div className="font-medium text-sm" style={{ color: '#EDF4F6' }}>{opt.label}</div>
                      <div className="text-xs mt-0.5" style={{ color: '#7BAAB8' }}>{opt.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Title */}
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: '#7BAAB8' }}>
                  Título do serviço *
                </label>
                <input
                  type="text"
                  value={form.title}
                  onChange={e => update('title', e.target.value)}
                  placeholder="Ex: Instalação eléctrica para escritório..."
                  className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
                  style={{ background: 'rgba(6,30,38,0.8)', border: '1px solid rgba(255,255,255,0.1)', color: '#EDF4F6' }}
                />
              </div>

              {/* Category */}
              <div>
                <label className="block text-xs font-medium mb-2" style={{ color: '#7BAAB8' }}>
                  Categoria *
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {categories.slice(0, 8).map(cat => (
                    <button
                      key={cat.id}
                      onClick={() => update('category', cat.id)}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left transition-all"
                      style={{
                        background: form.category === cat.id ? 'rgba(232,160,32,0.1)' : 'rgba(6,30,38,0.6)',
                        border: `1px solid ${form.category === cat.id ? 'rgba(232,160,32,0.4)' : 'rgba(255,255,255,0.06)'}`,
                        color: form.category === cat.id ? '#EDF4F6' : '#7BAAB8',
                      }}
                    >
                      <span>{cat.icon}</span> {cat.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: '#7BAAB8' }}>
                  Descrição detalhada *
                </label>
                <textarea
                  value={form.description}
                  onChange={e => update('description', e.target.value)}
                  rows={4}
                  placeholder="Descreva com detalhe o que precisa, dimensões, requisitos especiais..."
                  className="w-full px-3 py-2.5 rounded-lg text-sm outline-none resize-none"
                  style={{ background: 'rgba(6,30,38,0.8)', border: '1px solid rgba(255,255,255,0.1)', color: '#EDF4F6' }}
                />
                <div className="text-right text-xs mt-1" style={{ color: '#3D6878' }}>{form.description.length}/500</div>
              </div>

              <button
                onClick={() => canNext1 && setStep(2)}
                disabled={!canNext1}
                className="w-full py-3 rounded-xl font-semibold text-sm transition-all"
                style={{
                  background: canNext1 ? '#E8A020' : 'rgba(255,255,255,0.06)',
                  color: canNext1 ? '#fff' : '#3D6878',
                }}
              >
                Continuar →
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <h2 className="font-semibold text-lg mb-1" style={{ color: '#EDF4F6' }}>Detalhes do projecto</h2>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: '#7BAAB8' }}>
                    Orçamento mínimo (MZN) *
                  </label>
                  <input
                    type="number"
                    value={form.budget}
                    onChange={e => update('budget', e.target.value)}
                    placeholder="5.000"
                    className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
                    style={{ background: 'rgba(6,30,38,0.8)', border: '1px solid rgba(255,255,255,0.1)', color: '#EDF4F6' }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: '#7BAAB8' }}>
                    Orçamento máximo (MZN)
                  </label>
                  <input
                    type="number"
                    value={form.budgetMax}
                    onChange={e => update('budgetMax', e.target.value)}
                    placeholder="20.000"
                    className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
                    style={{ background: 'rgba(6,30,38,0.8)', border: '1px solid rgba(255,255,255,0.1)', color: '#EDF4F6' }}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: '#7BAAB8' }}>
                  Localização *
                </label>
                <select
                  value={form.location}
                  onChange={e => update('location', e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
                  style={{ background: 'rgba(6,30,38,0.8)', border: '1px solid rgba(255,255,255,0.1)', color: '#EDF4F6' }}
                >
                  <option>Nampula Cidade</option>
                  <option>Nacala Porto</option>
                  <option>Ilha de Moçambique</option>
                  <option>Monapo</option>
                  <option>Angoche</option>
                  <option>Remoto (à distância)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: '#7BAAB8' }}>
                  Prazo desejado
                </label>
                <select
                  value={form.deadline}
                  onChange={e => update('deadline', e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
                  style={{ background: 'rgba(6,30,38,0.8)', border: '1px solid rgba(255,255,255,0.1)', color: '#EDF4F6' }}
                >
                  <option value="">Seleccione o prazo</option>
                  <option>O mais rápido possível</option>
                  <option>Esta semana</option>
                  <option>Próximas 2 semanas</option>
                  <option>Este mês</option>
                  <option>Sem pressa</option>
                </select>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl"
                style={{ background: 'rgba(6,30,38,0.6)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div>
                  <div className="text-sm font-medium" style={{ color: '#EDF4F6' }}>Urgente</div>
                  <div className="text-xs" style={{ color: '#7BAAB8' }}>Marcar como urgente para maior visibilidade</div>
                </div>
                <button
                  onClick={() => update('urgent', !form.urgent)}
                  className="w-10 h-6 rounded-full transition-all relative"
                  style={{ background: form.urgent ? '#E8A020' : 'rgba(255,255,255,0.1)' }}
                >
                  <div className="absolute top-1 w-4 h-4 rounded-full bg-white transition-all"
                    style={{ left: form.urgent ? '22px' : '4px' }} />
                </button>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setStep(1)}
                  className="flex-1 py-3 rounded-xl font-semibold text-sm"
                  style={{ background: 'rgba(255,255,255,0.06)', color: '#7BAAB8', border: '1px solid rgba(255,255,255,0.08)' }}
                >
                  ← Voltar
                </button>
                <button
                  onClick={() => canNext2 && setStep(3)}
                  disabled={!canNext2}
                  className="flex-1 py-3 rounded-xl font-semibold text-sm transition-all"
                  style={{
                    background: canNext2 ? '#E8A020' : 'rgba(255,255,255,0.06)',
                    color: canNext2 ? '#fff' : '#3D6878',
                  }}
                >
                  Continuar →
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-5">
              <h2 className="font-semibold text-lg mb-1" style={{ color: '#EDF4F6' }}>Informações de contacto</h2>
              <p className="text-sm" style={{ color: '#7BAAB8' }}>Para os profissionais poderem entrar em contacto consigo</p>

              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: '#7BAAB8' }}>
                  {form.type === 'company' ? 'Nome da empresa *' : 'O seu nome *'}
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => update('name', e.target.value)}
                  placeholder={form.type === 'company' ? 'Ex: Empresa ABC Lda' : 'Ex: João Silva'}
                  className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
                  style={{ background: 'rgba(6,30,38,0.8)', border: '1px solid rgba(255,255,255,0.1)', color: '#EDF4F6' }}
                />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: '#7BAAB8' }}>Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={e => update('email', e.target.value)}
                  placeholder="exemplo@email.com"
                  className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
                  style={{ background: 'rgba(6,30,38,0.8)', border: '1px solid rgba(255,255,255,0.1)', color: '#EDF4F6' }}
                />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: '#7BAAB8' }}>Telefone / WhatsApp *</label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={e => update('phone', e.target.value)}
                  placeholder="+258 84 000 0000"
                  className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
                  style={{ background: 'rgba(6,30,38,0.8)', border: '1px solid rgba(255,255,255,0.1)', color: '#EDF4F6' }}
                />
              </div>

              {/* Summary */}
              <div className="p-4 rounded-xl space-y-2" style={{ background: 'rgba(6,30,38,0.6)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <h4 className="text-xs font-semibold mb-2" style={{ color: '#7BAAB8' }}>RESUMO</h4>
                <div className="text-sm font-medium" style={{ color: '#EDF4F6' }}>{form.title}</div>
                <div className="text-xs" style={{ color: '#7BAAB8' }}>
                  {categories.find(c => c.id === form.category)?.name} • {form.location}
                </div>
                <div className="text-xs" style={{ color: '#34D399' }}>
                  {form.budget ? `${parseInt(form.budget).toLocaleString()}${form.budgetMax ? ` – ${parseInt(form.budgetMax).toLocaleString()}` : ''} MZN` : ''}
                  {form.urgent && ' • ⚡ Urgente'}
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setStep(2)}
                  className="flex-1 py-3 rounded-xl font-semibold text-sm"
                  style={{ background: 'rgba(255,255,255,0.06)', color: '#7BAAB8', border: '1px solid rgba(255,255,255,0.08)' }}
                >
                  ← Voltar
                </button>
                <button
                  onClick={() => {
                    if (!canSubmit) return
                    addPublishedJob({
                      title: form.title,
                      category: form.category,
                      description: form.description,
                      budget: form.budget,
                      budgetMax: form.budgetMax,
                      location: form.location,
                      deadline: form.deadline,
                      urgent: form.urgent,
                      type: form.type,
                      name: form.name,
                      email: form.email,
                      phone: form.phone,
                    })
                    setSubmitted(true)
                  }}
                  disabled={!canSubmit}
                  className="flex-1 py-3 rounded-xl font-semibold text-sm transition-all"
                  style={{
                    background: canSubmit ? '#E8A020' : 'rgba(255,255,255,0.06)',
                    color: canSubmit ? '#fff' : '#3D6878',
                  }}
                >
                  Publicar Serviço
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
