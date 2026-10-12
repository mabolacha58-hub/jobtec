import type {
  User,
  Profissional,
  Competencia,
  ProfissionalCompetencia,
  PortfolioItem,
  Servico,
  Proposta,
  Contrato,
  Avaliacao,
} from './schema'

// Camada de armazenamento sobre localStorage, organizada por "tabelas".
// Cada tabela é uma array persistida. Fornece operações CRUD mínimas e
// deixa a porta aberta para migrar para uma base de dados real/SQL.

export interface JDBTables {
  users: User[]
  profissionais: Profissional[]
  competencias: Competencia[]
  profissional_competencias: ProfissionalCompetencia[]
  portfolio: PortfolioItem[]
  servicos: Servico[]
  propostas: Proposta[]
  contratos: Contrato[]
  avaliacoes: Avaliacao[]
}

export type TableName = keyof JDBTables
export type RowOf<K extends TableName> = JDBTables[K][number]

const PREFIX = 'jdb.'

function read(): JDBTables {
  try {
    const raw = localStorage.getItem('jdb.all')
    if (raw) return JSON.parse(raw) as JDBTables
  } catch {
    // ignore
  }
  return {
    users: [],
    profissionais: [],
    competencias: [],
    profissional_competencias: [],
    portfolio: [],
    servicos: [],
    propostas: [],
    contratos: [],
    avaliacoes: [],
  }
}

function write(tables: JDBTables): void {
  try {
    localStorage.setItem('jdb.all', JSON.stringify(tables))
  } catch {
    // ignore storage errors
  }
}

export function loadTables(): JDBTables {
  return read()
}

export function saveTables(tables: JDBTables): void {
  write(tables)
}

export function nextId<K extends TableName>(tables: JDBTables, table: K): number {
  const rows = tables[table] as RowOf<K>[]
  if (rows.length === 0) return 1
  const max = rows.reduce((m, r) => Math.max(m, (r as { id: number }).id), 0)
  return max + 1
}

export function insert<K extends TableName>(tables: JDBTables, table: K, row: RowOf<K>): JDBTables {
  const next = { ...tables, [table]: [...tables[table], row] } as JDBTables
  write(next)
  return next
}

export function updateRow<K extends TableName>(
  tables: JDBTables,
  table: K,
  id: number,
  patch: Partial<RowOf<K>>
): JDBTables {
  const rows = tables[table] as RowOf<K>[]
  const nextRows = rows.map(r =>
    (r as { id: number }).id === id ? { ...r, ...patch } : r
  ) as RowOf<K>[]
  const next = { ...tables, [table]: nextRows } as JDBTables
  write(next)
  return next
}

export function resetTables(): void {
  try {
    localStorage.removeItem('jdb.all')
  } catch {
    // ignore
  }
}

export const TABLES: { [K in TableName]: () => JDBTables[K] } = {
  users: () => [],
  profissionais: () => [],
  competencias: () => [],
  profissional_competencias: () => [],
  portfolio: () => [],
  servicos: () => [],
  propostas: () => [],
  contratos: () => [],
  avaliacoes: () => [],
}
