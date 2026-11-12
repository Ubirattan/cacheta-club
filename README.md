# Cacheta Club: online, com torneios, ranking, loja e painel admin (etapas 2 e 3)

Site do Cacheta Club com cadastro, salas online em tempo real e o modo contra o computador.
Feito em **Next.js + Supabase**, pra publicar no **Netlify**.

As fichas são virtuais: não valem dinheiro, não têm saque e não dá pra trocar.

---

## O que já funciona

- **Cadastro e login** com apelido, e-mail e senha, ou **com o Google**.
- **Perfil:** apelido, avatar, fichas, partidas, vitórias e aproveitamento.
- **Lobby em tempo real:** salas aparecem e somem sozinhas. Tem abas por modalidade (Cacheta, Cacheta 10 cartas, Pif Paf) e filtros Aguardando, Jogando e Privadas.
- **Criar sala:** de 2 a 9 jogadores, entrada em fichas, pontos, tempo por jogada, e sala pública ou **privada com senha**.
- **Convidar amigos** por link ou por código de 6 letras. Sala privada também pede a senha.
- **Entrada na sala:** os lugares mostram quem está pronto, tem **chat** e a partida **começa sozinha** quando todos estão prontos (mínimo 2).
- **Jogadores online:** mostra quem está conectado e onde (no início, procurando mesa ou numa sala).
- **Partida em tempo real** com o mesmo visual da mesa oval:
  - **Toda jogada é conferida no servidor.** O celular de cada um só vê as próprias cartas, e o baralho fica escondido no banco.
  - **Cronômetro por jogada:** se o tempo acaba, o servidor joga sozinho por quem demorou.
  - **Batida errada** perde a vez e deixa "queimado", com a mesma regra do modo offline.
  - Quem sai no meio é eliminado. O campeão leva o pote, e as estatísticas são atualizadas.
- **Contra o computador:** o jogo da etapa 1 vem junto (`public/offline`).

### Truco paulista (novo)
- Botões **Cacheta** e **Truco** no topo da tela inicial, entre o perfil e o "online".
- `/truco`: **contra o computador**, 1 contra 1 ou duplas (2x2), computador Fácil ou Esperto.
- Regras: vira e manilha (♦ < ♠ < ♥ < ♣ zap), truco/seis/nove/doze, mão de onze (vê as cartas do parceiro) e mão de ferro; partida até 12.
- Precisa ter fichas no saldo, mas contra o computador elas não são gastas (igual à cacheta).
- O motor fica em `lib/truco.js` e já está pronto pra rodar no servidor quando vier o truco online.
- A página do truco só é baixada quando o jogador toca no botão: a tela inicial continua leve.

### Bolinha de gude (novo)
- Botão **Gude** no topo da tela inicial. Três modos:
  - **Triângulo:** tire as 10 bolinhas do triângulo. Tirou, joga de novo. Ganha quem tirar mais.
  - **Buraco:** acerte os buraquinhos na ordem 1 → 2 → 3 → 2 → 1 e vire **matador** 💀. Aí é acertar a bolinha do outro.
  - **Mata-mata:** só as duas bolinhas. Acertou a do outro, 1 ponto. Faz 3 e ganha.
- **Contra o computador** (Fácil, Esperto ou Difícil): cada partida custa **1 ficha**. Ganhou, leva **2**. Empate devolve a ficha.
  O servidor guarda a partida e confere toda tecada (a do jogador e a do computador), então ninguém inventa vitória.
- **Online 1 contra 1:** no lobby, aba **🔵 Gude** → Criar sala. Tem entrada em fichas, convite, chat e cronômetro (tempo acabou = passa a vez).
  Quem ganha leva o pote; empate devolve a entrada; quem sai no meio perde.
- Mira nova: os pontinhos mostram até onde a bolinha vai parar e a força aparece em %.
- ⚠️ Rode uma vez o arquivo `supabase/gude.sql` no SQL Editor do Supabase (cria a tabela das partidas contra o computador).

### Novidades da etapa 3
- **Torneios:** o admin cria o torneio com nome, modalidade, jogadores por mesa, inscrição, prêmio extra da casa e horário de início (opcional).
  - Os jogadores se inscrevem e podem desistir enquanto as inscrições estão abertas, com as fichas devolvidas.
  - Na hora marcada, ou quando o admin manda começar, as mesas são sorteadas. Quem vence a mesa passa de rodada, com chaveamento ao vivo, até sobrar o campeão, que leva todas as inscrições mais o prêmio.
  - Torneio com menos de 2 inscritos é cancelado e devolve as fichas.
- **Ranking geral** por pontos, vitórias ou fichas. Vencer uma partida vale 10 pontos e jogar vale 1; o campeão de torneio ganha um bônus grande.
- **Histórico de partidas** de cada jogador: resultado, adversários e quantas fichas ganhou ou perdeu.
- **Loja** (só com fichas virtuais):
  - Bônus diário.
  - **VIP de 30 dias**: bônus em dobro, salas só para VIP, feltro exclusivo, coroa 👑 e nenhum anúncio.
  - Verso das cartas e cor do feltro da mesa.
  - Pacotes de fichas virtuais pagos com **Pix ou cartão** (Mercado Pago), creditados sozinhos.
- **Painel administrativo** (`/admin`):
  - Visão geral com números da plataforma.
  - Jogadores: buscar, bloquear, desbloquear e dar ou tirar fichas.
  - Partidas realizadas e salas abertas (dá pra fechar uma sala).
  - Torneios: criar, começar e cancelar.
  - Regras e configurações: modalidades liberadas, bônus diário, entrada máxima, espaço de anúncio e recado na tela inicial.
- Na mesa online, as cartas agora **voam** do monte e do descarte, como no modo offline.

---

## Passo a passo para colocar no ar

### 1. Criar o banco no Supabase (grátis)
1. Entre em **supabase.com** e crie um projeto (região: São Paulo).
2. No menu da esquerda, abra o **SQL Editor** e clique em **New query**.
3. Abra o arquivo `supabase/schema.sql` deste projeto, copie **tudo** e cole lá.
4. Clique em **Run**. A mensagem esperada é "Success".
5. Faça o mesmo com os arquivos `supabase/etapa3.sql`, `supabase/pagamento.sql` e `supabase/gude.sql`, um de cada vez: nova query, colar tudo e **Run**.
6. **Para virar administrador:** depois de criar sua conta no site, rode no SQL Editor a linha abaixo, trocando pelo seu e-mail:
   ```sql
   update public.profiles set is_admin = true where id = (select id from auth.users where email = 'seu@email.com');
   ```
   Depois disso, o botão 🛠 aparece no rodapé da tela inicial.
7. **Login do painel:** rode também o `supabase/admin-login.sql`. Na primeira vez que abrir o painel, ele pede pra criar um usuário e uma senha só do painel. Depois disso, essa senha é pedida sempre. A sessão dura 12 horas, e o painel trava por 15 minutos depois de 5 senhas erradas.

### 2. Copiar as chaves
Em **Project Settings → API** (ou **API Keys**), copie estes três valores:
- **Project URL**: vai em `NEXT_PUBLIC_SUPABASE_URL`.
- **anon public**: vai em `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- **service_role**: vai em `SUPABASE_SERVICE_ROLE_KEY`.

⚠️ A `service_role` é **secreta**. Ela vai só no Netlify, nunca no código nem no GitHub.

### 3. Publicar no Netlify
1. Suba esta pasta num repositório do **GitHub**. Pode ser privado.
2. No Netlify, vá em **Add new site → Import an existing project → GitHub** e escolha o repositório.
3. Antes de publicar, abra **Environment variables** e cadastre as 3 chaves do passo 2 com os mesmos nomes.
4. Clique em **Deploy**. Quando terminar, você tem um endereço tipo `https://cacheta-club.netlify.app`.

### 3b. Pagamento por Pix (Mercado Pago)
1. Entre em **mercadopago.com.br/developers** com a conta que vai receber, crie uma aplicação ("Pagamentos online" → Checkout Pro) e abra **Credenciais de produção**.
2. No Netlify, cadastre mais duas variáveis:
   - `MP_ACCESS_TOKEN`: o Access Token de produção (começa com `APP_USR-`). É **secreto**.
   - `SITE_URL`: o endereço do seu site, sem barra no final (ex.: `https://cacheta-club.netlify.app`).
3. Faça um novo deploy. Pronto: na Loja, os pacotes passam a ter o botão "Comprar com Pix".

Como funciona: o jogador é levado pro Mercado Pago, paga com Pix ou cartão e volta pra Loja. As fichas entram sozinhas quando o pagamento é aprovado, porque o Mercado Pago avisa o site em `/api/pay/webhook`. O servidor sempre confere o pagamento direto no Mercado Pago, checa o valor e credita uma vez só.

Pra testar sem dinheiro de verdade, use primeiro as **credenciais de teste** (`TEST-...`) e os usuários de teste do próprio Mercado Pago.

### 3c. Pix pelo GeraPix (opcional, no lugar do Mercado Pago)
Se a variável `GERAPIX_SECRET` existir, o site usa o GeraPix: o jogador informa nome e CPF, recebe o QR Code e o "copia e cola" na própria Loja, e as fichas entram sozinhas quando o Pix cai.
1. No app/painel do **GeraPix**, copie o **token secreto** da API.
2. No Netlify, cadastre `GERAPIX_SECRET` (marque **Contains secret values**) e `SITE_URL` = `https://cacheta-club.netlify.app`.
3. Faça um novo deploy.

O GeraPix avisa o site em `/api/pay/gerapix`, e o site confere o token antes de creditar. O valor mínimo do GeraPix é R$ 10, por isso os pacotes são de R$ 10, R$ 25 e R$ 50. O CPF vai só pro GeraPix e não fica guardado no banco. Saque de fichas não existe.

### 4. Avisar o Supabase do seu endereço
No Supabase, em **Authentication → URL Configuration**:
- **Site URL**: o seu endereço do Netlify.
- **Redirect URLs**: adicione `https://SEU-SITE.netlify.app/**`.

Pra testar mais rápido, você pode desligar a confirmação de e-mail em **Authentication → Providers (ou Sign In) → Email → "Confirm email"**. Ligue de novo antes de divulgar.

### 5. Login com Google (opcional)
1. No **Google Cloud Console**, crie um projeto. Configure a **Tela de consentimento OAuth** e depois crie uma credencial **ID do cliente OAuth → Aplicativo da Web**.
2. Em "URIs de redirecionamento autorizados", coloque `https://SEU-PROJETO.supabase.co/auth/v1/callback`.
3. Copie o **Client ID** e o **Client Secret**.
4. No Supabase, abra **Authentication → Providers → Google**, ative e cole os dois.

### 6. Testar
Abra o site em dois celulares, ou num celular e numa aba anônima do computador. Crie uma conta em cada um. Num deles, crie uma sala e mande o convite pro outro. Os dois tocam em "Estou pronto" e a partida começa.

---

## Rodar no computador (opcional)

```bash
npm install
cp .env.example .env.local   # e preencha as 3 chaves
npm run dev                  # abre em http://localhost:3000
npm test                     # testa as regras do servidor (sem precisar do Supabase)
```

---

## Como o projeto está organizado

| Pasta / arquivo | O que é |
|---|---|
| `lib/engine.js` | Motor da cacheta + IA. **O mesmo** código do modo offline. |
| `lib/service.js` | Regras do servidor: salas, senha, início automático, jogadas, cronômetro, pote. |
| `lib/repo-supabase.js` | Leitura e gravação no banco (com controle de versão, pra nenhuma jogada ser contada duas vezes). |
| `app/api/rooms/...` | Endereços que o site chama: criar, entrar, sair, pronto, jogada, tick. |
| `app/login`, `app/lobby`, `app/sala/[id]` | Telas de login, lobby e sala/mesa. |
| `supabase/schema.sql` | Tabelas e regras de segurança do banco. |
| `tests/service.test.mjs` | Teste completo: 9 jogadores, senha, sala cheia, cronômetro, saída no meio, pote. |
| `lib/tournament.js` | Torneios: inscrição, sorteio das mesas, avanço de rodada, prêmio. |
| `lib/shop.js`, `lib/shop-items.js` | Loja, VIP e bônus diário. |
| `lib/admin.js` | Operações do painel administrativo. |
| `lib/payments.js`, `app/api/pay` | Pagamento Pix/cartão pelo Mercado Pago e aviso automático (webhook). |
| `supabase/etapa3.sql` | Tabelas da etapa 3 (torneios, histórico, loja, configurações). |
| `tests/etapa3.test.mjs` | Torneios de 2, 5, 9 e 13 jogadores, loja, VIP, bônus e admin. |

Segurança: as cartas de cada jogador ficam numa tabela que só o dono enxerga (RLS do Supabase). O baralho e a mão dos outros ficam numa tabela que só o servidor acessa. Fichas e vitórias só mudam pelo servidor.

---

## Ainda não tem

- **Anúncios de verdade:** o espaço existe (`components/AdSlot.js`) e liga pelo painel. Falta colocar o código do anunciante, como o Google AdSense.
- Quem fecha o app no meio continua sentado, e o cronômetro joga por ele até a partida acabar.
