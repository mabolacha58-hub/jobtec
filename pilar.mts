// Prepara a base de dados para um piloto com utilizadores reais.
// Remove TODOS os dados de demonstração (perfis, clientes sintéticos,
// avaliações geradas) e deixa a base vazia.
//
// AVISO: destrutivo. Correr apenas quando a JOBTEC for aberta a pessoas reais.
// A senha demo só é criada de novo se voltares a correr o seed.
//
//   node --env-file=".env.local" .\node_modules\tsx\dist\cli.mjs .\pilar.mts --simular
//   node --env-file=".env.local" .\node_modules\tsx\dist\cli.mjs .\pilar.mts --executar

import pg from 'pg'

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })

const contar = async () => {
  const q = async (sql: string) => (await pool.query(sql)).rows[0].n
  return {
    utilizadores: await q('SELECT COUNT(*) n FROM users'),
    profissionais: await q('SELECT COUNT(*) n FROM profissionais'),
    avaliacoes: await q('SELECT COUNT(*) n FROM avaliacoes'),
    contratos: await q('SELECT COUNT(*) n FROM contratos'),
    servicos: await q('SELECT COUNT(*) n FROM servicos'),
  }
}

const executar = process.argv.includes('--executar')

console.log('Estado actual:')
console.table(await contar())

if (!executar) {
  console.log('\nIsto foi uma simulacao. Nada foi apagado.')
  console.log('Para apagar mesmo: --executar')
} else {
  const c = await pool.connect()
  try {
    await c.query('BEGIN')
    // Ordem inversa das dependencias. As avaliacoes sinteticas referenciam
    // clientes demo criados apenas para o seed; vao primeiro.
    await c.query("DELETE FROM avaliacoes WHERE avaliador_id IN (SELECT id FROM users WHERE email LIKE 'cliente.demo.%')")
    await c.query("DELETE FROM users WHERE email LIKE 'cliente.demo.%'")
    await c.query('DELETE FROM avaliacoes')
    await c.query('DELETE FROM contratos')
    await c.query('DELETE FROM propostas')
    await c.query('DELETE FROM servicos')
    await c.query('DELETE FROM profissionais')
    await c.query('DELETE FROM users')
    await c.query('COMMIT')
    console.log('\nBase de dados limpa.')
  } catch (e) {
    await c.query('ROLLBACK')
    throw e
  } finally {
    c.release()
  }
  console.log('\nEstado final:')
  console.table(await contar())
}

await pool.end()
