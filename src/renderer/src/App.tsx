import { useEffect, useMemo, useState } from 'react'
import { CATEGORIES, PROFILES, TWEAKS, type Category } from '../../shared/catalog'
import {
  type ApplyReport,
  type NetworkCommand,
  type RestorePoint,
  type SystemInfo,
  type TweakStatus
} from '../../shared/types'

type Page = 'ponto-restauracao' | 'painel' | 'otimizacoes' | 'rede' | 'sobre'

const NETWORK_ACTIONS: {
  id: NetworkCommand
  title: string
  command: string
  description: string
  buttonLabel: string
}[] = [
  {
    id: 'renew-ip',
    title: 'Renovar endereço IP',
    command: 'ipconfig /renew',
    description: 'Solicita ao servidor DHCP a renovação do endereço IP. A conexão pode oscilar durante a renovação.',
    buttonLabel: 'Renovar IP'
  },
  {
    id: 'flush-dns',
    title: 'Limpar cache DNS',
    command: 'ipconfig /flushdns',
    description: 'Limpa o cache local de resolução DNS do Windows.',
    buttonLabel: 'Limpar cache DNS'
  },
  {
    id: 'reset-winsock',
    title: 'Redefinir Winsock',
    command: 'netsh winsock reset',
    description: 'Redefine o catálogo Winsock, o que pode ajudar a corrigir problemas de conectividade Wi-Fi ou Ethernet. É necessário reiniciar o computador.',
    buttonLabel: 'Redefinir Winsock'
  }
]

function mockSystem(): SystemInfo {
  return {
    computer: 'Este PC',
    os: 'Windows',
    cpu: 'Aguardando leitura…',
    cores: 0,
    threads: 0,
    gpu: 'Aguardando leitura…',
    ramGB: 0,
    ramFreeGB: 0,
    disks: [],
    isAdmin: false
  }
}

export default function App() {
  const [page, setPage] = useState<Page>('ponto-restauracao')
  const [system, setSystem] = useState<SystemInfo>(mockSystem)
  const [status, setStatus] = useState<TweakStatus[]>([])
  const [selected, setSelected] = useState<string[]>(PROFILES[0].tweakIds)
  const [selectedNetworkCommands, setSelectedNetworkCommands] = useState<NetworkCommand[]>(
    PROFILES[0].networkCommandIds ?? []
  )
  const [profile, setProfile] = useState('ranked')
  const [filter, setFilter] = useState<Category | 'todas'>('todas')
  const [restoreLabel, setRestoreLabel] = useState('')
  const [restorePoints, setRestorePoints] = useState<RestorePoint[]>([])
  const [busy, setBusy] = useState(false)
  const [log, setLog] = useState('Pronto. Escolha um perfil e aplique.')
  const [error, setError] = useState('')

  async function refresh() {
    try {
      if (!window.picote) {
        setError('API do Electron não encontrada. Rode com npm run dev.')
        return
      }
      const [info, st] = await Promise.all([window.picote.getSystem(), window.picote.getStatus()])
      setSystem(info)
      setStatus(st)
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  async function refreshRestorePoints() {
    try {
      if (!window.picote) return
      const points = await window.picote.listRestorePoints()
      setRestorePoints(points)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  useEffect(() => {
    void refresh()
    void refreshRestorePoints()
  }, [])

  const appliedCount = status.filter((s) => s.applied).length
  const score = Math.round((appliedCount / TWEAKS.length) * 100)

  const visible = useMemo(
    () =>
      TWEAKS.filter(
        (tweak) => filter === 'todas' || tweak.category === filter
      ),
    [filter]
  )

  function toggle(id: string) {
    setProfile('custom')
    setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]))
  }

  function toggleNetworkCommand(id: NetworkCommand) {
    setProfile('custom')
    setSelectedNetworkCommands((current) =>
      current.includes(id) ? current.filter((command) => command !== id) : [...current, id]
    )
  }

  function pickProfile(id: string) {
    const p = PROFILES.find((x) => x.id === id)
    if (!p) return
    setProfile(id)
    setSelected(p.tweakIds)
    setSelectedNetworkCommands(p.networkCommandIds ?? [])
    setPage('otimizacoes')
  }

  async function runApply(ids = selected) {
    setBusy(true)
    try {
      const report: ApplyReport = await window.picote.apply(ids)
      setLog(report.log.join('\n'))
      await refresh()
    } catch (err) {
      setLog(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  async function runNetworkAction(command: NetworkCommand) {
    const confirmationMessages: Record<NetworkCommand, string> = {
      'renew-ip': 'Renovar o endereço IP pode interromper temporariamente a conexão. Deseja continuar?',
      'flush-dns': 'Limpar o cache DNS remove as resoluções locais armazenadas. Deseja continuar?',
      'reset-winsock': 'A redefinição do Winsock pode interromper conexões e exige reiniciar o computador. Deseja continuar?'
    }
    if (!window.confirm(confirmationMessages[command])) {
      return
    }

    setBusy(true)
    setLog(`Executando ${NETWORK_ACTIONS.find((action) => action.id === command)?.command ?? command}…`)
    try {
      setLog(await window.picote.runNetworkCommand(command))
    } catch (err) {
      setLog(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  async function createRestorePoint() {
    setBusy(true)
    try {
      const point = await window.picote.createRestorePoint(restoreLabel.trim() || undefined)
      setLog(`Ponto de restauração criado: ${point.name}\n${point.description}`)
      setRestoreLabel('')
      await refreshRestorePoints()
    } catch (err) {
      setLog(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  async function restorePointById(id: string) {
    setBusy(true)
    try {
      const report = await window.picote.restoreFromPoint(id)
      setLog(report.log.join('\n'))
      await refresh()
      await refreshRestorePoints()
    } catch (err) {
      setLog(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="app">
      <aside className="side">
        <div className="brand">
          <div className="mark">MP</div>
          <div>
            <h1>MestrePicote</h1>
            <p>Boost para PC gamer</p>
          </div>
        </div>
        <nav className="nav">
          <button
            className={page === 'ponto-restauracao' ? 'active' : ''}
            onClick={() => setPage('ponto-restauracao')}
          >
            Ponto de restauração
          </button>
          <button className={page === 'painel' ? 'active' : ''} onClick={() => setPage('painel')}>
            Painel
          </button>
          <button
            className={page === 'otimizacoes' ? 'active' : ''}
            onClick={() => setPage('otimizacoes')}
          >
            Otimizações
          </button>
          <button className={page === 'rede' ? 'active' : ''} onClick={() => setPage('rede')}>
            Rede
          </button>
          <button className={page === 'sobre' ? 'active' : ''} onClick={() => setPage('sobre')}>
            Sobre
          </button>
        </nav>
        <div className="side-foot">
          {system.computer} · {system.isAdmin ? 'Administrador' : 'Sem elevação'}
          <br />
          Snapshot local para reverter. Não desliga Defender nem firewall.
        </div>
      </aside>

      <main className="main">
        {error && <div className="banner">{error}</div>}
        {page === 'ponto-restauracao' && (
          <>
            <div className="hero">
              <div>
                <h2>Ponto de restauração</h2>
                <p>
                  Grave um ponto do estado atual do sistema antes de mexer em energia ou
                  serviços. A partir dele você pode restaurar rapidamente o que foi alterado.
                </p>
              </div>
              <button className="btn primary" disabled={busy} onClick={() => void createRestorePoint()}>
                {busy ? 'Criando…' : 'Criar ponto'}
              </button>
            </div>
            <div className="restore-form">
              <label htmlFor="restore-label">Descrição do ponto</label>
              <input
                id="restore-label"
                value={restoreLabel}
                onChange={(event) => setRestoreLabel(event.target.value)}
                placeholder="Ex.: antes do perfil Ranked"
              />
            </div>
            <div className="list">
              {restorePoints.length === 0 ? (
                <div className="empty-state">Nenhum ponto de restauração criado ainda.</div>
              ) : (
                restorePoints.map((point) => (
                  <div key={point.id} className="restore-card">
                    <div>
                      <h4>{point.name}</h4>
                      <p>{point.description}</p>
                      <div className="meta">
                        <span className="pill">{point.tweakCount} ajustes</span>
                        <span className="pill">{new Date(point.createdAt).toLocaleString('pt-BR')}</span>
                      </div>
                    </div>
                    <button className="btn ghost" onClick={() => void restorePointById(point.id)}>
                      Restaurar este ponto
                    </button>
                  </div>
                ))
              )}
            </div>
            <div className="log">{log}</div>
          </>
        )}

        {page === 'painel' && (
          <>
            <div className="hero">
              <div>
                <h2>Seu rig, no modo partida.</h2>
                <p>
                  Scan do hardware, perfil de jogo e tweaks reversíveis. Nada de “otimizador”
                  que some com antivírus.
                </p>
              </div>
            </div>
            {!system.isAdmin && (
              <div className="banner">
                Abra o app como Administrador para aplicar energia, HAGS e serviços. Tweaks
                de usuário (mouse e visuais) ainda funcionam.
              </div>
            )}
            <section className="cards">
              <article className="card score">
                <div className="k">Score Picote</div>
                <div className="big">{score}</div>
                <div className="v">
                  {appliedCount}/{TWEAKS.length} otimizações ativas
                </div>
              </article>
              <article className="card">
                <div className="k">CPU</div>
                <div className="v">
                  {system.cpu}
                  <br />
                  {system.cores}c / {system.threads}t
                </div>
              </article>
              <article className="card">
                <div className="k">GPU</div>
                <div className="v">{system.gpu}</div>
              </article>
              <article className="card">
                <div className="k">Memória / disco</div>
                <div className="v">
                  {system.ramFreeGB} GB livres de {system.ramGB} GB
                  <br />
                  {system.disks.map((d) => `${d.name} ${d.freeGB}/${d.totalGB} GB`).join(' · ') ||
                    '—'}
                </div>
              </article>
            </section>
            <h3>Perfis</h3>
            <div className="profiles">
              {PROFILES.map((p) => (
                <button
                  key={p.id}
                  className={profile === p.id ? 'profile on' : 'profile'}
                  onClick={() => pickProfile(p.id)}
                >
                  <div className="tag">{p.tag}</div>
                  <h3>{p.title}</h3>
                  <p>{p.description}</p>
                  <div className="meta">
                    <span className="pill">{p.tweakIds.length} otimizações</span>
                    {(p.networkCommandIds?.length ?? 0) > 0 && (
                      <span className="pill">{p.networkCommandIds?.length} ações de rede</span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </>
        )}

        {page === 'otimizacoes' && (
          <>
            <div className="hero">
              <div>
                <h2>Catálogo de tweaks</h2>
                <p>Marque, aplique, meça. Cada item guarda o valor anterior para desfazer.</p>
              </div>
              <div className="row">
                <button
                  className="btn ghost"
                  onClick={() => {
                    setProfile('custom')
                    setSelected((current) => [...new Set([...current, ...visible.map((t) => t.id)])])
                  }}
                >
                  Marcar visíveis
                </button>
                <button className="btn primary" disabled={busy || selected.length === 0} onClick={() => void runApply()}>
                  {busy ? 'Aplicando…' : `Aplicar ${selected.length}`}
                </button>
              </div>
            </div>
            <div className="toolbar">
              <div className="filters">
                <button
                  className={filter === 'todas' ? 'chip on' : 'chip'}
                  onClick={() => setFilter('todas')}
                >
                  Todas
                </button>
                {CATEGORIES.map((c) => (
                  <button
                    key={c.id}
                    className={filter === c.id ? 'chip on' : 'chip'}
                    onClick={() => setFilter(c.id)}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
              <span style={{ color: 'var(--mute)', fontSize: 12 }}>
                Perfil: {profile === 'custom' ? 'customizado' : profile}
              </span>
            </div>
            <div className="list">
              {visible.map((t) => {
                const st = status.find((s) => s.id === t.id)
                const on = selected.includes(t.id)
                return (
                  <label key={t.id} className="tweak">
                    <input type="checkbox" checked={on} onChange={() => toggle(t.id)} />
                    <div>
                      <h4>{t.title}</h4>
                      <p>{t.blurb}</p>
                      <div className="meta">
                        <span className={`pill ${t.risk}`}>{t.risk}</span>
                        {t.requiresAdmin && <span className="pill">admin</span>}
                        {t.rebootHint && <span className="pill">reinício</span>}
                        <span className="pill">{CATEGORIES.find((c) => c.id === t.category)?.label}</span>
                      </div>
                    </div>
                    <div className={st?.applied ? 'status on' : 'status'}>
                      {st?.applied ? 'ATIVA' : 'padrão'}
                      <br />
                      {st?.current && st.current !== 'MISSING' ? st.current : '—'}
                    </div>
                  </label>
                )
              })}
            </div>
            <section aria-labelledby="profile-network-heading">
              <h3 id="profile-network-heading">
                Opções de rede no perfil ({selectedNetworkCommands.length}/{NETWORK_ACTIONS.length})
              </h3>
              <p style={{ color: 'var(--mute)' }}>
                “Tudo no talo” seleciona todas. Os comandos não são executados pelo botão de aplicar
                otimizações; cada um exige confirmação individual.
              </p>
              <div className="list">
                {NETWORK_ACTIONS.map((action) => {
                  const isSelected = selectedNetworkCommands.includes(action.id)
                  return (
                    <article className="tweak network-profile-option" key={action.id}>
                      <input
                        type="checkbox"
                        aria-label={`Incluir ${action.title} no perfil`}
                        checked={isSelected}
                        onChange={() => toggleNetworkCommand(action.id)}
                      />
                      <div>
                        <h4>{action.title}</h4>
                        <p>{action.description}</p>
                        <code>{action.command}</code>
                      </div>
                      <button
                        className={action.id === 'reset-winsock' ? 'btn warn' : 'btn primary'}
                        disabled={busy || !system.isAdmin || !isSelected}
                        onClick={() => void runNetworkAction(action.id)}
                      >
                        {busy ? 'Executando…' : action.buttonLabel}
                      </button>
                    </article>
                  )
                })}
              </div>
            </section>
            <div className="log">{log}</div>
          </>
        )}

        {page === 'rede' && (
          <>
            <div className="hero">
              <div>
                <h2>Rede</h2>
                <p>Execute ações de diagnóstico e correção de rede somente quando necessário.</p>
              </div>
            </div>
            {!system.isAdmin && (
              <div className="banner">
                Abra o MestrePicoteBoost como Administrador para executar estes comandos.
              </div>
            )}
            <div className="list">
              {NETWORK_ACTIONS.map((action) => (
                <article className="tweak" key={action.id}>
                  <div aria-hidden="true" />
                  <div>
                    <h4>{action.title}</h4>
                    <p>{action.description}</p>
                    <code>{action.command}</code>
                  </div>
                  <button
                    className={action.id === 'reset-winsock' ? 'btn warn' : 'btn primary'}
                    disabled={busy || !system.isAdmin}
                    onClick={() => void runNetworkAction(action.id)}
                  >
                    {busy ? 'Executando…' : action.buttonLabel}
                  </button>
                </article>
              ))}
            </div>
            <div className="log" role="status" aria-live="polite">{log}</div>
          </>
        )}

        {page === 'sobre' && (
          <div className="about">
            <h2>Arquitetura</h2>
            <p>
              Desktop Windows com Electron. A UI (renderer) só escolhe tweaks. O processo principal
              executa PowerShell, lê hardware via CIM e grava um snapshot em AppData para
              rollback.
            </p>
            <h3>O que este app faz de propósito</h3>
            <p>
              Power plan, HAGS, visuais, mouse raw, SysMain em SSD e o serviço opcional de
              telemetria. Tudo opt-in, com risco marcado.
            </p>
            <h3>O que ele recusa</h3>
            <p>
              Não desliga Windows Defender, UAC, firewall, SmartScreen. Não mexe em BCDEdit
              (HPET, dynamic tick) — risco de boot. Não instala “cleaner” de registro.
            </p>
            <p>
              Sistema: {system.os}
              <br />
              {system.cpu} · {system.gpu}
            </p>
          </div>
        )}
      </main>
    </div>
  )
}
