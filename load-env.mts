// Carrega o `.env.local` para `process.env`.
//
// Tem de ser importado ANTES de `api/[...route].ts`: em ESM todos os imports
// são avaliados antes do corpo do módulo que os importa, por isso o loader
// anterior — que estava no corpo do `api-dev.mts` — chegava tarde demais e a
// rota construía o pool sem `DATABASE_URL`.
import fs from 'node:fs'

// O Vite aceita `CHAVE="valor"` e remove as aspas; o Node não. Sem esta
// limpeza o `pg` recebia a connection string com aspas à volta e falhava com
// `ENOTFOUND`.
function unquote(v: string): string {
  const s = v.trim()
  if (s.length >= 2 && ((s[0] === '"' && s.endsWith('"')) || (s[0] === "'" && s.endsWith("'")))) {
    return s.slice(1, -1)
  }
  return s
}

export function loadEnv(file = '.env.local'): void {
  if (!fs.existsSync(file)) return
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*?)\s*$/)
    if (!m) continue
    const key = m[1]
    if (!process.env[key]) process.env[key] = unquote(m[2])
  }
}

loadEnv()
