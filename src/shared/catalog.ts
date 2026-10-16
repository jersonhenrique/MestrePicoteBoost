import { NETWORK_COMMANDS, type NetworkCommand } from './types'

export type Risk = 'seguro' | 'moderado' | 'avancado'
export type Category = 'energia' | 'grafico' | 'sistema' | 'entrada' | 'servicos'

export interface Tweak {
  id: string
  title: string
  blurb: string
  detail: string
  category: Category
  risk: Risk
  requiresAdmin: boolean
  rebootHint?: boolean
}

export const CATEGORIES: { id: Category; label: string }[] = [
  { id: 'energia', label: 'Energia' },
  { id: 'grafico', label: 'Gráfico' },
  { id: 'sistema', label: 'Sistema' },
  { id: 'entrada', label: 'Mouse / input' },
  { id: 'servicos', label: 'Serviços' }
]

export const TWEAKS: Tweak[] = [
  {
    id: 'ultimate-power',
    title: 'Plano Ultimate Performance',
    blurb: 'CPU e GPU param de economizar energia no meio da partida.',
    detail:
      'Duplica o plano Ultimate Performance do Windows e o ativa. Reversível: volta ao plano anterior.',
    category: 'energia',
    risk: 'seguro',
    requiresAdmin: true
  },
  {
    id: 'usb-suspend',
    title: 'Desligar suspensão seletiva USB',
    blurb: 'Evita micro-cortes em mouse, teclado e headset.',
    detail: 'Desativa USB selective suspend no plano de energia ativo.',
    category: 'energia',
    risk: 'seguro',
    requiresAdmin: true
  },
  {
    id: 'pcie-link',
    title: 'PCI Express em desempenho máximo',
    blurb: 'Impede o link da GPU de entrar em estado de baixa energia.',
    detail: 'Link State Power Management = Off no plano ativo.',
    category: 'energia',
    risk: 'seguro',
    requiresAdmin: true
  },
  {
    id: 'hags',
    title: 'Agendamento de GPU com aceleração de hardware',
    blurb: 'Reduz latência de envio de frames (HAGS).',
    detail: 'HwSchMode = 2. Pode exigir reinício. Nem toda GPU antiga se beneficia.',
    category: 'grafico',
    risk: 'moderado',
    requiresAdmin: true,
    rebootHint: true
  },
  {
    id: 'mmcss-games',
    title: 'Prioridade MMCSS para jogos',
    blurb: 'Agenda GPU/CPU com prioridade Alta no perfil Games.',
    detail:
      'Ajusta Scheduling Category e GPU Priority em Multimedia\\SystemProfile\\Tasks\\Games.',
    category: 'grafico',
    risk: 'moderado',
    requiresAdmin: true
  },
  {
    id: 'visual-fx',
    title: 'Efeitos visuais no desempenho',
    blurb: 'Menos animações da UI = mais CPU livre.',
    detail: 'VisualFXSetting = 2 (ajustar para melhor desempenho).',
    category: 'sistema',
    risk: 'seguro',
    requiresAdmin: false
  },
  {
    id: 'transparency',
    title: 'Desligar transparência do Windows',
    blurb: 'Acrylic/mica tem custo em GPU integrada.',
    detail: 'EnableTransparency = 0.',
    category: 'sistema',
    risk: 'seguro',
    requiresAdmin: false
  },
  {
    id: 'animations',
    title: 'Desligar animações de janela',
    blurb: 'Minimize/maximize instantâneo.',
    detail: 'MinAnimate = 0 em Desktop\\WindowMetrics.',
    category: 'sistema',
    risk: 'seguro',
    requiresAdmin: false
  },
  {
    id: 'background-apps',
    title: 'Limitar apps em segundo plano',
    blurb: 'Menos acordar de UWP enquanto você joga.',
    detail: 'GlobalUserDisabled = 1 em BackgroundAccessApplications.',
    category: 'sistema',
    risk: 'moderado',
    requiresAdmin: false
  },
  {
    id: 'mouse-accel',
    title: 'Desligar precisão do ponteiro',
    blurb: 'Aceleração do Windows destrói aim consistente.',
    detail: 'MouseSpeed / Thresholds = 0.',
    category: 'entrada',
    risk: 'seguro',
    requiresAdmin: false
  },
  {
    id: 'sysmain',
    title: 'SysMain (Superfetch) — SSD',
    blurb: 'Em SSD o pré-carregamento costuma só gerar I/O extra.',
    detail: 'Para o serviço SysMain. Em HDD antigo, deixe ligado.',
    category: 'servicos',
    risk: 'avancado',
    requiresAdmin: true
  },
  {
    id: 'telemetry',
    title: 'Telemetria do Windows (DiagTrack)',
    blurb: 'Desativa a coleta opcional de diagnóstico em segundo plano.',
    detail:
      'Para e desativa Connected User Experiences and Telemetry (DiagTrack). Não garante ganho de FPS e pode limitar diagnósticos do Windows. O estado anterior é salvo para reversão.',
    category: 'servicos',
    risk: 'avancado',
    requiresAdmin: true
  }
]

export const PROFILES: {
  id: string
  title: string
  tag: string
  description: string
  tweakIds: string[]
  networkCommandIds?: NetworkCommand[]
}[] = [
  {
    id: 'ranked',
    title: 'Ranked',
    tag: 'FPS e input',
    description: 'Latência e consistência. Ideal para competitivo.',
    tweakIds: [
      'ultimate-power',
      'usb-suspend',
      'pcie-link',
      'visual-fx',
      'transparency',
      'animations',
      'mouse-accel'
    ]
  },
  {
    id: 'casual',
    title: 'Casual',
    tag: 'Equilíbrio',
    description: 'Ganho de desempenho para uso diário, sem ajustes avançados.',
    tweakIds: [
      'ultimate-power',
      'visual-fx',
      'transparency',
      'mouse-accel'
    ]
  },
  {
    id: 'stream',
    title: 'Stream',
    tag: 'Jogo + OBS',
    description: 'Power plan e GPU, sem alterar serviços do sistema.',
    tweakIds: [
      'ultimate-power',
      'usb-suspend',
      'hags',
      'mmcss-games',
      'visual-fx'
    ]
  },
  {
    id: 'max',
    title: 'Tudo no talo',
    tag: 'Avançado',
    description: 'Seleciona todas as otimizações e ações de rede. Cada comando de rede exige confirmação individual.',
    tweakIds: TWEAKS.map((t) => t.id),
    networkCommandIds: [...NETWORK_COMMANDS]
  }
]
