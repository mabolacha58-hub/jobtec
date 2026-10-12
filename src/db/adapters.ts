import type { JDBTables } from './db'
import type { Professional, Portfolio, Testimonial } from '../types'
import type { User, Profissional, PortfolioItem, Avaliacao } from './schema'
import type { Profissional as APIProfissional } from '../api/client'

// Converte as tabelas normalizadas de volta para o shape "Professional"
// usado pelos componentes de UI, de modo a não os quebrar durante a migração.
// Fonte de verdade continua a ser a base de dados normalizada (JDBTables).

const NOME_AUTORES = ['Carlos Nhampule', 'Ana Mussá', 'João Machel', 'Fatima Sithole', 'Pedro Cossa', 'Maria Vilanculos', 'Luís Tembe']

const AVATARES: string[] = [
  '/fotos/amade-assane.jpg',
  '/fotos/luisa-cumbana.jpg',
  '/fotos/graca-mondlane.jpg',
]

export function buildProfessionals(tables: JDBTables): Professional[] {
  const usersById = new Map<number, User>()
  for (const u of tables.users) usersById.set(u.id, u)

  const competenciasById = new Map<number, { nome: string; categoria: string }>()
  for (const c of tables.competencias) competenciasById.set(c.id, c)

  const skillsByPro = new Map<number, string[]>()
  for (const pc of tables.profissional_competencias) {
    const comp = competenciasById.get(pc.competencia_id)
    if (!comp) continue
    const list = skillsByPro.get(pc.profissional_id) ?? []
    list.push(comp.nome)
    skillsByPro.set(pc.profissional_id, list)
  }

  const portfolioByPro = new Map<number, PortfolioItem[]>()
  for (const p of tables.portfolio) {
    const list = portfolioByPro.get(p.profissional_id) ?? []
    list.push(p)
    portfolioByPro.set(p.profissional_id, list)
  }

  const avaliacoesByPro = new Map<number, Avaliacao[]>()
  for (const a of tables.avaliacoes) {
    const pro = tables.profissionais.find(p => p.user_id === a.avaliado_id)
    if (!pro) continue
    const list = avaliacoesByPro.get(pro.id) ?? []
    list.push(a)
    avaliacoesByPro.set(pro.id, list)
  }

  return tables.profissionais.map(pro => {
    const user = usersById.get(pro.user_id)
    const skills = skillsByPro.get(pro.id) ?? []
    const portItems = (portfolioByPro.get(pro.id) ?? []).map<Portfolio>(item => ({
      id: item.id,
      title: item.titulo,
      image: item.imagens[0] ?? '',
      description: item.descricao,
    }))
    const avals = avaliacoesByPro.get(pro.id) ?? []
    const testimonials: Testimonial[] = avals.map(a => {
      const autorId = a.avaliador_id
      const autor = NOME_AUTORES[autorId % NOME_AUTORES.length] ?? `Cliente ${autorId}`
      return {
        id: a.id,
        author: autor,
        avatar: AVATARES[a.avaliador_id % AVATARES.length],
        text: a.comentario,
        rating: a.nota,
        date: new Date(a.criada_em).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' }),
      }
    })
    const rating = avals.length
      ? Number((avals.reduce((s, a) => s + a.nota, 0) / avals.length).toFixed(1))
      : pro.jobtec_score >= 90 ? 4.9 : pro.jobtec_score >= 75 ? 4.5 : 4.0
    const reviews = avals.length

    return {
      id: pro.id,
      name: user?.nome ?? 'Profissional',
      profession: pro.profissao_principal,
      category: pro.categoria,
      location: user?.cidade ?? '',
      province: user?.provincia ?? '',
      rating,
      reviews,
      score: pro.jobtec_score,
      skills,
      hourlyRate: pro.taxa_hora,
      avatar: user?.foto_perfil ?? '',
      available: pro.disponibilidade === 'disponivel',
      jobsCompleted: pro.trabalhos_concluidos,
      bio: pro.sobre_mim,
      verified: pro.verificado,
      portfolio: portItems,
      testimonials,
      responseTime: pro.tempo_resposta,
    }
  })
}

// Converte um profissional vindo da API (Postgres) para o shape rico do UI.
export function serverProfToProfessional(p: APIProfissional): Professional {
  return {
    id: p.id,
    name: p.nome,
    profession: p.titulo ?? '',
    category: p.categoria ?? '',
    location: p.localizacao ?? '',
    province: p.provincia ?? '',
    rating: Number(p.avaliacao) || 0,
    reviews: Number(p.avaliacoes) || 0,
    score: Number(p.score) || 60,
    skills: Array.isArray(p.competencias) ? (p.competencias as string[]) : [],
    hourlyRate: Number(p.taxa_hora) || 0,
    avatar: p.foto_perfil || '',
    available: p.disponivel ?? true,
    jobsCompleted: p.trabalhos_concluidos || 0,
    bio: p.bio ?? '',
    verified: Boolean(p.verificado),
    phone: p.telefone || undefined,
    whatsapp: p.whatsapp || undefined,
    portfolio: Array.isArray(p.portfolio) ? (p.portfolio as unknown as Portfolio[]) : [],
    testimonials: [],
    responseTime: p.tempo_resposta || '< 1 dia',
  }
}
