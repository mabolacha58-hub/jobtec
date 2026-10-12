import { loadEnv } from './load-env.mts'
import pg from 'pg'

loadEnv()
const p = new pg.Pool({ connectionString: process.env.DATABASE_URL })
const r = await p.query(`
  SELECT
    (SELECT COUNT(*) FROM users)::int                                   AS users,
    (SELECT COUNT(*) FROM profissionais)::int                           AS profissionais,
    (SELECT COUNT(*) FROM avaliacoes)::int                              AS avaliacoes,
    (SELECT COUNT(DISTINCT avaliador_id) FROM avaliacoes)::int         AS avaliadores,
    (SELECT COUNT(*) FROM avaliacoes WHERE contrato_id IS NULL)::int   AS avaliacoes_servico,
    (SELECT COUNT(*) FROM servicos)::int                               AS servicos,
    (SELECT COUNT(*) FROM contratos)::int                              AS contratos,
    (SELECT COUNT(*) FROM notificacoes)::int                           AS notificacoes,
    (SELECT COUNT(*) FROM users WHERE email LIKE 't.%@jobtec.mz')::int AS lixo_teste,
    (SELECT COUNT(*) FROM avaliacoes a JOIN users u ON u.id = a.avaliado_id
      WHERE u.id = a.avaliador_id)::int                                AS auto_avaliacoes
`)
console.log(JSON.stringify(r.rows[0], null, 2))
await p.end()
