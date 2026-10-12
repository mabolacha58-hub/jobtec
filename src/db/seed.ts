import type { JDBTables } from './db'
import { professionals as prosData, categories } from '../data'
import type { Competencia, PortfolioItem, User, Profissional, ProfissionalCompetencia, Avaliacao, Proposta } from './schema'

// Constrói as tabelas normalizadas a partir dos dados de exemplo existentes.
// É aplicado apenas quando a base de dados está vazia.

export function buildSeed(): Partial<JDBTables> {
  const users: User[] = []
  const profissionais: Profissional[] = []
  const competencias: Competencia[] = []
  const profissional_competencias: ProfissionalCompetencia[] = []
  const portfolio: PortfolioItem[] = []
  const avaliacoes: Avaliacao[] = []
  const propostas: Proposta[] = []

  // Seed de competências por categoria
  const catNames: Record<string, string> = {}
  for (const c of categories) {
    catNames[c.id] = c.name
  }

  const competenciaByName = new Map<string, number>()
  let competenciaId = 1
  function ensureCompetencia(nome: string, categoria: string): number {
    const key = nome.toLowerCase()
    if (competenciaByName.has(key)) return competenciaByName.get(key)!
    const c: Competencia = { id: competenciaId, nome, categoria }
    competencias.push(c)
    competenciaByName.set(key, competenciaId)
    competenciaId++
    return c.id
  }

  prosData.forEach((pro, idx) => {
    const userId = idx + 1
    users.push({
      id: userId,
      nome: pro.name,
      email: `${pro.name.toLowerCase().replace(/\s+/g, '.')}@jobtec.co.mz`,
      telefone: `+258 84 ${String(1000000 + idx * 137).slice(0, 7)}`,
      tipo: 'profissional',
      provincia: pro.province,
      cidade: pro.location,
      bairro: '',
      foto_perfil: pro.avatar,
      criado_em: new Date(Date.now() - (idx + 1) * 90 * 86400000).toISOString(),
    })

    profissionais.push({
      id: pro.id,
      user_id: userId,
      profissao_principal: pro.profession,
      categoria: pro.category,
      anos_experiencia: Math.max(1, Math.round(pro.jobsCompleted / 8)),
      sobre_mim: pro.bio,
      disponibilidade: pro.available ? 'disponivel' : 'ocupado',
      jobtec_score: pro.score,
      verificado: pro.verified,
      avaliacoes_positivas: Math.round(pro.reviews * 0.95),
      trabalhos_concluidos: pro.jobsCompleted,
      taxa_hora: pro.hourlyRate,
      tempo_resposta: pro.responseTime,
    })

    pro.skills.forEach((skill, si) => {
      const cid = ensureCompetencia(skill, pro.category)
      const niveis: ProfissionalCompetencia['nivel'][] = ['basico', 'intermediario', 'avancado']
      const nivel = niveis[Math.min(si, 2)] ?? 'intermediario'
      profissional_competencias.push({ profissional_id: pro.id, competencia_id: cid, nivel })
    })

    pro.portfolio.forEach(pItem => {
      portfolio.push({
        id: pItem.id,
        profissional_id: pro.id,
        titulo: pItem.title,
        descricao: pItem.description,
        imagens: [pItem.image],
        data: new Date(Date.now() - 200 * 86400000).toISOString(),
      })
    })

    // Avaliações existentes como entrada da tabela "avaliacoes"
    pro.testimonials.forEach((t, ti) => {
      avaliacoes.push({
        id: pro.id * 100 + ti + 1,
        contrato_id: 0,
        avaliador_id: 100000 + ti,
        avaliado_id: userId,
        nota: t.rating,
        comentario: t.text,
        criada_em: new Date(Date.now() - (ti + 1) * 30 * 86400000).toISOString(),
      })
    })
  })

  return {
    users,
    profissionais,
    competencias,
    profissional_competencias,
    portfolio,
    avaliacoes,
    propostas,
  }
}
