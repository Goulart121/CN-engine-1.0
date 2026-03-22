export const PROJECT_VERSION = 6;
export const SCENE_VERSION = 18;

export const SCENE_SPACE_MODES = ["2d", "3d-preview"];

export const SCENE_SPACE_LABELS = {
  "2d": "2D",
  "3d-preview": "Previa 3D"
};

export const VIEWPORT_RENDERER_MODES = ["scene", "native-3d"];

export const VIEWPORT_RENDERER_LABELS = {
  scene: "Tela da Cena",
  "native-3d": "3D Nativo"
};

export const VARIABLE_TYPES = ["string", "number", "boolean", "color", "json"];

export const VARIABLE_TYPE_LABELS = {
  string: "Texto",
  number: "Numero",
  boolean: "Booleano",
  color: "Cor",
  json: "JSON"
};

export const VARIABLE_PRESETS = ["none", "scene-id", "team-id", "spawn-tag", "door-tag", "trigger-tag", "checkpoint-id"];

export const VARIABLE_PRESET_LABELS = {
  none: "Sem predefinicao",
  "scene-id": "ID da Cena",
  "team-id": "ID da Equipe",
  "spawn-tag": "Tag do Ponto Inicial",
  "door-tag": "Tag de Porta",
  "trigger-tag": "Tag do Gatilho",
  "checkpoint-id": "ID do Ponto de Controle"
};

export const TILE_LAYERS = ["background", "gameplay", "collision", "foreground"];

export const TILE_LAYER_LABELS = {
  background: "Fundo",
  gameplay: "Jogabilidade",
  collision: "Colisao",
  foreground: "Primeiro Plano"
};

export const PAINT_TOOLS = ["brush", "random", "line", "rect", "fill", "eyedropper"];

export const PAINT_TOOL_LABELS = {
  brush: "Pincel",
  random: "Pincel Aleatorio",
  line: "Linha",
  rect: "Retangulo",
  fill: "Preencher",
  eyedropper: "Conta-gotas"
};

export const SORTING_LAYERS = ["background", "default", "foreground", "ui"];

export const SORTING_LAYER_LABELS = {
  background: "Fundo",
  default: "Padrao",
  foreground: "Frente",
  ui: "Interface"
};

export const RIGIDBODY_TYPES = ["static", "dynamic", "kinematic"];

export const RIGIDBODY_TYPE_LABELS = {
  static: "Estatico",
  dynamic: "Dinamico",
  kinematic: "Cinematico"
};

export const TRIGGER_ACTION_TYPES = ["none", "message", "set-team", "teleport-spawn", "switch-scene", "respawn", "clear-checkpoint", "enable-trigger", "disable-trigger", "open-door", "close-door", "play-animation", "set-variable", "start-dialogue", "play-timeline", "move-player", "move-camera"];

export const TRIGGER_ACTION_LABELS = {
  none: "Nenhuma",
  message: "Mensagem",
  "set-team": "Definir Equipe",
  "teleport-spawn": "Teleportar para Ponto Inicial",
  "switch-scene": "Trocar Cena",
  respawn: "Reaparecer",
  "clear-checkpoint": "Limpar Ponto de Controle",
  "enable-trigger": "Ativar Gatilho",
  "disable-trigger": "Desativar Gatilho",
  "open-door": "Abrir Porta",
  "close-door": "Fechar Porta",
  "play-animation": "Tocar Animacao",
  "set-variable": "Definir Variavel",
  "start-dialogue": "Iniciar Dialogo",
  "play-timeline": "Executar Timeline",
  "move-player": "Mover Jogador",
  "move-camera": "Mover Camera"
};

export const TRIGGER_CONDITION_TYPES = ["always", "team-is", "team-not", "scene-is", "has-checkpoint", "var-is", "var-not"];

export const TRIGGER_CONDITION_LABELS = {
  always: "Sempre",
  "team-is": "Equipe E",
  "team-not": "Equipe Nao E",
  "scene-is": "Cena E",
  "has-checkpoint": "Tem Ponto de Controle",
  "var-is": "Variavel E",
  "var-not": "Variavel Nao E"
};

export const OBJECT_TYPE_LABELS = {
  player: "Jogador",
  enemy: "Inimigo",
  wall: "Parede",
  spriteShape: "Forma Sprite",
  cameraZone: "Zona de Camera",
  spawn: "Ponto Inicial",
  trigger: "Gatilho",
  portal: "Portal",
  checkpoint: "Ponto de Controle",
  door: "Porta",
  light2d: "Luz 2D",
  entity: "Entidade",
  gameplayObject: "Objeto de Jogo",
  object: "Objeto"
};

export const SURFACE_MATERIAL_IDS = ["default", "grass", "stone", "sand", "water", "lava"];

export const SURFACE_MATERIAL_LABELS = {
  default: "Padrao",
  grass: "Grama",
  stone: "Pedra",
  sand: "Areia",
  water: "Agua",
  lava: "Lava"
};

export const TILES = [
  { id: 1, name: "Grama", color: "#3f9f62", randomPool: [1, 6, 7, 8, 9], surfaceMaterial: "grass" },
  { id: 2, name: "Pedra", color: "#6f7988", surfaceMaterial: "stone" },
  { id: 3, name: "Agua", color: "#2b7cd6", surfaceMaterial: "water" },
  { id: 4, name: "Areia", color: "#c8a159", surfaceMaterial: "sand" },
  { id: 5, name: "Lava", color: "#cf5734", surfaceMaterial: "lava" },
  { id: 6, name: "Grama Auto A", color: "#4cab6b", ruleGroup: "grass_auto", ruleVariants: [6, 7, 8, 9, 10], randomPool: [6, 7, 8, 9, 10], surfaceMaterial: "grass" },
  { id: 7, name: "Grama Auto B", color: "#43a665", ruleGroup: "grass_auto", ruleVariants: [6, 7, 8, 9, 10], randomPool: [6, 7, 8, 9, 10], surfaceMaterial: "grass" },
  { id: 8, name: "Grama Auto C", color: "#3f9d61", ruleGroup: "grass_auto", ruleVariants: [6, 7, 8, 9, 10], randomPool: [6, 7, 8, 9, 10], surfaceMaterial: "grass" },
  { id: 9, name: "Grama Auto D", color: "#58b879", ruleGroup: "grass_auto", ruleVariants: [6, 7, 8, 9, 10], randomPool: [6, 7, 8, 9, 10], surfaceMaterial: "grass" },
  { id: 10, name: "Grama Auto E", color: "#67bf86", ruleGroup: "grass_auto", ruleVariants: [6, 7, 8, 9, 10], randomPool: [6, 7, 8, 9, 10], surfaceMaterial: "grass" },
  { id: 11, name: "Agua Animada", color: "#2b7cd6", animatedFrames: [11, 12, 13], frameDuration: 0.22, surfaceMaterial: "water" },
  { id: 12, name: "Agua Frame B", color: "#3587df", surfaceMaterial: "water" },
  { id: 13, name: "Agua Frame C", color: "#2f73cd", surfaceMaterial: "water" }
];

export const TILE_BY_ID = new Map(TILES.map((tile) => [tile.id, tile]));
