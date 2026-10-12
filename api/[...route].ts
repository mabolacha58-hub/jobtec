import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';

// ============================== DB ==============================
const SALT_ROUNDS = 10;
const IS_PROD = process.env.VERCEL_ENV === 'production';

// Em produção o JWT_SECRET é obrigatório — sem ele o servidor recusa arrancar
// (não usar um fallback hardcoded permite forjar tokens).
function getSecret(): string {
  const s = process.env.JWT_SECRET;
  if (s) return s;
  if (IS_PROD) throw new Error('JWT_SECRET nao definido no ambiente. Configure-o no Vercel.');
  return 'dev-only-secret';
}

// Emails que ganham automaticamente o papel de administrador ao autenticar.
// Configurável via ADMIN_EMAILS (separados por vírgula); padrão: conta do dono.
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || 'mabolacha58@gmail.com')
  .toLowerCase().split(',').map((s: string) => s.trim()).filter(Boolean);

let pool: Pool | null = null;
function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 10,
      // O Neon suspende o compute após inatividade; o cold start pode demorar
      // mais do que o default. 20s evita falhas transitórias em SERP.
      connectionTimeoutMillis: 20000,
    });
  }
  return pool;
}

// As migrações correm uma vez por instância, não a cada request. Executar DDL
// em cada chamada custava ~15 round-trips e mantinha uma ligação do pool
// ocupada, o que em base de dados partilhada (pooler) esgotava o pool.
let dbReady: Promise<void> | null = null;
function ensureDb(): Promise<void> {
  if (!dbReady) {
    dbReady = initDb().catch((e) => {
      dbReady = null; // permite nova tentativa no próximo request
      throw e;
    });
  }
  return dbReady;
}

async function initDb(): Promise<void> {
  const client = await getPool().connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY, email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL,
        nome TEXT NOT NULL, tipo TEXT NOT NULL DEFAULT 'cliente', telefone TEXT,
        created_at TIMESTAMPTZ DEFAULT now()
      );`);
    await client.query(`
      CREATE TABLE IF NOT EXISTS profissionais (
        id SERIAL PRIMARY KEY, user_id INTEGER UNIQUE NOT NULL REFERENCES users(id),
        titulo TEXT, categoria TEXT, bio TEXT, localizacao TEXT, disponivel BOOLEAN DEFAULT true,
        avaliacao NUMERIC DEFAULT 0, avaliacoes INTEGER DEFAULT 0, score INTEGER DEFAULT 60,
        portfolio JSONB DEFAULT '[]'::jsonb, competencias JSONB DEFAULT '[]'::jsonb
      );`);
    // Tabelas criadas antes do score existirem trazem DEFAULT 0, o que faz um
    // perfil novo nascer com score 0 em vez da base neutra.
    await client.query(`ALTER TABLE profissionais ALTER COLUMN score SET DEFAULT 60`);
    await client.query(`CREATE TABLE IF NOT EXISTS servicos ( id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), categoria TEXT NOT NULL, titulo TEXT NOT NULL, descricao TEXT, orcamento TEXT, disponivel_ime TEXT, localizacao TEXT, status TEXT DEFAULT 'aberto', created_at TIMESTAMPTZ DEFAULT now() );`);
    await client.query(`CREATE TABLE IF NOT EXISTS propostas ( id SERIAL PRIMARY KEY, servico_id INTEGER NOT NULL REFERENCES servicos(id), profissional_id INTEGER NOT NULL REFERENCES profissionais(id), mensagem TEXT, valor TEXT, status TEXT DEFAULT 'pendente', created_at TIMESTAMPTZ DEFAULT now() );`);
    await client.query(`CREATE TABLE IF NOT EXISTS contratos ( id SERIAL PRIMARY KEY, servico_id INTEGER NOT NULL REFERENCES servicos(id), profissional_id INTEGER NOT NULL REFERENCES profissionais(id), orcamento TEXT, prazo TEXT, escopo TEXT, status TEXT DEFAULT 'em_andamento', avaliacao NUMERIC, comentario TEXT, created_at TIMESTAMPTZ DEFAULT now() );`);

    const profCols: [string, string][] = [
      ['foto_perfil', 'TEXT'], ['taxa_hora', 'NUMERIC DEFAULT 0'], ['trabalhos_concluidos', 'INTEGER DEFAULT 0'],
      ['verificado', 'BOOLEAN DEFAULT false'], ['tempo_resposta', "TEXT DEFAULT '< 1 dia'"],
      ['anos_experiencia', 'INTEGER DEFAULT 0'], ['provincia', "TEXT DEFAULT ''"],
    ];
    for (const [c, t] of profCols) await client.query(`ALTER TABLE profissionais ADD COLUMN IF NOT EXISTS ${c} ${t}`);
    const userCols: [string, string][] = [
      ['foto_perfil', 'TEXT'], ['cidade', "TEXT DEFAULT ''"], ['provincia', "TEXT DEFAULT ''"],
      ['ativo', 'BOOLEAN DEFAULT true'],
    ];
    for (const [c, t] of userCols) await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS ${c} ${t}`);
    const servCols: [string, string][] = [
      ['orcamento_min', 'NUMERIC DEFAULT 0'], ['orcamento_max', 'NUMERIC DEFAULT 0'],
      ['cidade', "TEXT DEFAULT ''"], ['prazo', "TEXT DEFAULT ''"], ['urgente', 'BOOLEAN DEFAULT false'],
    ];
    for (const [c, t] of servCols) await client.query(`ALTER TABLE servicos ADD COLUMN IF NOT EXISTS ${c} ${t}`);

    // Colunas que alinham o servidor com o modelo normalizado de src/db/schema.ts.
    // `propostas.servico_id` passa a ser anulável: o cliente pode enviar uma
    // proposta directa a um profissional a partir do perfil, sem serviço publicado.
    const propCols: [string, string][] = [
      ['cliente_id', 'INTEGER REFERENCES users(id)'], ['prazo', "TEXT DEFAULT ''"],
      ['valor_num', 'NUMERIC DEFAULT 0'], ['descricao', 'TEXT'],
    ];
    for (const [c, t] of propCols) await client.query(`ALTER TABLE propostas ADD COLUMN IF NOT EXISTS ${c} ${t}`);
    await client.query('ALTER TABLE propostas ALTER COLUMN servico_id DROP NOT NULL');

    const contrCols: [string, string][] = [
      ['cliente_id', 'INTEGER REFERENCES users(id)'], ['escopo', 'TEXT'],
      ['valor_acordado', 'NUMERIC DEFAULT 0'], ['prazo', "TEXT DEFAULT ''"],
      ['data_inicio', 'TIMESTAMPTZ'], ['data_conclusao', 'TIMESTAMPTZ'],
      ['avaliacao_nota', 'INTEGER'], ['avaliacao_comentario', 'TEXT'],
    ];
    for (const [c, t] of contrCols) await client.query(`ALTER TABLE contratos ADD COLUMN IF NOT EXISTS ${c} ${t}`);
    await client.query('ALTER TABLE contratos ALTER COLUMN servico_id DROP NOT NULL');

    await client.query(`
      CREATE TABLE IF NOT EXISTS avaliacoes (
        id SERIAL PRIMARY KEY,
        contrato_id INTEGER REFERENCES contratos(id),
        avaliador_id INTEGER NOT NULL REFERENCES users(id),
        avaliado_id INTEGER NOT NULL REFERENCES users(id),
        profissional_id INTEGER REFERENCES profissionais(id),
        nota INTEGER NOT NULL CHECK (nota BETWEEN 1 AND 5),
        comentario TEXT,
        criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
      );`);
    await client.query(`UPDATE avaliacoes SET criado_em = now() WHERE criado_em IS NULL`);

    await client.query('CREATE INDEX IF NOT EXISTS idx_avaliacoes_pro ON avaliacoes(profissional_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_avaliacoes_autor ON avaliacoes(avaliador_id)');
    await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS uq_avaliacao_unica ON avaliacoes(avaliador_id, profissional_id)`);
    await client.query('CREATE INDEX IF NOT EXISTS idx_propostas_cliente ON propostas(cliente_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_propostas_pro ON propostas(profissional_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_contratos_cliente ON contratos(cliente_id)');

    // Contacto: em Moçambique o serviço fecha-se por chamada, e o técnico
    // escreve o próprio número ao registar-se — ou seja, quer ser contactado.
    // Por isso o número é visível a utilizadores autenticados, com opt-out
    // explícito para quem preferir não o expor.
    await client.query('ALTER TABLE profissionais ADD COLUMN IF NOT EXISTS telefone_publico BOOLEAN DEFAULT true');

    await client.query(`
      CREATE TABLE IF NOT EXISTS notificacoes (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        tipo TEXT NOT NULL,
        titulo TEXT NOT NULL,
        texto TEXT,
        link TEXT,
        lida BOOLEAN NOT NULL DEFAULT false,
        criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
      );`);
    await client.query('CREATE INDEX IF NOT EXISTS idx_notif_user ON notificacoes(user_id, criado_em DESC)');

    // Recuperação de senha. Guardamos só o hash do token: se a base for
    // lida por alguém, não serve para entrar na conta de ninguém.
    await client.query(`
      CREATE TABLE IF NOT EXISTS password_resets (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_hash TEXT NOT NULL UNIQUE,
        expira_em TIMESTAMPTZ NOT NULL,
        usado_em TIMESTAMPTZ,
        criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
      );`);
    await client.query('CREATE INDEX IF NOT EXISTS idx_pwdreset_user ON password_resets(user_id)');

    // Um JWT continua válido durante 7 dias. Sem este contador, quem tivesse
    // uma sessão roubada mantinha-se dentro da conta mesmo depois de o dono
    // trocar a senha — que é precisamente o que a troca de senha quer travar.
    await client.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 0');

    // Apagar um utilizador apaga tudo o que lhe pertence, em cascata e por
    // vários níveis. Sem isto, as chaves estrangeiras de propostas/contratos
    // tornavam a eliminação de conta impossível: o `DELETE` falhava e o
    // histórico ficava órfão. O percorrido é automático em vez de uma lista
    // escrita à mão, para nenhuma tabela nova ficar com a constraint por omissão
    // — daí o `confrelid IN (...)` e não nomes concretos de constraint.
    await client.query(`
      DO $$
      DECLARE fk record;
      BEGIN
        FOR fk IN
          SELECT con.conname,
                 con.conrelid::regclass AS child,
                 con.confrelid::regclass AS parent,
                 (SELECT string_agg(att.attname, ', ' ORDER BY u.ord)
                    FROM unnest(con.conkey) WITH ORDINALITY AS u(attnum, ord)
                    JOIN pg_attribute att
                      ON att.attrelid = con.conrelid AND att.attnum = u.attnum) AS cols
            FROM pg_constraint con
           WHERE con.contype = 'f'
             AND con.confrelid IN ('users'::regclass, 'profissionais'::regclass,
                                   'servicos'::regclass, 'contratos'::regclass)
             AND con.confdeltype <> 'c'
        LOOP
          EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', fk.child, fk.conname);
          EXECUTE format(
            'ALTER TABLE %s ADD CONSTRAINT %I FOREIGN KEY (%s) REFERENCES %s ON DELETE CASCADE',
            fk.child, fk.conname, fk.cols, fk.parent);
        END LOOP;
      END $$;`);
  } finally {
    client.release();
  }
}

// Notificações dentro da aplicação. Sem isto, um pedido que o técnico não vê
// é um pedido perdido: o lado da oferta está a trabalhar e não abre a app
// três vezes por dia à espera. `email` fica preparado para quando houver um
// provedor configurado — sem ele, a notificação degrada para dentro da app.
type TipoNotificacao = 'proposta' | 'resposta' | 'contrato' | 'avaliacao';

async function notificar(
  userId: number | null | undefined,
  tipo: TipoNotificacao,
  titulo: string,
  texto: string,
  link?: string,
): Promise<void> {
  if (!userId) return;
  try {
    await getPool().query(
      'INSERT INTO notificacoes (user_id, tipo, titulo, texto, link) VALUES ($1,$2,$3,$4,$5)',
      [userId, tipo, titulo, texto, link ?? null]);
  } catch (e) {
    // Uma notificação perdida nunca pode derrubar a operação que a originou.
    console.error('Notificação falhou:', (e as Error)?.message);
  }
}

// Normaliza para o formato wa.me (só dígitos, com código de Moçambique).
function whatsappLink(telefone: string | null | undefined): string | null {
  if (!telefone) return null;
  const d = String(telefone).replace(/\D/g, '');
  if (!d) return null;
  const full = d.startsWith('258') ? d : `258${d}`;
  return `https://wa.me/${full}`;
}

// Recalcula avaliação e JOBTEC Score a partir das avaliações reais gravadas.
// A pontuação parte da base (60) e a reputação só soma: um 5/5 isolado nunca
// pode fazer um perfil descer abaixo de onde começou. O volume de trabalhos
// concluídos e a confiança nas avaliações escalam esse bónus até um tecto.
const SCORE_BASE = 60;   // score de um perfil sem histórico
const SCORE_MIN = 20;    // piso para perfis com reputação consistentemente má
const SCORE_MAX = 99;
const MEDIA_PLATAFORMA = 4.0; // média de referência: neutraliza avaliações isoladas
const K = 3;                  // peso do "voto neutro" de Bayes (quão forte é a dúvida)

// Média de Bayes: com poucas avaliações o resultado converge para a média da
// plataforma, evitando que uma única nota determine a reputação.
function bayes(media: number, n: number, m: number, k: number): number {
  return (media * n + m * k) / (n + k);
}

async function recalcularReputacao(profissionalId: number): Promise<void> {
  const pool = getPool();
  const avals = await pool.query('SELECT nota FROM avaliacoes WHERE profissional_id=$1', [profissionalId]);
  const n = avals.rows.length;

  const r = await pool.query(
    `SELECT GREATEST(p.trabalhos_concluidos,
        (SELECT COUNT(*) FROM contratos WHERE profissional_id=p.id AND status='concluido'))::int AS n
     FROM profissionais p WHERE p.id=$1`, [profissionalId]);
  const trabalhos = r.rows[0]?.n ?? 0;

  // Sem avaliações não há reputação a calcular: o perfil volta à base. Sem
  // este reset, apagar a última avaliação deixava a nota e o score antigos
  // congelados no perfil para sempre.
  if (n === 0) {
    await pool.query(
      'UPDATE profissionais SET avaliacao=0, avaliacoes=0, score=$1, trabalhos_concluidos=GREATEST(trabalhos_concluidos,$2) WHERE id=$3',
      [SCORE_BASE, trabalhos, profissionalId]);
    return;
  }

  const media = avals.rows.reduce((s: number, r: any) => s + Number(r.nota), 0) / n;

  const suavizada = bayes(media, n, MEDIA_PLATAFORMA, K);
  // -1..+1, com curva que expande o topo: na banda 4.0–5.0 é onde está a
  // diferenciação real, e uma escala linear achatava-a quase toda em 90.
  const qualidade = Math.sign(suavizada - MEDIA_PLATAFORMA) * Math.pow(Math.abs(suavizada - MEDIA_PLATAFORMA), 0.6);
  const confianca = Math.min(n / 5, 1);
  const volume = Math.min(trabalhos, 10) / 10;

  const bonus = qualidade * 20 * confianca + volume * 15;
  const score = Math.max(SCORE_MIN, Math.min(SCORE_MAX, Math.round(SCORE_BASE + bonus)));

  await pool.query(
    'UPDATE profissionais SET avaliacao=$1, avaliacoes=$2, score=$3, trabalhos_concluidos=GREATEST(trabalhos_concluidos,$4) WHERE id=$5',
    [Number(media.toFixed(1)), n, score, trabalhos, profissionalId]);
}

// ============================== AUTH ==============================
function hashPassword(plain: string): Promise<string> { return bcrypt.hash(plain, SALT_ROUNDS); }
function verifyPassword(plain: string, hash: string): Promise<boolean> { return bcrypt.compare(plain, hash); }
function signToken(payload: Record<string, unknown>): string { return jwt.sign(payload, getSecret(), { expiresIn: '7d' }); }
function verifyToken(token: string): jwt.JwtPayload | null {
  try { return jwt.verify(token, getSecret()) as jwt.JwtPayload; } catch { return null; }
}

// ============================== RATE LIMIT ==============================
// Limita tentativas falhadas de login/registo por IP e por conta para
// mitigar brute-force. Usa uma tabela na Postgres (funciona em múltiplas
// instâncias serverless).
const RL_MAX = 10;            // máx. tentativas falhadas
const RL_WINDOW_MS = 15 * 60 * 1000; // janela de 15 min

function clientIp(req: VercelRequest): string {
  const fwd = (req.headers['x-forwarded-for'] as string) || '';
  return fwd.split(',')[0].trim() || (req as any).socket?.remoteAddress || 'unknown';
}

// Limite por chave. `max` permite apertar mais onde faz sentido: o limite por IP
// não impede que alguém, mudando de rede, peça dezenas de resets para o mesmo
// endereço e encha a caixa de correcção dessa pessoa.
async function rl(key: string, action: 'check' | 'hit' | 'reset', max = RL_MAX): Promise<boolean> {
  try {
    const pool = getPool();
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ratelimit (
        key TEXT PRIMARY KEY, count INTEGER NOT NULL, window_start TIMESTAMPTZ NOT NULL
      )`);
    const since = new Date(Date.now() - RL_WINDOW_MS).toISOString();
    if (action === 'reset') {
      await pool.query('DELETE FROM ratelimit WHERE key=$1', [key]);
      return false;
    }
    const fresh = await pool.query(
      'SELECT count FROM ratelimit WHERE key=$1 AND window_start > $2', [key, since]);
    if (action === 'check') {
      if (fresh.rows.length === 0) return false;
      return fresh.rows[0].count >= max;
    }
    // action === 'hit'
    if (fresh.rows.length === 0) {
      await pool.query(
        `INSERT INTO ratelimit (key,count,window_start) VALUES ($1,1,now())
         ON CONFLICT (key) DO UPDATE SET count=1, window_start=now()`, [key]);
    } else {
      await pool.query(
        'UPDATE ratelimit SET count=count+1 WHERE key=$1 AND window_start > $2', [key, since]);
    }
    const after = await pool.query(
      'SELECT count FROM ratelimit WHERE key=$1 AND window_start > $2', [key, since]);
    return after.rows[0]?.count >= RL_MAX;
  } catch (e) {
    console.error('RATELIMIT ERRO:', (e as any)?.message);
    return false; // fail-open: a BD não deve bloquear o acesso em caso de falha
  }
}

// ============================== HELPERS ==============================
function ok(res: VercelResponse, body: unknown) { return res.status(200).json(body); }
function bad(res: VercelResponse, message: string) { return res.status(400).json({ error: message }); }
function unauthorized(res: VercelResponse, message = 'Nao autorizado') { return res.status(401).json({ error: message }); }
function notFound(res: VercelResponse, message = 'Nao encontrado') { return res.status(404).json({ error: message }); }
function serverError(res: VercelResponse, message = 'Erro interno') {
  // Em produção não expõe o detalhe interno (SQL/paths/etc.). Regista no console
  // para diagnóstico e devolve uma mensagem genérica ao cliente.
  if (IS_PROD) {
    console.error('ERRO INTERNO:', message);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
  return res.status(500).json({ error: message });
}

// Lê e consome o corpo do pedido. Consumir o stream é essencial para o
// runtime da Vercel não devolver resposta vazia quando há body.
function readBody<T = any>(req: VercelRequest): Promise<T> {
  const pre = (req as any).body;
  if (pre !== undefined) {
    drain(req);
    return Promise.resolve(pre as T);
  }
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk: Buffer) => (data += chunk));
    req.on('end', () => {
      try { resolve((data ? JSON.parse(data) : {}) as T); } catch (e) { reject(new Error('JSON invalido: ' + (e as any).message)); }
    });
    req.on('error', reject);
  });
}

function drain(req: VercelRequest) {
  req.on('data', () => {});
  req.resume();
}

function userIdFrom(req: VercelRequest): number | undefined {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  const payload = token ? verifyToken(token) : null;
  return payload?.userId as number | undefined;
}

// Verifica o token **e** se continua a ser da geração actual. `token_version`
// sobe quando a senha muda, invalidando de uma vez todos os JWTs emitidos
// antes — incluindo o do atacante.
async function authPayloadAsync(req: VercelRequest): Promise<{ userId: number; tipo: string } | null> {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  const payload = token ? verifyToken(token) : null;
  if (!payload?.userId) return null;
  const r = await getPool().query('SELECT tipo, token_version FROM users WHERE id=$1', [payload.userId as number]);
  if (r.rows.length === 0) return null;
  if ((payload.v as number | undefined) !== r.rows[0].token_version) return null;
  return { userId: payload.userId as number, tipo: (payload.tipo as string) || r.rows[0].tipo || 'cliente' };
}

// Garante que o pedido é de um administrador ativo. Devolve null e já escreve
// a resposta de 401 se não estiver autorizado.
async function requireAdmin(req: VercelRequest, res: VercelResponse): Promise<boolean> {
  const auth = await authPayloadAsync(req);
  if (!auth) { unauthorized(res); return false; }
  const r = await getPool().query('SELECT tipo, ativo FROM users WHERE id=$1', [auth.userId]);
  if (r.rows.length === 0) { unauthorized(res); return false; }
  if (r.rows[0].tipo !== 'admin' || r.rows[0].ativo === false) {
    unauthorized(res, 'Requer permissao de administrador');
    return false;
  }
  return true;
}

function mapProf(row: any, opts: { contact?: boolean; viewer?: number | null } = {}) {
  let portfolio = row.portfolio; let competencias = row.competencias;
  try { portfolio = typeof portfolio === 'string' ? JSON.parse(portfolio) : portfolio; } catch {}
  try { competencias = typeof competencias === 'string' ? JSON.parse(competencias) : competencias; } catch {}
  const base: any = {
    id: row.id, nome: row.nome, profissao_principal: row.titulo, categoria: row.categoria, bio: row.bio,
    localizacao: row.localizacao, provincia: row.provincia || '', foto_perfil: row.foto_perfil || '',
    disponivel: row.disponivel, avaliacao: Number(row.avaliacao) || 0, avaliacoes: row.avaliacoes || 0,
    score: Number(row.score) || 60, taxa_hora: Number(row.taxa_hora) || 0,
    trabalhos_concluidos: row.trabalhos_concluidos || 0, verificado: row.verificado || false,
    tempo_resposta: row.tempo_resposta || '< 1 dia', anos_experiencia: row.anos_experiencia || 0,
    portfolio, competencias,
  };
  // O dono vê sempre os seus dados. Os outros só veem o telefone se o técnico
  // o tiver marcado como público — e nunca o e-mail, que é dado de conta.
  const ehDono = opts.contact === true;
  const contactoPublico = row.telefone_publico !== false && opts.viewer != null;
  if (ehDono && row.email !== undefined) base.email = row.email;
  if (ehDono || contactoPublico) {
    base.telefone = row.telefone || null;
    base.whatsapp = whatsappLink(row.telefone);
    base.telefone_publico = row.telefone_publico !== false;
  }
  return base;
}

// ============================== SEED DATA ==============================
const SENHA = 'demo1234';
const NOMES_CLIENTES = [
  'Carlos Nhampule', 'Ana Mussá', 'João Machel', 'Fátima Sithole', 'Pedro Cossa',
  'Maria Vilanculos', 'Luís Tembe', 'Rita Cossa', 'Abel Muianga', 'Célia Faria',
];
const COMENTARIOS = [
  'Muito profissional, chegou no horário combinado e fez um excelente trabalho.',
  'Serviço rápido e com boa qualidade. Recomendo fortement.',
  'Comunicação fácil e preço justo. Voltarei a contratar.',
  'Resolveu o problema em menos tempo do que o previsto.',
  'Trabalho caprichado e limpo. Repetiria sem hesitar.',
  'Atendeu ao pedido dentro do orçamento combinado.',
];
const PROFISSIONAIS = [
  { nome: 'Amade Assane', email: 'amade@jobtec.mz', titulo: 'Taxista de Mota (Chapas 100)', categoria: 'mecanica', bio: 'Taxista de mota com 5 anos de experiencia na cidade de Nampula.', localizacao: 'Nampula Cidade', provincia: 'Nampula', foto: 'https://images.unsplash.com/photo-1531427186611-ecfd6d936c79?w=200&h=200&fit=crop&auto=format', skills: ['Passeios na Cidade', 'Entregas Rapidas'], rate: 100, score: 91, avaliacao: 4.8, avaliacoes: 72, concluidos: 310, tempo: '< 10 min' },
  { nome: 'Luisa Cumbana', email: 'luisa@jobtec.mz', titulo: 'Empregada Domestica', categoria: 'limpeza', bio: 'Empregada domestica experiente em limpeza e cozinha mocambicana.', localizacao: 'Nampula Cidade', provincia: 'Nampula', foto: 'https://images.unsplash.com/photo-1502823403499-6ccfcf4fb453?w=200&h=200&fit=crop&auto=format', skills: ['Limpeza Geral', 'Cozinha Tradicional'], rate: 120, score: 93, avaliacao: 4.9, avaliacoes: 64, concluidos: 180, tempo: '< 1 hora' },
  { nome: 'Graca Mondlane', email: 'graca@jobtec.mz', titulo: 'Enfermeira (Tecnica de Saude)', categoria: 'saude', bio: 'Tecnica de saude com 7 anos de experiencia em cuidados domiciliarios.', localizacao: 'Nacala Porto', provincia: 'Nampula', foto: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=200&h=200&fit=crop&auto=format', skills: ['Cuidados Domiciliarios', 'Injecoes'], rate: 350, score: 95, avaliacao: 5.0, avaliacoes: 41, concluidos: 96, tempo: '< 30 min' },
  { nome: 'Mario Chipanga', email: 'mario@jobtec.mz', titulo: 'Taxista de Mota (Entregas)', categoria: 'mecanica', bio: 'Taxista de mota especializado em entregas expressas.', localizacao: 'Nacala Porto', provincia: 'Nampula', foto: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=200&h=200&fit=crop&auto=format', skills: ['Entregas Expressas', 'Rotas'], rate: 120, score: 86, avaliacao: 4.7, avaliacoes: 55, concluidos: 240, tempo: '< 15 min' },
  { nome: 'Luis Mendes', email: 'luis@jobtec.mz', titulo: 'Taxista de Mota (App)', categoria: 'mecanica', bio: 'Taxista de mota para transporte de passageiros e entregas.', localizacao: 'Nampula Cidade', provincia: 'Nampula', foto: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=200&h=200&fit=crop&auto=format', skills: ['Transporte', 'Conducao Segura'], rate: 110, score: 88, avaliacao: 4.8, avaliacoes: 61, concluidos: 280, tempo: '< 10 min' },
  { nome: 'Marta Nhongwane', email: 'marta@jobtec.mz', titulo: 'Tecnica de Saude (Enfermeira)', categoria: 'saude', bio: 'Enfermeira experiente em cuidados domiciliarios.', localizacao: 'Nampula Cidade', provincia: 'Nampula', foto: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200&h=200&fit=crop&auto=format', skills: ['Cuidados Domiciliarios', 'Injecoes'], rate: 380, score: 96, avaliacao: 5.0, avaliacoes: 45, concluidos: 120, tempo: '< 30 min' },
];

// ============================== HANDLERS ==============================
async function hRegister(req: VercelRequest, res: VercelResponse) {
  const ip = clientIp(req);
  if (await rl(`reg:${ip}`, 'check')) return unauthorized(res, 'Demasiadas tentativas. Tente mais tarde.');
  const body = await readBody<{ nome?: string; email?: string; senha?: string; tipo?: string; telefone?: string; titulo?: string; categoria?: string; bio?: string; localizacao?: string; provincia?: string; disponivel?: boolean; telefonePublico?: boolean; taxa_hora?: number; competencias?: string[]; anos_experiencia?: number }>(req);
  if (!body.nome || !body.email || !body.senha) {
    await rl(`reg:${ip}`, 'hit');
    return bad(res, 'nome, email e senha sao obrigatorios');
  }
  // Validação de senha forte
  const senha = body.senha;
  const fraca = validarSenha(senha);
  if (fraca) {
    await rl(`reg:${ip}`, 'hit');
    return bad(res, fraca);
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) {
    await rl(`reg:${ip}`, 'hit');
    return bad(res, 'Email invalido');
  }
  const tipo = body.tipo === 'profissional' ? 'profissional' : 'cliente';
  const passwordHash = await hashPassword(senha);
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const ins = await client.query<{ id: number }>(
      'INSERT INTO users (email, password_hash, nome, tipo, telefone, provincia) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id',
      [body.email.toLowerCase().trim(), passwordHash, body.nome, tipo, body.telefone || null, body.provincia || '']);
    const userId = ins.rows[0].id;
    let profissionalId: number | null = null;
    if (tipo === 'profissional') {
      // O formulário pede taxa, competências, experiência e província. Não os
      // guardar deixava o técnico com um perfil a dizer "0 MZN/hora" logo no
      // primeiro minuto — que é a primeira coisa que um cliente vê.
      const p = await client.query<{ id: number }>(
        `INSERT INTO profissionais
           (user_id, titulo, categoria, bio, localizacao, provincia, disponivel, score,
            telefone_publico, taxa_hora, competencias, anos_experiencia)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`,
        [userId, body.titulo || null, body.categoria || null, body.bio || null,
         body.localizacao || null, body.provincia || '', body.disponivel ?? true, SCORE_BASE,
         body.telefonePublico !== false,
         Number(body.taxa_hora) || 0,
         JSON.stringify(Array.isArray(body.competencias) ? body.competencias : []),
         Number(body.anos_experiencia) || 0]);
      profissionalId = p.rows[0].id;
    }
    await client.query('COMMIT');
    await rl(`reg:${ip}`, 'reset');
    let finalTipo = tipo;
    if (ADMIN_EMAILS.includes(body.email.toLowerCase().trim())) {
      await getPool().query('UPDATE users SET tipo=$1 WHERE id=$2', ['admin', userId]);
      finalTipo = 'admin';
    }
    const token = signToken({ userId, tipo: finalTipo, v: 0 });
    return ok(res, { token, user: { id: userId, nome: body.nome, email: body.email, tipo: finalTipo, profissionalId, score: profissionalId ? SCORE_BASE : null } });
  } catch (e: any) {
    await client.query('ROLLBACK');
    if (e && e.code === '23505') {
      await rl(`reg:${ip}`, 'hit');
      return bad(res, 'Este email ja esta registado');
    }
    throw e;
  } finally {
    client.release();
  }
}

async function hLogin(req: VercelRequest, res: VercelResponse) {
  const body = await readBody<{ email?: string; senha?: string }>(req);
  if (!body.email || !body.senha) return bad(res, 'email e senha sao obrigatorios');
  const ip = clientIp(req);
  const emailKey = body.email.toLowerCase().trim();
  if (await rl(`login:${ip}`, 'check')) return unauthorized(res, 'Demasiadas tentativas. Tente mais tarde.');
  if (await rl(`login:${emailKey}`, 'check')) return unauthorized(res, 'Demasiadas tentativas para esta conta. Tente mais tarde.');
  const r = await getPool().query<{ id: number; nome: string; email: string; password_hash: string; tipo: string; ativo: boolean; profissional_id: number | null; token_version: number }>(
    `SELECT u.id, u.nome, u.email, u.password_hash, u.tipo, u.ativo, u.token_version, p.id AS profissional_id
     FROM users u LEFT JOIN profissionais p ON p.user_id = u.id WHERE u.email = $1`,
    [emailKey]);
  if (r.rows.length === 0) {
    await rl(`login:${ip}`, 'hit');
    await rl(`login:${emailKey}`, 'hit');
    return unauthorized(res, 'Email ou senha incorretos');
  }
  const user = r.rows[0];
  const valid = await verifyPassword(body.senha, user.password_hash);
  if (!valid) {
    await rl(`login:${ip}`, 'hit');
    await rl(`login:${emailKey}`, 'hit');
    return unauthorized(res, 'Email ou senha incorretos');
  }
  if (user.ativo === false) {
    await rl(`login:${ip}`, 'hit');
    return unauthorized(res, 'Conta desativada pelo administrador');
  }
  // Emails na lista ADMIN_EMAILS ganham o papel de administrador automaticamente.
  let tipo = user.tipo;
  if (ADMIN_EMAILS.includes(user.email)) {
    await getPool().query('UPDATE users SET tipo=$1 WHERE id=$2', ['admin', user.id]);
    tipo = 'admin';
  }
  // Login bem-sucedido: limpa as tentativas para este IP/conta
  await rl(`login:${ip}`, 'reset');
  await rl(`login:${emailKey}`, 'reset');
  const token = signToken({ userId: user.id, tipo, v: user.token_version ?? 0 });
  return ok(res, { token, user: { id: user.id, nome: user.nome, email: user.email, tipo, profissionalId: user.profissional_id ?? null } });
}

// A foto de perfil chega como data URI (`data:image/jpeg;base64,...`) porque o
// MVP não tem storage externo: o browser redimensiona para 400x400 antes de
// enviar. Validar o prefixo e o tamanho não é opcional — `foto_perfil` acaba no
// `src` de vários `<img>` e a coluna é TEXT, portanto sem isto aceitaria
// qualquer string. 2 MB é o teto do body numa função serverless da Vercel.
const AVATAR_PREFIXOS = ['data:image/jpeg;base64,', 'data:image/png;base64,', 'data:image/webp;base64,'];
const AVATAR_MAX_CHARS = 2 * 1024 * 1024;

function validarAvatar(v: unknown): { valor: string | null; erro: string | null } {
  if (v === null || v === '') return { valor: null, erro: null };
  if (typeof v !== 'string') return { valor: null, erro: 'Foto invalida' };
  if (!AVATAR_PREFIXOS.some((p) => v.startsWith(p))) {
    return { valor: null, erro: 'A foto tem de ser JPEG, PNG ou WebP' };
  }
  if (v.length > AVATAR_MAX_CHARS) return { valor: null, erro: 'A foto e demasiado grande (max. 2 MB)' };
  return { valor: v, erro: null };
}

async function hMe(req: VercelRequest, res: VercelResponse) {
  await ensureDb();
  const userId = (await authPayloadAsync(req))?.userId;
  if (!userId) return unauthorized(res);

  // Auto-serviço: o utilizador só mexe na sua própria linha — não há `id` no
  // corpo de propósito, o alvo é sempre quem vai autenticado.
  if (req.method === 'PATCH') {
    const body = await readBody<{
      nome?: string; telefone?: string; provincia?: string; cidade?: string;
      foto_perfil?: string | null;
    }>(req);

    const campos: string[] = [];
    const vals: unknown[] = [];
    const set = (col: string, v: unknown) => { vals.push(v); campos.push(`${col}=$${vals.length}`); };

    if (body.nome !== undefined) {
      const nome = String(body.nome).trim();
      if (nome.length < 2) return bad(res, 'Nome demasiado curto');
      set('nome', nome);
    }
    if (body.telefone !== undefined) set('telefone', String(body.telefone).trim() || null);
    if (body.provincia !== undefined) set('provincia', String(body.provincia).trim());
    if (body.cidade !== undefined) set('cidade', String(body.cidade).trim());

    let avatar: string | null = null;
    if (body.foto_perfil !== undefined) {
      const a = validarAvatar(body.foto_perfil);
      if (a.erro) return bad(res, a.erro);
      avatar = a.valor;
      set('foto_perfil', avatar);
    }
    if (campos.length === 0) return bad(res, 'Nada para atualizar');

    vals.push(userId);
    await getPool().query(`UPDATE users SET ${campos.join(', ')} WHERE id=$${vals.length}`, vals);

    // `hProfissionais` lê a foto de `profissionais.foto_perfil` (via `p.*`), mas
    // as notificações e as avaliações lêem de `users.foto_perfil`. Sem esta cópia
    // a mesma pessoa aparecia com duas fotos diferentes conforme a página.
    if (body.foto_perfil !== undefined) {
      await getPool().query('UPDATE profissionais SET foto_perfil=$1 WHERE user_id=$2', [avatar, userId]);
    }
  }

  const user = await getPool().query(
    `SELECT u.id, u.nome, u.email, u.tipo, u.telefone, u.provincia, u.cidade, u.foto_perfil,
            p.id AS profissional_id, p.titulo, p.categoria,
            p.bio, p.localizacao, p.disponivel, p.avaliacao, p.avaliacoes, p.score, p.portfolio, p.competencias
     FROM users u LEFT JOIN profissionais p ON p.user_id = u.id WHERE u.id = $1`, [userId]);
  const servicos = await getPool().query(
    'SELECT s.*, u.nome AS autor FROM servicos s JOIN users u ON u.id=s.user_id WHERE s.user_id=$1 ORDER BY s.created_at DESC',
    [userId]);
  const propostas = await getPool().query(`${PROPOSTA_SELECT}
    WHERE pr.cliente_id = $1 OR p.user_id = $1 OR s.user_id = $1 ORDER BY pr.created_at DESC`, [userId]);
  const contratos = await getPool().query(`${CONTRATO_SELECT}
    WHERE c.cliente_id = $1 OR p.user_id = $1 OR s.user_id = $1
    ORDER BY COALESCE(c.data_inicio, c.created_at) DESC`, [userId]);
  const avaliacoes = await getPool().query(
    `${AVALIACAO_SELECT} WHERE a.avaliador_id = $1 ORDER BY a.criado_em DESC`, [userId]);
  return ok(res, {
    user: user.rows[0] || null,
    servicos: servicos.rows,
    // map passa (elemento, indice, array): mapProposta(row, indice) faria o
    // indice ser lido como viewerId e podeDecidir sairia sempre falso.
    propostas: propostas.rows.map((row) => mapProposta(row, userId)),
    contratos: contratos.rows.map((row) => mapContrato(row)),
    avaliacoes: avaliacoes.rows.map((row) => mapAvaliacao(row)),
  });
}

async function hSeed(req: VercelRequest, res: VercelResponse) {
  // Em produção o seed é fechado: exige o SEED_TOKEN no header x-seed-token.
  // O frontend já não chama o seed automaticamente — só um admin deve poder
  // repor os dados de exemplo manualmente.
  const seedToken = process.env.SEED_TOKEN;
  if (IS_PROD) {
    if (!seedToken) return serverError(res, 'Seed nao configurado no servidor');
    const provided = (req.headers['x-seed-token'] as string) || '';
    if (provided !== seedToken) return unauthorized(res, 'Seed nao autorizado');
  }
  await ensureDb();
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const clienteExists = await client.query('SELECT id FROM users WHERE email=$1', ['cliente@jobtec.mz']);
    if (clienteExists.rows.length === 0) {
      const hash = await hashPassword(SENHA);
      await client.query('INSERT INTO users (email,password_hash,nome,tipo,cidade,provincia,foto_perfil) VALUES ($1,$2,$3,$4,$5,$6,$7)',
        ['cliente@jobtec.mz', hash, 'Cliente Demo', 'cliente', 'Nampula Cidade', 'Nampula', 'https://images.unsplash.com/photo-1502823403499-6ccfcf4fb453?w=200&h=200&fit=crop&auto=format']);
    }
    const senhaHash = await hashPassword(SENHA);
    let criados = 0;
    let atualizados = 0;
    for (const p of PROFISSIONAIS) {
      const exists = await client.query('SELECT id FROM users WHERE email=$1', [p.email]);
      if (exists.rows.length > 0) {
        await client.query('UPDATE users SET nome=$1, cidade=$2, provincia=$3, foto_perfil=$4 WHERE email=$5',
          [p.nome, p.localizacao, p.provincia, p.foto, p.email]);
        await client.query(
          `UPDATE profissionais SET titulo=$1, categoria=$2, bio=$3, localizacao=$4, provincia=$5, foto_perfil=$6, score=$7, avaliacao=$8, avaliacoes=$9, taxa_hora=$10, trabalhos_concluidos=$11, tempo_resposta=$12, competencias=$13
           WHERE user_id=(SELECT id FROM users WHERE email=$14)`,
          [p.titulo, p.categoria, p.bio, p.localizacao, p.provincia, p.foto, p.score, p.avaliacao, p.avaliacoes, p.rate, p.concluidos, p.tempo, JSON.stringify(p.skills), p.email]);
        atualizados++;
        continue;
      }
      const insUser = await client.query('INSERT INTO users (email,password_hash,nome,tipo,telefone,cidade,provincia,foto_perfil) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id',
        [p.email, senhaHash, p.nome, 'profissional', '', p.localizacao, p.provincia, p.foto]);
      const userId = insUser.rows[0].id;
      await client.query(
        `INSERT INTO profissionais (user_id,titulo,categoria,bio,localizacao,provincia,foto_perfil,disponivel,avaliacao,avaliacoes,score,taxa_hora,trabalhos_concluidos,verificado,tempo_resposta,competencias)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
        [userId, p.titulo, p.categoria, p.bio, p.localizacao, p.provincia, p.foto, true, p.avaliacao, p.avaliacoes, p.score, p.rate, p.concluidos, true, p.tempo, JSON.stringify(p.skills)]);
      criados++;
    }
    await client.query(`DELETE FROM profissionais WHERE user_id IN (SELECT id FROM users WHERE tipo='profissional' AND email = ANY($1))`,
      [['joaofaria@jobtec.mz', 'celia@jobtec.mz', 'abel@jobtec.mz', 'rita@jobtec.mz']]);
    await client.query(`DELETE FROM users WHERE tipo='profissional' AND email = ANY($1)`,
      [['joaofaria@jobtec.mz', 'celia@jobtec.mz', 'abel@jobtec.mz', 'rita@jobtec.mz']]);
    await client.query('COMMIT');
    // Gera avaliações sintéticas para que a reputação e os JOBTEC Scores dos
    // profissionais de demonstração derivem de dados reais e não de números
    // inventados à mão. Cada avaliação vem de um cliente distinto (o índice
    // único impede o mesmo avaliador de repetir). Idempotente: só corre quando
    // o perfil ainda não tem avaliações.
    let avaliacoesCriadas = 0;
    for (const p of PROFISSIONAIS) {
      const alvo = await client.query(
        'SELECT id, user_id FROM profissionais WHERE user_id=(SELECT id FROM users WHERE email=$1)', [p.email]);
      if (alvo.rows.length === 0) continue;
      const profId = alvo.rows[0].id;
      const profUserId = alvo.rows[0].user_id;
      // O seed completa o que falta em vez de saltar o perfil inteiro: um
      // seed interrompido a meio deixava o perfil com 3 de 60 avaliações para
      // sempre, porque `jaTem > 0` saltava todas as execuções seguintes.
      const faltam = Math.max(0, p.avaliacoes - (await client.query(
        'SELECT COUNT(*)::int AS n FROM avaliacoes WHERE profissional_id=$1', [profId])).rows[0].n);

      for (let i = 0; i < faltam; i++) {
        // Cliente sintético exclusivo desta avaliação.
        // O índice `i` continua a correr pelo total declarado, não pelas
        // faltantes — assim as notas preservam a média de referência mesmo
        // quando o seed é retomado a meio.
        const emailCli = `cliente.demo.${p.email.split('@')[0]}.${i}@jobtec.mz`;
        const insCli = await client.query(
          `INSERT INTO users (email,password_hash,nome,tipo,cidade,provincia)
           VALUES ($1,$2,$3,'cliente','Nampula Cidade','Nampula')
           ON CONFLICT (email) DO UPDATE SET nome=EXCLUDED.nome RETURNING id`,
          [emailCli, senhaHash, `${NOMES_CLIENTES[i % NOMES_CLIENTES.length]} ${i + 1}`]);
        // Distribuição determinística cuja média reproduz exatamente a nota
        // declarada: em cada ciclo de 5 avaliações, k vêm com +1 e o resto
        // com a base. Sem isto, a média real divergia do número de showcase.
        const base = Math.floor(p.avaliacao);
        const k = Math.max(0, Math.min(5, Math.round((p.avaliacao - base) * 5)));
        const nota = base >= 5 ? 5 : base + (i % 5 < k ? 1 : 0);
        const ins = await client.query(
          `INSERT INTO avaliacoes (avaliador_id, avaliado_id, profissional_id, nota, comentario, criado_em)
           VALUES ($1,$2,$3,$4,$5, now() - ($6 || ' days')::interval)
           ON CONFLICT (avaliador_id, profissional_id) DO NOTHING
           RETURNING id`,
          [insCli.rows[0].id, profUserId, profId, nota,
           COMENTARIOS[(i + p.nome.length) % COMENTARIOS.length], String(30 - (i % 30))]);
        // Contar inserts reais: um ON CONFLICT que não fez nada não criou
        // avaliação, e a resposta de seed dizia o contrário.
        if (ins.rows.length > 0) avaliacoesCriadas++;
      }
      // Só recalcula se o perfil tiver mesmo avaliações gravadas.
      const total = await client.query('SELECT COUNT(*)::int AS n FROM avaliacoes WHERE profissional_id=$1', [profId]);
      if (total.rows[0].n > 0) await recalcularReputacao(profId);
    }
    return ok(res, { criados, atualizados, avaliacoes: avaliacoesCriadas, total: PROFISSIONAIS.length, senha: SENHA });
  } catch (e: any) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

async function hProfissionais(req: VercelRequest, res: VercelResponse) {
  await ensureDb();
  const { id } = req.query;
  const viewerId = (await authPayloadAsync(req))?.userId;
  if (id) {
    const r = await getPool().query('SELECT p.*, u.nome, u.email, u.telefone FROM profissionais p JOIN users u ON u.id=p.user_id WHERE p.id=$1', [id]);
    if (r.rows.length === 0) return notFound(res, 'Profissional nao encontrado');
    const own = viewerId === r.rows[0].user_id;
    return ok(res, mapProf(r.rows[0], { contact: own, viewer: viewerId }));
  }
  const r = await getPool().query('SELECT p.*, u.nome, u.email, u.telefone FROM profissionais p JOIN users u ON u.id=p.user_id ORDER BY p.score DESC, p.avaliacao DESC');
  return ok(res, r.rows.map((row: any) => mapProf(row, { viewer: viewerId })));
}

async function hServicos(req: VercelRequest, res: VercelResponse) {
  await ensureDb();
  const userId = (await authPayloadAsync(req))?.userId;
  if (req.method === 'POST') {
    if (!userId) return unauthorized(res);
    const body = await readBody<{ categoria?: string; titulo?: string; descricao?: string; orcamento?: string; disponivelIme?: string; localizacao?: string; orcamentoMin?: number; orcamentoMax?: number; cidade?: string; prazo?: string; urgente?: boolean }>(req);
    if (!body.categoria || !body.titulo) return res.status(400).json({ error: 'categoria e titulo sao obrigatorios' });
    const r = await getPool().query(
      `INSERT INTO servicos (user_id,categoria,titulo,descricao,orcamento,disponivel_ime,localizacao,orcamento_min,orcamento_max,cidade,prazo,urgente)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [userId, body.categoria, body.titulo, body.descricao || null, body.orcamento || null, body.disponivelIme || null, body.localizacao || null, body.orcamentoMin ?? null, body.orcamentoMax ?? null, body.cidade || null, body.prazo || null, body.urgente ?? null]);
    return ok(res, r.rows[0]);
  }
  const { id } = req.query;
  if (id) {
    const r = await getPool().query('SELECT * FROM servicos WHERE id=$1', [id]);
    if (r.rows.length === 0) return res.status(404).json({ error: 'Nao encontrado' });
    return ok(res, r.rows[0]);
  }
  const r = await getPool().query(
    `SELECT s.*, u.nome AS autor FROM servicos s JOIN users u ON u.id=s.user_id ORDER BY s.created_at DESC`);
  return ok(res, r.rows);
}

// Converte um estado legado/alternativo para o vocabulário canônico do
// frontend: 'enviada' | 'aceita' | 'recusada'.
function normalizarPropostaStatus(s: string | null | undefined): 'enviada' | 'aceita' | 'recusada' {
  const v = (s || '').toLowerCase();
  if (v === 'aceita' || v === 'aceite' || v === 'aceito' || v === 'contratado') return 'aceita';
  if (v === 'recusada' || v === 'recusado' || v === 'rejeitada') return 'recusada';
  return 'enviada';
}

// Uma proposta tem sempre dois lados: quem a envia e quem decide. São lados
// diferentes consoante o fluxo, e confundi-los é o que permitia ao cliente
// aceitar o próprio pedido.
//   - Resposta a serviço publicado (servico_id): envia o profissional, decide o
//     cliente que publicou o serviço.
//   - Pedido directo (servico_id nulo): envia o cliente, decide o profissional.
function ladosDaProposta(row: any) {
  const eRespostaAJob = row.servico_id != null;
  return {
    eRespostaAJob,
    remetenteUserId: eRespostaAJob
      ? row.profissional_user_id
      : row.cliente_id,
    destinatarioUserId: eRespostaAJob
      ? (row.servico_cliente ?? row.cliente_id)
      : row.profissional_user_id,
  };
}

function mapProposta(row: any, viewerId?: number | null) {
  const valorNum = row.valor_num != null ? Number(row.valor_num) : 0;
  const valorTxt = row.valor != null ? String(row.valor) : '';
  const { destinatarioUserId } = ladosDaProposta(row);
  const isViewer = viewerId != null && Number(destinatarioUserId) === Number(viewerId);
  return {
    id: row.id,
    servico_id: row.servico_id ?? null,
    cliente_id: row.cliente_id ?? row.servico_cliente ?? null,
    profissional_id: row.profissional_id,
    proName: row.profissional_nome || '',
    proProfession: row.profissional_titulo || '',
    proAvatar: row.profissional_foto || '',
    clienteNome: row.cliente_nome || '',
    servicoTitulo: row.servico_titulo || '',
    valor: valorNum || parseInt(String(valorTxt).replace(/[^\d]/g, ''), 10) || 0,
    prazo: row.prazo || 'A combinar',
    descricao: row.descricao || row.mensagem || '',
    status: normalizarPropostaStatus(row.status),
    criadaEm: row.created_at,
    // O frontend usa isto para não mostrar "aceitar" a quem não pode decidir.
    sentido: isViewer ? 'recebida' : 'enviada',
    podeDecidir: isViewer,
  };
}

const PROPOSTA_SELECT = `
  SELECT pr.*, u.nome AS profissional_nome, u.foto_perfil AS profissional_foto,
         p.titulo AS profissional_titulo, p.user_id AS profissional_user_id,
         cu.nome AS cliente_nome,
         s.titulo AS servico_titulo, s.user_id AS servico_cliente
  FROM propostas pr
  JOIN profissionais p ON p.id = pr.profissional_id
  JOIN users u ON u.id = p.user_id
  LEFT JOIN users cu ON cu.id = pr.cliente_id
  LEFT JOIN servicos s ON s.id = pr.servico_id`;

async function hPropostas(req: VercelRequest, res: VercelResponse) {
  await ensureDb();
  const userId = (await authPayloadAsync(req))?.userId;
  const { id } = req.query;

  if (req.method === 'POST') {
    if (!userId) return unauthorized(res);
    const body = await readBody<{
      servicoId?: number; profissionalId?: number; mensagem?: string;
      descricao?: string; valor?: string | number; prazo?: string;
    }>(req);

    const servicoId = body.servicoId ? Number(body.servicoId) : null;
    if (!servicoId && !body.profissionalId) {
      return bad(res, 'servicoId ou profissionalId sao obrigatorios');
    }

    const valorRaw = body.valor;
    const valorNum = typeof valorRaw === 'number'
      ? valorRaw
      : parseInt(String(valorRaw ?? '').replace(/[^\d]/g, ''), 10) || 0;
    const prazo = body.prazo || 'A combinar';
// O formulário de proposta envia `mensagem`; clientes mais antigos podem
    // mandar `descricao`. Ler só uma das duas fazia a descrição chegar vazia à
    // base de dados e as notificações ficavam sem contexto.
    const descricao = body.descricao || body.mensagem || '';

    const client = await getPool().connect();
    try {
      await client.query('BEGIN');

      let profissionalId: number;
      let insertedId: number;

      if (servicoId) {
        // Fluxo A — o profissional autenticado responde a um serviço publicado.
        const srv = await client.query('SELECT user_id, status FROM servicos WHERE id=$1 FOR UPDATE', [servicoId]);
        if (srv.rows.length === 0) { await client.query('ROLLBACK'); return bad(res, 'Servico nao encontrado'); }
        if (srv.rows[0].user_id === userId) {
          await client.query('ROLLBACK'); return bad(res, 'Nao pode propor ao seu proprio servico');
        }
        if (srv.rows[0].status === 'contratado') {
          await client.query('ROLLBACK'); return bad(res, 'Servico ja contratado');
        }
        const me = await client.query('SELECT id FROM profissionais WHERE user_id=$1', [userId]);
        if (me.rows.length === 0) {
          await client.query('ROLLBACK'); return bad(res, 'Apenas profissionais podem proposing a servicos');
        }
        profissionalId = body.profissionalId ? Number(body.profissionalId) : me.rows[0].id;
        if (profissionalId !== me.rows[0].id) {
          await client.query('ROLLBACK'); return bad(res, 'Nao pode propor em nome de outro profissional');
        }
        const dup = await client.query(
          'SELECT id FROM propostas WHERE servico_id=$1 AND profissional_id=$2', [servicoId, profissionalId]);
        if (dup.rows.length > 0) {
          await client.query('ROLLBACK'); return bad(res, 'Ja enviou uma proposta para este servico');
        }
        // RETURNING id em vez de MAX(id): com duas inserções simultâneas, o
        // MAX(id) pode devolver a linha do outro pedido e responder com a
        // proposta errada.
        const ins = await client.query(
          `INSERT INTO propostas (servico_id, profissional_id, cliente_id, mensagem, descricao, valor, valor_num, prazo, status)
           VALUES ($1,$2,$3,$4,$4,$5,$6,$7,'enviada') RETURNING id`,
          [servicoId, profissionalId, srv.rows[0].user_id, descricao || null,
           body.valor != null ? String(body.valor) : null, valorNum, prazo]);
        insertedId = ins.rows[0].id;
      } else {
        // Fluxo B — o cliente envia uma proposta directa a um profissional.
        profissionalId = Number(body.profissionalId);
        const prof = await client.query('SELECT user_id FROM profissionais WHERE id=$1', [profissionalId]);
        if (prof.rows.length === 0) { await client.query('ROLLBACK'); return bad(res, 'Profissional nao encontrado'); }
        if (prof.rows[0].user_id === userId) {
          await client.query('ROLLBACK'); return bad(res, 'Nao pode enviar uma proposta a si mesmo');
        }
        const dup = await client.query(
          `SELECT id FROM propostas WHERE profissional_id=$1 AND cliente_id=$2 AND status='enviada'`,
          [profissionalId, userId]);
        if (dup.rows.length > 0) {
          await client.query('ROLLBACK'); return bad(res, 'Ja enviou uma proposta a este profissional');
        }
        const ins = await client.query(
          `INSERT INTO propostas (profissional_id, cliente_id, mensagem, descricao, valor, valor_num, prazo, status)
           VALUES ($1,$2,$3,$3,$4,$5,$6,'enviada') RETURNING id`,
          [profissionalId, userId, descricao || null,
           body.valor != null ? String(body.valor) : null, valorNum, prazo]);
        insertedId = ins.rows[0].id;
      }

      const created = await client.query(`${PROPOSTA_SELECT} WHERE pr.id = $1`, [insertedId]);
      await client.query('COMMIT');
      // Notifica o destinatário — a contraparte de quem enviou, não o remetente.
      const nova = mapProposta(created.rows[0], userId);
      const { destinatarioUserId } = ladosDaProposta(created.rows[0]);
      const quem = servicoId
        ? `${nova.proName} respondeu ao seu serviço`
        : `${nova.clienteNome || 'Um cliente'} enviou-lhe um pedido`;
      await notificar(destinatarioUserId, 'proposta', quem,
        nova.descricao ? nova.descricao.slice(0, 140) : 'Abra o JOBTEC para ver os detalhes.',
        'dashboard');
      return ok(res, nova);
    } catch (e: any) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  if (req.method === 'GET') {
    if (!userId) return unauthorized(res);
    const r = await getPool().query(
      `${PROPOSTA_SELECT}
       WHERE pr.cliente_id = $1 OR p.user_id = $1 OR s.user_id = $1
       ORDER BY pr.created_at DESC`, [userId]);
    return ok(res, r.rows.map((row) => mapProposta(row, userId)));
  }

  if (req.method === 'PATCH') {
    if (!userId) return unauthorized(res);
    if (!id) return bad(res, 'id e obrigatorio');
    const patch = await readBody<{ status?: string; valor?: string | number; prazo?: string }>(req);
    const status = normalizarPropostaStatus(patch.status);

    const client = await getPool().connect();
    try {
      await client.query('BEGIN');
      const current = await client.query(`${PROPOSTA_SELECT} WHERE pr.id = $1 FOR UPDATE OF pr`, [id]);
      if (current.rows.length === 0) { await client.query('ROLLBACK'); return notFound(res, 'Proposta nao encontrada'); }
      const row = current.rows[0];
      // Só o destinatário decide. Num pedido directo o destinatário é o
      // profissional (o cliente é o remetente); numa resposta a serviço é o
      // cliente que publicou o serviço.
      const { destinatarioUserId } = ladosDaProposta(row);
      if (Number(destinatarioUserId) !== Number(userId)) {
        await client.query('ROLLBACK');
        return bad(res, 'Apenas o destinatario pode aceitar ou recusar esta proposta');
      }
      if (normalizarPropostaStatus(row.status) === status) {
        await client.query('COMMIT');
        return ok(res, mapProposta(row, userId));
      }

      await client.query('UPDATE propostas SET status=$1 WHERE id=$2', [status, id]);

      let contratoId: number | null = null;
      if (status === 'aceita') {
        const proposto = row.valor_num != null ? Number(row.valor_num)
          : parseInt(String(row.valor ?? '').replace(/[^\d]/g, ''), 10) || 0;
        // Quem aceita pode declarar o valor final. Em Moçambique quase nada se
        // fecha na primeira, e o acordo acontece no WhatsApp; sem esta
        //override o contrato ficava com o preço da proposta original e o
        // valor realmente combinado nunca existia no sistema.
        let valor = proposto;
        if (patch.valor !== undefined && patch.valor !== null && String(patch.valor).trim() !== '') {
          const n = Number(String(patch.valor).replace(/[^\d]/g, ''));
          if (!Number.isFinite(n) || n < 0) {
            await client.query('ROLLBACK');
            return bad(res, 'Valor acordado invalido');
          }
          valor = n;
        }
        const prazo = (patch.prazo != null && String(patch.prazo).trim() !== '')
          ? String(patch.prazo) : (row.prazo || '');
        const ins = await client.query(
          `INSERT INTO contratos (servico_id, profissional_id, cliente_id, orcamento, valor_acordado, prazo, escopo, status, data_inicio)
           VALUES ($1,$2,$3,$4,$5,$6,$7,'em_andamento', now()) RETURNING id`,
          // O cliente é sempre o dono do pedido/serviço, nunca quem aceitou:
          // num pedido directo quem aceita é o profissional, e usar o userId
          // de quem aceitou colocaria o profissional nos dois lados do contrato.
          [row.servico_id ?? null, row.profissional_id, row.cliente_id ?? row.servico_cliente,
           row.valor != null ? String(row.valor) : null, valor, prazo, row.descricao || row.mensagem || null]);
        contratoId = ins.rows[0].id;
        if (row.servico_id) {
          await client.query("UPDATE servicos SET status='contratado' WHERE id=$1", [row.servico_id]);
        }
      }
      await client.query('COMMIT');
      const fresh = await getPool().query(`${PROPOSTA_SELECT} WHERE pr.id = $1`, [id]);
      // Avisa o remetente da decisão. Sem isto, quem enviou fica sem forma
      // de saber se o trabalho foi aceite ou recusado.
      const { remetenteUserId } = ladosDaProposta(row);
      if (Number(remetenteUserId) !== Number(userId)) {
        const vista = mapProposta(fresh.rows[0], userId);
        await notificar(remetenteUserId, 'resposta',
          status === 'aceita' ? 'A sua proposta foi aceite' : 'A sua proposta foi recusada',
          status === 'aceita'
            ? `${vista.proName} está pronto para começar. Fale com ele para combinar.`
            : `${vista.proName} não pode aceitar desta vez.`,
          'dashboard');
      }
      return ok(res, { ...mapProposta(fresh.rows[0], userId), contratoId });
    } catch (e: any) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  return res.status(405).json({ error: 'Metodo nao permitido' });
}

function mapContrato(row: any) {
  return {
    id: row.id,
    servico_id: row.servico_id ?? null,
    profissional_id: row.profissional_id,
    cliente_id: row.cliente_id ?? null,
    proId: row.profissional_id,
    clientId: row.cliente_id ?? row.servico_cliente ?? null,
    proName: row.profissional_nome || '',
    servicoTitulo: row.servico_titulo || '',
    budget: row.valor_acordado != null && Number(row.valor_acordado) !== 0
      ? String(row.valor_acordado)
      : row.orcamento || '',
    prazo: row.prazo || '',
    escopo: row.escopo || '',
    phase: row.status === 'concluido' ? 'completed'
      : row.status === 'cancelado' ? 'cancelled' : 'hired',
    status: row.status,
    hiredAt: row.data_inicio || row.created_at,
    concluídoEm: row.data_conclusao || null,
  };
}

const CONTRATO_SELECT = `
  SELECT c.*, u.nome AS profissional_nome, s.titulo AS servico_titulo, s.user_id AS servico_cliente
  FROM contratos c
  JOIN profissionais p ON p.id = c.profissional_id
  JOIN users u ON u.id = p.user_id
  LEFT JOIN servicos s ON s.id = c.servico_id`;

async function hContratos(req: VercelRequest, res: VercelResponse) {
  await ensureDb();
  const userId = (await authPayloadAsync(req))?.userId;
  const { id } = req.query;

  if (req.method === 'GET') {
    if (!userId) return unauthorized(res);
    if (id) {
      const r = await getPool().query(
        `${CONTRATO_SELECT} WHERE c.id=$1 AND (c.cliente_id=$2 OR p.user_id=$2 OR s.user_id=$2)`,
        [id, userId]);
      if (r.rows.length === 0) return notFound(res, 'Contrato nao encontrado');
      return ok(res, mapContrato(r.rows[0]));
    }
    const r = await getPool().query(
      `${CONTRATO_SELECT} WHERE c.cliente_id=$1 OR p.user_id=$1 OR s.user_id=$1
       ORDER BY COALESCE(c.data_inicio, c.created_at) DESC`, [userId]);
    return ok(res, r.rows.map(mapContrato));
  }

  if (req.method === 'POST') {
    if (!userId) return unauthorized(res);
    const body = await readBody<{
      profissionalId?: number; servicoId?: number; orcamento?: string | number;
      prazo?: string; escopo?: string;
    }>(req);
    if (!body.profissionalId) return bad(res, 'profissionalId e obrigatorio');
    const prof = await getPool().query('SELECT user_id FROM profissionais WHERE id=$1', [body.profissionalId]);
    if (prof.rows.length === 0) return bad(res, 'Profissional nao encontrado');
    if (prof.rows[0].user_id === userId) return bad(res, 'Nao pode contratar a si mesmo');

    const valorNum = typeof body.orcamento === 'number'
      ? body.orcamento
      : parseInt(String(body.orcamento ?? '').replace(/[^\d]/g, ''), 10) || 0;

    const r = await getPool().query(
      `INSERT INTO contratos (servico_id, profissional_id, cliente_id, orcamento, valor_acordado, prazo, escopo, status, data_inicio)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'em_andamento', now()) RETURNING id`,
      [body.servicoId ? Number(body.servicoId) : null, Number(body.profissionalId), userId,
       body.orcamento != null ? String(body.orcamento) : null, valorNum,
       body.prazo || '', body.escopo || null]);
    const fresh = await getPool().query(`${CONTRATO_SELECT} WHERE c.id=$1`, [r.rows[0].id]);
    return ok(res, mapContrato(fresh.rows[0]));
  }

  if (req.method === 'PATCH') {
    if (!userId) return unauthorized(res);
    if (!id) return bad(res, 'id e obrigatorio');
    const body = await readBody<{
      status?: 'em_andamento' | 'concluido' | 'cancelado';
      orcamento?: string; prazo?: string; escopo?: string;
      avaliacao?: number; comentario?: string;
    }>(req);

    const current = await getPool().query(
      `SELECT c.*, p.user_id AS profissional_user FROM contratos c
       JOIN profissionais p ON p.id=c.profissional_id
       LEFT JOIN servicos s ON s.id=c.servico_id WHERE c.id=$1`, [id]);
    if (current.rows.length === 0) return notFound(res, 'Contrato nao encontrado');
    const row = current.rows[0];
    const isCliente = row.cliente_id === userId;
    const isPro = row.profissional_user === userId;
    if (!isCliente && !isPro) return bad(res, 'Sem permissao');

    const allowed = body.status === 'em_andamento' || body.status === 'concluido' || body.status === 'cancelado';
    if (body.status && !allowed) return bad(res, 'status invalido');

    await getPool().query(
      `UPDATE contratos SET
        orcamento = COALESCE($1, orcamento),
        prazo = COALESCE($2, prazo),
        escopo = COALESCE($3, escopo),
        status = COALESCE($4, status),
        data_conclusao = CASE WHEN $4='concluido' THEN now() ELSE data_conclusao END
       WHERE id=$5`,
      [body.orcamento ?? null, body.prazo ?? null, body.escopo ?? null,
       allowed ? body.status! : null, id]);

    // Avisar a contraparte: um trabalho terminado é o momento em que o
    // profissional precisa de saber que pode ser avaliado.
    if (body.status === 'concluido' && row.status !== 'concluido') {
      const contraparte = isCliente ? row.profissional_user : row.cliente_id;
      await notificar(contraparte, 'contrato', 'Trabalho concluído',
        isCliente
          ? `${row.cliente_nome || 'O cliente'} marcou o trabalho como concluído.`
          : `${row.profissional_nome || 'O profissional'} marcou o trabalho como concluído.`,
        'dashboard');
    }

    // Avaliar concluindo o contrato é atalho equivalente a avaliar pelo perfil.
    if (body.avaliacao != null && body.avaliacao > 0) {
      if (!isCliente) return bad(res, 'Apenas o cliente pode avaliar');
      if (row.status !== 'concluido' && body.status !== 'concluido') {
        return bad(res, 'So pode avaliar um contrato concluido');
      }
      await gravarAvaliacao({
        contratoId: Number(id),
        avaliadorId: userId,
        profissionalId: row.profissional_id,
        nota: Math.round(body.avaliacao),
        comentario: body.comentario || '',
      });
    }
    const fresh = await getPool().query(`${CONTRATO_SELECT} WHERE c.id=$1`, [id]);
    return ok(res, mapContrato(fresh.rows[0]));
  }

  return res.status(405).json({ error: 'Metodo nao permitido' });
}

// ============================== AVALIAÇÕES ==============================
// Uma avaliação por (avaliador, profissional): reavaliar substitui, não duplica.
async function gravarAvaliacao(input: {
  contratoId: number | null
  avaliadorId: number
  profissionalId: number
  nota: number
  comentario: string
}) {
  const prof = await getPool().query('SELECT user_id FROM profissionais WHERE id=$1', [input.profissionalId]);
  const avaliadoId = prof.rows[0]?.user_id;
  if (!avaliadoId) throw new Error('Profissional nao encontrado');
  if (avaliadoId === input.avaliadorId) throw new Error('Nao pode avaliar a si mesmo');

  const nota = Math.max(1, Math.min(5, Math.round(input.nota)));
  const r = await getPool().query(
    `INSERT INTO avaliacoes (contrato_id, avaliador_id, avaliado_id, profissional_id, nota, comentario)
     VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (avaliador_id, profissional_id)
       DO UPDATE SET nota=EXCLUDED.nota, comentario=EXCLUDED.comentario,
                     contrato_id=EXCLUDED.contrato_id, criado_em=now()
     RETURNING *`,
    [input.contratoId, input.avaliadorId, avaliadoId, input.profissionalId, nota, input.comentario || null]);
  await recalcularReputacao(input.profissionalId);
  await notificar(avaliadoId, 'avaliacao', 'Recebeu uma avaliação',
    `${input.nota} de 5. Abra o JOBTEC para ver o detalhe.`, 'dashboard');
  return r.rows[0];
}

function mapAvaliacao(row: any) {
  return {
    id: row.id,
    contrato_id: row.contrato_id ?? null,
    profissional_id: row.profissional_id,
    avaliador_id: row.avaliador_id,
    avaliado_id: row.avaliado_id,
    nota: Number(row.nota),
    comentario: row.comentario || '',
    autorNome: row.autor_nome || '',
    autorFoto: row.autor_foto || '',
    criada_em: row.criado_em,
    date: new Date(row.criado_em).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' }),
  };
}

const AVALIACAO_SELECT = `
  SELECT a.*, u.nome AS autor_nome, u.foto_perfil AS autor_foto
  FROM avaliacoes a JOIN users u ON u.id = a.avaliador_id`;

async function hAvaliacoes(req: VercelRequest, res: VercelResponse) {
  await ensureDb();
  const userId = (await authPayloadAsync(req))?.userId;
  const { id, profissionalId } = req.query;

  if (req.method === 'GET') {
    if (profissionalId) {
      const r = await getPool().query(
        `${AVALIACAO_SELECT} WHERE a.profissional_id=$1 ORDER BY a.criado_em DESC`, [profissionalId]);
      return ok(res, r.rows.map(mapAvaliacao));
    }
    if (!userId) return unauthorized(res);
    const r = await getPool().query(
      `${AVALIACAO_SELECT} WHERE a.avaliador_id=$1 ORDER BY a.criado_em DESC`, [userId]);
    return ok(res, r.rows.map(mapAvaliacao));
  }

  if (req.method === 'POST') {
    if (!userId) return unauthorized(res);
    const body = await readBody<{
      profissionalId?: number; contratoId?: number; nota?: number; comentario?: string;
    }>(req);
    if (!body.profissionalId) return bad(res, 'profissionalId e obrigatorio');
    const nota = Number(body.nota);
    if (!nota || nota < 1 || nota > 5) return bad(res, 'nota deve ser entre 1 e 5');

    // Só é possível avaliar quem se contratou e concluiu o serviço.
    const contratoId = body.contratoId ? Number(body.contratoId) : null;
    if (contratoId) {
      const c = await getPool().query(
        'SELECT profissional_id, cliente_id, status FROM contratos WHERE id=$1', [contratoId]);
      if (c.rows.length === 0) return bad(res, 'Contrato nao encontrado');
      if (c.rows[0].cliente_id !== userId) return bad(res, 'Apenas o cliente pode avaliar este contrato');
      if (c.rows[0].status !== 'concluido') return bad(res, 'So pode avaliar um contrato concluido');
    } else {
      const done = await getPool().query(
        `SELECT id FROM contratos
         WHERE cliente_id=$1 AND profissional_id=$2 AND status='concluido'
         ORDER BY data_conclusao DESC NULLS LAST LIMIT 1`, [userId, body.profissionalId]);
      if (done.rows.length === 0) return bad(res, 'So pode avaliar quem contratou e concluiu o servico');
      const saved = await gravarAvaliacao({
        contratoId: done.rows[0].id,
        avaliadorId: userId,
        profissionalId: Number(body.profissionalId),
        nota,
        comentario: body.comentario || '',
      });
      return ok(res, mapAvaliacao(saved));
    }

    try {
      const saved = await gravarAvaliacao({
        contratoId,
        avaliadorId: userId,
        profissionalId: Number(body.profissionalId),
        nota,
        comentario: body.comentario || '',
      });
      return ok(res, mapAvaliacao(saved));
    } catch (e: any) {
      return bad(res, e?.message || 'Nao foi possivel gravar a avaliacao');
    }
  }

  if (req.method === 'DELETE') {
    if (!userId) return unauthorized(res);
    let targetPro: number | null = null;
    if (id) {
      const r = await getPool().query(
        'DELETE FROM avaliacoes WHERE id=$1 AND avaliador_id=$2 RETURNING profissional_id', [id, userId]);
      if (r.rows.length === 0) return notFound(res, 'Avaliacao nao encontrada');
      targetPro = r.rows[0].profissional_id;
    } else if (profissionalId) {
      const r = await getPool().query(
        'DELETE FROM avaliacoes WHERE avaliador_id=$1 AND profissional_id=$2 RETURNING profissional_id',
        [userId, profissionalId]);
      targetPro = Number(profissionalId);
      if (r.rows.length === 0) return notFound(res, 'Avaliacao nao encontrada');
    } else {
      return bad(res, 'id ou profissionalId e obrigatorio');
    }
    if (targetPro) await recalcularReputacao(Number(targetPro));
    return ok(res, { success: true });
  }

  return res.status(405).json({ error: 'Metodo nao permitido' });
}

async function hNotificacoes(req: VercelRequest, res: VercelResponse) {
  await ensureDb();
  const userId = (await authPayloadAsync(req))?.userId;
  if (!userId) return unauthorized(res);

  if (req.method === 'GET') {
    // Só a contagem: o sino faz polling leve e não precisa da lista toda.
    if (req.query.action === 'count') {
      const r = await getPool().query(
        'SELECT COUNT(*)::int AS n FROM notificacoes WHERE user_id=$1 AND lida=false', [userId]);
      return ok(res, { naoLidas: r.rows[0].n });
    }
    const r = await getPool().query(
      `SELECT id, tipo, titulo, texto, link, lida, criado_em
       FROM notificacoes WHERE user_id=$1 ORDER BY criado_em DESC LIMIT 50`, [userId]);
    return ok(res, r.rows.map((n: any) => ({
      id: n.id, tipo: n.tipo, titulo: n.titulo, texto: n.texto || '',
      link: n.link || '', lida: n.lida, criadaEm: n.criado_em,
    })));
  }

  if (req.method === 'PATCH') {
    const body = await readBody<{ id?: number; todas?: boolean }>(req);
    if (body.todas) {
      await getPool().query('UPDATE notificacoes SET lida=true WHERE user_id=$1 AND lida=false', [userId]);
      return ok(res, { success: true });
    }
    if (!body.id) return bad(res, 'id ou todas e obrigatorio');
    const r = await getPool().query(
      'UPDATE notificacoes SET lida=true WHERE id=$1 AND user_id=$2 RETURNING id',
      [body.id, userId]);
    if (r.rows.length === 0) return notFound(res, 'Notificacao nao encontrada');
    return ok(res, { success: true });
  }

  return res.status(405).json({ error: 'Metodo nao permitido' });
}
// Endpoints de administração consolidados em /api/admin?action=... por
// compatibilidade com o router de captura da Vercel (um único segmento).
async function hAdmin(req: VercelRequest, res: VercelResponse) {
  await ensureDb();
  if (!(await requireAdmin(req, res))) return;
  const { action } = req.query;
  const { id } = req.query;
  const method = req.method || 'GET';

  if (action === 'metrics') {
    const [usuarios, profAgr, servAgr, contrAgr, propostas, porCategoria] = await Promise.all([
      getPool().query(`SELECT tipo, COUNT(*)::int AS n FROM users GROUP BY tipo`),
      getPool().query(`SELECT COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE verificado)::int AS verificado,
        COUNT(*) FILTER (WHERE disponivel)::int AS disponiveis
        FROM profissionais`),
      getPool().query(`SELECT status, COUNT(*)::int AS n FROM servicos GROUP BY status`),
      getPool().query(`SELECT status, COUNT(*)::int AS n FROM contratos GROUP BY status`),
      getPool().query(`SELECT COUNT(*)::int AS n FROM propostas`),
      getPool().query(`SELECT COALESCE(NULLIF(categoria,''),'outros') AS categoria, COUNT(*)::int AS n
        FROM profissionais GROUP BY categoria ORDER BY n DESC`),
    ]);
    const sum = (rows: { n: number }[]) => rows.reduce((a, r) => a + r.n, 0);
    return ok(res, {
      usuarios: { total: sum(usuarios.rows), porTipo: usuarios.rows },
      profissionais: { ...profAgr.rows[0], porCategoria: porCategoria.rows },
      servicos: { total: sum(servAgr.rows), porStatus: servAgr.rows },
      contratos: { total: sum(contrAgr.rows), porStatus: contrAgr.rows },
      propostas: propostas.rows[0].n,
    });
  }

  if (action === 'usuarios') {
    if (id && method === 'PATCH') {
      const body = await readBody<{ tipo?: string; ativo?: boolean }>(req);
      const allowedTipo = body.tipo === 'admin' || body.tipo === 'profissional' || body.tipo === 'cliente';
      const r = await getPool().query(
        `UPDATE users SET tipo=COALESCE($1,tipo), ativo=COALESCE($2,ativo) WHERE id=$3 RETURNING id`,
        [allowedTipo ? body.tipo : null, body.ativo === undefined ? null : body.ativo, id]);
      if (r.rows.length === 0) return notFound(res, 'Utilizador nao encontrado');
      return ok(res, { success: true });
    }
    const r = await getPool().query(
      `SELECT id, nome, email, tipo, telefone, ativo, created_at FROM users ORDER BY created_at DESC`);
    return ok(res, r.rows);
  }

  if (action === 'profissionais') {
    if (id && method === 'PATCH') {
      const b = await readBody<{
        nome?: string; email?: string; telefone?: string; titulo?: string; categoria?: string;
        bio?: string; localizacao?: string; provincia?: string; foto_perfil?: string;
        disponivel?: boolean; verificado?: boolean; taxa_hora?: number; score?: number;
      }>(req);
      const profId = Number(id);
      const p = await getPool().query('SELECT p.user_id FROM profissionais p WHERE p.id=$1', [profId]);
      if (p.rows.length === 0) return notFound(res, 'Profissional nao encontrado');
      await getPool().query(
        `UPDATE users SET nome=COALESCE($1,nome), email=COALESCE($2,email), telefone=COALESCE($3,telefone) WHERE id=$4`,
        [b.nome ?? null, b.email?.toLowerCase().trim() ?? null, b.telefone ?? null, p.rows[0].user_id]);
      await getPool().query(
        `UPDATE profissionais SET titulo=COALESCE($1,titulo), categoria=COALESCE($2,categoria), bio=COALESCE($3,bio),
         localizacao=COALESCE($4,localizacao), provincia=COALESCE($5,provincia), foto_perfil=COALESCE($6,foto_perfil),
         disponivel=COALESCE($7,disponivel), verificado=COALESCE($8,verificado),
         taxa_hora=COALESCE($9,taxa_hora), score=COALESCE($10,score) WHERE id=$11`,
        [b.titulo ?? null, b.categoria ?? null, b.bio ?? null, b.localizacao ?? null, b.provincia ?? null,
         b.foto_perfil ?? null, b.disponivel ?? null, b.verificado ?? null, b.taxa_hora ?? null, b.score ?? null, profId]);
      return ok(res, { success: true });
    }
    const r = await getPool().query(
      `SELECT p.id, p.user_id, u.nome, u.email, u.telefone, u.ativo, u.created_at,
              p.titulo, p.categoria, p.bio, p.localizacao, p.provincia, p.foto_perfil, p.disponivel,
              p.verificado, p.score, p.taxa_hora, p.trabalhos_concluidos, p.avaliacao, p.avaliacoes
       FROM profissionais p JOIN users u ON u.id=p.user_id ORDER BY p.score DESC, p.avaliacao DESC`);
    return ok(res, r.rows);
  }

  if (action === 'servicos') {
    if (id && method === 'PATCH') {
      const b = await readBody<{ status?: string }>(req);
      const allowed = b.status === 'aberto' || b.status === 'contratado' || b.status === 'removido';
      const r = await getPool().query(
        `UPDATE servicos SET status=COALESCE($1,status) WHERE id=$2 RETURNING id`,
        [allowed ? b.status : null, id]);
      if (r.rows.length === 0) return notFound(res, 'Servico nao encontrado');
      return ok(res, { success: true });
    }
    const r = await getPool().query(
      `SELECT s.*, u.nome AS autor FROM servicos s JOIN users u ON u.id=s.user_id ORDER BY s.created_at DESC`);
    return ok(res, r.rows);
  }

  return bad(res, 'action desconhecido');
}

// ============================== RECUPERAR SENHA ==============================
// O token viaja uma vez e guardamos apenas o hash. Em produção devolvemos
// sempre a mesma resposta, exista ou não a conta: um "email não existe" é a
// forma mais rápida de transformar o formulário numa lista de quem tem conta.
const RESET_MINUTOS = 30;
// Máximo de pedidos de reset para o mesmo endereço na janela do rate limit.
// Três é o suficiente para quem se enganou duas vezes e não dá para encher a
// caixa de correcção de outra pessoa.
const RESET_MAX_POR_ALVO = 3;

function validarSenha(senha: string): string | null {
  if (senha.length < 8) return 'A senha deve ter pelo menos 8 caracteres';
  if (!/[a-z]/.test(senha) || !/[A-Z]/.test(senha) || !/[0-9]/.test(senha)) {
    return 'A senha deve conter maiusculas, minusculas e numeros';
  }
  return null;
}

async function enviarEmailReset(destino: string, link: string): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return false;
  const from = process.env.RESEND_FROM || 'JOBTEC <noreply@jobtec.co.mz>';
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from, to: [destino],
        subject: 'Recuperar a sua palavra-passe JOBTEC',
        text: `Recebeu este pedido para redefinir a palavra-passe da sua conta JOBTEC.\n\n${link}\n\nO link é válido durante ${RESET_MINUTOS} minutos e só pode ser usado uma vez. Se não foi você, ignore este e-mail: nada muda na sua conta.`,
      }),
    });
    return r.ok;
  } catch (e) {
    console.error('Email de reset falhou:', (e as Error)?.message);
    return false;
  }
}

async function hPasswordReset(req: VercelRequest, res: VercelResponse) {
  await ensureDb();
  const ip = clientIp(req);
  if (req.method !== 'POST') return res.status(405).json({ error: 'Metodo nao permitido' });
  const action = (req.query.action as string) || 'pedir';

  if (action === 'pedir') {
    const body = await readBody<{ email?: string }>(req);
    if (!body.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) {
      return bad(res, 'Email invalido');
    }
    if (await rl(`reset:${ip}`, 'check')) {
      return unauthorized(res, 'Demasiados pedidos. Tente mais tarde.');
    }
    // Limite por endereço de destino, e bem mais apertado que o do IP: é o que
    // trava o email bombing, em que o atacante muda de rede mas não de vítima.
    if (await rl(`resetalvo:${body.email.toLowerCase().trim()}`, 'check', RESET_MAX_POR_ALVO)) {
      return unauthorized(res, 'Demasiados pedidos para este email. Tente dentro de uns minutos.');
    }
    await rl(`reset:${ip}`, 'hit');
    await rl(`resetalvo:${body.email.toLowerCase().trim()}`, 'hit', RESET_MAX_POR_ALVO);

    const email = body.email.toLowerCase().trim();
    const u = await getPool().query(
      'SELECT id, email FROM users WHERE email=$1 AND ativo=true', [email]);

    // Mesma resposta exista ou não a conta, e o tempo de resposta também não
    // deve denunciar a diferença.
    if (u.rows.length === 0) return ok(res, { enviado: true });

    // Só o pedido mais recente vale: os anteriores deixam de servir assim que
    // este é criado.
    await getPool().query(
      'UPDATE password_resets SET usado_em=now() WHERE user_id=$1 AND usado_em IS NULL', [u.rows[0].id]);

    const token = crypto.randomBytes(32).toString('hex');
    const hash = crypto.createHash('sha256').update(token).digest('hex');
    await getPool().query(
      'INSERT INTO password_resets (user_id, token_hash, expira_em) VALUES ($1,$2, now() + ($3 || \' minutes\')::interval)',
      [u.rows[0].id, hash, String(RESET_MINUTOS)]);

    // O link tem de apontar para o domínio real. Se `PUBLIC_URL` não estiver
    // definido, tiramo-lo dos headers da Vercel: sem isto, o email de recuperação
    // em produção mandava o utilizador para `localhost:5173`.
    const proto = String(req.headers['x-forwarded-proto'] || '').split(',')[0] || 'https';
    const host = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0];
    const base = process.env.PUBLIC_URL || (host ? `${proto}://${host}` : 'http://localhost:5173');
    const link = `${base}/?reset=${token}`;
    const enviado = await enviarEmailReset(u.rows[0].email, link);

    if (!enviado) {
      // Sem provedor de email não há como entregar o link. Devolvê-lo só fora
      // de produção permite testar o fluxo e, no piloto, passar a mão.
      console.error(`Reset para ${email} sem email enviado (RESEND_API_KEY ausente ou falhou). Link: ${link}`);
      if (!IS_PROD) {
        return ok(res, { enviado: true, debugLink: link });
      }
    }
    return ok(res, { enviado: true });
  }

  if (action === 'confirmar') {
    const body = await readBody<{ token?: string; senha?: string }>(req);
    if (!body.token || !body.senha) return bad(res, 'token e senha sao obrigatorios');
    const fraca = validarSenha(body.senha);
    if (fraca) return bad(res, fraca);

    const hash = crypto.createHash('sha256').update(body.token).digest('hex');
    const r = await getPool().query(
      `SELECT id, user_id FROM password_resets
        WHERE token_hash=$1 AND usado_em IS NULL AND expira_em > now()`, [hash]);
    if (r.rows.length === 0) {
      return bad(res, 'Link invalido ou expirado. Peça um novo.');
    }

    const passwordHash = await hashPassword(body.senha);
    // `token_version + 1` invalida todos os JWTs emitidos com a senha antiga,
    // incluindo o de quem tivesse roubado a sessão.
    await getPool().query(
      'UPDATE users SET password_hash=$1, token_version=token_version+1 WHERE id=$2',
      [passwordHash, r.rows[0].user_id]);
    await getPool().query(
      'UPDATE password_resets SET usado_em=now() WHERE user_id=$1 AND usado_em IS NULL',
      [r.rows[0].user_id]);
    return ok(res, { success: true });
  }

  return bad(res, 'action desconhecido');
}

// ============================== ROUTER ==============================
export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const url = (req.url || '').split('?')[0];
    const method = req.method || 'GET';

    // A migração corre aqui, no router, e não em cada handler: `hRegister` e
    // `hLogin` eram as únicas excepções e o registo — a primeira coisa que um
    // utilizador novo faz — podia chegar a uma base sem a coluna mais recente.
    // `ensureDb` é memoizado, portanto as chamadas nos handlers são inofensivas.
    await ensureDb();

    if (url === '/api' || url === '/api/') return ok(res, { status: 'ok' });
    if (url === '/api/ping') return ok(res, { pong: true, url, method });

    if (url === '/api/register' && method === 'POST') return hRegister(req, res);
    if (url === '/api/login' && method === 'POST') return hLogin(req, res);
    if (url === '/api/me' && (method === 'GET' || method === 'PATCH')) return hMe(req, res);
    if (url === '/api/seed' && method === 'POST') return hSeed(req, res);
    if (url === '/api/admin' || url.startsWith('/api/admin?')) return hAdmin(req, res);
    if (url.startsWith('/api/profissionais')) return hProfissionais(req, res);
    if (url.startsWith('/api/servicos')) return hServicos(req, res);
    if (url.startsWith('/api/propostas')) return hPropostas(req, res);
    if (url.startsWith('/api/contratos')) return hContratos(req, res);
    if (url.startsWith('/api/avaliacoes')) return hAvaliacoes(req, res);
    if (url.startsWith('/api/notificacoes')) return hNotificacoes(req, res);
    if (url.startsWith('/api/password-reset')) return hPasswordReset(req, res);

    return res.status(404).json({ error: 'Rota nao encontrada' });
  } catch (e: any) {
    return serverError(res, e?.message || 'Erro interno');
  }
}
