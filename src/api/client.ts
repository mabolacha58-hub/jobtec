const API_BASE = import.meta.env.VITE_API_BASE || '/api'

export interface User {
  id: number
  nome: string
  email: string
  tipo: 'cliente' | 'profissional' | 'admin'
  telefone?: string
  profissionalId?: number | null
}

export interface Profissional {
  id: number
  nome: string
  email?: string
  telefone?: string
  /** Deep link wa.me. Só existe quando o profissional marcou o número como público. */
  whatsapp?: string | null
  telefone_publico?: boolean
  titulo?: string
  categoria?: string
  bio?: string
  localizacao?: string
  provincia?: string
  foto_perfil?: string
  disponivel?: boolean
  avaliacao: number
  avaliacoes: number
  score: number
  taxa_hora?: number
  trabalhos_concluidos?: number
  verificado?: boolean
  tempo_resposta?: string
  anos_experiencia?: number
  portfolio?: unknown[]
  competencias?: unknown[]
}

let authToken: string | null =
  typeof localStorage !== 'undefined' ? localStorage.getItem('jdb.token') : null

export function getToken(): string | null {
  return authToken
}

export function setToken(token: string | null) {
  authToken = token
  if (typeof localStorage !== 'undefined') {
    if (token) localStorage.setItem('jdb.token', token)
    else localStorage.removeItem('jdb.token')
  }
}

const USER_KEY = 'jdb.user'

export function getUser(): User | null {
  if (typeof localStorage === 'undefined') return null
  try {
    const raw = localStorage.getItem(USER_KEY)
    return raw ? (JSON.parse(raw) as User) : null
  } catch {
    return null
  }
}

export function setUser(user: User | null) {
  if (typeof localStorage !== 'undefined') {
    if (user) localStorage.setItem(USER_KEY, JSON.stringify(user))
    else localStorage.removeItem(USER_KEY)
  }
}

export function logout() {
  setToken(null)
  setUser(null)
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  }
  if (authToken) headers.Authorization = `Bearer ${authToken}`

  let res: Response
  try {
    res = await fetch(`${API_BASE}${path}`, { ...options, headers })
  } catch {
    throw new Error('O servidor de autenticação não está disponível. Inicie o backend local ou tente novamente mais tarde.')
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error((data as any)?.error || 'Erro de rede')
  }
  return data as T
}

export type ProposalStatus = 'enviada' | 'aceita' | 'recusada'

export interface ServerProposta {
  id: number
  servico_id: number | null
  cliente_id: number | null
  profissional_id: number
  proName: string
  proProfession: string
  proAvatar: string
  clienteNome: string
  servicoTitulo: string
  valor: number
  prazo: string
  descricao: string
  status: ProposalStatus
  criadaEm: string
  /** 'recebida' quando o utilizador é quem pode decidir; 'enviada' caso contrário. */
  sentido: 'enviada' | 'recebida'
  podeDecidir: boolean
  contratoId?: number | null
}

export type ContractPhase = 'proposed' | 'hired' | 'completed' | 'cancelled'

export interface ServerContrato {
  id: number
  servico_id: number | null
  profissional_id: number
  cliente_id: number | null
  proId: number
  clientId: number | null
  proName: string
  servicoTitulo: string
  budget: string
  prazo: string
  escopo: string
  phase: ContractPhase
  status: string
  hiredAt: string
  concluídoEm: string | null
}

export interface ServerAvaliacao {
  id: number
  contrato_id: number | null
  profissional_id: number
  avaliador_id: number
  avaliado_id: number
  nota: number
  comentario: string
  autorNome: string
  autorFoto: string
  criada_em: string
  date: string
}

export interface ServerNotificacao {
  id: number
  tipo: 'proposta' | 'resposta' | 'contrato' | 'avaliacao'
  titulo: string
  texto: string
  link: string
  lida: boolean
  criadaEm: string
}

export interface ServerServico {
  id: number
  user_id: number
  categoria: string
  titulo: string
  descricao: string | null
  orcamento: string | null
  localizacao: string | null
  cidade: string | null
  orcamento_min: number
  orcamento_max: number
  prazo: string | null
  urgente: boolean
  status: string
  created_at: string
  autor?: string
}

export const api = {
  register: (body: {
    nome: string
    email: string
    senha: string
    tipo?: string
    telefone?: string
    /** Omissão = true. Só o profissional decide se o número fica visível. */
    telefonePublico?: boolean
    titulo?: string
    categoria?: string
    bio?: string
    localizacao?: string
    provincia?: string
    taxa_hora?: number
    competencias?: string[]
    anos_experiencia?: number
  }) =>
    request<{ token: string; user: User }>('/register', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  login: (email: string, senha: string) =>
    request<{ token: string; user: User }>('/login', {
      method: 'POST',
      body: JSON.stringify({ email, senha }),
    }),

  me: () =>
    request<{
      user: (User & {
        titulo?: string
        categoria?: string
        bio?: string
        localizacao?: string
        provincia?: string
        cidade?: string
        foto_perfil?: string
        disponivel?: boolean
        portfolio?: unknown[]
        competencias?: unknown[]
      }) | null
      servicos: ServerServico[]
      propostas: ServerProposta[]
      contratos: ServerContrato[]
      avaliacoes: ServerAvaliacao[]
    }>('/me'),

  /** Auto-serviço: o alvo é sempre o utilizador autenticado, nunca um `id`. */
  atuMe: (body: { nome?: string; telefone?: string; provincia?: string; cidade?: string; foto_perfil?: string | null }) =>
    request<{
      user: User & { provincia?: string; cidade?: string; foto_perfil?: string }
      servicos: ServerServico[]
      propostas: ServerProposta[]
      contratos: ServerContrato[]
      avaliacoes: ServerAvaliacao[]
    }>('/me', { method: 'PATCH', body: JSON.stringify(body) }),

  profissionais: () => request<Profissional[]>('/profissionais'),
  profissional: (id: number) => request<Profissional>(`/profissionais?id=${id}`),

  publicarServico: (body: {
    categoria: string
    titulo: string
    descricao?: string
    orcamento?: string
    disponivelIme?: string
    localizacao?: string
    orcamentoMin?: number
    orcamentoMax?: number
    cidade?: string
    prazo?: string
    urgente?: boolean
  }) => request<ServerServico>('/servicos', { method: 'POST', body: JSON.stringify(body) }),

  servicos: (id?: number) => request<ServerServico[]>(id ? `/servicos?id=${id}` : '/servicos'),

  enviarProposta: (body: {
    servicoId?: number
    profissionalId?: number
    mensagem?: string
    valor?: string | number
    prazo?: string
  }) => request<ServerProposta>('/propostas', { method: 'POST', body: JSON.stringify(body) }),

  propostas: () => request<ServerProposta[]>('/propostas'),

  respostaProposta: (id: number, status: 'aceita' | 'recusada', valorAcordado?: number) =>
    request<ServerProposta & { contratoId: number | null }>(`/propostas?id=${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status, ...(valorAcordado != null ? { valor: valorAcordado } : {}) }),
    }),

  criarContrato: (body: {
    profissionalId: number
    servicoId?: number
    orcamento?: string | number
    prazo?: string
    escopo?: string
  }) => request<ServerContrato>('/contratos', { method: 'POST', body: JSON.stringify(body) }),

  contratos: () => request<ServerContrato[]>('/contratos'),

  contrato: (id: number, body: Record<string, unknown>) =>
    request<ServerContrato>(`/contratos?id=${id}`, { method: 'PATCH', body: JSON.stringify(body) }),

  avaliacoes: (profissionalId?: number) =>
    request<ServerAvaliacao[]>(profissionalId ? `/avaliacoes?profissionalId=${profissionalId}` : '/avaliacoes'),

  avaliar: (body: { profissionalId: number; contratoId?: number; nota: number; comentario?: string }) =>
    request<ServerAvaliacao>('/avaliacoes', { method: 'POST', body: JSON.stringify(body) }),

  removerAvaliacao: (profissionalId: number) =>
    request<{ success: boolean }>(`/avaliacoes?profissionalId=${profissionalId}`, { method: 'DELETE' }),

  notificacoes: () => request<ServerNotificacao[]>('/notificacoes'),

  notificacoesNaoLidas: () => request<{ naoLidas: number }>('/notificacoes?action=count'),

  marcarNotificacaoLida: (id: number) =>
    request<{ success: boolean }>('/notificacoes', { method: 'PATCH', body: JSON.stringify({ id }) }),

  marcarTodasLidas: () =>
    request<{ success: boolean }>('/notificacoes', { method: 'PATCH', body: JSON.stringify({ todas: true }) }),

  // Sem `RESEND_API_KEY` configurado o servidor devolve `debugLink` fora de
  // produção — é o que permite testar o fluxo completo sem provedor de email.
  pedirResetSenha: (email: string) =>
    request<{ enviado: boolean; debugLink?: string }>('/password-reset?action=pedir', {
      method: 'POST', body: JSON.stringify({ email }),
    }),

  confirmarResetSenha: (token: string, senha: string) =>
    request<{ success: boolean }>('/password-reset?action=confirmar', {
      method: 'POST', body: JSON.stringify({ token, senha }),
    }),

  seed: () => {
    const seedToken = (import.meta.env.VITE_SEED_TOKEN as string) || ''
    return request<{ criados: number; total: number }>('/seed', {
      method: 'POST',
      ...(seedToken ? { headers: { 'x-seed-token': seedToken } } : {}),
    })
  },

  admin: {
    metrics: () => request<AdminMetrics>('/admin?action=metrics'),
    profissionais: () => request<AdminProfissional[]>('/admin?action=profissionais'),
    atuProfissional: (id: number, body: Record<string, unknown>) =>
      request<{ success: boolean }>(`/admin?action=profissionais&id=${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    usuarios: () => request<AdminUsuario[]>('/admin?action=usuarios'),
    atuUsuario: (id: number, body: Record<string, unknown>) =>
      request<{ success: boolean }>(`/admin?action=usuarios&id=${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    servicos: () => request<AdminServico[]>('/admin?action=servicos'),
    atuServico: (id: number, status: 'aberto' | 'contratado' | 'removido') =>
      request<{ success: boolean }>(`/admin?action=servicos&id=${id}`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  },
}

export interface AdminUsuario {
  id: number
  nome: string
  email: string
  tipo: string
  telefone: string | null
  ativo: boolean
  created_at: string
}

export interface AdminProfissional {
  id: number
  user_id: number
  nome: string
  email: string
  telefone: string | null
  ativo: boolean
  created_at: string
  titulo: string | null
  categoria: string | null
  bio: string | null
  localizacao: string | null
  provincia: string | null
  foto_perfil: string | null
  disponivel: boolean
  verificado: boolean
  score: number
  taxa_hora: number
  trabalhos_concluidos: number
  avaliacao: number
  avaliacoes: number
}

export interface AdminServico {
  id: number
  user_id: number
  autor: string
  categoria: string
  titulo: string
  descricao: string | null
  status: string
  cidade: string | null
  prazo: string | null
  urgente: boolean
  created_at: string
}

export interface AdminMetrics {
  usuarios: { total: number; porTipo: { tipo: string; n: number }[] }
  profissionais: {
    total: number
    verificado: number
    disponiveis: number
    porCategoria: { categoria: string; n: number }[]
  }
  servicos: { total: number; porStatus: { status: string; n: number }[] }
  contratos: { total: number; porStatus: { status: string; n: number }[] }
  propostas: number
}
