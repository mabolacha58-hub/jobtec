import type { NavigateFn } from '../types'

interface HowItWorksProps {
  navigate: NavigateFn
}

export default function HowItWorks({ navigate }: HowItWorksProps) {
  return (
    <div className="min-h-screen" style={{ background: '#061E26' }}>
      {/* Hero */}
      <div className="py-16 px-4 text-center" style={{ background: 'linear-gradient(180deg, #0D2E38, #061E26)' }}>
        <div className="max-w-2xl mx-auto">
          <h1 className="font-serif text-4xl sm:text-5xl mb-4" style={{ color: '#EDF4F6' }}>
            Como a JOBTEC Funciona
          </h1>
          <p className="text-lg" style={{ color: '#7BAAB8' }}>
            Do cadastro à conclusão — simples, transparente e seguro
          </p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-12 space-y-16">
        {/* For clients */}
        <div>
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
              style={{ background: 'rgba(56,189,248,0.12)' }}>👤</div>
            <h2 className="font-serif text-3xl" style={{ color: '#EDF4F6' }}>Para Clientes e Empresas</h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { n: '01', icon: '🔍', title: 'Pesquise ou Publique', desc: 'Procure profissionais disponíveis ou publique o serviço que precisa com todos os detalhes.' },
              { n: '02', icon: '📊', title: 'Compare Perfis', desc: 'Analise o JOBTEC Score, portfólio, avaliações anteriores e taxa horária de cada profissional.' },
              { n: '03', icon: '💬', title: 'Solicite Orçamento', desc: 'Envie uma proposta detalhada. Negoceie prazos e valores directamente com o profissional.' },
              { n: '04', icon: '⭐', title: 'Contrate e Avalie', desc: 'Confirme a contratação, acompanhe o progresso e avalie no final para ajudar a comunidade.' },
            ].map(step => (
              <div key={step.n} className="p-5 rounded-2xl" style={{ background: '#0D2E38', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-2xl">{step.icon}</span>
                  <span className="text-xs font-bold" style={{ color: '#38BDF8' }}>{step.n}</span>
                </div>
                <h3 className="font-semibold text-sm mb-2" style={{ color: '#EDF4F6' }}>{step.title}</h3>
                <p className="text-xs leading-relaxed" style={{ color: '#7BAAB8' }}>{step.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* For professionals */}
        <div>
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
              style={{ background: 'rgba(232,160,32,0.12)' }}>💼</div>
            <h2 className="font-serif text-3xl" style={{ color: '#EDF4F6' }}>Para Profissionais</h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { n: '01', icon: '📝', title: 'Crie o seu Perfil', desc: 'Cadastre as suas competências, experiência, portfólio e defina a sua taxa horária.' },
              { n: '02', icon: '🎯', title: 'Receba Matches', desc: 'O JOBTEC Match sugere-lhe oportunidades compatíveis com o seu perfil e localização.' },
              { n: '03', icon: '💰', title: 'Apresente Proposta', desc: 'Envie orçamentos detalhados, negoceie condições e feche os melhores contratos.' },
              { n: '04', icon: '📈', title: 'Cresça na Plataforma', desc: 'Cada trabalho concluído melhora o seu JOBTEC Score e aumenta a sua visibilidade.' },
            ].map(step => (
              <div key={step.n} className="p-5 rounded-2xl" style={{ background: '#0D2E38', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-2xl">{step.icon}</span>
                  <span className="text-xs font-bold" style={{ color: '#E8A020' }}>{step.n}</span>
                </div>
                <h3 className="font-semibold text-sm mb-2" style={{ color: '#EDF4F6' }}>{step.title}</h3>
                <p className="text-xs leading-relaxed" style={{ color: '#7BAAB8' }}>{step.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Features */}
        <div className="grid md:grid-cols-3 gap-6">
          {[
            {
              icon: '🪪', title: 'JOBTEC Skill Card', color: '#E8A020',
              desc: 'Carteira digital de competências verificadas. O seu currículo profissional numa só plataforma, acessível a qualquer cliente.',
            },
            {
              icon: '⭐', title: 'JOBTEC Score', color: '#34D399',
              desc: 'Sistema de reputação transparente. Calculado com base em avaliações, pontualidade, qualidade e histórico de trabalhos.',
            },
            {
              icon: '🎯', title: 'JOBTEC Match', color: '#38BDF8',
              desc: 'Algoritmo inteligente que considera competência, localização, disponibilidade e Score para sugerir o profissional ideal.',
            },
          ].map(f => (
            <div key={f.title} className="p-6 rounded-2xl text-center" style={{ background: '#0D2E38', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="text-4xl mb-4">{f.icon}</div>
              <h3 className="font-serif text-xl mb-3" style={{ color: '#EDF4F6' }}>{f.title}</h3>
              <p className="text-sm leading-relaxed" style={{ color: '#7BAAB8' }}>{f.desc}</p>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="text-center py-8">
          <h2 className="font-serif text-3xl mb-4" style={{ color: '#EDF4F6' }}>Pronto para começar?</h2>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => navigate('explore')}
              className="px-8 py-3 rounded-xl font-semibold transition-all"
              style={{ background: '#E8A020', color: '#fff' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#D08C10')}
              onMouseLeave={e => (e.currentTarget.style.background = '#E8A020')}
            >
              Explorar Profissionais
            </button>
            <button
              onClick={() => navigate('post')}
              className="px-8 py-3 rounded-xl font-semibold transition-all"
              style={{ background: 'rgba(255,255,255,0.06)', color: '#EDF4F6', border: '1px solid rgba(255,255,255,0.12)' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.1)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
            >
              Publicar Serviço
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
