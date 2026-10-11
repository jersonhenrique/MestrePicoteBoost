import { useEffect, useMemo, useState } from 'react'
import { CATEGORIES, PROFILES, TWEAKS, type Category } from '../../shared/catalog'
import type { ApplyReport, SystemInfo, TweakStatus } from '../../shared/types'

type Page = 'painel' | 'otimizacoes' | 'restaurar' | 'sobre'

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
  const [page, setPage] = useState<Page>('painel')
  const [system, setSystem] = useState<SystemInfo>(mockSystem)
  const [status, setStatus] = useState<TweakStatus[]>([])
  const [selected, setSelected] = useState<string[]>(PROFILES[0].tweakIds)
  const [profile, setProfile] = useState('ranked')
  const [filter, setFilter] = useState<Category | 'todas'>('todas')
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

  useEffect(() => {
    void refresh()
  }, [])

  const appliedCount = status.filter((s) => s.applied).length
  const score = Math.round((appliedCount / TWEAKS.length) * 100)

  const visible = useMemo(
    () => TWEAKS.filter((t) => filter === 'todas' || t.category === filter),
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

  async function runApply() {
    setBusy(true)
    try {
      const report: ApplyReport = await window.picote.apply(selected)
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
          <button className={page === 'painel' ? 'active' : ''} onClick={() => setPage('painel')}>
            Painel
          </button>
          <button
            className={page === 'otimizacoes' ? 'active' : ''}
            onClick={() => setPage('otimizacoes')}
          >
            Otimizações
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
            {error && <div className="banner">{error}</div>}
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
              Power plan, Game Mode, HAGS, overlay Xbox, visuais, mouse raw, QoS multimídia e
              SysMain em SSD. Tudo opt-in, com risco marcado.
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
