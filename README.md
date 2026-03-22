# CN Engine Web

Projeto inicial de engine/editor 2D web com base propria, editor jogavel e preparacao gradual para 3D.

## Visao geral

A CN Engine Web nasceu como uma base leve para construir mapas, testar gameplay no navegador e evoluir a arquitetura sem depender de uma engine pronta logo no inicio.

Hoje o projeto ja entrega:

- editor visual local no navegador
- varias cenas no mesmo projeto
- templates de projeto (top-down, plataforma, arena e puzzle)
- camadas de tiles
- renderizacao por sprite com atlas (flip, pivot e ordem)
- componentes basicos de fisica 2D (rigidbody e collider)
- objetos de jogabilidade
- modo `EDITAR` e modo `JOGAR`
- persistencia em JSON
- historico com `desfazer/refazer`
- dialogo e cutscene simples integrados aos gatilhos
- cena inicial com demo jogavel para validar interacao, dialogo e porta
- ponte inicial entre o fluxo 2D e a futura fase 3D

## Tecnologias

- HTML, CSS e JavaScript vanilla com ES Modules
- Canvas 2D
- servidor Node.js sem dependencias externas

## Como rodar

1. Abra um terminal em `C:\Users\CN emprega\Documents\Cn engine`
2. Execute:

```bash
npm.cmd start
```

3. Abra no navegador:

- `http://127.0.0.1:3600`

## Scripts Windows e GitHub

Repositorio GitHub atual:

- `https://github.com/Goulart121/CN-engine-1.0.git`

Scripts prontos na raiz do projeto:

- `start-cn-engine.bat`: inicia o servidor local da CN Engine
- `publicar-cn-engine-github.bat`: faz `git add`, cria commit e envia as alteracoes para o GitHub
- `atualizar-cn-engine-github.bat`: baixa as alteracoes do GitHub para o projeto local com `pull --ff-only`
- `atualizar-e-iniciar-cn-engine.bat`: atualiza do GitHub, sincroniza dependencias com `npm.cmd install` e inicia a CN Engine

Observacoes:

- os scripts de atualizacao param automaticamente se houver alteracoes locais nao commitadas
- o servidor local continua rodando em `http://127.0.0.1:3600`
- para uso rapido no Windows, basta dar duplo clique no `.bat` desejado

## Testes

```bash
npm.cmd test
```

A suite cobre principalmente:

- migracao de schema por `scene.version`
- validacao de colisao e transformacoes
- projeto com varias cenas
- ferramentas de tilemap
- objetos de jogabilidade
- painel de variaveis
- fluxo da previa 3D e do 3D nativo

## Termos adotados no editor

Para a interface ficar 100% em portugues, o editor usa estes nomes visiveis:

- `spawn` -> `Ponto Inicial`
- `trigger` -> `Gatilho`
- `checkpoint` -> `Ponto de Controle`

Observacao importante:

- o JSON e os identificadores internos continuam usando `spawn`, `trigger` e `checkpoint` para manter compatibilidade com projetos antigos e com o pipeline de migracao ja existente

## Recursos atuais

### Edicao e organizacao

- modo `EDITAR` e modo `JOGAR` com botoes e tecla `Tab`
- jogador com movimento por `WASD`/setas e corrida com `Shift`
- inimigo com patrulha
- camera acompanhando o alvo
- hierarquia com selecao de objetos
- multiselecao com `Ctrl/Cmd + clique`, selecao por area e arraste em grupo
- duplicacao e exclusao em lote com atalhos e botoes
- gizmo visual de grupo
- alinhamento e distribuicao de multiselecao
- redimensionamento por gizmo
- guias visuais de encaixe durante mover, alinhar e redimensionar
- inspector com edicao de `X`, `Y`, `Z`, `Largura` e `Altura`
- arrastar e soltar em modo de edicao

### Cenas e projeto

- projeto com varias cenas
- criar, duplicar, excluir e trocar cenas
- exportar e importar JSON do projeto
- painel de build/exportacao com perfis `dev`, `test` e `release`
- preferencias do editor salvas por projeto

### Tilemap e camadas

- pintura de tiles com `Pincel`, `Linha`, `Retangulo`, `Preencher` e `Conta-gotas`
- `Pincel Aleatorio` para variacoes automaticas
- camadas `Fundo`, `Jogabilidade`, `Colisao` e `Primeiro Plano`
- camada ativa selecionavel
- visibilidade e bloqueio por camada
- camada de colisao funcionando no runtime
- `Rule Tile` basico por vizinhanca para grupo de grama automatica
- `Animated Tile` basico por frames e duracao no runtime

### Objetos de jogabilidade

- `Ponto Inicial`
- `Gatilho`
- `Portal`
- `Ponto de Controle`
- `Porta`
- `Forma Sprite` (spline 2D simples para terreno organico)

### Fisica 2D basica

- `Rigidbody2D`: modos `static`, `dynamic` e `kinematic`
- `Collider2D`: habilitar/desabilitar, trigger, offset e tamanho
- colisao com paredes, portas e layer de colisao
- deteccao de contato usando collider

### Renderizacao 2D por sprites

- sistema de `spriteId` por objeto (`atlas:sprite`)
- suporte a `flipX` e `flipY`
- suporte a `pivotX` e `pivotY`
- `Camada de Ordenacao` e `Ordem na Camada`
- painel `Atlas de Sprites` com importacao/reset por JSON
- painel de `Animacoes Sprite` por frames (`id`, `fps`, `loop`, `frames`)
- painel de `Prefabs` com `Salvar Sel.` e `Instanciar`

### Execucao de jogabilidade

- `Ponto Inicial`: define a entrada da cena, com `teamId` e `priority`
- `Ponto de Controle`: salva o local de retorno do jogador
- `Gatilho`: executa acoes reais, com condicoes e cadeia de ate 3 acoes
- `Gatilho`: tambem pode exigir interacao por `E` e iniciar dialogos/cutscenes simples
- `Porta`: bloco solido que pode abrir e fechar com animacao
- `Portal`: troca de cena em tempo real, com ponto inicial de destino, equipe e modo de alternativa
- contato com `enemy`: reposiciona o jogador no ultimo ponto de controle valido ou no ponto inicial da cena

### Acoes de gatilho ja suportadas

- `message`: mostra uma mensagem
- `set-team`: define a equipe atual
- `teleport-spawn`: teleporta para um ponto inicial
- `switch-scene`: troca de cena
- `respawn`: reposiciona o jogador
- `clear-checkpoint`: limpa o ponto de controle salvo
- `enable-trigger`: ativa outro gatilho
- `disable-trigger`: desativa outro gatilho
- `open-door`: abre porta
- `close-door`: fecha porta
- `play-animation`: toca animacao
- `set-variable`: define variavel de runtime
- `start-dialogue`: abre caixa de dialogo e trava o input
- `move-player`: move o jogador em uma etapa de cutscene
- `move-camera`: move a camera em uma etapa de cutscene

### Condicoes de gatilho ja suportadas

- `always`: sempre
- `team-is`: equipe igual
- `team-not`: equipe diferente
- `scene-is`: cena igual
- `has-checkpoint`: exige ponto de controle salvo
- `var-is`: variavel igual
- `var-not`: variavel diferente

### Variaveis

- padroes por cena e por projeto
- tipos `string`, `number`, `boolean`, `color` e `json`
- predefinicoes como `scene-id`, `team-id`, `spawn-tag`, `door-tag`, `trigger-tag` e `checkpoint-id`
- modelos rapidos para criar referencias e valores comuns de jogabilidade
- integracao com gatilhos `var-is`, `var-not` e `set-variable`

### Previa 3D e 3D nativo

- `Espaco da Visualizacao` com `2D` e `Previa 3D`
- selecao, arraste, caixa de selecao e redimensionamento respeitando a projecao
- `Renderizador da Visualizacao` com `Tela da Cena` e `3D Nativo`
- previa dedicada do renderizador 3D nativo
- camera do `3D Nativo` com orbita, deslocamento e zoom
- modo `JOGAR` com camera 3D acompanhando o jogador

### Dialogo e cutscene

- interacao por `E`, `Enter` ou `Espaco` em gatilhos marcados como interativos
- caixa de dialogo no viewport com nome do personagem e sequencia de falas
- bloqueio de input durante dialogo e etapas da cutscene
- fila simples de cutscene reaproveitando as acoes do gatilho
- suporte inicial para `start-dialogue`, `move-player` e `move-camera`

## Arquitetura modular

- `public/app/main.mjs`: orquestracao principal do editor
- `public/app/project-core.mjs`: estrutura do projeto com varias cenas e validacao do JSON do projeto
- `public/app/runtime-2d.mjs`: loop principal, atualizacao e renderizacao
- `public/app/editor-input.mjs`: teclado e mouse do editor
- `public/app/scene-manager.mjs`: painel de cenas do projeto
- `public/app/scene-list.mjs`: hierarquia da cena atual
- `public/app/inspector.mjs`: leitura e renderizacao do inspector
- `public/app/core-scene.mjs`: modelo de cena, objetos e validacoes
- `public/app/scene-migrations.mjs`: pipeline de migracao por `scene.version`
- `public/app/scene-space.mjs`: normalizacao de `space.mode`, profundidade e projecao da previa 3D
- `public/app/native-3d.mjs`: funcoes puras de apoio ao renderizador 3D nativo
- `public/app/editor-prefs.mjs`: persistencia local das preferencias do editor
- `public/app/history.mjs`: historico de comandos para `desfazer/refazer`
- `public/app/constants.mjs`: constantes globais
- `public/app/utils.mjs`: utilitarios puros

## Versionamento de dados

- versao atual da cena: `14`
- versao atual do projeto: `5`
- qualquer JSON antigo sem versao ou com `version: 1` ate `13` e migrado automaticamente para `14`

### Migracoes de cena

- `0 -> 1`: normaliza o campo de versao
- `1 -> 2`: prepara a ponte com 3D (`world.depth`, `space`, `z` em entidades, patrulha e paredes)
- `2 -> 3`: converte `tiles` antigos para `layers.gameplay` e padroniza as camadas
- `3 -> 4`: adiciona `gameObjects` ao schema
- `4 -> 5`: adiciona `targetSpawnTag` em portais
- `5 -> 6`: adiciona dados avancados de jogabilidade, como `teamId`, `priority`, `targetTeamId`, `fallbackMode`, `actionType`, `once` e `enabled`
- `6 -> 7`: adiciona `conditionType`, `conditionValue` e `actions[]` para gatilhos encadeados
- `7 -> 8`: adiciona `targetTag` nas acoes de gatilho e defaults de porta
- `8 -> 9`: adiciona `conditionTargetTag` para variaveis de gatilho e normaliza `space.mode` com suporte ao `3d-preview`
- `9 -> 10`: adiciona `variables` por cena
- `10 -> 11`: adiciona `variableMeta` por cena
- `11 -> 12`: adiciona `preset` em `variableMeta` e normaliza os tipos extras `color` e `json`
- `12 -> 13`: adiciona `interactionOnly` em gatilhos e campos de dialogo/cutscene nas acoes
- `13 -> 14`: adiciona campos de render 2D (`sortingLayer`, `orderInLayer`, `spriteId`, `flip`, `pivot`) e defaults de `spriteShape`

## Estrutura resumida do JSON

Cada projeto exportado segue esta ideia:

```json
{
  "projectVersion": 5,
  "name": "CN Project",
  "templateId": "top-down",
  "spriteAtlases": [
    {
      "id": "demo",
      "name": "Atlas Demo",
      "imageSrc": "assets/sprite-atlas-demo.svg",
      "sprites": []
    }
  ],
  "variables": {},
  "variableMeta": {},
  "activeBuildProfile": "dev",
  "buildProfiles": {
    "dev": {
      "buildName": "cn-dev",
      "mode": "dev",
      "startScene": "scene_1",
      "includeEditorUI": true,
      "includeDebugPanel": true,
      "compressAssets": false
    },
    "test": {},
    "release": {}
  },
  "buildConfig": {
    "buildName": "cn-dev",
    "mode": "dev",
    "startScene": "scene_1",
    "includeEditorUI": true,
    "includeDebugPanel": true,
    "compressAssets": false
  },
  "activeSceneId": "scene_1",
  "scenes": [
    {
      "id": "scene_1",
      "name": "Cena 1",
      "version": 14,
      "world": { "width": 3200, "height": 1800, "depth": 2000, "tileSize": 32 },
      "space": { "mode": "2d", "upAxis": "y", "forwardAxis": "z" },
      "player": {},
      "enemy": {},
      "walls": [],
      "variables": {},
      "variableMeta": {},
      "gameObjects": [],
      "layers": {
        "background": [],
        "gameplay": [],
        "collision": [],
        "foreground": []
      }
    }
  ]
}
```

## Proximos passos sugeridos

1. enriquecer os gizmos do `3D Nativo` para edicao ainda mais precisa
2. expandir os fluxos de variaveis e gatilhos para comportamento mais complexo
3. evoluir o renderizador 3D jogavel sem quebrar o modelo de dados atual
