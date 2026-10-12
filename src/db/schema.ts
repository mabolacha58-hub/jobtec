// Modelo de dados normalizado do JOBTEC (schema do briefing)
// Segue a arquitetura definida: tabelas separadas com chaves primárias e estrangeiras.

export type UserTipo = 'profissional' | 'cliente' | 'empresa'
export type Disponibilidade = 'disponivel' | 'ocupado' | 'sob_pedido'
export type NivelCompetencia = 'basico' | 'intermediario' | 'avancado'
export type StatusServico = 'aberto' | 'em_analise' | 'contratado' | 'concluido'
export type StatusProposta = 'enviada' | 'aceita' | 'recusada'
export type StatusContrato = 'em_andamento' | 'concluido' | 'cancelado'

// -- users
export interface User {
  id: number
  nome: string
  email: string
  telefone: string
  tipo: UserTipo
  provincia: string
  cidade: string
  bairro: string
  foto_perfil: string
  criado_em: string // ISO
}

// -- profissionais
export interface Profissional {
  id: number
  user_id: number
  profissao_principal: string
  categoria: string
  anos_experiencia: number
  sobre_mim: string
  disponibilidade: Disponibilidade
  jobtec_score: number // 0-100
  verificado: boolean
  avaliacoes_positivas: number
  trabalhos_concluidos: number
  taxa_hora: number
  tempo_resposta: string
}

// -- competencias
export interface Competencia {
  id: number
  nome: string
  categoria: string
}

// -- profissional_competencias
export interface ProfissionalCompetencia {
  profissional_id: number
  competencia_id: number
  nivel: NivelCompetencia
}

// -- portfolio
export interface PortfolioItem {
  id: number
  profissional_id: number
  titulo: string
  descricao: string
  imagens: string[]
  data: string // ISO
}

// -- servicos
export interface Servico {
  id: number
  cliente_id: number // User.id
  titulo: string
  descricao: string
  categoria: string
  provincia: string
  cidade: string
  orcamento_min: number
  orcamento_max: number
  prazo: string
  urgente: boolean
  status: StatusServico
  criado_em: string
}

// -- propostas
export interface Proposta {
  id: number
  servico_id: number
  cliente_id?: number
  profissional_id: number // Profissional.id
  valor: number
  prazo_entrega: string
  descricao: string
  status: StatusProposta
  criada_em: string
}

// -- contratos
export interface Contrato {
  id: number
  servico_id: number
  proposta_id?: number
  profissional_id: number // Profissional.id
  cliente_id: number // User.id
  valor_acordado: number
  data_inicio: string
  data_conclusao?: string
  status: StatusContrato
}

// -- avaliacoes
export interface Avaliacao {
  id: number
  contrato_id: number
  avaliador_id: number // User.id
  avaliado_id: number // User.id (dono do perfil avaliado)
  nota: number // 1-5
  comentario: string
  criada_em: string
}

// Vista derivada (não persistida) — mantém compatibilidade com o UI.
// Máscara que reconstitui o antigo shape "Professional" a partir das tabelas.
export interface ProfessionalView {
  id: number
  userId: number
  name: string
  profession: string
  category: string
  location: string
  province: string
  rating: number
  reviews: number
  score: number
  skills: Array<{ nome: string; nivel: NivelCompetencia }>
  hourlyRate: number
  avatar: string
  available: boolean
  jobsCompleted: number
  bio: string
  verified: boolean
  portfolio: PortfolioItem[]
  testimonials: Array<{ id: number; author: string; avatar: string; text: string; rating: number; date: string }>
  responseTime: string
  anosExperiencia: number
  bairro: string
}
