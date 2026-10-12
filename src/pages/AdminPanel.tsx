import { useCallback, useEffect, useState } from 'react'
import { api, type AdminMetrics, type AdminProfissional, type AdminServico, type AdminUsuario } from '../api/client'
import { useStore } from '../context/store'

type AdminTab = 'overview' | 'profissionais' | 'usuarios' | 'servicos'

const TAB_ITEMS: { id: AdminTab; label: string }[] = [
  { id: 'overview', label: '📊 Visão Geral' },
  { id: 'profissionais', label: '👷 Profissionais' },
  { id: 'usuarios', label: '👥 Utilizadores' },
  { id: 'servicos', label: '📋 Serviços' },
]

const CATEGORIAS = ['electricidade', 'informatica', 'construcao', 'design', 'educacao', 'saude', 'mecanica', 'limpeza', 'juridico', 'financas']

export default function AdminPanel() {
  const { authUser } = useStore()
  const [tab, setTab] = useState<AdminTab>('overview')
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null)
  const [pros, setPros] = useState<AdminProfissional[]>([])
  const [users, setUsers] = useState<AdminUsuario[]>([])
  const [servs, setServs] = useState<AdminServico[]>([])
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  const flash = (text: string) => {
    setMsg(text)
    setTimeout(() => setMsg(''), 3000)
  }

  const load = useCallback(async (silent = false) => {
    // O polling não mexe em `busy`: senão o botão "Atualizar" piscava a cada
    // 30 segundos sem o utilizador ter pedido nada.
    if (!silent) setBusy(true)
    try {
      const [m, p, u, s] = await Promise.all([
        api.admin.metrics(),
        api.admin.profissionais(),
        api.admin.usuarios(),
        api.admin.servicos(),
      ])
      setMetrics(m)
      setPros(p)
      setUsers(u)
      setServs(s)
    } catch (e: any) {
      flash(e?.message || 'Erro ao carregar dados')
    } finally {
      if (!silent) setBusy(false)
    }
  }, [])

  useEffect(() => {
    load()
    // Um painel de controlo que só carrega no arranque esconde os registos que
    // chegam depois de o abrir — foi exactamente o que aconteceu hoje.
    const t = setInterval(() => { void load(true) }, 30000)
    const aoVoltar = () => { if (document.visibilityState === 'visible') void load(true) }
    document.addEventListener('visibilitychange', aoVoltar)
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', aoVoltar) }
  }, [load])

  const refresh = async () => {
    await load()
  }

  const atuPro = async (id: number, body: Record<string, unknown>) => {
    try {
      await api.admin.atuProfissional(id, body)
      flash('Profissional atualizado')
      await refresh()
    } catch (e: any) {
      flash(e?.message || 'Erro ao atualizar')
    }
  }

  const atuUser = async (id: number, body: Record<string, unknown>) => {
    try {
      await api.admin.atuUsuario(id, body)
      flash('Utilizador atualizado')
      await refresh()
    } catch (e: any) {
      flash(e?.message || 'Erro ao atualizar')
    }
  }

  const atuServ = async (id: number, status: 'aberto' | 'contratado' | 'removido') => {
    try {
      await api.admin.atuServico(id, status)
      flash('Serviço atualizado')
      await refresh()
    } catch (e: any) {
      flash(e?.message || 'Erro ao atualizar')
    }
  }

  return (
    <div className="min-h-screen" style={{ background: '#061E26' }}>
      {/* Header */}
      <div className="py-10 px-4" style={{ background: 'linear-gradient(180deg, #0D2E38, #061E26)' }}>
        <div className="max-w-6xl mx-auto flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-bold uppercase tracking-[0.16em] px-2 py-0.5 rounded-lg"
                style={{ background: 'rgba(232,160,32,0.18)', color: '#E8A020' }}>
                Administração
              </span>
            </div>
            <h1 className="font-serif text-3xl sm:text-4xl" style={{ color: '#EDF4F6' }}>Painel de Controlo</h1>
            <p className="text-sm mt-1" style={{ color: '#7BAAB8' }}>
              Gestão total da plataforma — {authUser?.nome}
            </p>
          </div>
          <button
            onClick={refresh}
            disabled={busy}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold"
            style={{ background: '#E8A020', color: '#fff' }}
          >
            {busy ? 'A atualizar…' : '↻ Atualizar'}
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6">
        {msg && (
          <div className="mb-4 px-4 py-3 rounded-xl text-sm" 
            style={{ background: 'rgba(52,211,153,0.1)', color: '#34D399', border: '1px solid rgba(52,211,153,0.2)' }}>
            {msg}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 mb-6 p-1 rounded-xl overflow-x-auto" style={{ background: '#0D2E38' }}>
          {TAB_ITEMS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className="flex-shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-all"
              style={{
                background: tab === t.id ? 'rgba(232,160,32,0.15)' : 'transparent',
                color: tab === t.id ? '#E8A020' : '#7BAAB8',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'overview' && <Overview metrics={metrics} />}
        {tab === 'profissionais' && (
          <Profissionais rows={pros} onSave={atuPro} />
        )}
        {tab === 'usuarios' && (
          <Utilizadores rows={users} onSave={atuUser} />
        )}
        {tab === 'servicos' && (
          <Servicos rows={servs} onSave={atuServ} />
        )}
      </div>
    </div>
  )
}

function Card({ label, value, icon, sub }: { label: string; value: string | number; icon: string; sub?: string }) {
  return (
    <div className="p-4 rounded-2xl" style={{ background: '#0D2E38', border: '1px solid rgba(255,255,255,0.06)' }}>
      <div className="text-2xl mb-1">{icon}</div>
      <div className="font-bold text-2xl" style={{ color: '#EDF4F6' }}>{value}</div>
      <div className="text-xs" style={{ color: '#7BAAB8' }}>{label}</div>
      {sub && <div className="text-[11px] mt-1" style={{ color: '#3D6878' }}>{sub}</div>}
    </div>
  )
}

function Bars({ items }: { items: { label: string; n: number }[] }) {
  const max = Math.max(1, ...items.map(i => i.n))
  return (
    <div className="space-y-2">
      {items.map(i => (
        <div key={i.label}>
          <div className="flex justify-between text-xs mb-1">
            <span style={{ color: '#9EC2CB' }}>{i.label || '—'}</span>
            <span style={{ color: '#E8A020' }}>{i.n}</span>
          </div>
          <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
            <div className="h-full rounded-full" style={{ background: '#E8A020', width: `${Math.max(4, (i.n / max) * 100)}%` }} />
          </div>
        </div>
      ))}
    </div>
  )
}

function Overview({ metrics }: { metrics: AdminMetrics | null }) {
  if (!metrics) return <Loading />
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <Card label="Utilizadores" value={metrics.usuarios.total} icon="👥" />
        <Card label="Profissionais" value={metrics.profissionais.total} icon="👷" sub={`${metrics.profissionais.verificado} verificados`} />
        <Card label="Serviços publicados" value={metrics.servicos.total} icon="📋" />
        <Card label="Contratos" value={metrics.contratos.total} icon="🤝" />
        <Card label="Propostas" value={metrics.propostas} icon="📨" />
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <Section title="Utilizadores por tipo">
          <Bars items={metrics.usuarios.porTipo.map(t => ({ label: t.tipo, n: t.n }))} />
        </Section>
        <Section title="Profissionais por categoria">
          <Bars items={metrics.profissionais.porCategoria.map(c => ({ label: c.categoria, n: c.n }))} />
        </Section>
        <Section title="Serviços por estado">
          <Bars items={metrics.servicos.porStatus.map(s => ({ label: s.status, n: s.n }))} />
        </Section>
      </div>
    </div>
  )
}

function Profissionais({ rows, onSave }: { rows: AdminProfissional[]; onSave: (id: number, body: Record<string, unknown>) => void }) {
  const [edits, setEdits] = useState<Record<number, Partial<AdminProfissional>>>({})

  const set = (id: number, patch: Partial<AdminProfissional>) =>
    setEdits(prev => ({ ...prev, [id]: { ...prev[id], ...patch } }))

  return (
    <div className="space-y-3">
      {rows.length === 0 && <Empty text="Sem profissionais registados." />}
      {rows.map(p => {
        const e = edits[p.id] ?? {}
        const titulo = e.titulo !== undefined ? e.titulo : p.titulo
        const taxa = e.taxa_hora !== undefined ? e.taxa_hora : p.taxa_hora
        const disponivel = e.disponivel !== undefined ? e.disponivel : p.disponivel
        const verificado = e.verificado !== undefined ? e.verificado : p.verificado
        const categoria = e.categoria !== undefined ? e.categoria : p.categoria
        const dirty = edits[p.id] !== undefined
        return (
          <div key={p.id} className="p-4 rounded-2xl" style={{ background: '#0D2E38', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="flex flex-wrap items-start gap-3">
              <img src={p.foto_perfil || ''} alt={p.nome} data-african-avatar="true" loading="lazy" decoding="async"
                className="w-12 h-12 rounded-xl object-cover"
                style={{ background: '#1A4050' }} />
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm" style={{ color: '#EDF4F6' }}>{p.nome}</div>
                <div className="text-xs" style={{ color: '#E8A020' }}>{p.email}</div>
                <div className="text-xs mt-0.5" style={{ color: '#7BAAB8' }}>
                  {p.titulo || 'Sem título'} • {p.localizacao || '—'} • ⭐ {Number(p.avaliacao).toFixed(1)} ({p.avaliacoes})
                </div>
              </div>
              <div className="flex flex-col items-end gap-1 text-xs">
                <span className={p.ativo ? 'ok' : 'bad'} style={{ color: p.ativo ? '#34D399' : '#F87171' }}>
                  {p.ativo ? 'Conta ativa' : 'Conta desativada'}
                </span>
                <span style={{ color: '#7BAAB8' }}>Score {p.score}</span>
              </div>
            </div>

            <div className="mt-3 grid sm:grid-cols-2 gap-3">
              <Field label="Título / Profissão">
                <input value={titulo || ''} onChange={ev => set(p.id, { titulo: ev.target.value })}
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                  style={{ background: 'rgba(4,24,31,0.58)', border: '1px solid rgba(255,255,255,0.12)', color: '#EDF4F6' }} />
              </Field>
              <Field label="Categoria">
                <select value={categoria || ''} onChange={ev => set(p.id, { categoria: ev.target.value })}
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                  style={{ background: 'rgba(4,24,31,0.58)', border: '1px solid rgba(255,255,255,0.12)', color: '#EDF4F6' }}>
                  <option value="">—</option>
                  {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </Field>
              <Field label={`Taxa horária — ${taxa ?? 0} MZN`}>
                <input type="number" value={taxa ?? 0} onChange={ev => set(p.id, { taxa_hora: Number(ev.target.value) })}
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                  style={{ background: 'rgba(4,24,31,0.58)', border: '1px solid rgba(255,255,255,0.12)', color: '#EDF4F6' }} />
              </Field>
              <Field label="Perfil (URL da foto)">
                <input value={p.foto_perfil || ''} onChange={ev => set(p.id, { foto_perfil: ev.target.value })}
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                  style={{ background: 'rgba(4,24,31,0.58)', border: '1px solid rgba(255,255,255,0.12)', color: '#EDF4F6' }} />
              </Field>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-3">
              <Toggle
                on={verificado}
                label={verificado ? 'Verificado ✓' : 'Por verificar'}
                onColor="#34D399"
                onClick={() => set(p.id, { verificado: !verificado })}
              />
              <Toggle
                on={disponivel}
                label={disponivel ? 'Disponível' : 'Indisponível'}
                onColor="#38BDF8"
                onClick={() => set(p.id, { disponivel: !disponivel })}
              />
              <div className="flex-1" />
              <button
                onClick={() => onSave(p.id, edits[p.id] ?? {})}
                disabled={!dirty}
                className="px-4 py-2 rounded-lg text-sm font-semibold transition-all"
                style={{
                  background: dirty ? '#E8A020' : 'rgba(255,255,255,0.06)',
                  color: dirty ? '#fff' : '#3D6878',
                }}
              >
                Guardar alterações
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function Utilizadores({ rows, onSave }: { rows: AdminUsuario[]; onSave: (id: number, body: Record<string, unknown>) => void }) {
  // 338 dos utilizadores são clientes sintéticos do seed. Esconder isto por
  // omissão é a diferença entre ver um registo real e precisar de o procurar
  // numa lista de 350 linhas.
  const [busca, setBusca] = useState('')
  const [verDemo, setVerDemo] = useState(false)

  const demo = (u: AdminUsuario) => u.email.startsWith('cliente.demo.')
  const filtrados = rows.filter(u => {
    if (!verDemo && demo(u)) return false
    if (!busca.trim()) return true
    const b = busca.trim().toLowerCase()
    return (u.nome || '').toLowerCase().includes(b) || (u.email || '').toLowerCase().includes(b)
  })
  const ocultos = rows.length - filtrados.length

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Procurar por nome ou email"
          className="flex-1 min-w-[200px] px-3.5 py-2.5 rounded-lg text-sm outline-none"
          style={{ background: 'rgba(4,24,31,0.58)', border: '1px solid rgba(255,255,255,0.12)', color: '#EDF4F6' }} />
        <label className="flex items-center gap-2 text-xs cursor-pointer" style={{ color: '#7BAAB8' }}>
          <input type="checkbox" checked={verDemo} onChange={e => setVerDemo(e.target.checked)}
            className="w-4 h-4 accent-[#E8A020]" />
          Mostrar clientes de demonstração
        </label>
      </div>

      {ocultos > 0 && (
        <p className="text-xs" style={{ color: '#5C8894' }}>
          {ocultos} utilizador{ocultos === 1 ? '' : 'es'} de demonstração oculto{ocultos === 1 ? '' : 's'}.
        </p>
      )}

      {filtrados.length === 0 && <Empty text={rows.length === 0 ? 'Sem utilizadores.' : 'Nenhum utilizador corresponde à procura.'} />}
      {filtrados.map(u => (
        <div key={u.id} className="p-4 rounded-2xl flex flex-wrap items-center gap-3"
          style={{ background: '#0D2E38', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm"
            style={{ background: 'rgba(232,160,32,0.15)', color: '#E8A020' }}>
            {u.nome.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-medium text-sm" style={{ color: '#EDF4F6' }}>{u.nome}</div>
            <div className="text-xs" style={{ color: '#7BAAB8' }}>{u.email} {u.telefone ? `• ${u.telefone}` : ''}</div>
          </div>
          <select
            value={u.tipo}
            onChange={ev => onSave(u.id, { tipo: ev.target.value })}
            className="px-3 py-2 rounded-lg text-sm outline-none"
            style={{ background: 'rgba(4,24,31,0.58)', border: '1px solid rgba(255,255,255,0.12)', color: '#EDF4F6' }}
          >
            <option value="cliente">Cliente</option>
            <option value="profissional">Profissional</option>
            <option value="admin">Admin</option>
          </select>
          <Toggle
            on={u.ativo}
            label={u.ativo ? 'Ativo' : 'Suspenso'}
            onColor="#34D399"
            onClick={() => onSave(u.id, { ativo: !u.ativo })}
          />
        </div>
      ))}
    </div>
  )
}

function Servicos({ rows, onSave }: { rows: AdminServico[]; onSave: (id: number, status: 'aberto' | 'contratado' | 'removido') => void }) {
  const statusColor: Record<string, { color: string; bg: string; label: string }> = {
    aberto: { color: '#34D399', bg: 'rgba(52,211,153,0.12)', label: 'Aberto' },
    contratado: { color: '#38BDF8', bg: 'rgba(56,189,248,0.12)', label: 'Contratado' },
    removido: { color: '#F87171', bg: 'rgba(248,113,113,0.12)', label: 'Removido' },
  }
  return (
    <div className="space-y-3">
      {rows.length === 0 && <Empty text="Sem serviços publicados." />}
      {rows.map(s => {
        const st = statusColor[s.status] ?? { color: '#7BAAB8', bg: 'rgba(255,255,255,0.06)', label: s.status }
        return (
          <div key={s.id} className="p-4 rounded-2xl" style={{ background: '#0D2E38', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="flex flex-wrap items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 font-medium text-sm" style={{ color: '#EDF4F6' }}>
                  {s.titulo}
                  {s.urgente && <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(248,113,113,0.15)', color: '#F87171' }}>⚡</span>}
                </div>
                <div className="text-xs mt-0.5" style={{ color: '#7BAAB8' }}>
                  {s.autor} • {s.categoria} • {s.cidade || '—'} • {new Date(s.created_at).toLocaleDateString('pt-PT')}
                </div>
                {s.descricao && <p className="text-xs mt-1.5 leading-relaxed line-clamp-2" style={{ color: '#9EC2CB' }}>{s.descricao}</p>}
              </div>
              <div className="flex flex-col items-end gap-2">
                <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: st.bg, color: st.color }}>{st.label}</span>
                <select
                  value={s.status}
                  onChange={ev => onSave(s.id, ev.target.value as 'aberto' | 'contratado' | 'removido')}
                  className="px-3 py-1.5 rounded-lg text-xs outline-none"
                  style={{ background: 'rgba(4,24,31,0.58)', border: '1px solid rgba(255,255,255,0.12)', color: '#EDF4F6' }}
                >
                  <option value="aberto">Aberto</option>
                  <option value="contratado">Contratado</option>
                  <option value="removido">Removido</option>
                </select>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="p-4 rounded-2xl" style={{ background: '#0D2E38', border: '1px solid rgba(255,255,255,0.06)' }}>
      <div className="text-sm font-semibold mb-3" style={{ color: '#EDF4F6' }}>{title}</div>
      {children}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold mb-1.5" style={{ color: '#9EC2CB' }}>{label}</label>
      {children}
    </div>
  )
}

function Toggle({ on, label, onColor, onClick }: { on: boolean; label: string; onColor: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border"
      style={{
        background: on ? `${onColor}1a` : 'rgba(255,255,255,0.04)',
        color: on ? onColor : '#7BAAB8',
        borderColor: on ? `${onColor}45` : 'rgba(255,255,255,0.1)',
      }}
    >
      <span className="w-2 h-2 rounded-full" style={{ background: on ? onColor : '#4A6B76' }} />
      {label}
    </button>
  )
}

function Loading() {
  return <div className="text-sm py-8 text-center" style={{ color: '#7BAAB8' }}>A carregar dados admin…</div>
}

function Empty({ text }: { text: string }) {
  return (
    <div className="p-8 rounded-2xl text-center" style={{ background: '#0D2E38', border: '1px solid rgba(255,255,255,0.06)' }}>
      <div className="text-3xl mb-2">📭</div>
      <p className="text-sm" style={{ color: '#7BAAB8' }}>{text}</p>
    </div>
  )
}