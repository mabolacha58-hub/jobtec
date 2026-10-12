import { loadEnv } from './load-env.mts'
import pg from 'pg'

loadEnv()
const BASE = process.env.BASE_URL || 'http://localhost:8444'
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })

const stamp = Date.now()
const email = `t.cadastro.${stamp}@jobtec.mz`

const req = async (path: string, opts: any = {}) => {
  const r = await fetch(BASE + path, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
  })
  return { status: r.status, body: await r.json().catch(() => null) }
}

// Tudo aquilo que o formulário de registo do técnico pede.
const reg = await req('/api/register', {
  method: 'POST',
  body: JSON.stringify({
    nome: 'Teste Cadastro Completo',
    email,
    senha: 'Jobtec2026',
    tipo: 'profissional',
    telefone: '+258 84 555 0000',
    titulo: 'Electricista Predial',
    categoria: 'electricidade',
    bio: 'Faço instalações electricas residenciais e comerciais.',
    localizacao: 'Nampula Cidade',
    provincia: 'Nampula',
    taxa_hora: 1200,
    competencias: ['Quadros electricos', 'Cabling', 'Rasik'],
    anos_experiencia: 12,
  }),
})
console.log('registo:', reg.status)

const prof = await pool.query(
  `SELECT pr.id, pr.titulo, pr.categoria, pr.localizacao, pr.provincia,
          pr.taxa_hora, pr.competencias, pr.anos_experiencia, pr.bio, pr.score,
          u.telefone, u.provincia AS provincia_user
     FROM profissionais pr JOIN users u ON u.id = pr.user_id
    WHERE u.email = $1`, [email])
const p = prof.rows[0]
console.log('\nO que ficou gravado:')
console.log('  titulo            ', JSON.stringify(p?.titulo))
console.log('  categoria         ', JSON.stringify(p?.categoria))
console.log('  localizacao       ', JSON.stringify(p?.localizacao))
console.log('  provincia (perfil)', JSON.stringify(p?.provincia), '  <-- pedido pelo formulário')
console.log('  provincia (user)  ', JSON.stringify(p?.provincia_user), '  <-- pedido pelo formulário')
console.log('  taxa_hora         ', JSON.stringify(p?.taxa_hora), '  <-- pedido pelo formulário')
console.log('  competencias      ', JSON.stringify(p?.competencias), '  <-- pedido pelo formulário')
console.log('  anos_experiencia  ', JSON.stringify(p?.anos_experiencia), '  <-- pedido pelo formulário')
console.log('  score             ', JSON.stringify(p?.score))

const perdidos = [
  ['provincia', p?.provincia],
  ['taxa_hora', p?.taxa_hora],
  ['competencias', p?.competencias],
  ['anos_experiencia', p?.anos_experiencia],
].filter(([, v]) => v === null || v === 0 || v === undefined)

console.log('\nPERDIDOS:', perdidos.length ? perdidos.map(([k]) => k).join(', ') : 'nada')

await pool.query('DELETE FROM users WHERE email=$1', [email])
await pool.end()
