import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { loadTables, saveTables, insert, updateRow, nextId, type JDBTables } from '../db/db'
import { buildSeed } from '../db/seed'
import { buildProfessionals, serverProfToProfessional } from '../db/adapters'
import {
  api, getToken, getUser, setToken, setUser, logout as apiLogout, type User,
  type ServerAvaliacao, type ServerContrato, type ServerNotificacao, type ServerProposta, type ServerServico,
} from '../api/client'
import type { Professional } from '../types'
import type { Contrato, StatusContrato, Servico } from '../db/schema'

export interface UserReview {
  rating: number
  text: string
  date: string
}

export interface PublishedJob {
  id: string
  clientId?: number
  title: string
  category: string
  description: string
  budget: string
  budgetMax: string
  location: string
  deadline: string
  urgent: boolean
  type: string
  name: string
  email: string
  phone: string
  postedAt: string
}

export type ContractPhase = 'proposed' | 'hired' | 'completed' | 'cancelled'

export interface Contract {
  proId: number
  clientId?: number
  phase: ContractPhase
  budget: string
  deadline: string
  scope: string
  hiredAt?: string
}

export interface NewProfessional {
  name: string
  email: string
  phone: string
  profession: string
  category: string
  skills: string[]
  location: string
  province: string
  hourlyRate: number
  bio: string
  /** Omissão = true: o técnico escreve o número para ser contactado. */
  publicPhone?: boolean
}

export interface Perfil {
  nome: string
  telefone: string
  provincia: string
  cidade: string
  foto_perfil: string
}

export type ProfilePatch = {
  nome?: string
  telefone?: string
  provincia?: string
  cidade?: string
  /** `null` remove a foto. */
  foto_perfil?: string | null
}

interface StoreState {
  professionals: Professional[]
  publishedJobs: PublishedJob[]
  contracts: Contract[]
  userReviews: Record<number, UserReview>
  proposals: ProposalView[]
  notifications: ServerNotificacao[]
  unreadCount: number
  markNotificationRead: (id: number) => Promise<void>
  markAllNotificationsRead: () => Promise<void>
  refreshNotifications: () => Promise<void>
  authUser: User | null
  perfil: Perfil | null
  authLoading: boolean
  signIn: (email: string, senha: string) => Promise<User>
  signUp: (data: {
    nome: string
    email: string
    senha: string
    tipo: 'profissional' | 'cliente'
    telefone?: string
  }) => Promise<User>
  signOut: () => void
  updateProfile: (patch: ProfilePatch) => Promise<void>
  refreshPerfil: () => Promise<void>
  setReview: (proId: number, review: UserReview) => Promise<void>
  addPublishedJob: (job: Omit<PublishedJob, 'id' | 'postedAt'>) => Promise<void>
  setContract: (proId: number, contract: Contract) => Promise<void>
  clearReview: (proId: number) => Promise<void>
  registerProfessional: (data: NewProfessional, senha: string) => Promise<Professional | null>
  sendProposal: (proId: number, proposal: { valor: number; prazo: string; descricao: string }) => Promise<void>
  setProposalStatus: (proposalId: number, status: 'aceita' | 'recusada', valorAcordado?: number) => Promise<void>
  mutating: boolean
}

export interface ProposalView {
  id: number
  clientId: number
  profissionalId: number
  proName: string
  proProfession: string
  proAvatar: string
  clienteNome: string
  valor: number
  prazo: string
  descricao: string
  status: 'enviada' | 'aceita' | 'recusada'
  criadaEm: string
  /** Quem pode aceitar/recusar é o destinatário, que não é o remetente. */
  podeDecidir: boolean
}

const StoreContext = createContext<StoreState | null>(null)

// Garante que a "base de dados" é inicializada com os dados de exemplo na 1ª vez.
function initDb(): JDBTables {
  const DB_VERSION = 5 // force reset of stale localStorage data so the selected desktop photos are used by the app
  const storedVersion = parseInt(localStorage.getItem('jdb.version') ?? '0', 10)
  if (storedVersion < DB_VERSION) {
    localStorage.removeItem('jdb.all')
    localStorage.setItem('jdb.version', String(DB_VERSION))
  }
  const existing = loadTables()
  if (existing.users.length === 0 && existing.profissionais.length === 0) {
    const seed = buildSeed()
    return { ...existing, ...seed }
  }
  return existing
}

function statusToServico(phase: ContractPhase): StatusContrato {
  if (phase === 'completed') return 'concluido'
  if (phase === 'cancelled') return 'cancelado'
  return 'em_andamento'
}

// Valores aceitos pela coluna status na tabela contratos (Postgres).
function statusToContrato(phase: ContractPhase): 'em_andamento' | 'concluido' | 'cancelado' {
  if (phase === 'completed') return 'concluido'
  if (phase === 'cancelled') return 'cancelado'
  return 'em_andamento'
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<JDBTables>(() => initDb())
  const [serverProfessionals, setServerProfessionals] = useState<Professional[]>([])
  const [serverServices, setServerServices] = useState<ServerServico[]>([])
  const [serverProposals, setServerProposals] = useState<ServerProposta[]>([])
  const [serverContracts, setServerContracts] = useState<ServerContrato[]>([])
  const [serverReviews, setServerReviews] = useState<ServerAvaliacao[]>([])
  const [notifications, setNotifications] = useState<ServerNotificacao[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [perfil, setPerfil] = useState<Perfil | null>(null)
  const [authUser, setAuthUser] = useState<User | null>(() => getUser())
  const [authLoading, setAuthLoading] = useState(false)
  const [mutating, setMutating] = useState(false)

  // Persiste sempre que db muda
  useEffect(() => {
    saveTables(db)
  }, [db])

  // Sincroniza com o backend apenas quando a aplicação foi explicitamente
  // configurada para usar a API. Em modo local de desenvolvimento, o app
  // mantém-se em modo demonstrativo sem bloquear o carregamento por 404/500.
  const shouldUseServerApi = import.meta.env.VITE_ENABLE_API === 'true' || import.meta.env.PROD

  // Quando autenticado, o servidor é a fonte de verdade do marketplace. Os IDs
  // locais (catálogo de demonstração) e os do Postgres colidem, por isso nunca
  // se misturam: sessão iniciada usa exclusivamente dados do servidor.
  const isLive = shouldUseServerApi && !!authUser && !!getToken()

  const refreshServer = useCallback(async () => {
    if (!getToken()) return
    const [pros, servs, props, contrs, avals] = await Promise.all([
      api.profissionais(),
      api.servicos(),
      api.propostas(),
      api.contratos(),
      api.avaliacoes(),
    ])
    // Devolve os profissionais já convertidos: quem acaba de registar-se
    // precisa do id do perfil que acabou de criar, e procurar em
    // serverProfessionals lê o estado do render anterior (setState é async).
    const convertidos = pros.map(serverProfToProfessional)
    setServerProfessionals(convertidos)
    setServerServices(servs)
    setServerProposals(props)
    setServerContracts(contrs)
    setServerReviews(avals)
    return convertidos
  }, [])

  // O sino faz polling da contagem, que é uma query leve. A lista completa só
  // é pedida quando o painel é aberto —_polling de tudo a cada minuto num
  // telemóvel com dados limitados seria desperdício.
  const refreshUnreadCount = useCallback(async () => {
    if (!getToken()) return
    const r = await api.notificacoesNaoLidas()
    setUnreadCount(r.naoLidas)
  }, [])

  const refreshNotifications = useCallback(async () => {
    if (!getToken()) return
    const lista = await api.notificacoes()
    setNotifications(lista)
    setUnreadCount(lista.filter(n => !n.lida).length)
  }, [])

  const markNotificationRead = useCallback(async (id: number) => {
    if (!getToken()) return
    await api.marcarNotificacaoLida(id)
    setNotifications(prev => prev.map(n => (n.id === id ? { ...n, lida: true } : n)))
    setUnreadCount(prev => Math.max(0, prev - 1))
  }, [])

  const markAllNotificationsRead = useCallback(async () => {
    if (!getToken()) return
    await api.marcarTodasLidas()
    setNotifications(prev => prev.map(n => ({ ...n, lida: true })))
    setUnreadCount(0)
  }, [])

  // Enquanto o utilizador está com a app aberta, o sino actualiza sozinho.
  useEffect(() => {
    if (!isLive) {
      setNotifications([])
      setUnreadCount(0)
      return
    }
    void refreshUnreadCount().catch(() => { /* offline — tenta mais tarde */ })
    const t = setInterval(() => { void refreshUnreadCount().catch(() => {}) }, 60000)
    return () => clearInterval(t)
  }, [isLive, refreshUnreadCount])

  useEffect(() => {
    if (!isLive) {
      setServerProfessionals([])
      setServerServices([])
      setServerProposals([])
      setServerContracts([])
      setServerReviews([])
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        await refreshServer()
      } catch {
        /* API indisponível — mantém modo local */
      }
      if (!cancelled) setMutating(false)
    })()
    return () => {
      cancelled = true
    }
  }, [authUser?.id, isLive, refreshServer])

  // O token em `localStorage` só guarda id/nome/email/tipo — a foto e a
  // localidade vivem em `/me`. Sem este carregamento a página de definições
  // abria sempre com os campos vazios depois de um refresh.
  const refreshPerfil = useCallback(async () => {
    if (!getToken()) { setPerfil(null); return }
    const r = await api.me()
    const u = r.user
    if (!u) { setPerfil(null); return }
    setPerfil({
      nome: u.nome || '',
      telefone: u.telefone || '',
      provincia: u.provincia || '',
      cidade: u.cidade || '',
      foto_perfil: u.foto_perfil || '',
    })
  }, [])

  useEffect(() => {
    if (!isLive) return
    void refreshPerfil().catch(() => { /* API indisponível — mostra os campos vazios */ })
  }, [authUser?.id, isLive, refreshPerfil])

  const myUserId = authUser?.id ?? 2 // app demo: o utilizador da sessão (cliente)

  // Em modo local não existe `/me`: o perfil vem da linha do próprio utilizador
  // dentro das tabelas.
  useEffect(() => {
    if (isLive) return
    const u = db.users.find(x => x.id === myUserId)
    setPerfil(u ? {
      nome: u.nome, telefone: u.telefone || '', provincia: u.provincia || '',
      cidade: u.cidade || '', foto_perfil: u.foto_perfil || '',
    } : null)
  }, [db, isLive, myUserId])

  const localProfessionals = useMemo(() => buildProfessionals(db), [db])
  const professionals: Professional[] = useMemo(
    () => (isLive ? serverProfessionals : localProfessionals),
    [isLive, serverProfessionals, localProfessionals],
  )

  const publishedJobs: PublishedJob[] = useMemo(() => {
    if (isLive) {
      return serverServices.map(s => ({
        id: `SRV-${s.id}`,
        clientId: s.user_id,
        title: s.titulo,
        category: s.categoria,
        description: s.descricao ?? '',
        budget: String(s.orcamento_min ?? 0),
        budgetMax: s.orcamento_max ? String(s.orcamento_max) : '',
        location: s.cidade || s.localizacao || '',
        deadline: s.prazo ?? '',
        urgent: s.urgente ?? false,
        type: 'client' as const,
        name: s.autor ?? '',
        email: '',
        phone: '',
        postedAt: s.created_at ?? '',
      }))
    }
    return db.servicos.map(s => ({
      id: `JT-SRV-${String(s.id).padStart(3, '0')}`,
      clientId: s.cliente_id,
      title: s.titulo,
      category: s.categoria,
      description: s.descricao,
      budget: String(s.orcamento_min),
      budgetMax: s.orcamento_max ? String(s.orcamento_max) : '',
      location: s.cidade,
      deadline: s.prazo,
      urgent: s.urgente,
      type: 'client' as const,
      name: db.users.find(u => u.id === s.cliente_id)?.nome ?? '',
      email: '',
      phone: '',
      postedAt: s.criado_em,
    }))
  }, [db, isLive, serverServices])

  const contracts: Contract[] = useMemo(() => {
    if (isLive) {
      return serverContracts.map(c => ({
        proId: c.proId,
        clientId: c.clientId ?? undefined,
        phase: c.phase,
        budget: c.budget,
        deadline: c.prazo,
        scope: c.escopo,
        hiredAt: c.hiredAt,
      }))
    }
    return db.contratos.map(c => {
      const pro = db.profissionais.find(p => p.id === c.profissional_id)
      const user = pro ? db.users.find(u => u.id === pro.user_id) : undefined
      return {
        proId: c.profissional_id,
        clientId: c.cliente_id,
        phase: c.status === 'concluido' ? 'completed' : c.status === 'cancelado' ? 'cancelled' : 'hired',
        budget: c.valor_acordado ? String(c.valor_acordado) : '',
        deadline: c.data_inicio ? new Date(c.data_inicio).toLocaleDateString('pt-PT') : '',
        scope: '',
        hiredAt: c.data_inicio,
      }
    })
  }, [db, isLive, serverContracts])

  const userReviews: Record<number, UserReview> = useMemo(() => {
    const reviews: Record<number, UserReview> = {}
    if (isLive) {
      for (const a of serverReviews) {
        reviews[a.profissional_id] = {
          rating: a.nota,
          text: a.comentario,
          date: a.date,
        }
      }
      return reviews
    }
    for (const a of db.avaliacoes) {
      const pro = db.profissionais.find(p => p.user_id === a.avaliado_id)
      if (pro && a.avaliador_id === myUserId) {
        reviews[pro.id] = {
          rating: a.nota,
          text: a.comentario,
          date: new Date(a.criada_em).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' }),
        }
      }
    }
    return reviews
  }, [db, isLive, serverReviews, myUserId])

  const proposals: ProposalView[] = useMemo(() => {
    if (isLive) {
      return serverProposals.map(p => ({
        id: p.id,
        clientId: p.cliente_id ?? 0,
        profissionalId: p.profissional_id,
        proName: p.proName,
        proProfession: p.proProfession,
        proAvatar: p.proAvatar,
        clienteNome: p.clienteNome,
        valor: p.valor,
        prazo: p.prazo,
        descricao: p.descricao,
        status: p.status,
        criadaEm: p.criadaEm,
        podeDecidir: p.podeDecidir,
      }))
    }
    return db.propostas.map(p => {
      const pro = db.profissionais.find(pr => pr.id === p.profissional_id)
      const user = pro ? db.users.find(u => u.id === pro.user_id) : undefined
      return {
        id: p.id,
        clientId: p.cliente_id ?? myUserId,
        profissionalId: p.profissional_id,
        proName: user?.nome ?? 'Profissional',
        proProfession: pro?.profissao_principal ?? '',
        proAvatar: user?.foto_perfil ?? '',
        clienteNome: db.users.find(u => u.id === p.cliente_id)?.nome ?? '',
        valor: p.valor,
        prazo: p.prazo_entrega,
        descricao: p.descricao,
        status: p.status,
        criadaEm: p.criada_em,
        // Em modo local o dashboard é do cliente, que é quem decide.
        podeDecidir: p.cliente_id === myUserId,
      }
    })
  }, [db, isLive, serverProposals, myUserId])

  // Executa uma mutação contra o servidor e volta a carregar o estado. Em modo
  // local (demonstração) devolve false para o caller seguir o caminho local.
  const runServer = useCallback(async (fn: () => Promise<unknown>): Promise<boolean> => {
    if (!isLive) return false
    setMutating(true)
    try {
      await fn()
      await refreshServer()
      return true
    } catch (e) {
      console.error('Operação falhou:', (e as Error)?.message)
      throw e
    } finally {
      setMutating(false)
    }
  }, [isLive, refreshServer])

  const sendProposal = async (proId: number, proposal: { valor: number; prazo: string; descricao: string }) => {
    if (await runServer(() => api.enviarProposta({
      profissionalId: proId,
      mensagem: proposal.descricao,
      valor: proposal.valor,
      prazo: proposal.prazo,
    }))) return
    setDb(prev => {
      const id = nextId(prev, 'propostas')
      const nova = {
        id,
        servico_id: 0,
        cliente_id: myUserId,
        profissional_id: proId,
        valor: proposal.valor,
        prazo_entrega: proposal.prazo,
        descricao: proposal.descricao,
        status: 'enviada' as const,
        criada_em: new Date().toISOString(),
      }
      return insert(prev, 'propostas', nova)
    })
  }

  const setProposalStatus = async (proposalId: number, status: 'aceita' | 'recusada', valorAcordado?: number) => {
    if (await runServer(() => api.respostaProposta(proposalId, status, valorAcordado))) return
    setDb(prev => {
      let next = updateRow(prev, 'propostas', proposalId, { status })
      const prop = prev.propostas.find(p => p.id === proposalId)
      if (prop && status === 'aceita') {
        // Ao aceitar, cria contrato e marca o serviço como contratado
        const id = nextId(next, 'contratos')
        next = insert(next, 'contratos', {
          id,
          servico_id: prop.servico_id,
          proposta_id: prop.id,
          profissional_id: prop.profissional_id,
          cliente_id: myUserId,
          valor_acordado: prop.valor,
          data_inicio: new Date().toISOString(),
          data_conclusao: undefined,
          status: 'em_andamento',
        })
        if (prop.servico_id > 0) {
          next = updateRow(next, 'servicos', prop.servico_id, { status: 'contratado' })
        }
      }
      return next
    })
  }

  const setReview = async (proId: number, review: UserReview) => {
    if (await runServer(() => api.avaliar({
      profissionalId: proId,
      nota: review.rating,
      comentario: review.text,
    }))) return
    setDb(prev => {
      const pro = prev.profissionais.find(p => p.id === proId)
      if (!pro) return prev
      const id = nextId(prev, 'avaliacoes')
      const avaliacao = {
        id,
        contrato_id: 0,
        avaliador_id: myUserId,
        avaliado_id: pro.user_id,
        nota: review.rating,
        comentario: review.text,
        criada_em: new Date().toISOString(),
      }
      const delta = review.rating >= 4 ? 1 : review.rating >= 3 ? 0 : -1
      const novoScore = Math.max(40, Math.min(99, pro.jobtec_score + delta))
      let next = insert(prev, 'avaliacoes', avaliacao)
      next = updateRow(next, 'profissionais', pro.id, { jobtec_score: novoScore })
      return next
    })
  }

  const clearReview = async (proId: number) => {
    if (await runServer(() => api.removerAvaliacao(proId))) return
    setDb(prev => {
      const pro = prev.profissionais.find(p => p.id === proId)
      if (!pro) return prev
      const next = { ...prev, avaliacoes: prev.avaliacoes.filter(a => !(a.avaliador_id === myUserId && a.avaliado_id === pro.user_id)) }
      return next
    })
  }

  const signIn = async (email: string, senha: string): Promise<User> => {
    setAuthLoading(true)
    try {
      const res = await api.login(email, senha)
      setToken(res.token)
      setUser(res.user)
      setAuthUser(res.user)
      return res.user
    } finally {
      setAuthLoading(false)
    }
  }

  const signUp = async (data: {
    nome: string
    email: string
    senha: string
    tipo: 'profissional' | 'cliente'
    telefone?: string
  }): Promise<User> => {
    setAuthLoading(true)
    try {
      const res = await api.register({
        nome: data.nome,
        email: data.email,
        senha: data.senha,
        tipo: data.tipo,
        telefone: data.telefone,
      })
      setToken(res.token)
      setUser(res.user)
      setAuthUser(res.user)
      return res.user
    } finally {
      setAuthLoading(false)
    }
  }

  const signOut = () => {
    apiLogout()
    setAuthUser(null)
    setServerProfessionals([])
    setServerServices([])
    setServerProposals([])
    setServerContracts([])
    setServerReviews([])
    setNotifications([])
    setUnreadCount(0)
    setPerfil(null)
  }

  // A foto de perfil é auto-serviço: o alvo é sempre o utilizador autenticado,
  // tanto no servidor (`PATCH /api/me`) como na camada local. No servidor a rota
  // escreve `users.foto_perfil` **e** `profissionais.foto_perfil`, porque os
  // cartões de profissional e as avaliações lêem de colunas diferentes.
  const updateProfile = async (patch: ProfilePatch): Promise<void> => {
    if (isLive) {
      const res = await api.atuMe(patch)
      // `refreshServer` não toca em `authUser` (só recarrega profissionais,
      // serviços, propostas, contratos e avaliações), por isso persistimos à mão
      // o que a rota devolveu — caso contrário o cabeçalho continuava com o
      // nome e a foto antigos até ao próximo login.
      const merged = { ...authUser, ...res.user } as User
      setUser(merged)
      setAuthUser(merged)
      await Promise.all([refreshServer(), refreshPerfil()])
      return
    }
    // Na camada local a foto vive só em `users.foto_perfil` — `buildProfessionals`
    // tira o avatar de lá. O `Profissional` de `db/schema.ts` não tem a coluna, ao
    // contrário do esquema do servidor, por isso não há segunda escrita a fazer.
    setDb(prev => updateRow(prev, 'users', myUserId, { ...patch, foto_perfil: patch.foto_perfil ?? '' }))
  }

  const addPublishedJob = async (job: Omit<PublishedJob, 'id' | 'postedAt'>) => {
    if (isLive) {
      setMutating(true)
      try {
        await api.publicarServico({
          categoria: job.category,
          titulo: job.title,
          descricao: job.description,
          orcamento: job.budget,
          localizacao: job.location,
          orcamentoMin: parseInt(job.budget) || 0,
          orcamentoMax: job.budgetMax ? parseInt(job.budgetMax) || 0 : 0,
          cidade: job.location,
          prazo: job.deadline,
          urgente: job.urgent,
        })
        await refreshServer()
      } catch (e) {
        console.error('Publicação falhou:', (e as Error)?.message)
        throw e
      } finally {
        setMutating(false)
      }
      return
    }
    setDb(prev => {
      const id = nextId(prev, 'servicos')
      const servico = {
        id,
        cliente_id: myUserId,
        titulo: job.title,
        descricao: job.description,
        categoria: job.category,
        provincia: 'Nampula',
        cidade: job.location,
        orcamento_min: parseInt(job.budget) || 0,
        orcamento_max: job.budgetMax ? parseInt(job.budgetMax) || 0 : 0,
        prazo: job.deadline,
        urgente: job.urgent,
        status: 'aberto' as const,
        criado_em: new Date().toISOString(),
      }
      return insert(prev, 'servicos', servico)
    })
  }

  const setContract = async (proId: number, contract: Contract) => {
    // "proposta" (proposed) não cria contrato — é um estado leve não persistido
    if (contract.phase === 'proposed') return
    if (isLive) {
      setMutating(true)
      try {
        const existing = serverContracts.find(c => c.proId === proId)
        const valor = parseInt(contract.budget.replace(/[^\d]/g, '')) || 0
        if (existing) {
          await api.contrato(existing.id, {
            orcamento: contract.budget,
            prazo: contract.deadline,
            escopo: contract.scope,
            status: statusToContrato(contract.phase),
          })
        } else {
          await api.criarContrato({
            profissionalId: proId,
            orcamento: valor || contract.budget,
            prazo: contract.deadline,
            escopo: contract.scope,
          })
        }
        await refreshServer()
      } catch (e) {
        console.error('Contrato falhou:', (e as Error)?.message)
        throw e
      } finally {
        setMutating(false)
      }
      return
    }
    setDb(prev => {
      const existing = prev.contratos.find(c => c.profissional_id === proId)
      const valor = parseInt(contract.budget.replace(/[^\d]/g, '')) || 0
      if (existing) {
        return updateRow(prev, 'contratos', existing.id, {
          valor_acordado: valor || existing.valor_acordado,
          data_inicio: contract.hiredAt ?? existing.data_inicio,
          data_conclusao: contract.phase === 'completed' ? new Date().toISOString() : existing.data_conclusao,
          status: statusToServico(contract.phase),
        })
      }
      const id = nextId(prev, 'contratos')
      const contrato: Contrato = {
        id,
        servico_id: 0,
        profissional_id: proId,
        cliente_id: myUserId,
        valor_acordado: valor,
        data_inicio: contract.hiredAt ?? new Date().toISOString(),
        data_conclusao: contract.phase === 'completed' ? new Date().toISOString() : undefined,
        status: statusToServico(contract.phase),
      }
      return insert(prev, 'contratos', contrato)
    })
  }

  const registerProfessional = async (data: NewProfessional, senha: string): Promise<Professional | null> => {
    // O teste é `shouldUseServerApi`, não `isLive`: um técnico novo chega aqui
    // sem sessão iniciada, e `isLive` é falso nesse momento — o perfil ficava
    // só no localStorage e desaparecia quando fechasse o browser.
    if (shouldUseServerApi) {
      setMutating(true)
      try {
        const res = await api.register({
          nome: data.name,
          email: data.email,
          senha,
          tipo: 'profissional',
          telefone: data.phone,
          titulo: data.profession,
          categoria: data.category,
          bio: data.bio,
          localizacao: data.location,
          provincia: data.province,
          taxa_hora: data.hourlyRate,
          competencias: data.skills,
          telefonePublico: data.publicPhone !== false,
        })
        // Deixa o técnico com sessão iniciada, como o signUp normal faz.
        setToken(res.token)
        setUser(res.user)
        setAuthUser(res.user)
        const pros = await refreshServer()
        const criado = pros?.find(p => p.id === res.user.profissionalId)
        return criado ?? null
      } catch (e) {
        console.error('Registo falhou:', (e as Error)?.message)
        throw e
      } finally {
        setMutating(false)
      }
    }
    const userId = nextId(db, 'users')
    const proId = nextId(db, 'profissionais')
    let current: JDBTables = db

    const user = {
      id: userId,
      nome: data.name,
      email: data.email,
      telefone: data.phone,
      tipo: 'profissional' as const,
      provincia: data.province,
      cidade: data.location,
      bairro: '',
      foto_perfil: '/fotos/graca-mondlane.jpg',
      criado_em: new Date().toISOString(),
    }
    current = insert(current, 'users', user)

    const pro = {
      id: proId,
      user_id: userId,
      profissao_principal: data.profession,
      categoria: data.category,
      anos_experiencia: 0,
      sobre_mim: data.bio,
      disponibilidade: 'disponivel' as const,
      jobtec_score: 60,
      verificado: false,
      avaliacoes_positivas: 0,
      trabalhos_concluidos: 0,
      taxa_hora: data.hourlyRate,
      tempo_resposta: '< 1 dia',
    }
    current = insert(current, 'profissionais', pro)

    // Competências: adiciona à tabela de competencias (dedup por nome) e liga com nível "avancado"
    for (const skill of data.skills) {
      const existingComp = current.competencias.find(c => c.nome.toLowerCase() === skill.toLowerCase())
      let compId: number
      if (existingComp) {
        compId = existingComp.id
      } else {
        compId = nextId(current, 'competencias')
        current = insert(current, 'competencias', { id: compId, nome: skill, categoria: data.category })
      }
      current = insert(current, 'profissional_competencias', {
        profissional_id: proId,
        competencia_id: compId,
        nivel: 'avancado',
      })
    }

    setDb(current)
    const built = buildProfessionals(current)
    return built.find(p => p.id === proId)!
  }

  return (
    <StoreContext.Provider
      value={{
        professionals,
        publishedJobs,
        contracts,
        userReviews,
        setReview,
        addPublishedJob,
        setContract,
        clearReview,
        registerProfessional,
        proposals,
        notifications,
        unreadCount,
        refreshNotifications,
        markNotificationRead,
        markAllNotificationsRead,
        sendProposal,
        setProposalStatus,
        authUser,
        perfil,
        refreshPerfil,
        authLoading,
        mutating,
        signIn,
        signUp,
        signOut,
        updateProfile,
      }}
    >
      {children}
    </StoreContext.Provider>
  )
}

export function useStore(): StoreState {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be used within StoreProvider')
  return ctx
}
