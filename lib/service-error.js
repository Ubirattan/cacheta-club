// Erro de regra do jogo (vira resposta com a mensagem em português)
export class GameError extends Error { constructor(msg, status = 400) { super(msg); this.status = status; } }
