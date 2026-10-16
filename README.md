# MestrePicoteBoost

App desktop para **criar e aplicar otimizações de PC gamer** no Windows — com scan de hardware, perfis (Ranked, Casual, Stream, Tudo no talo) e **rollback**.

## Arquitetura

```
renderer (React)  →  preload (contextBridge)  →  main (Electron)
                                                 ├─ scan CIM (CPU/GPU/RAM/disco)
                                                 ├─ catálogo de tweaks
                                                 └─ PowerShell + snapshot em AppData
```

- A UI nunca fala com o registro direto.
- Cada apply guarda o valor anterior em `%APPDATA%/mestre-picote-boost/picote-snapshot.json`.
- Tweaks de energia/serviços pedem **Executar como administrador**.

## O que entra no catálogo

| Área | Exemplos |
| --- | --- |
| Energia | Ultimate Performance, USB selective suspend, PCIe ASPM |
| Gráfico | HAGS, MMCSS Games |
| Sistema | efeitos visuais, transparência, animações, apps em background |
| Input | precisão do ponteiro off |
| Serviços | SysMain em SSD; telemetria Windows opcional |

## Ações de rede

A aba **Rede** disponibiliza ações manuais, executadas somente após clicar no botão:

- `ipconfig /renew`: solicita a renovação do endereço IP via DHCP.
- `ipconfig /flushdns`: limpa o cache local de DNS.
- `netsh winsock reset`: redefine o catálogo Winsock; pode ajudar com problemas de conectividade
  Wi-Fi ou Ethernet e exige reiniciar o computador.

Execute o app como Administrador. A renovação do IP ou a redefinição do Winsock pode interromper
temporariamente a conexão.

Fora de escopo de propósito: Defender, firewall, UAC, BCDEdit, “limpa registro”.

A leitura de CPU, GPUs, memória e discos é feita no Windows via CIM; o app soma processadores
físicos, mostra adaptadores gráficos detectados e usa a memória física instalada como fonte principal.

## Rodar

```bash
npm install
npm run dev
```

Build:

```bash
npm run build
```

Testes:

```bash
npm test
npm run test:e2e
npm run allure:report
npm run allure:open
```

Windows 10/11. Node 20+.

## Relatórios e releases

Os testes unitários e de interface são enviados ao Allure. O relatório contém gráficos de execução,
etapas, capturas de tela e validações finais do fluxo automatizado. O GitHub Actions publica o HTML
no Pages e anexa a versão compactada do relatório e o instalador Windows às releases.

Para gerar localmente o instalador:

```bash
npm run dist:win
```

Para publicar uma release, envie uma tag `v*` (por exemplo `v1.0.0`). A pipeline executa os testes
e publica o instalador `.exe` e o relatório Allure na página Releases do GitHub.

## Uso

1. Abra como administrador se quiser os tweaks de máquina.
2. No **Painel**, veja score e hardware.
3. Escolha um **perfil** ou monte o próprio na aba Otimizações.
4. **Aplicar**. Reinicie se o item pedir (HAGS).
5. **Restaurar** desfaz pelo snapshot.
