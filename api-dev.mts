// Servidor local temporário: expõe a função serverless `api/[...route].ts`
// numa porta HTTP para que os testes de integração possam falar com a Neon real.
// A ordem dos imports importa: `load-env` tem de correr antes de a rota ser
// avaliada, senão o pool é construído sem DATABASE_URL.
import './load-env.mts'
import { createServer } from 'node:http'
import handler from './api/[...route].ts'

// `API_PORT` e não `PORT`: o Vite também lê `PORT` para a porta do dev server
// (com `strictPort`), por isso partilhar a variável fazia os dois processos
// disputarem a mesma porta. O proxy em `vite.config.ts` aponta para este valor.
const PORT = Number(process.env.API_PORT || 3000)

createServer(async (inReq, outRes) => {
  // `readBody` da função serverless consome `req.on('data'|'end')`, por isso o
  // objeto tem de ser o IncomingMessage real — um plain object não serve.
  const req: any = inReq
  req.query = Object.fromEntries(new URL(inReq.url!, 'http://x').searchParams)

  const res: any = {
    statusCode: 200,
    status(c: number) { this.statusCode = c; return this },
    setHeader() { return this },
    json(payload: unknown) {
      outRes.writeHead(this.statusCode, { 'Content-Type': 'application/json' })
      outRes.end(JSON.stringify(payload))
      return this
    },
  }

  try { await handler(req, res) }
  catch (e: any) {
    if (!outRes.headersSent) { outRes.writeHead(500, { 'Content-Type': 'application/json' }); outRes.end(JSON.stringify({ error: String(e?.message || e) })) }
  }
}).listen(PORT, () => console.log(`API local em http://localhost:${PORT}`))
