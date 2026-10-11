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
- Tweaks de energia/rede/serviços pedem **Executar como administrador**.

## O que entra no catálogo

| Área | Exemplos |
| --- | --- |
| Energia | Ultimate Performance, USB selective suspend, PCIe ASPM |
| Gráfico | Game Mode, HAGS, Xbox DVR off, MMCSS Games |
| Sistema | efeitos visuais, transparência, animações, apps em background |
| Rede | NetworkThrottlingIndex, TcpNoDelay (avançado) |
| Input | precisão do ponteiro off |
| Serviços | SysMain em SSD (avançado) |

Fora de escopo de propósito: Defender, firewall, UAC, BCDEdit, “limpa registro”.

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
```

Windows 10/11. Node 20+.

## Uso

1. Abra como administrador se quiser os tweaks de máquina.
2. No **Painel**, veja score e hardware.
3. Escolha um **perfil** ou monte o próprio na aba Otimizações.
4. **Aplicar**. Reinicie se o item pedir (HAGS).
5. **Restaurar** desfaz pelo snapshot.
