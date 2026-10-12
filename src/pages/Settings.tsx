import { useEffect, useRef, useState } from 'react'
import { useStore } from '../context/store'
import type { NavigateFn } from '../types'

interface SettingsProps {
  navigate: NavigateFn
}

const PROVINCES = ['Nampula', 'Cabo Delgado', 'Niassa', 'Zambézia', 'Manica', 'Sofala', 'Maputo', 'Outra província']
const LADO = 400
const QUALIDADE = 0.82
const TAMANHO_MAX_ENTRADA = 12 * 1024 * 1024

const inputStyle = {
  background: 'rgba(6,30,38,0.8)',
  border: '1px solid rgba(255,255,255,0.1)',
  color: '#EDF4F6',
} as const

const campoClass = 'w-full px-3 py-2.5 rounded-lg text-sm outline-none'

function lerComoDataUri(ficheiro: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader()
    fr.onerror = () => reject(new Error('Não foi possível ler o ficheiro.'))
    fr.onload = () => resolve(String(fr.result))
    fr.readAsDataURL(ficheiro)
  })
}

function carregarImagem(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('O ficheiro não é uma imagem válida.'))
    img.src = src
  })
}

// Recorte central a um quadrado e recompressão. Sem isto, uma selfie de 4 MB
// seguiria inteira para a base de dados dentro de um data URI; cortada a 400x400
// e recomprimida fica com algumas dezenas de KB, que é o que um avatar precisa.
async function prepararAvatar(ficheiro: File): Promise<string> {
  if (!/^image\/(jpeg|png|webp)$/.test(ficheiro.type)) {
    throw new Error('Use uma fotografia JPEG, PNG ou WebP.')
  }
  if (ficheiro.size > TAMANHO_MAX_ENTRADA) {
    throw new Error('A fotografia é demasiado grande (máx. 12 MB).')
  }
  const img = await carregarImagem(await lerComoDataUri(ficheiro))
  const lado = Math.min(img.naturalWidth, img.naturalHeight)
  if (lado < 64) throw new Error('A fotografia é demasiado pequena.')
  const canvas = document.createElement('canvas')
  canvas.width = LADO
  canvas.height = LADO
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Este navegador não permite recortar a imagem.')
  ctx.drawImage(
    img,
    (img.naturalWidth - lado) / 2, (img.naturalHeight - lado) / 2, lado, lado,
    0, 0, LADO, LADO,
  )
  return canvas.toDataURL('image/jpeg', QUALIDADE)
}

export default function Settings({ navigate }: SettingsProps) {
  const { authUser, perfil, updateProfile, signOut } = useStore()
  const [form, setForm] = useState({ nome: '', telefone: '', provincia: '', cidade: '' })
  const [avatar, setAvatar] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [ok, setOk] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const [aPreparar, setAPreparar] = useState(false)
  const inputFoto = useRef<HTMLInputElement>(null)

  // `perfil` só fica pronto depois do primeiro fetch. O guarda evita sobrescrever
  // o que o utilizador já escreveu se um refresh a meio arrives atrasado.
  const [carregado, setCarregado] = useState(false)
  useEffect(() => {
    if (!perfil || carregado) return
    setForm({ nome: perfil.nome, telefone: perfil.telefone, provincia: perfil.provincia, cidade: perfil.cidade })
    setAvatar(perfil.foto_perfil || '')
    setCarregado(true)
  }, [perfil, carregado])

  const update = (k: keyof typeof form, v: string) => {
    setForm(prev => ({ ...prev, [k]: v }))
    setOk(false)
  }

  const escolherFicheiro = async (ficheiro: File | undefined) => {
    if (!ficheiro) return
    setErro(null)
    setOk(false)
    setAPreparar(true)
    try {
      setAvatar(await prepararAvatar(ficheiro))
    } catch (e) {
      setErro((e as Error).message)
    } finally {
      setAPreparar(false)
      // Limpar o valor deixa escolher outra vez o mesmo ficheiro, que o browser
      // não emite quando o input não muda de valor.
      if (inputFoto.current) inputFoto.current.value = ''
    }
  }

  const submeter = async () => {
    if (ocupado) return
    if (form.nome.trim().length < 2) { setErro('Escreva o seu nome.'); return }
    setOcupado(true)
    setErro(null)
    setOk(false)
    try {
      await updateProfile({
        nome: form.nome.trim(),
        telefone: form.telefone.trim(),
        provincia: form.provincia,
        cidade: form.cidade.trim(),
        foto_perfil: avatar || null,
      })
      setOk(true)
    } catch (e) {
      setErro((e as Error)?.message || 'Não foi possível guardar as alterações.')
    } finally {
      setOcupado(false)
    }
  }

  const removerFoto = () => { setAvatar(''); setOk(false); setErro(null) }

  if (!authUser) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: '#061E26' }}>
        <div className="text-center">
          <p className="mb-4" style={{ color: '#7BAAB8' }}>Precisa de entrar na sua conta para ver as definições.</p>
          <button onClick={() => navigate('home')}
            className="px-5 py-2.5 rounded-lg text-sm font-medium"
            style={{ background: '#E8A020', color: '#fff' }}>
            Voltar ao início
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen py-10 px-4" style={{ background: '#061E26' }}>
      <div className="max-w-2xl mx-auto">
        <button onClick={() => navigate('home')}
          className="flex items-center gap-1.5 text-sm mb-4 transition-colors"
          style={{ color: '#7BAAB8' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="m15 18-6-6 6-6" />
          </svg>
          Voltar
        </button>

        <h1 className="font-serif text-3xl sm:text-4xl mb-2" style={{ color: '#EDF4F6' }}>Definições da conta</h1>
        <p className="text-sm mb-8" style={{ color: '#7BAAB8' }}>
          {authUser.email} · a fotografia aparece nos seus cartões e avaliações.
        </p>

        <div className="space-y-5 rounded-2xl p-6" style={{ background: '#0D2E38', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div>
            <h2 className="font-semibold text-lg mb-4" style={{ color: '#EDF4F6' }}>Fotografia</h2>
            <div className="flex items-center gap-5">
              <div className="relative shrink-0">
                {avatar ? (
                  <img src={avatar} alt="A sua fotografia"
                    className="w-24 h-24 rounded-2xl object-cover"
                    style={{ background: '#1A4050', border: '1px solid rgba(255,255,255,0.1)' }} />
                ) : (
                  <div className="w-24 h-24 rounded-2xl flex items-center justify-center"
                    style={{ background: '#1A4050', border: '1px solid rgba(255,255,255,0.1)' }}>
                    <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#7BAAB8" strokeWidth="1.5">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                  </div>
                )}
                {aPreparar && (
                  <div className="absolute inset-0 rounded-2xl flex items-center justify-center text-xs"
                    style={{ background: 'rgba(6,30,38,0.75)', color: '#EDF4F6' }}>
                    A processar…
                  </div>
                )}
              </div>

              <div className="flex-1">
                <input ref={inputFoto} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
                  onChange={e => void escolherFicheiro(e.target.files?.[0])} />
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => inputFoto.current?.click()} disabled={aPreparar || ocupado}
                    className="px-4 py-2.5 rounded-lg text-sm font-medium disabled:opacity-50"
                    style={{ background: '#E8A020', color: '#fff' }}>
                    {avatar ? 'Trocar fotografia' : 'Carregar fotografia'}
                  </button>
                  {avatar && (
                    <button type="button" onClick={removerFoto} disabled={ocupado}
                      className="px-4 py-2.5 rounded-lg text-sm disabled:opacity-50"
                      style={{ background: 'rgba(255,255,255,0.06)', color: '#EDF4F6', border: '1px solid rgba(255,255,255,0.1)' }}>
                      Remover
                    </button>
                  )}
                </div>
                <p className="text-xs mt-2" style={{ color: '#7BAAB8' }}>
                  JPEG, PNG ou WebP. A imagem é recortada e reduzida no seu navegador
                  antes de ser guardada, por isso não espera um upload lento.
                </p>
              </div>
            </div>
          </div>

          <div>
            <h2 className="font-semibold text-lg mb-4" style={{ color: '#EDF4F6' }}>Dados pessoais</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: '#7BAAB8' }}>Nome completo</label>
                <input type="text" value={form.nome} onChange={e => update('nome', e.target.value)}
                  placeholder="O seu nome" className={campoClass} style={inputStyle} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: '#7BAAB8' }}>Telefone</label>
                <input type="tel" value={form.telefone} onChange={e => update('telefone', e.target.value)}
                  placeholder="84 000 0000" className={campoClass} style={inputStyle} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: '#7BAAB8' }}>Província</label>
                  <select value={form.provincia} onChange={e => update('provincia', e.target.value)}
                    className={campoClass} style={inputStyle}>
                    <option value="">Escolher</option>
                    {PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: '#7BAAB8' }}>Cidade</label>
                  <input type="text" value={form.cidade} onChange={e => update('cidade', e.target.value)}
                    placeholder="Nampula" className={campoClass} style={inputStyle} />
                </div>
              </div>
            </div>
          </div>

          {erro && (
            <p className="text-sm px-3 py-2.5 rounded-lg"
              style={{ background: 'rgba(239,68,68,0.12)', color: '#FCA5A5', border: '1px solid rgba(239,68,68,0.25)' }}>
              {erro}
            </p>
          )}
          {ok && (
            <p className="text-sm px-3 py-2.5 rounded-lg"
              style={{ background: 'rgba(52,211,153,0.12)', color: '#34D399', border: '1px solid rgba(52,211,153,0.25)' }}>
              Alterações guardadas.
            </p>
          )}

          <button type="button" onClick={() => void submeter()} disabled={ocupado || aPreparar}
            className="w-full py-3 rounded-lg text-sm font-semibold disabled:opacity-50"
            style={{ background: '#E8A020', color: '#fff' }}>
            {ocupado ? 'A guardar…' : 'Guardar alterações'}
          </button>
        </div>

        <div className="mt-6 rounded-2xl p-6" style={{ background: '#0D2E38', border: '1px solid rgba(255,255,255,0.06)' }}>
          <h2 className="font-semibold text-lg mb-2" style={{ color: '#EDF4F6' }}>Sessão</h2>
          <p className="text-sm mb-4" style={{ color: '#7BAAB8' }}>Terminar a sessão neste dispositivo.</p>
          <button type="button" onClick={signOut}
            className="px-4 py-2.5 rounded-lg text-sm"
            style={{ background: 'rgba(255,255,255,0.06)', color: '#EDF4F6', border: '1px solid rgba(255,255,255,0.1)' }}>
            Terminar sessão
          </button>
        </div>
      </div>
    </div>
  )
}
