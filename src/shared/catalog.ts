export type Risk = 'seguro' | 'moderado' | 'avancado'
export type Category = 'energia' | 'grafico' | 'rede' | 'sistema' | 'entrada' | 'servicos'

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
  { id: 'rede', label: 'Rede' },
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
    id: 'game-mode',
    title: 'Game Mode do Windows',
    blurb: 'Prioriza o jogo e reduz tarefas em segundo plano.',
    detail: 'Liga Auto Game Mode nas chaves do Game Bar.',
    category: 'grafico',
    risk: 'seguro',
    requiresAdmin: false
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
    id: 'game-dvr',
    title: 'Desligar Xbox Game DVR / captura',
    blurb: 'Overlay e gravação em background comem FPS.',
    detail: 'Desativa AppCapture e GameDVR_Enabled no perfil do usuário.',
    category: 'grafico',
    risk: 'seguro',
    requiresAdmin: false
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
    id: 'network-throttle',
    title: 'Remover throttle de rede multimídia',
    blurb: 'Windows deixa de limitar pacotes em sessão “multimídia”.',
    detail: 'NetworkThrottlingIndex = 0xFFFFFFFF e SystemResponsiveness = 0.',
    category: 'rede',
    risk: 'moderado',
    requiresAdmin: true
  },
  {
    id: 'nagle',
    title: 'TcpNoDelay (desligar Nagle)',
    blurb: 'Pacotes pequenos saem na hora — útil em competitivos.',
    detail: 'TcpNoDelay e TcpAckFrequency = 1 nas interfaces IPv4. Pode piorar downloads.',
    category: 'rede',
    risk: 'avancado',
    requiresAdmin: true
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
    id: 'xbox-auth',
    title: 'Xbox Live Auth Manager',
    blurb: 'Se não usa Xbox Live/Game Pass; desativar pode interromper login e recursos sociais.',
    detail: 'Desativa XblAuthManager. Pode impedir autenticação Xbox, recursos sociais e alguns jogos do Game Pass.',
    category: 'servicos',
    risk: 'avancado',
    requiresAdmin: true
  },
  {
    id: 'xbox-game-save',
    title: 'Xbox Live Game Save',
    blurb: 'Se não usa Xbox cloud save; pode impedir sincronização de saves entre PCs.',
    detail: 'Desativa XblGameSave. Não use se depender de saves sincronizados pela Xbox network.',
    category: 'servicos',
    risk: 'avancado',
    requiresAdmin: true
  },
  {
    id: 'xbox-network',
    title: 'Xbox Live Networking Service',
    blurb: 'Se não usa Xbox Live; pode afetar multiplayer e convites em jogos Xbox.',
    detail: 'Desativa XboxNetApiSvc. Pode afetar partidas, convites e recursos online de jogos Xbox/Game Pass.',
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
      'game-mode',
      'game-dvr',
      'visual-fx',
      'transparency',
      'animations',
      'mouse-accel',
      'network-throttle'
    ]
  },
  {
    id: 'casual',
    title: 'Casual',
    tag: 'Equilíbrio',
    description: 'Ganho de desempenho sem mexer em rede avançada nem serviços.',
    tweakIds: [
      'ultimate-power',
      'game-mode',
      'game-dvr',
      'visual-fx',
      'transparency',
      'mouse-accel'
    ]
  },
  {
    id: 'stream',
    title: 'Stream',
    tag: 'Jogo + OBS',
    description: 'Power plan e GPU, mas mantém captura Xbox desligada e não mata SysMain.',
    tweakIds: [
      'ultimate-power',
      'usb-suspend',
      'game-mode',
      'hags',
      'mmcss-games',
      'visual-fx'
    ]
  },
  {
    id: 'max',
    title: 'Tudo no talo',
    tag: 'Avançado',
    description: 'Aplica o catálogo completo. Revise os itens avançados antes.',
    tweakIds: TWEAKS.map((t) => t.id)
  }
]
