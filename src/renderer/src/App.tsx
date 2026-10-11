import { useEffect, useMemo, useState } from 'react'
import { CATEGORIES, PROFILES, TWEAKS, type Category } from '../../shared/catalog'
import type { ApplyReport, RestorePoint, SystemInfo, TweakStatus } from '../../shared/types'

type Page = 'ponto-restauracao' | 'painel' | 'otimizacoes' | 'xbox' | 'restaurar' | 'sobre'

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
        (tweak) =>
          tweak.category !== 'xbox' && (filter === 'todas' || tweak.category === filter)
      ),
    [filter]
  )

  function toggle(id: string) {
    setProfile('custom')
    setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]))
  }

  function pickProfile(id: string) {
    const p = PROFILES.find((x) => x.id === id)
    if (!p) return
    setProfile(id)
    setSelected(p.tweakIds)
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

  async function runRevert(ids?: string[]) {
    setBusy(true)
    try {
      const report = await window.picote.revert(ids)
      setLog(report.log.join('\n'))
      await refresh()
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
          <button className={page === 'xbox' ? 'active' : ''} onClick={() => setPage('xbox')}>
            Xbox
          </button>
          <button className={page === 'restaurar' ? 'active' : ''} onClick={() => setPage('restaurar')}>
            Restaurar
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
                  Grave um ponto do estado atual do sistema antes de mexer em energia, rede ou
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
              <div className="row">
                <button className="btn ghost" onClick={() => void refresh()} disabled={busy}>
                  Atualizar scan
                </button>
                <button className="btn primary" onClick={() => pickProfile('ranked')}>
                  Ir para Ranked
                </button>
              </div>
            </div>
            {!system.isAdmin && (
              <div className="banner">
                Abra o app como Administrador para aplicar energia, HAGS, rede e serviços. Tweaks
                de usuário (Game Mode, mouse, visuais) ainda funcionam.
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
                <button className="btn ghost" onClick={() => setSelected(visible.map((t) => t.id))}>
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
                {CATEGORIES.filter((c) => c.id !== 'xbox').map((c) => (
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
            <div className="log">{log}</div>
          </>
        )}

        {page === 'xbox' && (
          <>
            <div className="hero">
              <div>
                <h2>Xbox</h2>
                <p>
                  Ajustes do Game Mode, captura e serviços Xbox em um só lugar. Os serviços são
                  opcionais e podem afetar login, Game Pass, multiplayer ou sincronização de saves.
                </p>
              </div>
              <div className="row">
                <button
                  className="btn ghost"
                  onClick={() =>
                    setSelected((current) => [
                      ...new Set([...current, ...TWEAKS.filter((tweak) => tweak.category === 'xbox').map((tweak) => tweak.id)])
                    ])
                  }
                >
                  Marcar itens Xbox
                </button>
                <button
                  className="btn primary"
                  disabled={busy || !TWEAKS.some((tweak) => tweak.category === 'xbox' && selected.includes(tweak.id))}
                  onClick={() =>
                    void runApply(
                      TWEAKS.filter((tweak) => tweak.category === 'xbox' && selected.includes(tweak.id)).map(
                        (tweak) => tweak.id
                      )
                    )
                  }
                >
                  {busy ? 'Aplicando…' : 'Aplicar selecionados'}
                </button>
              </div>
            </div>
            <div className="banner">
              Desative serviços Xbox somente se não usa esses recursos. O Windows pode não oferecer
              ganho perceptível de FPS; cada serviço salva seu estado anterior para reversão.
            </div>
            <div className="list">
              {TWEAKS.filter((tweak) => tweak.category === 'xbox').map((tweak) => {
                const tweakStatus = status.find((item) => item.id === tweak.id)
                return (
                  <label key={tweak.id} className="tweak">
                    <input
                      type="checkbox"
                      checked={selected.includes(tweak.id)}
                      onChange={() => toggle(tweak.id)}
                    />
                    <div>
                      <h4>{tweak.title}</h4>
                      <p>{tweak.blurb}</p>
                      <div className="meta">
                        <span className={`pill ${tweak.risk}`}>{tweak.risk}</span>
                        {tweak.requiresAdmin && <span className="pill">admin</span>}
                      </div>
                      <p>{tweak.detail}</p>
                    </div>
                    <div className={tweakStatus?.applied ? 'status on' : 'status'}>
                      {tweakStatus?.applied ? 'ATIVA' : 'padrão'}
                      <br />
                      {tweakStatus?.current && tweakStatus.current !== 'MISSING'
                        ? tweakStatus.current
                        : '—'}
                    </div>
                  </label>
                )
              })}
            </div>
            <div className="log">{log}</div>
          </>
        )}

        {page === 'restaurar' && (
          <>
            <div className="hero">
              <div>
                <h2>Desfazer o boost</h2>
                <p>
                  Restaura valores salvos no snapshot local. Se nunca aplicou por aqui, volta a
                  padrões razoáveis do Windows.
                </p>
              </div>
              <button className="btn warn" disabled={busy} onClick={() => void runRevert()}>
                {busy ? 'Revertendo…' : 'Reverter tudo'}
              </button>
            </div>
            <div className="list">
              {TWEAKS.map((t) => {
                const st = status.find((s) => s.id === t.id)
                return (
                  <div key={t.id} className="tweak">
                    <div />
                    <div>
                      <h4>{t.title}</h4>
                      <p>{t.detail}</p>
                    </div>
                    <div>
                      <button
                        className="btn ghost"
                        disabled={busy}
                        onClick={() => void runRevert([t.id])}
                      >
                        Reverter
                      </button>
                      <div className={st?.applied ? 'status on' : 'status'}>
                        {st?.applied ? 'ATIVA' : 'padrão'}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="log">{log}</div>
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
              Power plan, Game Mode, HAGS, overlay Xbox, visuais, mouse raw, QoS multimídia,
              SysMain em SSD e o serviço opcional de telemetria. Ajustes Xbox ficam na aba Xbox.
              Tudo opt-in, com risco marcado.
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
