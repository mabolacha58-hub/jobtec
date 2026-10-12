import { loadEnv } from './load-env.mts'
import pg from 'pg'

loadEnv()
const p = new pg.Pool({ connectionString: process.env.DATABASE_URL })

const novos = await p.query(`
  SELECT u.id, u.nome, u.email, u.tipo, u.telefone, u.created_at,
         (SELECT COUNT(*) FROM profissionais pr WHERE pr.user_id = u.id)::int AS perfil
    FROM users u
   WHERE u.email NOT LIKE 'cliente.demo.%'
   ORDER BY u.created_at DESC
   LIMIT 15
`)
console.log('Utilizadores registados (não-seed), mais recentes primeiro:')
for (const r of novos.rows) {
  console.log(`  ${String(r.id).padStart(4)}  ${String(r.created_at).slice(0, 16)}  ${r.tipo.padEnd(12)} perfil=${r.perfil}  ${r.email}`)
}

const contagens = await p.query(`
  SELECT
    (SELECT COUNT(*) FROM users)::int                                        AS users,
    (SELECT COUNT(*) FROM users WHERE tipo='profissional')::int               AS profis,
    (SELECT COUNT(*) FROM users WHERE tipo='cliente')::int                   AS clientes,
    (SELECT COUNT(*) FROM users WHERE tipo='admin')::int                     AS admins,
    (SELECT COUNT(*) FROM users WHERE created_at > now() - interval '3 days')::int AS ultimos_3_dias,
    (SELECT MAX(created_at) FROM users)                                       AS mais_recente
`)
console.log('\nContagens:', JSON.stringify(contagens.rows[0], null, 2))

// A tabela de tentativas de login conta com que IPs/endereços entraram
// recentemente — dá para ver se alguém chegou a tentar autenticar-se.
const rl = await p.query(
  `SELECT key, count, window_start FROM rate_limits WHERE window_start > now() - interval '1 day' ORDER BY count DESC LIMIT 10`)
console.log('\nRate limits últimas 24h:', rl.rows.length ? JSON.stringify(rl.rows, null, 2) : 'nenhum')

await p.end()
