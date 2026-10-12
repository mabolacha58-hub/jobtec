import { lazy, Suspense, useEffect, useState } from 'react'
import jobtecLogo from './imports/IMG-20260828-WA0004.jpg'
import Navbar from './components/Navbar'
import { useStore } from './context/store'
import { api } from './api/client'
import type { AppPage } from './types'

const Landing = lazy(() => import('./pages/Landing'))
const Explore = lazy(() => import('./pages/Explore'))
const Profile = lazy(() => import('./pages/Profile'))
const PostService = lazy(() => import('./pages/PostService'))
const HowItWorks = lazy(() => import('./pages/HowItWorks'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const ProfessionalSignup = lazy(() => import('./pages/ProfessionalSignup'))
const Settings = lazy(() => import('./pages/Settings'))

type AuthMode = 'none' | 'login' | 'signup-pro' | 'signup-client'

function PageLoader() {
  return (
    <div className="flex items-center justify-center py-24" style={{ background: '#061E26' }}>
      <div className="flex items-center gap-2 text-sm" style={{ color: '#7BAAB8' }}>
        <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
        A carregar...
      </div>
    </div>
  )
}

function AuthModal({ mode, onClose, goProSignup, resetToken }: { mode: AuthMode; onClose: () => void; goProSignup: () => void; resetToken: string }) {
  const { signIn, signUp } = useStore()
  const [tab, setTab] = useState<'login' | 'signup'>(mode === 'login' ? 'login' : 'signup')
  const [role, setRole] = useState<'professional' | 'client'>(mode === 'signup-pro' ? 'professional' : 'client')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  // 'form' = login/registo normais; 'pedir' = pedir link; 'definir' = já tem
  // token na URL e quer escolher a nova senha.
  const [view, setView] = useState<'form' | 'pedir' | 'definir'>(resetToken ? 'definir' : 'form')
  const [resetEnviado, setResetEnviado] = useState<string | null>(null)

  if (view !== 'form') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(10px)' }}
        onClick={e => e.target === e.currentTarget && onClose()}>
        <div role="dialog" aria-modal="true" aria-labelledby="reset-title"
          className="w-full max-w-md rounded-3xl p-8 shadow-2xl"
          style={{ background: 'linear-gradient(145deg, #103945 0%, #0A2730 100%)', border: '1px solid rgba(255,255,255,0.14)' }}>
          <h2 id="reset-title" className="font-serif text-2xl" style={{ color: '#EDF4F6' }}>
            {view === 'pedir' ? 'Recuperar acesso' : 'Nova palavra-passe'}
          </h2>

          {view === 'pedir' && (
            resetEnviado ? (
              <>
                <p className="mt-3 text-sm" style={{ color: '#8DB4BF' }}>
                  Se existir uma conta com esse email, enviámos um link. Verifique também
                  o spam — o link é válido durante 30 minutos.
                </p>
                {resetEnviado && (
                  <a href={resetEnviado} className="mt-4 block text-xs underline break-all"
                    style={{ color: '#E8A020' }}>
                    {resetEnviado}
                  </a>
                )}
              </>
            ) : (
              <>
                <p className="mt-3 text-sm" style={{ color: '#8DB4BF' }}>
                  Indique o email com que se registou e enviamos um link para escolher
                  uma nova palavra-passe.
                </p>
                <div className="mt-4">
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: '#9EC2CB' }}>Email</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                    placeholder="exemplo@email.com" autoComplete="email"
                    className="auth-input w-full px-3.5 py-3 rounded-xl text-sm outline-none"
                    style={{ background: 'rgba(4,24,31,0.58)', border: '1px solid rgba(255,255,255,0.12)', color: '#EDF4F6' }} />
                </div>
                <button
                  onClick={async () => {
                    setError('')
                    if (!email.trim()) { setError('Indique o seu email.'); return }
                    setBusy(true)
                    try {
                      const r = await api.pedirResetSenha(email.trim())
                      setResetEnviado(r.debugLink ?? null)
                    } catch (e: any) {
                      setError(e?.message || 'Não foi possível pedir o link.')
                    } finally { setBusy(false) }
                  }}
                  disabled={busy || !email.trim()}
                  className="mt-4 w-full py-3.5 rounded-xl font-semibold text-sm transition-all"
                  style={{ background: !busy && email.trim() ? '#E8A020' : 'rgba(255,255,255,0.06)', color: !busy && email.trim() ? '#fff' : '#3D6878' }}>
                  {busy ? 'A processar…' : 'Enviar link'}
                </button>
              </>
            )
          )}

          {view === 'definir' && (
            <>
              <p className="mt-3 text-sm" style={{ color: '#8DB4BF' }}>
                Escolha a nova palavra-passe. Ao fazê-lo, as sessões abertas noutros
                dispositivos são encerradas.
              </p>
              <div className="mt-4">
                <label className="block text-xs font-semibold mb-1.5" style={{ color: '#9EC2CB' }}>Nova senha</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                  autoComplete="new-password"
                  className="auth-input w-full px-3.5 py-3 rounded-xl text-sm outline-none"
                  style={{ background: 'rgba(4,24,31,0.58)', border: '1px solid rgba(255,255,255,0.12)', color: '#EDF4F6' }} />
                <p className="mt-1.5 text-xs" style={{ color: '#6F9AA5' }}>
                  Mínimo 8 caracteres, com maiúsculas, minúsculas e números.
                </p>
              </div>
              <button
                onClick={async () => {
                  setError('')
                  if (!password) { setError('Escreva a nova senha.'); return }
                  setBusy(true)
                  try {
                    await api.confirmarResetSenha(resetToken, password)
                    setDone(true)
                  } catch (e: any) {
                    setError(e?.message || 'Não foi possível mudar a senha.')
                  } finally { setBusy(false) }
                }}
                disabled={busy || !password}
                className="mt-4 w-full py-3.5 rounded-xl font-semibold text-sm transition-all"
                style={{ background: !busy && password ? '#E8A020' : 'rgba(255,255,255,0.06)', color: !busy && password ? '#fff' : '#3D6878' }}>
                {busy ? 'A processar…' : 'Guardar nova senha'}
              </button>
            </>
          )}

          {error && <p className="mt-3 text-xs font-medium" style={{ color: '#F87171' }}>{error}</p>}

          <button onClick={() => { setView('form'); setError(''); setResetEnviado(null) }}
            className="mt-5 text-xs font-medium" style={{ color: '#7BAAB8' }}>
            Voltar ao início de sessão
          </button>
        </div>
      </div>
    )
  }

  if (done) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(10px)' }}
        onClick={e => e.target === e.currentTarget && onClose()}>
        <div className="w-full max-w-sm rounded-2xl p-8 text-center"
          style={{ background: '#0D2E38', border: '1px solid rgba(255,255,255,0.1)' }}>
          <div className="text-4xl mb-4">🎉</div>
          <h3 className="font-serif text-2xl mb-2" style={{ color: '#EDF4F6' }}>
            {tab === 'login' ? 'Bem-vindo de volta!' : 'Conta criada!'}
          </h3>
          <p className="text-sm mb-6" style={{ color: '#7BAAB8' }}>
            {tab === 'login'
              ? 'Sessão iniciada com sucesso.'
              : `Conta de ${role === 'professional' ? 'profissional' : 'cliente'} criada. Comece a explorar!`}
          </p>
          <button
            onClick={onClose}
            className="w-full py-3 rounded-xl font-semibold text-sm"
            style={{ background: '#E8A020', color: '#fff' }}
          >
            Continuar
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(10px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-title"
        className="w-full max-w-md max-h-[calc(100vh-2rem)] overflow-y-auto rounded-3xl shadow-2xl"
        style={{
          background: 'linear-gradient(145deg, #103945 0%, #0A2730 100%)',
          border: '1px solid rgba(255,255,255,0.14)',
          boxShadow: '0 24px 80px rgba(0,0,0,0.45)',
        }}
      >
        {/* Header */}
      <div className="flex items-start justify-between p-6 pb-5" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div>
          <div className="rounded-lg overflow-hidden px-1.5 py-1" style={{ background: '#fff' }}>
            <img src={jobtecLogo} alt="JOBTEC"
              style={{ height: 30, width: 'auto', objectFit: 'contain', display: 'block' }} />
          </div>
          <p className="mt-4 text-xs font-semibold uppercase tracking-[0.16em]" style={{ color: '#E8A020' }}>
            {tab === 'login' ? 'Área segura' : 'Junte-se ao JOBTEC'}
          </p>
          <h2 id="auth-title" className="mt-1 font-serif text-2xl" style={{ color: '#EDF4F6' }}>
            {tab === 'login' ? 'Bem-vindo de volta' : 'Crie a sua conta'}
          </h2>
          <p className="mt-1 text-sm" style={{ color: '#8DB4BF' }}>
            {tab === 'login' ? 'Entre para continuar a encontrar oportunidades.' : 'Conecte-se a profissionais e clientes em Moçambique.'}
          </p>
        </div>
        <button onClick={onClose} aria-label="Fechar"
          className="w-9 h-9 rounded-xl flex items-center justify-center transition-colors"
          style={{ background: 'rgba(255,255,255,0.06)', color: '#7BAAB8' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex p-1 mx-6 mt-5 rounded-xl" style={{ background: 'rgba(6,30,38,0.72)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <button
            onClick={() => setTab('login')}
            className="flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all"
            style={{
              background: tab === 'login' ? 'rgba(232,160,32,0.15)' : 'transparent',
              color: tab === 'login' ? '#E8A020' : '#7BAAB8',
            }}
          >
            Entrar
          </button>
          <button
            onClick={() => setTab('signup')}
            className="flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all"
            style={{
              background: tab === 'signup' ? 'rgba(232,160,32,0.15)' : 'transparent',
              color: tab === 'signup' ? '#E8A020' : '#7BAAB8',
            }}
          >
            Cadastrar
          </button>
        </div>

        <div className="p-6 pt-5 space-y-4">
          {tab === 'signup' && (
            <>
              <div>
                <label className="block text-xs font-semibold mb-2" style={{ color: '#9EC2CB' }}>Pretendo usar o JOBTEC como</label>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    { id: 'professional', label: 'Profissional', detail: 'Oferecer serviços' },
                    { id: 'client', label: 'Cliente', detail: 'Contratar serviços' },
                  ] as const).map(opt => (
                    <button
                      key={opt.id}
                      onClick={() => setRole(opt.id)}
                      className="py-3 px-3 rounded-xl text-left transition-all"
                      style={{
                        background: role === opt.id ? 'rgba(232,160,32,0.12)' : 'rgba(6,30,38,0.6)',
                        color: role === opt.id ? '#E8A020' : '#7BAAB8',
                        border: `1px solid ${role === opt.id ? 'rgba(232,160,32,0.35)' : 'rgba(255,255,255,0.08)'}`,
                      }}
                    >
                      <span className="block text-sm font-semibold">{opt.label}</span>
                      <span className="block mt-0.5 text-[11px]" style={{ color: role === opt.id ? '#C7DDE2' : '#6F9AA5' }}>{opt.detail}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: '#9EC2CB' }}>Nome completo</label>
                <input type="text" value={name} onChange={e => setName(e.target.value)}
                  placeholder="O seu nome"
                  autoComplete="name"
                  className="auth-input w-full px-3.5 py-3 rounded-xl text-sm outline-none"
                  style={{ background: 'rgba(4,24,31,0.58)', border: '1px solid rgba(255,255,255,0.12)', color: '#EDF4F6' }} />
              </div>
            </>
          )}

          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: '#9EC2CB' }}>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="exemplo@email.com"
              autoComplete="email"
              className="auth-input w-full px-3.5 py-3 rounded-xl text-sm outline-none"
              style={{ background: 'rgba(4,24,31,0.58)', border: '1px solid rgba(255,255,255,0.12)', color: '#EDF4F6' }} />
          </div>

          {tab === 'signup' && (
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: '#9EC2CB' }}>Telefone <span className="font-normal opacity-70">(opcional)</span></label>
              <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                placeholder="+258 84 000 0000"
                autoComplete="tel"
                className="auth-input w-full px-3.5 py-3 rounded-xl text-sm outline-none"
                style={{ background: 'rgba(4,24,31,0.58)', border: '1px solid rgba(255,255,255,0.12)', color: '#EDF4F6' }} />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: '#9EC2CB' }}>Senha</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="Introduza a sua senha"
              autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
              className="auth-input w-full px-3.5 py-3 rounded-xl text-sm outline-none"
              style={{ background: 'rgba(4,24,31,0.58)', border: '1px solid rgba(255,255,255,0.12)', color: '#EDF4F6' }} />
          </div>

          <button
            onClick={async () => {
              setError('')
              if (tab === 'signup' && role === 'professional' && !mode) {
                goProSignup()
                return
              }
              if (tab === 'signup' && role === 'professional') {
                // O profissional completo usa o formulário dedicado; aqui não criamos.
                goProSignup()
                return
              }
              if (tab === 'signup') {
                if (!name.trim() || !email.trim() || !password) {
                  setError('Preencha nome, email e senha.')
                  return
                }
                setBusy(true)
                try {
                  await signUp({ nome: name.trim(), email: email.trim(), senha: password, tipo: role === 'professional' ? 'profissional' : 'cliente', telefone: phone || undefined })
                  setDone(true)
                } catch (e: any) {
                  setError(e?.message || 'Não foi possível criar a conta.')
                } finally {
                  setBusy(false)
                }
                return
              }
              if (!email.trim() || !password) {
                setError('Preencha email e senha.')
                return
              }
              setBusy(true)
              try {
                await signIn(email.trim(), password)
                setDone(true)
              } catch (e: any) {
                setError(e?.message || 'Email ou senha incorretos.')
              } finally {
                setBusy(false)
              }
            }}
            disabled={tab === 'signup' && role === 'professional' ? false : busy || !(email && password)}
            className="w-full py-3.5 rounded-xl font-semibold text-sm transition-all shadow-lg"
            style={{
              background: tab === 'signup' && role === 'professional' ? '#38BDF8' : (email || phone) && password && !busy ? '#E8A020' : 'rgba(255,255,255,0.06)',
              color: tab === 'signup' && role === 'professional' ? '#fff' : (email || phone) && password && !busy ? '#fff' : '#3D6878',
            }}
            onMouseEnter={e => { if (tab === 'signup' && role === 'professional') e.currentTarget.style.background = '#0EA5E9' }}
            onMouseLeave={e => { if (tab === 'signup' && role === 'professional') e.currentTarget.style.background = '#38BDF8' }}
          >
            {busy ? 'A processar…'
              : tab === 'signup' && role === 'professional'
              ? 'Criar Perfil Profissional →'
              : tab === 'login' ? 'Entrar' : 'Criar conta'}
          </button>

          {error && (
            <p className="text-xs font-medium" style={{ color: '#F87171' }}>{error}</p>
          )}

          {tab === 'login' && (
            <>
              <p className="text-center text-xs pt-1" style={{ color: '#7BAAB8' }}>
                Ainda não tem conta?{' '}
                <button onClick={() => setTab('signup')} style={{ color: '#E8A020' }}>Cadastre-se</button>
              </p>
              <p className="text-center text-xs" style={{ color: '#7BAAB8' }}>
                <button onClick={() => { setError(''); setView('pedir') }} style={{ color: '#7BAAB8', textDecoration: 'underline' }}>
                  Esqueci-me da palavra-passe
                </button>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default function App() {
  const { professionals } = useStore()
  const [page, setPage] = useState<AppPage>('home')
  const [selectedProId, setSelectedProId] = useState<number | null>(null)
  const [authModal, setAuthModal] = useState<AuthMode>('none')
  // Um link de recuperação abre a app já no ecrã de nova senha. Guardamos o
  // token num state inicial para o AuthModal poder montar já no passo certo.
  const [resetToken] = useState(() =>
    typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('reset') ?? '' : '')

  // Com um token na URL abrimos o AuthModal de imediato.
  useEffect(() => {
    if (resetToken) setAuthModal('login')
  }, [resetToken])

  const navigate = (p: AppPage, proId?: number) => {
    setPage(p)
    if (proId !== undefined) setSelectedProId(proId)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const selectedPro = professionals.find(p => p.id === selectedProId)

  return (
    <div className="min-h-full" style={{ background: '#061E26', color: '#EDF4F6', fontFamily: "'Outfit', system-ui, sans-serif" }}>
      <Navbar currentPage={page} navigate={navigate} openAuth={setAuthModal} />

      <Suspense fallback={<PageLoader />}>
        {page === 'home' && <Landing navigate={navigate} />}
        {page === 'explore' && <Explore navigate={navigate} />}
        {page === 'profile' && selectedPro && <Profile pro={selectedPro} navigate={navigate} />}
        {page === 'profile' && !selectedPro && <Explore navigate={navigate} />}
        {page === 'post' && <PostService navigate={navigate} />}
        {page === 'how' && <HowItWorks navigate={navigate} />}
        {page === 'dashboard' && <Dashboard navigate={navigate} />}
        {page === 'pro-signup' && <ProfessionalSignup navigate={navigate} />}
        {page === 'settings' && <Settings navigate={navigate} />}
      </Suspense>

      {authModal !== 'none' && (
        <AuthModal
          mode={authModal}
          onClose={() => setAuthModal('none')}
          goProSignup={() => { setAuthModal('none'); navigate('pro-signup') }}
          resetToken={resetToken}
        />
      )}
    </div>
  )
}
