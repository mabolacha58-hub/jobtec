import { useEffect, useRef, useState } from 'react'
import jobtecLogo from '../imports/IMG-20260828-WA0004.jpg'
import { useStore } from '../context/store'
import type { AppPage, NavigateFn } from '../types'

interface NavbarProps {
  currentPage: AppPage
  navigate: NavigateFn
  openAuth: (mode: 'login' | 'signup-pro' | 'signup-client') => void
}

export default function Navbar({ currentPage, navigate, openAuth }: NavbarProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const {
    authUser, signOut, notifications, unreadCount, perfil,
    refreshNotifications, markNotificationRead, markAllNotificationsRead,
  } = useStore()
  const [bellOpen, setBellOpen] = useState(false)
  const bellRef = useRef<HTMLDivElement>(null)

  // A lista só é carregada quando o sino abre; o polling traz só a contagem.
  useEffect(() => {
    if (!bellOpen) return
    void refreshNotifications().catch(() => { /* offline — mostra o que já tem */ })
  }, [bellOpen, refreshNotifications])

  useEffect(() => {
    if (!bellOpen) return
    const fora = (e: MouseEvent) => {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) setBellOpen(false)
    }
    document.addEventListener('mousedown', fora)
    return () => document.removeEventListener('mousedown', fora)
  }, [bellOpen])

  const navItems = [
    { id: 'home' as AppPage, label: 'Início' },
    { id: 'explore' as AppPage, label: 'Explorar' },
    { id: 'post' as AppPage, label: 'Publicar Serviço' },
    { id: 'dashboard' as AppPage, label: 'Painel' },
    { id: 'how' as AppPage, label: 'Como Funciona' },
  ]

  const abrirNotificacao = (link: string) => {
    setBellOpen(false)
    if (link) navigate(link as AppPage)
  }

  // O sino só aparece com sessão iniciada: notificação anónimo não tem a quem
  // pertencer, e um contador que não abre em lado nenhum é só ruído visual.
  const sino = authUser ? (
    <div className="relative" ref={bellRef}>
      <button
        onClick={() => setBellOpen(v => !v)}
        className="relative w-10 h-10 flex items-center justify-center rounded-lg transition-colors"
        style={{ color: unreadCount > 0 ? '#E8A020' : '#7BAAB8' }}
        aria-label={`Notificações${unreadCount > 0 ? ` (${unreadCount} por ler)` : ''}`}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full text-[10px] font-bold flex items-center justify-center"
            style={{ background: '#E8A020', color: '#061E26' }}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {bellOpen && (
        <div className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-xl overflow-hidden z-50"
          style={{ background: '#0A2833', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 18px 40px rgba(0,0,0,0.45)' }}>
          <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            <span className="text-sm font-semibold" style={{ color: '#EDF4F6' }}>Notificações</span>
            {unreadCount > 0 && (
              <button onClick={() => void markAllNotificationsRead()} className="text-xs font-medium"
                style={{ color: '#E8A020' }}>
                Marcar todas como lidas
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="px-4 py-8 text-sm text-center" style={{ color: '#7BAAB8' }}>
                Ainda não tem notificações.
              </p>
            ) : notifications.map(n => (
              <button key={n.id} onClick={() => { void markNotificationRead(n.id); abrirNotificacao(n.link) }}
                className="w-full text-left px-4 py-3 transition-colors"
                style={{
                  background: n.lida ? 'transparent' : 'rgba(232,160,32,0.08)',
                  borderBottom: '1px solid rgba(255,255,255,0.05)',
                }}>
                <div className="flex items-start gap-2">
                  {!n.lida && <span className="mt-1.5 w-2 h-2 rounded-full flex-shrink-0" style={{ background: '#E8A020' }} />}
                  <div className={n.lida ? 'pl-4' : ''}>
                    <p className="text-sm font-medium" style={{ color: n.lida ? '#9FBDC7' : '#EDF4F6' }}>{n.titulo}</p>
                    {n.texto && <p className="text-xs mt-0.5 line-clamp-2" style={{ color: '#7BAAB8' }}>{n.texto}</p>}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  ) : null

  return (
    <nav
      className="sticky top-0 z-50 border-b"
      style={{
        background: 'rgba(6,30,38,0.96)',
        backdropFilter: 'blur(12px)',
        borderColor: 'rgba(255,255,255,0.08)',
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">

          {/* Logo */}
          <button
            onClick={() => navigate('home')}
            className="flex-shrink-0 transition-opacity hover:opacity-90"
            aria-label="JOBTEC — Início"
          >
            <div
              className="flex items-center rounded-xl overflow-hidden px-1.5 py-1"
              style={{ background: '#fff' }}
            >
              <img
                src={jobtecLogo}
                alt="JOBTEC"
                style={{ height: 36, width: 'auto', objectFit: 'contain', display: 'block' }}
              />
            </div>
          </button>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-1">
            {navItems.map(item => (
              <button
                key={item.id}
                onClick={() => navigate(item.id)}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200"
                style={{
                  color: currentPage === item.id ? '#E8A020' : '#7BAAB8',
                  background: currentPage === item.id ? 'rgba(232,160,32,0.1)' : 'transparent',
                }}
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* Desktop CTA */}
          <div className="hidden md:flex items-center gap-3">
            {authUser ? (
              <>
                {sino}
                <span className="text-sm font-medium flex items-center gap-2" style={{ color: '#7BAAB8' }}>
                  {perfil?.foto_perfil ? (
                    <img src={perfil.foto_perfil} alt="" className="w-6 h-6 rounded-full object-cover"
                      style={{ background: '#1A4050' }} />
                  ) : (
                    <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                      style={{ background: 'rgba(232,160,32,0.2)', color: '#E8A020' }}>
                      {(authUser.nome || 'U').charAt(0).toUpperCase()}
                    </span>
                  )}
                  {authUser.nome}
                  {authUser.tipo === 'admin' && (
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md"
                      style={{ background: 'rgba(232,160,32,0.2)', color: '#E8A020' }}>
                      Admin
                    </span>
                  )}
                </span>
                <button
                  onClick={() => navigate('settings')}
                  className="px-4 py-2 rounded-lg text-sm font-medium border"
                  style={{ color: '#7BAAB8', borderColor: 'rgba(255,255,255,0.15)' }}
                  onMouseEnter={e => { e.currentTarget.style.color = '#E8A020'; e.currentTarget.style.borderColor = 'rgba(232,160,32,0.4)' }}
                  onMouseLeave={e => { e.currentTarget.style.color = '#7BAAB8'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)' }}
                >
                  Definições
                </button>
                <button
                  onClick={signOut}
                  className="px-4 py-2 rounded-lg text-sm font-medium border"
                  style={{ color: '#7BAAB8', borderColor: 'rgba(255,255,255,0.15)' }}
                  onMouseEnter={e => { e.currentTarget.style.color = '#F87171'; e.currentTarget.style.borderColor = 'rgba(248,113,113,0.4)' }}
                  onMouseLeave={e => { e.currentTarget.style.color = '#7BAAB8'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)' }}
                >
                  Sair
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => openAuth('login')}
                  className="px-4 py-2 text-sm font-medium transition-colors"
                  style={{ color: '#7BAAB8' }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#EDF4F6')}
                  onMouseLeave={e => (e.currentTarget.style.color = '#7BAAB8')}
                >
                  Entrar
                </button>
                <button
                  onClick={() => openAuth('signup-pro')}
                  className="px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200"
                  style={{ background: '#E8A020', color: '#fff' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#D08C10')}
                  onMouseLeave={e => (e.currentTarget.style.background = '#E8A020')}
                >
                  Cadastrar
                </button>
              </>
            )}
          </div>

          {/* Mobile menu button */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="md:hidden p-2 rounded-lg"
            style={{ color: '#7BAAB8' }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {menuOpen
                ? <path d="M18 6L6 18M6 6l12 12" />
                : <path d="M3 12h18M3 6h18M3 18h18" />
              }
            </svg>
          </button>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="md:hidden py-4 border-t space-y-1" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
            {navItems.map(item => (
              <button
                key={item.id}
                onClick={() => { navigate(item.id); setMenuOpen(false) }}
                className="w-full text-left px-4 py-3 rounded-lg text-sm font-medium transition-all"
                style={{
                  color: currentPage === item.id ? '#E8A020' : '#7BAAB8',
                  background: currentPage === item.id ? 'rgba(232,160,32,0.1)' : 'transparent',
                }}
              >
                {item.label}
              </button>
            ))}
            <div className="flex items-center gap-3 pt-3 px-4">
              {authUser ? (
                <>
                  {sino}
                  <button
                    onClick={() => { setMenuOpen(false) }}
                    className="flex-1 py-2 rounded-lg text-sm font-medium"
                    style={{ color: '#E8A020' }}
                  >
                    {authUser.nome}
                  </button>
                  <button
                    onClick={() => { navigate('settings'); setMenuOpen(false) }}
                    className="flex-1 py-2 rounded-lg text-sm font-medium border"
                    style={{ color: '#7BAAB8', borderColor: 'rgba(255,255,255,0.15)' }}
                  >
                    Definições
                  </button>
                  <button
                    onClick={() => { signOut(); setMenuOpen(false) }}
                    className="flex-1 py-2 rounded-lg text-sm font-semibold"
                    style={{ background: '#E8A020', color: '#fff' }}
                  >
                    Sair
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => { openAuth('login'); setMenuOpen(false) }}
                    className="flex-1 py-2 rounded-lg text-sm font-medium border"
                    style={{ color: '#7BAAB8', borderColor: 'rgba(255,255,255,0.15)' }}
                  >
                    Entrar
                  </button>
                  <button
                    onClick={() => { openAuth('signup-pro'); setMenuOpen(false) }}
                    className="flex-1 py-2 rounded-lg text-sm font-semibold"
                    style={{ background: '#E8A020', color: '#fff' }}
                  >
                    Cadastrar
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  )
}
