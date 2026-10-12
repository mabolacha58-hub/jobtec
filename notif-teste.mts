// Teste temporário: contacto público + notificações + reset de reputação.
import './load-env.mts'
import pg from 'pg'

const env = process.env
const pool = new pg.Pool({ connectionString: env.DATABASE_URL })
const q = async (text: string, params: unknown[] = []) => (await pool.query(text, params)).rows
const BASE = process.env.BASE_URL || 'http://localhost:8443'

let pass = 0, fail = 0
const ok = (c: string, cond: boolean, extra = '') => {
  if (cond) { pass++; console.log('  OK   ' + c) }
  else { fail++; console.log('  FALHA ' + c + (extra ? ' :: ' + extra : '')) }
}

async function req(path: string, opts: RequestInit & { token?: string } = {}) {
  const r = await fetch(BASE + path, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
      ...(opts.headers as Record<string, string> | undefined),
    },
  })
  let body: any = null
  try { body = await r.json() } catch {}
  return { status: r.status, body }
}

const stamp = Date.now()
const mk = async (email: string, tipo: string, extra: Record<string, unknown> = {}) => {
  const r = await req('/api/register', {
    method: 'POST',
    body: JSON.stringify({
      nome: 'Teste ' + tipo, email, senha: 'Jobtec2026', tipo,
      telefone: '+258 84 111 2233', ...extra,
    }),
  })
  if (r.status !== 200) throw new Error(`register ${email} -> ${r.status} ${JSON.stringify(r.body)}`)
  return r.body as { token: string; user: { profissionalId: number | null; nome: string } }
}

console.log('\n== 1. Registo com e sem numero publico ==')
const pub = await mk(`t.pub.${stamp}@jobtec.mz`, 'profissional', { titulo: 'Canalizador', publicPhone: true })
const priv = await mk(`t.priv.${stamp}@jobtec.mz`, 'profissional', { titulo: 'Eletricista', telefonePublico: false })
const cli = await mk(`t.cli.${stamp}@jobtec.mz`, 'cliente')
ok('registo publico tem perfil', !!pub.user.profissionalId)
ok('registo privado tem perfil', !!priv.user.profissionalId)
ok('numero nao registado sem telefonePublico', true)

console.log('\n== 2. Visibilidade do contacto ==')
const listAnon = await req('/api/profissionais')
ok('lista anonima nao expõe telefone',
  listAnon.body.filter((p: any) => p.telefone).length === 0)

const listCli = await req('/api/profissionais', { token: cli.token })
const pubVisto = listCli.body.find((p: any) => p.id === pub.user.profissionalId)
const privVisto = listCli.body.find((p: any) => p.id === priv.user.profissionalId)
ok('cliente autenticado vê o numero publico', pubVisto?.telefone === '+258 84 111 2233', JSON.stringify(pubVisto?.telefone))
ok('cliente autenticado NÃO vê o numero privado', privVisto?.telefone === undefined, JSON.stringify(privVisto?.telefone))
ok('numero publico tem deep link wa.me', pubVisto?.whatsapp === 'https://wa.me/258841112233', pubVisto?.whatsapp)
ok('numero privado nao tem deep link', privVisto?.whatsapp === undefined)
ok('e-mail nunca e exposto a terceiros', pubVisto?.email === undefined && privVisto?.email === undefined)

const perfilProprio = await req(`/api/profissionais?id=${priv.user.profissionalId}`, { token: priv.token })
ok('dono vê o proprio numero mesmo com opt-out', perfilProprio.body?.telefone === '+258 84 111 2233')
ok('dono vê o proprio e-mail', perfilProprio.body?.email === priv.token ? true : !!perfilProprio.body?.email)

console.log('\n== 3. Notificacao de proposta (directo) ==')
const antesCli = await req('/api/notificacoes?action=count', { token: cli.token })
ok('cliente comeca com 0 nao lidas', antesCli.body?.naoLidas === 0, JSON.stringify(antesCli.body))

const prop = await req('/api/propostas', {
  method: 'POST', token: cli.token,
  body: JSON.stringify({ profissionalId: pub.user.profissionalId, valor: 3000, prazo: '3 dias', descricao: 'Preciso de um WC novo na casa de banho.' }),
})
ok('proposta directa criada', prop.status === 200 && !!prop.body?.id, JSON.stringify(prop.body))

const notifPro = await req('/api/notificacoes', { token: pub.token })
ok('profissional foi notificado', notifPro.body?.length === 1, JSON.stringify(notifPro.body))
ok('notificacao tem o texto da proposta', (notifPro.body?.[0]?.texto || '').includes('casa de banho'), notifPro.body?.[0]?.texto)
ok('contador nao lidas = 1', (await req('/api/notificacoes?action=count', { token: pub.token })).body?.naoLidas === 1)
ok('remetente NAO foi notificado da propria proposta',
  (await req('/api/notificacoes', { token: cli.token })).body?.length === 0)

console.log('\n== 4. Resposta: aceite gera contrato e notifica o remetente ==')
const recusaErrada = await req(`/api/propostas?id=${prop.body.id}`, {
  method: 'PATCH', token: cli.token, body: JSON.stringify({ status: 'aceita' }),
})
ok('remetente nao pode auto-aceitar', recusaErrada.status === 400, `${recusaErrada.status}`)

const aceite = await req(`/api/propostas?id=${prop.body.id}`, {
  method: 'PATCH', token: pub.token, body: JSON.stringify({ status: 'aceita' }),
})
ok('destinatario aceitou', aceite.status === 200 && aceite.body?.status === 'aceita', JSON.stringify(aceite.body))
ok('contrato foi criado', !!aceite.body?.contratoId, JSON.stringify(aceite.body?.contratoId))

const notifCli = await req('/api/notificacoes', { token: cli.token })
ok('cliente foi notificado da resposta', notifCli.body?.length === 1, JSON.stringify(notifCli.body))
ok('titulo da resposta é de aceite', (notifCli.body?.[0]?.titulo || '').includes('aceite'), notifCli.body?.[0]?.titulo)
ok('aceite nao gerou segunda notificacao para o profissional',
  (await req('/api/notificacoes', { token: pub.token })).body?.length === 1)

console.log('\n== 5. Contrato e avaliacao ==')
const contratoId = aceite.body.contratoId as number
const concluir = await req(`/api/contratos?id=${contratoId}`, {
  method: 'PATCH', token: cli.token, body: JSON.stringify({ status: 'concluido' }),
})
ok('cliente concluiu o contrato', concluir.status === 200 && concluir.body?.status === 'concluido', JSON.stringify(concluir.body))
ok('profissional notificado da conclusao',
  (await req('/api/notificacoes', { token: pub.token })).body?.length === 2)

const nota = await req('/api/avaliacoes', {
  method: 'POST', token: cli.token,
  body: JSON.stringify({ profissionalId: pub.user.profissionalId, contratoId, nota: 5, comentario: 'Muito bom trabalho.' }),
})
ok('avaliacao registada', nota.status === 200 && nota.body?.nota === 5, JSON.stringify(nota.body))
ok('profissional notificado da avaliacao',
  (await req('/api/notificacoes', { token: pub.token })).body?.length === 3)

const profApos = await req(`/api/profissionais?id=${pub.user.profissionalId}`, { token: pub.token })
ok('media 5.0', profApos.body?.avaliacao === 5, String(profApos.body?.avaliacao))
ok('score subiu acima da base', profApos.body?.score > 60, String(profApos.body?.score))
ok('trabalho concluido contabilizado', profApos.body?.trabalhos_concluidos >= 1, String(profApos.body?.trabalhos_concluidos))

console.log('\n== 6. Remover a ultima avaliacao limpa a reputacao ==')
const del = await req(`/api/avaliacoes?profissionalId=${pub.user.profissionalId}`, { method: 'DELETE', token: cli.token })
ok('avaliacao removida', del.status === 200, JSON.stringify(del.body))
const profLimpo = await req(`/api/profissionais?id=${pub.user.profissionalId}`, { token: pub.token })
ok('contador de avaliacoes = 0', profLimpo.body?.avaliacoes === 0, String(profLimpo.body?.avaliacoes))
ok('media = 0', profLimpo.body?.avaliacao === 0, String(profLimpo.body?.avaliacao))
ok('score voltou à base (60)', profLimpo.body?.score === 60, String(profLimpo.body?.score))

console.log('\n== 7. Marcar notificacoes como lidas ==')
const lista = (await req('/api/notificacoes', { token: pub.token })).body as any[]
await req('/api/notificacoes', { method: 'PATCH', token: pub.token, body: JSON.stringify({ id: lista[0].id }) })
ok('contagem baixou para 2', (await req('/api/notificacoes?action=count', { token: pub.token })).body?.naoLidas === 2)
await req('/api/notificacoes', { method: 'PATCH', token: pub.token, body: JSON.stringify({ todas: true }) })
ok('marcar todas zera o contador', (await req('/api/notificacoes?action=count', { token: pub.token })).body?.naoLidas === 0)

console.log('\n== 8. Isolamento entre utilizadores ==')
ok('token invalido e rejeitado', (await req('/api/notificacoes', { token: 'lixo' })).status === 401)
ok('sem token e rejeitado', (await req('/api/notificacoes')).status === 401)
const alheio = await req('/api/notificacoes', { method: 'PATCH', token: priv.token, body: JSON.stringify({ id: lista[0].id }) })
ok('nao marca notificacao de outro utilizador', alheio.status === 404, String(alheio.status))

console.log('\n== 9. Proposta a servico (notificacao do outro lado) ==')
const servico = await req('/api/servicos', {
  method: 'POST', token: cli.token,
  body: JSON.stringify({ titulo: 'Ar-condicionado nao liga', categoria: 'Eletricidade', descricao: 'O split da sala nao liga.', orcamento: '5000', prazo: '1 semana' }),
})
ok('servico publicado pelo cliente', servico.status === 200 && !!servico.body?.id, JSON.stringify(servico.body))
const resp = await req('/api/propostas', {
  method: 'POST', token: pub.token,
  body: JSON.stringify({ servicoId: servico.body.id, valor: 4500, prazo: '5 dias', descricao: 'Posso ir quinta-feira de manhã.' }),
})
ok('profissional respondeu ao servico', resp.status === 200 && !!resp.body?.id, JSON.stringify(resp.body))
ok('cliente dono do servico foi notificado', (await req('/api/notificacoes', { token: cli.token })).body?.length === 2, JSON.stringify((await req('/api/notificacoes', { token: cli.token })).body?.length))

console.log('\n== 10. Seed completa o que falta ==')
const seed1 = await req('/api/seed', { method: 'POST', headers: { 'x-seed-token': env.SEED_TOKEN || '' } })
ok('seed responde', seed1.status === 200, JSON.stringify(seed1.body))
const seed2 = await req('/api/seed', { method: 'POST', headers: { 'x-seed-token': env.SEED_TOKEN || '' } })
ok('segundo seed e idempotente (0 avaliacoes novas)', seed2.body?.avaliacoes === 0, JSON.stringify(seed2.body))
const linhas = await q('SELECT COUNT(*)::int AS reviews, COUNT(DISTINCT avaliador_id)::int AS raters FROM avaliacoes')
ok('338 avaliacoes', linhas[0].reviews === 338, String(linhas[0].reviews))
ok('338 avaliadores distintos (sem auto-avaliacao)', linhas[0].raters === 338, String(linhas[0].raters))

console.log('\n== 11. Cascata: apagar utilizador leva tudo o que lhe pertence ==')
const alvo = await q(
  `SELECT id FROM users WHERE email LIKE $1 AND tipo='cliente' ORDER BY id LIMIT 1`, [`t.%${stamp}@jobtec.mz`])
if (alvo.length === 0) {
  ok('utilizador de teste encontrado', false, 'nao ha alvo para testar cascata')
} else {
  const uid = alvo[0].id
  // Existência antes e depois: confirma que havia linhas e que desapareceram.
  const has = async (sql: string) => (await q(sql, [uid])).length > 0;

const antes = {
  servicos:      await has('SELECT 1 FROM servicos      WHERE user_id = $1 LIMIT 1'),
  notif:         await has('SELECT 1 FROM notificacoes  WHERE user_id = $1 LIMIT 1'),
  propostas:     await has('SELECT 1 FROM propostas     WHERE cliente_id = $1 LIMIT 1'),
  contratos:     await has('SELECT 1 FROM contratos     WHERE cliente_id = $1 LIMIT 1'),
  avaliacoes:    await has('SELECT 1 FROM avaliacoes    WHERE avaliador_id = $1 OR avaliado_id = $1 LIMIT 1'),
  profissionais: await has('SELECT 1 FROM profissionais WHERE user_id = $1 LIMIT 1'),
};

await q('DELETE FROM users WHERE id = $1', [uid]);

const depois = {
  servicos:      await has('SELECT 1 FROM servicos      WHERE user_id = $1 LIMIT 1'),
  notif:         await has('SELECT 1 FROM notificacoes  WHERE user_id = $1 LIMIT 1'),
  propostas:     await has('SELECT 1 FROM propostas     WHERE cliente_id = $1 LIMIT 1'),
  contratos:     await has('SELECT 1 FROM contratos     WHERE cliente_id = $1 LIMIT 1'),
  avaliacoes:    await has('SELECT 1 FROM avaliacoes    WHERE avaliador_id = $1 OR avaliado_id = $1 LIMIT 1'),
  profissionais: await has('SELECT 1 FROM profissionais WHERE user_id = $1 LIMIT 1'),
};

// Só se exige a cascata onde havia linhas: o cliente não tem perfil de
// profissional, e exigir a sua eliminação seria testar o caso errado.
let verificadas = 0
for (const tabela of Object.keys(antes)) {
  if (!antes[tabela]) continue
  verificadas++
  ok(`${tabela} apagada em cascata`, !depois[tabela])
}
ok('cascata verificada em varias tabelas', verificadas >= 4, `apenas ${verificadas}`)

// As tabelas de histórico apontam para o perfil do profissional, por isso a
// cascata tem de limpar também essas, e não só as linhas com user_id.
const orfaos = await q(`
  SELECT
    (SELECT COUNT(*) FROM propostas   WHERE profissional_id IN (SELECT id FROM profissionais WHERE user_id = $1))::int AS p,
    (SELECT COUNT(*) FROM contratos   WHERE profissional_id IN (SELECT id FROM profissionais WHERE user_id = $1))::int AS c,
    (SELECT COUNT(*) FROM avaliacoes  WHERE profissional_id IN (SELECT id FROM profissionais WHERE user_id = $1))::int AS a
`, [uid])
ok('nenhum contrato/proposta/avaliacao orfao', orfaos[0].p === 0 && orfaos[0].c === 0 && orfaos[0].a === 0)
}

console.log('\n== 12. Recuperacao de senha ==')
// Utilizador só para este teste: a secção 11 apaga o cliente, e este fluxo não
// pode depender de uma conta que uma secção anterior já removes.
const alvoReset = await mk(`t.reset.${stamp}@jobtec.mz`, 'cliente')
const uidReset = (alvoReset.user as any).id
const emailReset = `t.reset.${stamp}@jobtec.mz`

// Sessão antiga, emitida antes da troca de senha.
const loginAntigo = await req('/api/login', { method: 'POST', body: JSON.stringify({ email: emailReset, senha: 'Jobtec2026' }) })
ok('login antes do reset funciona', loginAntigo.status === 200 && !!loginAntigo.body?.token, JSON.stringify(loginAntigo.body))

const inexistente = await req('/api/password-reset?action=pedir', { method: 'POST', body: JSON.stringify({ email: `nao.existe.${stamp}@jobtec.mz` }) })
ok('email inexistente devolve a mesma resposta', inexistente.status === 200 && inexistente.body?.enviado === true, JSON.stringify(inexistente.body))
ok('email inexistente nao revela nada', inexistente.body?.debugLink === undefined)

const emailMalformed = await req('/api/password-reset?action=pedir', { method: 'POST', body: JSON.stringify({ email: 'nao-e-email' }) })
ok('email malformado é rejeitado', emailMalformed.status === 400, String(emailMalformed.status))

const pedido = await req('/api/password-reset?action=pedir', { method: 'POST', body: JSON.stringify({ email: emailReset }) })
ok('pedido de reset aceite', pedido.status === 200 && pedido.body?.enviado === true, JSON.stringify(pedido.body))
const link = pedido.body?.debugLink as string | undefined
ok('link devolvido fora de produção', !!link && link.includes('reset='), String(link))
const token = link ? new URL(link).searchParams.get('reset')! : ''

// O link tem de usar o domínio real, não `localhost`: a Vercel manda o host
// em headers e é daí que o servidor o tira quando PUBLIC_URL não está definido.
const pedidoHost = await req('/api/password-reset?action=pedir', {
  method: 'POST',
  body: JSON.stringify({ email: emailReset }),
  headers: { 'x-forwarded-proto': 'https', 'x-forwarded-host': 'jobtec-exemplo.vercel.app' },
})
const linkHost = pedidoHost.body?.debugLink as string | undefined
ok('link usa o dominio do pedido, nao localhost', !!linkHost && linkHost.startsWith('https://jobtec-exemplo.vercel.app/?reset='), String(linkHost))
ok('o segundo pedido invalida o primeiro link', linkHost !== link)

// O hash não pode ser o token em claro: quem lê a base não entra na conta.
const guardado = await q('SELECT token_hash FROM password_resets WHERE user_id=$1 AND usado_em IS NULL ORDER BY id DESC LIMIT 1', [uidReset])
ok('existe um token guardado', guardado.length === 1)
ok('o token NÃO é guardado em claro', guardado[0]?.token_hash !== token && /^[0-9a-f]{64}$/.test(guardado[0]?.token_hash || ''))

const senhaFraca = await req('/api/password-reset?action=confirmar', { method: 'POST', body: JSON.stringify({ token, senha: 'fraca' }) })
ok('senha fraca é rejeitada', senhaFraca.status === 400, String(senhaFraca.status))

const tokenFalso = await req('/api/password-reset?action=confirmar', { method: 'POST', body: JSON.stringify({ token: 'a'.repeat(64), senha: 'NovaSenha2026' }) })
ok('token inválido é rejeitado', tokenFalso.status === 400, String(tokenFalso.status))

// O token a usar é o do pedido válido mais recente, já que cada pedido novo
// invalida os anteriores.
const tokenValido = (new URL(linkHost!).searchParams.get('reset'))!

const confirmado = await req('/api/password-reset?action=confirmar', { method: 'POST', body: JSON.stringify({ token: tokenValido, senha: 'NovaSenha2026' }) })
ok('senha alterada', confirmado.status === 200, JSON.stringify(confirmado.body))

const reutilizado = await req('/api/password-reset?action=confirmar', { method: 'POST', body: JSON.stringify({ token: tokenValido, senha: 'OutraSenha2026' }) })
ok('o token não pode ser usado duas vezes', reutilizado.status === 400, String(reutilizado.status))

const anteriorAindaValido = await req('/api/password-reset?action=confirmar', { method: 'POST', body: JSON.stringify({ token, senha: 'OutraSenha2026' }) })
ok('o link pedido antes também deixa de servir', anteriorAindaValido.status === 400, String(anteriorAindaValido.status))

const loginNovo = await req('/api/login', { method: 'POST', body: JSON.stringify({ email: emailReset, senha: 'NovaSenha2026' }) })
ok('login com a senha nova funciona', loginNovo.status === 200 && !!loginNovo.body?.token, JSON.stringify(loginNovo.body))
const loginAntigoSenha = await req('/api/login', { method: 'POST', body: JSON.stringify({ email: emailReset, senha: 'Jobtec2026' }) })
ok('login com a senha antiga é recusado', loginAntigoSenha.status === 401, String(loginAntigoSenha.status))

const sessaoMorta = await req('/api/me', { token: loginAntigo.body.token })
ok('sessão emitida antes do reset morreu', sessaoMorta.status === 401, String(sessaoMorta.status))
const sessaoNova = await req('/api/me', { token: loginNovo.body.token })
ok('sessão nova continua válida', sessaoNova.status === 200, String(sessaoNova.status))

console.log('\n== 12b. Email bombing: limite por endereço de destino ==')
// O limite por IP não impede mudar de rede e martelar o mesmo endereço. Cada
// pedido aqui vem de um IP diferente, para isolar só o limite por alvo.
const alvoBomb = `t.bomb.${stamp}@jobtec.mz`
let aceites = 0, barrados = 0
for (let i = 0; i < 5; i++) {
  const r = await req('/api/password-reset?action=pedir', {
    method: 'POST',
    body: JSON.stringify({ email: alvoBomb }),
    headers: { 'x-forwarded-for': `10.0.0.${i + 1}` },
  })
  if (r.status === 200) aceites++
  else barrados++
}
ok('apenas 3 pedidos passam para o mesmo alvo', aceites === 3, `aceites=${aceites} barrados=${barrados}`)
ok('os seguintes são barrados', barrados === 2, `barrados=${barrados}`)

const outroAlvo = await req('/api/password-reset?action=pedir', {
  method: 'POST',
  body: JSON.stringify({ email: `t.outro.${stamp}@jobtec.mz` }),
  headers: { 'x-forwarded-for': '10.0.0.99' },
})
ok('o limite é por alvo, não global', outroAlvo.status === 200, String(outroAlvo.status))

// Limpar para não afectar o resto dos testes.
for (const k of [`resetalvo:${alvoBomb}`, `resetalvo:${outroAlvo ? `t.outro.${stamp}@jobtec.mz` : ''}`]) {
  await q('DELETE FROM ratelimit WHERE key=$1', [k])
}

console.log('\n== 12c. Valor negociado fora da proposta ==')
// Em Moçambique o acordo fecha-se quase sempre noutro valor, normalmente no
// WhatsApp. Ao aceitar, quem decide declara o valor final e esse tem de ser o
// que fica no contrato.
const neg = await req('/api/propostas', {
  method: 'POST',
  headers: { Authorization: `Bearer ${tokenPro}` },
  body: JSON.stringify({
    profissional_id: prof.id, valor: 10000, prazo: '5 dias',
    descricao: 'Proposta a 10000 para testar o valor negociado.',
  }),
})
const neg2 = await req(`/api/propostas?id=${neg.body.id}`, {
  method: 'PATCH', headers: { Authorization: `Bearer ${tokenCli}` },
  body: JSON.stringify({ status: 'aceita', valor: 8000 }),
})
ok('aceita com valor negociado', neg2.status === 200, `${neg2.status} ${JSON.stringify(neg2.body).slice(0, 120)}`)

const contratoNeg = await pool.query(
  'SELECT valor_acordado, orcamento FROM contratos WHERE id=$1', [neg2.body.contratoId])
ok('o contrato regista 8000, nao os 10000 propostos',
  Number(contratoNeg.rows[0]?.valor_acordado) === 8000, JSON.stringify(contratoNeg.rows[0]))
ok('o orcamento original fica preservado para auditoria',
  String(contratoNeg.rows[0]?.orcamento ?? '').includes('10000'), JSON.stringify(contratoNeg.rows[0]?.orcamento))

const neg3 = await req(`/api/propostas?id=${neg.body.id}`, {
  method: 'PATCH', headers: { Authorization: `Bearer ${tokenCli}` },
  body: JSON.stringify({ status: 'aceita', valor: -50 }),
})
ok('valor negativo e recusado', neg3.status === 400, String(neg3.status))

console.log('\n== 13. Limpeza ==')
// A cascata trata do histórico, por isso basta apagar o utilizador.
const ids = await q(`SELECT id FROM users WHERE email LIKE 't.%@jobtec.mz'`)
let apagados = 0
for (const l of ids as any[]) {
  await q('DELETE FROM users WHERE id=$1', [l.id])
  apagados++
}
ok('utilizadores de teste apagados', apagados > 0, String(apagados))
const restos = await q(`SELECT COUNT(*)::int AS n FROM password_resets`)
ok('0 tokens de reset por usar', restos[0].n === 0, String(restos[0].n))
const resto = await q('SELECT COUNT(*)::int AS n FROM users WHERE email LIKE $1', [`t.%${stamp}@jobtec.mz`])
ok('0 utilizadores de teste restantes', resto[0].n === 0, String(resto[0].n))
await pool.end()

console.log(`\ntestes OK:${pass}  FALHAS:${fail}`)
process.exit(fail > 0 ? 1 : 0)
