/* =====================================================================
   MODO DEMONSTRAÇÃO — imita o Supabase dentro do navegador.
   Só é usado enquanto o config.js não estiver preenchido.
   Os dados ficam no armazenamento local deste aparelho.
   ===================================================================== */
(function () {
  'use strict';
  const CHAVE = 'catalogo-marmore-demo-v1';
  const SENHA_DEMO = 'demo123';
  const ADMINS = ['demo@catalogo.com'];

  /* ---------- imagens de exemplo (desenho de pedra em SVG) ---------- */
  function pedra(fundo, veio, seed, escuro) {
    let s = seed;
    const r = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
    let veios = '';
    for (let i = 0; i < 7; i++) {
      const y = r() * 600, d = [`M-20 ${y}`];
      for (let x = 0; x <= 840; x += 120) d.push(`Q ${x + 60} ${y + (r() - 0.5) * 260} ${x + 120} ${y + (r() - 0.5) * 160}`);
      veios += `<path d="${d.join(' ')}" stroke="${veio}" stroke-width="${(r() * 3 + 0.6).toFixed(1)}" fill="none" opacity="${(0.35 + r() * 0.5).toFixed(2)}"/>`;
    }
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600"><defs><filter id="b"><feGaussianBlur stdDeviation="1.4"/></filter>` +
      `<radialGradient id="g" cx="30%" cy="30%" r="90%"><stop offset="0" stop-color="${fundo}"/><stop offset="1" stop-color="${escuro}"/></radialGradient></defs>` +
      `<rect width="800" height="600" fill="url(#g)"/><g filter="url(#b)">${veios}</g></svg>`;
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }
  const f = (a, b, c, d) => ({ g: pedra(a, b, c, d), p: pedra(a, b, c, d) });

  function semente() {
    const agora = Date.now();
    const p = (o, i) => Object.assign({
      id: 'demo-' + i, tipo: null, cor: null, origem: null, acabamento: null, espessura_cm: null,
      comprimento_cm: null, altura_cm: null, lote: null, qtd_chapas: null, preco_m2: null,
      mostrar_preco: true, status: 'disponivel', aplicacoes: [], observacoes: null, fotos: [],
      publicado: true, criado_em: new Date(agora - i * 864e5).toISOString(),
      atualizado_em: new Date(agora - i * 864e5).toISOString()
    }, o);
    return {
      configuracoes: [{ id: 1, mostrar_preco: true, nome_empresa: 'Marmoraria Exemplo', whatsapp: '5519999999999', exibir: {} }],
      produtos: [
        p({ nome: 'Branco Carrara', codigo: 'MAR-001', tipo: 'Mármore', cor: 'Branco', origem: 'Importado (Itália)', acabamento: 'Polido', espessura_cm: 2, comprimento_cm: 290, altura_cm: 175, lote: 'L-2611', qtd_chapas: 14, preco_m2: 890, aplicacoes: ['Bancada de cozinha', 'Banheiro / lavatório', 'Parede / revestimento'], observacoes: 'Veios cinza suaves. Ótimo para lavatórios.', fotos: [f('#f4f2ee', '#8d8f94', 3, '#dcd8d1'), f('#efece6', '#7e8187', 11, '#d3cec5')] }, 1),
        p({ nome: 'Preto São Gabriel', codigo: 'GRA-014', tipo: 'Granito', cor: 'Preto', origem: 'Nacional (ES)', acabamento: 'Polido', espessura_cm: 2, comprimento_cm: 300, altura_cm: 190, lote: 'L-2598', qtd_chapas: 22, preco_m2: 420, aplicacoes: ['Bancada de cozinha', 'Escada', 'Área gourmet / churrasqueira'], fotos: [f('#2a2a2c', '#55565a', 7, '#121213')] }, 2),
        p({ nome: 'Taj Mahal', codigo: 'QTZ-007', tipo: 'Quartzito', cor: 'Bege', origem: 'Nacional (BA)', acabamento: 'Levigado (fosco)', espessura_cm: 2, comprimento_cm: 310, altura_cm: 195, lote: 'B-88', qtd_chapas: 6, preco_m2: 1650, status: 'reservado', aplicacoes: ['Bancada de cozinha', 'Mesa / móveis'], fotos: [f('#efe4d3', '#b89a6c', 5, '#d9c7aa')] }, 3),
        p({ nome: 'Travertino Romano', codigo: 'TRV-003', tipo: 'Travertino', cor: 'Bege', origem: 'Importado (Itália)', acabamento: 'Escovado', espessura_cm: 3, comprimento_cm: 280, altura_cm: 160, lote: 'T-12', qtd_chapas: 9, preco_m2: 1100, mostrar_preco: false, status: 'sob_consulta', aplicacoes: ['Piso interno', 'Parede / revestimento'], fotos: [f('#e3d3b8', '#c3a77c', 9, '#c9b28d')] }, 4),
        p({ nome: 'Verde Ubatuba', codigo: 'GRA-021', tipo: 'Granito', cor: 'Verde', origem: 'Nacional (SP)', acabamento: 'Flameado', espessura_cm: 3, comprimento_cm: 290, altura_cm: 180, lote: 'L-2450', qtd_chapas: 0, preco_m2: 380, status: 'esgotado', aplicacoes: ['Piso externo', 'Fachada'], fotos: [f('#2f3a33', '#5f6f63', 13, '#1b221d')] }, 5)
      ],
      sessao: null,
      arquivos: {}
    };
  }

  /* ---------- armazenamento ---------- */
  let memoria = null;
  function db() {
    if (memoria) return memoria;
    try { memoria = JSON.parse(localStorage.getItem(CHAVE)); } catch (e) { memoria = null; }
    if (!memoria || !memoria.produtos) memoria = semente();
    return memoria;
  }
  function salvar() { try { localStorage.setItem(CHAVE, JSON.stringify(db())); } catch (e) { /* cheio ou bloqueado: segue só em memória */ } }
  const copia = (o) => JSON.parse(JSON.stringify(o));
  const erro = (message, code) => ({ data: null, error: { message, code } });
  const ehAdmin = () => !!(db().sessao && ADMINS.includes(db().sessao.user.email.toLowerCase()));

  function vitrine() {
    const c = db().configuracoes[0];
    const e = c.exibir || {}, mostra = (k) => e[k] !== false;
    return db().produtos.filter((p) => p.publicado).map((p) => {
      const v = copia(p);
      if (!(c.mostrar_preco && p.mostrar_preco)) v.preco_m2 = null;
      const zera = { codigo: ['codigo'], lote: ['lote'], tipo: ['tipo'], cor: ['cor'], origem: ['origem'], acabamento: ['acabamento'],
        espessura: ['espessura_cm'], medidas: ['comprimento_cm', 'altura_cm'], estoque: ['qtd_chapas'], observacoes: ['observacoes'] };
      for (const [k, cols] of Object.entries(zera)) if (!mostra(k)) cols.forEach((col) => (v[col] = null));
      if (!mostra('aplicacoes')) v.aplicacoes = [];
      if (!mostra('videos')) v.fotos = (v.fotos || []).filter((f) => !(f && f.v));
      delete v.mostrar_preco; delete v.publicado; delete v.criado_em;
      return v;
    });
  }

  /* ---------- consultas (imita supabase-js) ---------- */
  class Consulta {
    constructor(tabela) { this.t = tabela; this.op = 'select'; this.filtros = []; this.ordem = []; this.lim = null; this.um = false; this.retornar = false; }
    select() { if (this.op !== 'select') this.retornar = true; return this; }
    insert(linhas) { this.op = 'insert'; this.dados = Array.isArray(linhas) ? linhas : [linhas]; return this; }
    update(obj) { this.op = 'update'; this.dados = obj; return this; }
    delete() { this.op = 'delete'; return this; }
    eq(col, v) { this.filtros.push((r) => r[col] === v); return this; }
    order(col, o) { this.ordem.push([col, !o || o.ascending !== false]); return this; }
    limit(n) { this.lim = n; return this; }
    single() { this.um = true; return this; }
    maybeSingle() { this.um = 'talvez'; return this; }
    then(ok, falha) { return new Promise((r) => setTimeout(() => r(this.executar()), 60)).then(ok, falha); }

    linhas() {
      if (this.t === 'catalogo_publico') return vitrine();
      if (this.t === 'configuracoes') return db().configuracoes;
      if (this.t === 'produtos') return ehAdmin() ? db().produtos : [];
      return null;
    }
    executar() {
      const base = this.linhas();
      if (base === null) return erro('Tabela inexistente: ' + this.t);
      const escrita = this.op !== 'select';
      if (escrita && this.t === 'catalogo_publico') return erro('Somente leitura');
      if (escrita && !ehAdmin()) return erro('new row violates row-level security policy', '42501');
      let res;
      if (this.op === 'select') {
        res = base.filter((r) => this.filtros.every((fn) => fn(r))).map(copia);
      } else if (this.op === 'insert') {
        res = [];
        for (const d of this.dados) {
          const e = this.validar(d, null); if (e) return e;
          const agora = new Date().toISOString();
          const novo = Object.assign({ id: d.id || ('demo-' + Math.random().toString(36).slice(2)), mostrar_preco: true, status: 'disponivel', aplicacoes: [], fotos: [], publicado: true, criado_em: agora, atualizado_em: agora }, copia(d));
          db().produtos.push(novo); res.push(copia(novo));
        }
      } else if (this.op === 'update') {
        res = [];
        const alvo = (this.t === 'configuracoes' ? db().configuracoes : db().produtos).filter((r) => this.filtros.every((fn) => fn(r)));
        for (const r of alvo) {
          if (this.t === 'produtos') { const e = this.validar(Object.assign({}, r, this.dados), r.id); if (e) return e; }
          Object.assign(r, copia(this.dados), { atualizado_em: new Date().toISOString() });
          res.push(copia(r));
        }
      } else {
        const lista = db().produtos; res = [];
        for (let i = lista.length - 1; i >= 0; i--) if (this.filtros.every((fn) => fn(lista[i]))) res.push(lista.splice(i, 1)[0]);
      }
      if (escrita) salvar();
      for (const [col, asc] of this.ordem.slice().reverse()) {
        res.sort((a, b) => {
          const x = a[col], y = b[col];
          if (x == null && y == null) return 0; if (x == null) return 1; if (y == null) return -1;
          const c = typeof x === 'number' ? x - y : String(x).localeCompare(String(y), 'pt-BR');
          return asc ? c : -c;
        });
      }
      if (this.lim != null) res = res.slice(0, this.lim);
      if (escrita && !this.retornar && !this.um) return { data: null, error: null };
      if (this.um) {
        if (!res.length) return this.um === 'talvez' ? { data: null, error: null } : erro('Nenhum registro encontrado', 'PGRST116');
        return { data: res[0], error: null };
      }
      return { data: res, error: null };
    }
    validar(p, idAtual) {
      if (!p.nome || !String(p.nome).trim()) return erro('violates check constraint "produtos_nome_check"', '23514');
      if (!p.codigo || !String(p.codigo).trim()) return erro('violates check constraint "produtos_codigo_check"', '23514');
      const k = (x) => String(x.codigo).toLowerCase() + '|' + String(x.lote || '').toLowerCase();
      if (db().produtos.some((o) => o.id !== idAtual && k(o) === k(p))) return erro('duplicate key value violates unique constraint "produtos_codigo_lote_uk"', '23505');
      return null;
    }
  }

  /* ---------- fotos ---------- */
  const lerComoDataUrl = (blob) => new Promise((ok) => { const fr = new FileReader(); fr.onload = () => ok(fr.result); fr.readAsDataURL(blob); });
  const storage = {
    from() {
      return {
        async upload(caminho, blob) {
          if (!ehAdmin()) return erro('new row violates row-level security policy', '42501');
          db().arquivos[caminho] = await lerComoDataUrl(blob); salvar();
          return { data: { path: caminho }, error: null };
        },
        getPublicUrl(caminho) { return { data: { publicUrl: db().arquivos[caminho] || '' } }; },
        async remove(caminhos) {
          if (!ehAdmin()) return erro('new row violates row-level security policy', '42501');
          caminhos.forEach((c) => delete db().arquivos[c]); salvar();
          return { data: caminhos, error: null };
        }
      };
    }
  };

  /* ---------- login ---------- */
  const ouvintes = [];
  const avisar = (ev) => ouvintes.forEach((fn) => fn(ev, db().sessao));
  const auth = {
    async getSession() { return { data: { session: db().sessao }, error: null }; },
    async signInWithPassword({ email, password }) {
      await new Promise((r) => setTimeout(r, 80));
      if (!email || password !== SENHA_DEMO) return { data: {}, error: { message: 'Invalid login credentials' } };
      db().sessao = { user: { email: String(email).toLowerCase() } }; salvar(); avisar('SIGNED_IN');
      return { data: { session: db().sessao }, error: null };
    },
    async signOut() { db().sessao = null; salvar(); avisar('SIGNED_OUT'); return { error: null }; },
    onAuthStateChange(fn) { ouvintes.push(fn); return { data: { subscription: { unsubscribe() { ouvintes.splice(ouvintes.indexOf(fn), 1); } } } }; }
  };

  window.DemoSupabase = {
    SENHA_DEMO, EMAIL_DEMO: ADMINS[0],
    createClient() {
      return {
        from: (t) => new Consulta(t), storage, auth,
        rpc: async (nome) => nome === 'is_admin' ? { data: ehAdmin(), error: null } : erro('Função inexistente')
      };
    },
    reiniciar() { memoria = semente(); salvar(); }
  };
})();
