# CN Engine - Documento Mestre (Atualizado)

Data de atualizacao: 2026-03-19

## Instrucao principal para o Codex

Voce vai continuar a evolucao da **CN Engine**.

Regra obrigatoria:
- antes de criar qualquer recurso novo, auditar a base atual
- se algo ja existir, **nao recriar** e **nao duplicar**
- evoluir em cima do que ja funciona

## Regras de trabalho

### Se o recurso ja existe
- preservar o sistema atual
- corrigir somente bug real
- completar o que estiver faltando
- manter compatibilidade com JSON e projetos antigos

### O que nao fazer
- nao reescrever a engine inteira
- nao apagar sistemas prontos
- nao criar painel paralelo para recurso ja existente
- nao trocar arquitetura sem necessidade

---

## Estado atual confirmado da CN Engine

### Base geral
- editor web 2D jogavel (modo EDITAR/JOGAR)
- projeto com multiplas cenas
- scene manager + scene list + inspector
- pipeline de migracao por `scene.version`
- undo/redo por historico de comandos

### Tilemap
- grid + tilemap por camadas
- camada ativa: fundo, jogabilidade, colisao, primeiro plano
- visibilidade/lock por camada
- ferramentas: pincel, linha, retangulo, preencher, conta-gotas

### Gameplay
- objetos: ponto inicial, gatilho, portal, ponto de controle, porta
- gatilhos com condicoes e acoes encadeadas
- dialogo/cutscene simples (acoes de gatilho)
- portal com fallback por prioridade/equipe

### Persistencia
- importar/exportar projeto em JSON
- validacao de schema
- migracoes automaticas de cenas antigas

### Ponte 3D
- previa 3D e renderizador 3D nativo inicial
- manipulacao respeitando projecao

---

## Atualizacoes recentes implementadas (bloco visual 2D)

### 1) Base visual 2D (estilo fluxo Unity)
- Sprite Renderer basico por `spriteId` (`atlas:sprite`)
- flip horizontal/vertical (`flipX`, `flipY`)
- pivot por objeto (`pivotX`, `pivotY`)
- Sorting Layer + Order in Layer para profundidade visual

### 2) Sprite Atlas
- suporte a `project.spriteAtlases`
- atlas demo incluido por padrao
- painel no editor para importar/resetar atlas via JSON
- desenho por recorte (`x,y,w,h`) no atlas

### 3) Tilemap Extras
- Random Brush (`Pincel Aleatorio`)
- Rule Tile basico por vizinhanca (variantes automaticas)
- Animated Tile basico por frames + duracao

### 4) Mundo organico
- novo objeto `spriteShape`
- spline 2D simples por pontos (`shapePoints`)
- preenchimento, contorno e espessura configuraveis

### 5) Compatibilidade de dados
- `scene.version` atualizado para **14**
- migracao `13 -> 14` adicionada
- JSON antigo continua suportado via pipeline

---

## Campos novos no schema (scene v14)

Aplicados em player/enemy/walls/gameObjects:
- `sortingLayer`
- `orderInLayer`
- `spriteId`
- `flipX`
- `flipY`
- `pivotX`
- `pivotY`

Para `spriteShape`:
- `shapePoints`
- `shapeClosed`
- `shapeFill`
- `shapeStroke`
- `shapeThickness`

---

## Regras de compatibilidade obrigatorias

- manter leitura de JSON legado
- manter migracoes anteriores funcionando
- nao quebrar identificadores internos (`spawn`, `trigger`, `checkpoint`)
- manter UI em portugues sem alterar IDs internos do schema

---

## Proximos blocos recomendados (2D)

Prioridade alta:
1. Sprite slicing multiplo por grade no painel de atlas
2. Brushes extras (line/random group brush com presets)
3. SpriteShape com manipuladores visuais (gizmos de ponto)
4. Layers de ordenacao customizaveis por projeto

Prioridade media:
1. Tile variants por peso
2. Preview de animacao no inspector
3. Biblioteca de assets com pastas e tags

---

## Comando de execucao local

- iniciar servidor: `npm.cmd start`
- endereco: `http://127.0.0.1:3600`
- testes: `npm.cmd test`

---

## Checklist antes de cada novo bloco

1. auditar se o recurso ja existe
2. decidir: corrigir, expandir, integrar ou criar
3. implementar sem duplicar sistema
4. validar compatibilidade com JSON
5. executar testes
6. atualizar README e este documento
