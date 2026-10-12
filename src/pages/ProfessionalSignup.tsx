import { useState } from 'react'
import { categories } from '../data'
import { useStore } from '../context/store'
import type { NavigateFn } from '../types'

interface ProfessionalSignupProps {
  navigate: NavigateFn
}

const LOCATIONS = ['Nampula Cidade', 'Nacala Porto', 'Ilha de Moçambique', 'Monapo', 'Angoche', 'Nampula (outras)']
const PROVINCES = ['Nampula', 'Cabo Delgado', 'Niassa', 'Zambézia', 'Outra província']

export default function ProfessionalSignup({ navigate }: ProfessionalSignupProps) {
  const { registerProfessional } = useStore()
  const [step, setStep] = useState(1)
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    publicPhone: true,
    profession: '',
    category: '',
    skills: [] as string[],
    skillInput: '',
    hourlyRate: '',
    bio: '',
    location: LOCATIONS[0],
    province: PROVINCES[0],
  })
  const [created, setCreated] = useState<null | { id: number }>(null)
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [aSubmeter, setASubmeter] = useState(false)

  const update = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm(prev => ({ ...prev, [key]: value }))

  const addSkill = () => {
    const s = form.skillInput.trim()
    if (s && !form.skills.includes(s)) {
      update('skills', [...form.skills, s])
      update('skillInput', '')
    }
  }
  const removeSkill = (s: string) => update('skills', form.skills.filter(x => x !== s))

  const canStep1 = form.name.trim() && form.profession.trim() && form.category
  const canStep2 = form.skills.length >= 1
  const canStep3 = !!form.hourlyRate && form.bio.trim().length >= 10
  const senhaValida = senha.length >= 8 && /[a-z]/.test(senha) && /[A-Z]/.test(senha) && /[0-9]/.test(senha)
  const canSubmit = canStep3 && form.phone.trim() && senhaValida

  const handleSubmit = async () => {
    if (!canSubmit || aSubmeter) return
    setASubmeter(true)
    setErro(null)
    try {
      const prof = await registerProfessional({
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        profession: form.profession.trim(),
        category: form.category,
        skills: form.skills,
        location: form.location,
        province: form.province,
        hourlyRate: parseInt(form.hourlyRate) || 0,
        bio: form.bio.trim(),
        publicPhone: form.publicPhone,
      }, senha)
      if (prof) setCreated({ id: prof.id })
      else setErro('Perfil criado, mas ainda não foi possível carregá-lo. Actualize a página.')
    } catch (e) {
      setErro((e as Error)?.message || 'Não foi possível criar o perfil. Tente novamente.')
    } finally {
      setASubmeter(false)
    }
  }

  if (created) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: '#061E26' }}>
        <div className="max-w-md w-full text-center">
          <div className="w-20 h-20 rounded-full flex items-center justify-center text-4xl mx-auto mb-6"
            style={{ background: 'rgba(232,160,32,0.12)', border: '2px solid rgba(232,160,32,0.3)' }}>
            🎉
          </div>
          <h2 className="font-serif text-3xl mb-3" style={{ color: '#EDF4F6' }}>Perfil criado!</h2>
          <p className="text-sm mb-2" style={{ color: '#7BAAB8' }}>
            O seu perfil está agora visível na plataforma JOBTEC.
          </p>
          <p className="text-sm mb-8" style={{ color: '#7BAAB8' }}>
            O seu JOBTEC Score inicial é <strong style={{ color: '#E8A020' }}>60</strong>. Complete trabalhos para o aumentar.
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => navigate('profile', created.id)}
              className="flex-1 py-3 rounded-xl font-semibold text-sm"
              style={{ background: '#E8A020', color: '#fff' }}
            >
              Ver o meu perfil
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
          <h1 className="font-serif text-3xl sm:text-4xl mb-2" style={{ color: '#EDF4F6' }}>Criar Perfil de Profissional</h1>
          <p className="text-sm" style={{ color: '#7BAAB8' }}>
            Receba oportunidades. Construa a sua reputação. Encontre quem precisa de si.
          </p>
        </div>

        {/* Steps */}
        <div className="flex items-center gap-2 mb-8">
          {[1, 2, 3, 4].map(s => (
            <div key={s} className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all"
                style={{
                  background: step >= s ? '#E8A020' : 'rgba(255,255,255,0.06)',
                  color: step >= s ? '#fff' : '#7BAAB8',
                }}>
                {step > s ? '✓' : s}
              </div>
              <span className="text-xs hidden sm:block" style={{ color: step >= s ? '#EDF4F6' : '#7BAAB8' }}>
                {s === 1 ? 'Identidade' : s === 2 ? 'Competências' : s === 3 ? 'Detalhes' : 'Localização'}
              </span>
              {s < 4 && <div className="h-px w-8" style={{ background: step > s ? '#E8A020' : 'rgba(255,255,255,0.08)' }} />}
            </div>
          ))}
        </div>

        <div className="rounded-2xl p-6" style={{ background: '#0D2E38', border: '1px solid rgba(255,255,255,0.06)' }}>
          {step === 1 && (
            <div className="space-y-5">
              <h2 className="font-semibold text-lg" style={{ color: '#EDF4F6' }}>Quem é você?</h2>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: '#7BAAB8' }}>Nome completo *</label>
                <input type="text" value={form.name} onChange={e => update('name', e.target.value)}
                  placeholder="O seu nome"
                  className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
                  style={{ background: 'rgba(6,30,38,0.8)', border: '1px solid rgba(255,255,255,0.1)', color: '#EDF4F6' }} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: '#7BAAB8' }}>Email</label>
                  <input type="email" value={form.email} onChange={e => update('email', e.target.value)}
                    placeholder="exemplo@email.com"
                    className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
                    style={{ background: 'rgba(6,30,38,0.8)', border: '1px solid rgba(255,255,255,0.1)', color: '#EDF4F6' }} />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: '#7BAAB8' }}>Telefone *</label>
                  <input type="tel" value={form.phone} onChange={e => update('phone', e.target.value)}
                    placeholder="+258 84 000 0000"
                    className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
                    style={{ background: 'rgba(6,30,38,0.8)', border: '1px solid rgba(255,255,255,0.1)', color: '#EDF4F6' }} />
                  <label className="flex items-start gap-2.5 mt-2.5 cursor-pointer">
                    <input type="checkbox" checked={form.publicPhone} onChange={e => update('publicPhone', e.target.checked)}
                      className="mt-0.5 w-4 h-4 accent-[#E8A020] flex-shrink-0" />
                    <span className="text-xs leading-relaxed" style={{ color: '#7BAAB8' }}>
                      Mostrar o meu número a clientes no JOBTEC.
                      <span style={{ color: '#5C8894' }}> Desligue se preferir receber contacto só dentro da app.</span>
                    </span>
                  </label>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: '#7BAAB8' }}>Profissão *</label>
                <input type="text" value={form.profession} onChange={e => update('profession', e.target.value)}
                  placeholder="Ex: Canalizador, Designer Gráfico, Contabilista..."
                  className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
                  style={{ background: 'rgba(6,30,38,0.8)', border: '1px solid rgba(255,255,255,0.1)', color: '#EDF4F6' }} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-2" style={{ color: '#7BAAB8' }}>Categoria *</label>
                <div className="grid grid-cols-2 gap-2">
                  {categories.map(cat => (
                    <button key={cat.id} onClick={() => update('category', cat.id)}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left transition-all"
                      style={{
                        background: form.category === cat.id ? 'rgba(232,160,32,0.1)' : 'rgba(6,30,38,0.6)',
                        border: `1px solid ${form.category === cat.id ? 'rgba(232,160,32,0.4)' : 'rgba(255,255,255,0.06)'}`,
                        color: form.category === cat.id ? '#EDF4F6' : '#7BAAB8',
                      }}>
                      <span>{cat.icon}</span> {cat.name}
                    </button>
                  ))}
                </div>
              </div>
              <button onClick={() => canStep1 && setStep(2)} disabled={!canStep1}
                className="w-full py-3 rounded-xl font-semibold text-sm"
                style={{ background: canStep1 ? '#E8A020' : 'rgba(255,255,255,0.06)', color: canStep1 ? '#fff' : '#3D6878' }}>
                Continuar →
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <h2 className="font-semibold text-lg" style={{ color: '#EDF4F6' }}>As suas competências</h2>
              <p className="text-sm" style={{ color: '#7BAAB8' }}>Adicione pelo menos uma competência. Estas serão visíveis no seu Skill Card.</p>
              <div className="flex gap-2">
                <input type="text" value={form.skillInput} onChange={e => update('skillInput', e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addSkill() } }}
                  placeholder="Ex: Canalização, Pintura, Soldadura..."
                  className="flex-1 px-3 py-2.5 rounded-lg text-sm outline-none"
                  style={{ background: 'rgba(6,30,38,0.8)', border: '1px solid rgba(255,255,255,0.1)', color: '#EDF4F6' }} />
                <button onClick={addSkill}
                  className="px-4 py-2.5 rounded-lg text-sm font-semibold"
                  style={{ background: '#E8A020', color: '#fff' }}>
                  Adicionar
                </button>
              </div>
              {form.skills.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {form.skills.map(s => (
                    <span key={s} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm"
                      style={{ background: 'rgba(232,160,32,0.08)', color: '#E8A020', border: '1px solid rgba(232,160,32,0.2)' }}>
                      {s}
                      <button onClick={() => removeSkill(s)} style={{ color: '#7BAAB8' }} className="ml-1">✕</button>
                    </span>
                  ))}
                </div>
              )}
              <div className="flex gap-3">
                <button onClick={() => setStep(1)}
                  className="flex-1 py-3 rounded-xl font-semibold text-sm"
                  style={{ background: 'rgba(255,255,255,0.06)', color: '#7BAAB8', border: '1px solid rgba(255,255,255,0.08)' }}>
                  ← Voltar
                </button>
                <button onClick={() => canStep2 && setStep(3)} disabled={!canStep2}
                  className="flex-1 py-3 rounded-xl font-semibold text-sm"
                  style={{ background: canStep2 ? '#E8A020' : 'rgba(255,255,255,0.06)', color: canStep2 ? '#fff' : '#3D6878' }}>
                  Continuar →
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-5">
              <h2 className="font-semibold text-lg" style={{ color: '#EDF4F6' }}>Preço e apresentação</h2>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: '#7BAAB8' }}>Taxa horária (MZN) *</label>
                <input type="number" value={form.hourlyRate} onChange={e => update('hourlyRate', e.target.value)}
                  placeholder="Ex: 500"
                  className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
                  style={{ background: 'rgba(6,30,38,0.8)', border: '1px solid rgba(255,255,255,0.1)', color: '#EDF4F6' }} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: '#7BAAB8' }}>Sobre você *</label>
                <textarea value={form.bio} onChange={e => update('bio', e.target.value)} rows={4}
                  placeholder="Conte a sua experiência, anos de trabalho, certificações..."
                  className="w-full px-3 py-2.5 rounded-lg text-sm outline-none resize-none"
                  style={{ background: 'rgba(6,30,38,0.8)', border: '1px solid rgba(255,255,255,0.1)', color: '#EDF4F6' }} />
                <div className="text-right text-xs mt-1" style={{ color: '#3D6878' }}>{form.bio.length} caracteres (mín. 10)</div>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setStep(2)}
                  className="flex-1 py-3 rounded-xl font-semibold text-sm"
                  style={{ background: 'rgba(255,255,255,0.06)', color: '#7BAAB8', border: '1px solid rgba(255,255,255,0.08)' }}>
                  ← Voltar
                </button>
                <button onClick={() => canStep3 && setStep(4)} disabled={!canStep3}
                  className="flex-1 py-3 rounded-xl font-semibold text-sm"
                  style={{ background: canStep3 ? '#E8A020' : 'rgba(255,255,255,0.06)', color: canStep3 ? '#fff' : '#3D6878' }}>
                  Continuar →
                </button>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-5">
              <h2 className="font-semibold text-lg" style={{ color: '#EDF4F6' }}>Onde está? Localização</h2>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: '#7BAAB8' }}>Localização *</label>
                <select value={form.location} onChange={e => update('location', e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
                  style={{ background: 'rgba(6,30,38,0.8)', border: '1px solid rgba(255,255,255,0.1)', color: '#EDF4F6' }}>
                  {LOCATIONS.map(l => <option key={l}>{l}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: '#7BAAB8' }}>Província *</label>
                <select value={form.province} onChange={e => update('province', e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
                  style={{ background: 'rgba(6,30,38,0.8)', border: '1px solid rgba(255,255,255,0.1)', color: '#EDF4F6' }}>
                  {PROVINCES.map(p => <option key={p}>{p}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: '#7BAAB8' }}>Senha *</label>
                <input type="password" value={senha} onChange={e => setSenha(e.target.value)} autoComplete="new-password"
                  placeholder="Mín. 8 caracteres"
                  className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
                  style={{ background: 'rgba(6,30,38,0.8)', border: '1px solid rgba(255,255,255,0.1)', color: '#EDF4F6' }} />
                <div className="text-xs mt-1" style={{ color: senhaValida ? '#34D399' : '#3D6878' }}>
                  Requer maiúsculas, minúsculas e números
                </div>
              </div>

              <div className="p-4 rounded-xl space-y-2" style={{ background: 'rgba(6,30,38,0.6)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <h4 className="text-xs font-semibold mb-2" style={{ color: '#7BAAB8' }}>RESUMO DO PERFIL</h4>
                <div className="text-sm font-medium" style={{ color: '#EDF4F6' }}>{form.name} — {form.profession}</div>
                <div className="text-xs" style={{ color: '#7BAAB8' }}>
                  {categories.find(c => c.id === form.category)?.name} • {form.location}, {form.province}
                </div>
                <div className="text-xs" style={{ color: '#7BAAB8' }}>
                  Competências: {form.skills.length} • Taxa: {form.hourlyRate ? `${parseInt(form.hourlyRate).toLocaleString()} MZN/h` : '—'}
                </div>
              </div>

              {erro && (
                <div className="p-3 rounded-xl text-sm" style={{ background: 'rgba(251,113,133,0.1)', color: '#FB7185', border: '1px solid rgba(251,113,133,0.25)' }}>
                  {erro}
                </div>
              )}

              <div className="flex gap-3">
                <button onClick={() => setStep(3)}
                  className="flex-1 py-3 rounded-xl font-semibold text-sm"
                  style={{ background: 'rgba(255,255,255,0.06)', color: '#7BAAB8', border: '1px solid rgba(255,255,255,0.08)' }}>
                  ← Voltar
                </button>
                <button onClick={handleSubmit} disabled={!canSubmit || aSubmeter}
                  className="flex-1 py-3 rounded-xl font-semibold text-sm disabled:opacity-60"
                  style={{ background: canSubmit ? '#E8A020' : 'rgba(255,255,255,0.06)', color: canSubmit ? '#fff' : '#3D6878' }}>
                  {aSubmeter ? 'A criar…' : 'Criar Perfil Profissional'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
