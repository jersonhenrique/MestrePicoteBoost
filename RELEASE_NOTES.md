# MestrePicoteBoost 1.3.0

## Melhorias

- O perfil **Tudo no talo** agora seleciona explicitamente todas as otimizações disponíveis no catálogo e as três opções de rede.
- Os perfis mostram quantas otimizações e ações de rede estão incluídas.
- As ações de rede também aparecem na seleção do perfil completo. Cada comando continua separado do botão de aplicar otimizações e exige confirmação própria antes da execução.
- A ação **Marcar visíveis** agora acrescenta os itens filtrados à seleção existente, em vez de desmarcar opções de outras categorias.
- Removidos do Painel os botões **Atualizar scan** e **Ir para Ranked**.
- Removida a aba **Restaurar**; a restauração a partir de um ponto continua disponível na tela **Ponto de restauração**.

## Comandos de rede

- `ipconfig /renew` solicita a renovação do endereço IP.
- `ipconfig /flushdns` limpa o cache DNS local.
- `netsh winsock reset` redefine o catálogo Winsock e requer reinicialização do computador.

Os comandos de rede são iniciados individualmente e após confirmação. É necessário executar o app como Administrador.
