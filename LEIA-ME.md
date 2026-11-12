# Catálogo de Mármores — como colocar no ar

São dois endereços:

- **Catálogo** (https://joaovpolizelli.github.io/catalogo-marmoraria/): vendedoras e clientes só consultam. Não precisa login.
- **Painel** (https://joaovpolizelli.github.io/catalogo-marmoraria/admin.html): sua esposa entra com e-mail e senha para cadastrar.

Tudo gratuito: o site fica no **GitHub Pages** e os dados e as fotos no **Supabase**.
A configuração é feita uma vez só, de preferência no computador. Leva uns 20 minutos.

---

## 1. Criar o banco no Supabase

1. Acesse **supabase.com**, clique em **Start your project** e entre com sua conta GitHub (ou e-mail).
2. Clique em **New project**:
   - **Name:** `catalogo-marmoraria`
   - **Database Password:** clique em *Generate* e guarde num lugar seguro (quase nunca será usada).
   - **Region:** *South America (São Paulo)*.
3. Espere uns 2 minutos até o projeto ficar pronto.

## 2. Criar as tabelas (copiar e colar)

1. Abra o arquivo `supabase/schema.sql` deste pacote.
2. **Troque** `email-da-sua-esposa@exemplo.com` pelo e-mail que ela vai usar. Para mais de uma pessoa editar, repita a linha com outro e-mail.
3. No Supabase, menu lateral **SQL Editor** → **New query**. Cole o arquivo inteiro e clique em **Run**.
4. Deve aparecer *Success. No rows returned*. Se o Supabase mostrar um aviso sobre "security definer view", pode confirmar: é a vitrine que esconde o preço, de propósito.

## 3. Criar o acesso da sua esposa

1. Menu **Authentication** → **Sign In / Providers** (ou *Settings*): **desligue** a opção *Allow new users to sign up*. Assim ninguém cria conta sozinho.
2. Menu **Authentication** → **Users** → **Add user** → **Create new user**:
   - o **mesmo e-mail** do passo 2;
   - uma senha;
   - marque **Auto Confirm User**.

## 4. Ligar o site ao banco

1. No Supabase, vá em **Project Settings** → **API** (às vezes aparece como **API Keys** / **Data API**).
2. Copie a **Project URL** (algo como `https://abcd1234.supabase.co`).
3. Copie a chave **anon public** ou **publishable** (começa com `eyJ…` ou `sb_publishable_…`).
   ⚠️ **Nunca** use a *service_role* / *secret*.
4. Abra o `config.js` e cole cada uma no lugar de `COLE_AQUI_…`, mantendo as aspas.

## 5. Publicação

O site já está no GitHub (repositório `catalogo-marmoraria`) com o GitHub Pages ligado. Qualquer alteração salva no GitHub aparece no site em cerca de 1 minuto.

## 6. Testar

1. Abra https://joaovpolizelli.github.io/catalogo-marmoraria/admin.html.
2. Entre com o e-mail e a senha do passo 3.
3. Cadastre uma pedra com foto e abra o catálogo: ela já aparece.

## 7. No iPhone

No **Safari**, abra o endereço → botão **Compartilhar** → **Adicionar à Tela de Início**. Fica com ícone, como um app.

- **Sua esposa:** salve o endereço do painel (`…/admin.html`).
- **Vendedoras:** salve o endereço do catálogo. Para mostrar uma pedra a um cliente, abra a pedra e toque em **Compartilhar**: vai o link direto dela.

---

## Atualizações do banco

Quando uma melhoria precisar mexer no banco, ela vem num arquivo `supabase/atualizacao-N-....sql`. Basta abrir o arquivo no GitHub, copiar, colar no **SQL Editor** do Supabase e clicar em **Run**. Nenhuma atualização apaga dados.

- `atualizacao-2-exibicao.sql`: ativa **Configurações → O que aparece no site** no painel.

## Uso no dia a dia (para sua esposa)

| Quero… | Como |
|---|---|
| Cadastrar | **+ Nova pedra** → fotos → nome e código → **Salvar** |
| Novo lote da mesma pedra | Abra a pedra → **Cadastrar novo lote desta pedra** (copia tudo, só muda lote/fotos) |
| Esconder uma informação do site (preço, lote, código, estoque…) | Botão **Configurações** (engrenagem, no topo) → desligue o item → **Salvar alterações** → confira a lista e toque em **Sim, salvar**. Vale para todas as pedras |
| Trocar nome da empresa ou WhatsApp | **Configurações** → **Dados da empresa** → **Salvar alterações** → **Sim, salvar** |
| Sair do painel | Toque na bolinha com a inicial do e-mail (canto do topo) → **Sair do painel** |
| Esconder o preço de **uma** pedra | Na pedra, desmarque **Mostrar o preço desta pedra no site** |
| Tirar do site sem apagar | Desmarque **Aparecer no site** |
| Pedra vendida | **Situação: Esgotado**. Some da lista padrão do catálogo, mas continua cadastrada |
| Trocar a foto de capa | Toque na ★ da foto desejada |

O valor por chapa e os m² do lote são calculados sozinhos a partir de comprimento, altura e quantidade de chapas.

## Perguntas

**Preciso pagar algo?**
Não. O plano gratuito do Supabase tem 500 MB de banco (dá para dezenas de milhares de pedras) e 1 GB de fotos. Cada foto é reduzida no próprio celular para cerca de 200–300 KB antes de enviar, o que dá uns 3.000+ fotos.

**O que é o "pausar por inatividade"?**
No plano grátis, se o banco ficar 7 dias sem nenhum acesso, o Supabase o pausa. O arquivo `.github/workflows/manter-ativo.yml` faz uma consulta automática a cada 3 dias para evitar isso. Se um dia pausar mesmo assim, entre no Supabase e clique em **Restore**: nada é perdido.

**O preço some de verdade quando desligo?**
Sim. Com a chave desligada, o valor nem sai do servidor. Não dá para descobrir "fuçando" no site.

**Alguém consegue editar sem senha?**
Não. Só os e-mails da lista de administradores (passo 2), logados, conseguem gravar. Visitantes só leem. Isso foi testado.

**Esqueceu a senha?**
Supabase → **Authentication** → **Users** → apague o usuário dela e crie de novo (passo 3) com uma senha nova. Os produtos não são afetados.

**Incluir outra pessoa para editar?**
No **SQL Editor**, rode o comando abaixo e crie o usuário dela como no passo 3:
`insert into administradores (email) values ('outra@pessoa.com');`

**Mudar algo no site (texto, campo)?**
Edite o arquivo no GitHub (ícone de lápis) e salve. O site atualiza em cerca de 1 minuto.
