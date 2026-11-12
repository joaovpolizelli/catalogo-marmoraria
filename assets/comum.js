/* Funções e listas compartilhadas entre o catálogo e o painel */
(function () {
  'use strict';

  const CFG = window.CATALOGO_CONFIG || {};
  const MODO_DEMO = !CFG.SUPABASE_URL || /COLE_AQUI/.test(CFG.SUPABASE_URL) ||
    !CFG.SUPABASE_ANON_KEY || /COLE_AQUI/.test(CFG.SUPABASE_ANON_KEY);

  const TIPOS = ['Mármore', 'Granito', 'Quartzito', 'Quartzo (industrializado)', 'Travertino',
    'Ônix', 'Limestone', 'Ardósia', 'Superfície sinterizada', 'Outro'];
  const ACABAMENTOS = ['Polido', 'Levigado (fosco)', 'Escovado', 'Apicoado', 'Flameado',
    'Jateado', 'Bruto', 'Outro'];
  const APLICACOES = ['Bancada de cozinha', 'Banheiro / lavatório', 'Piso interno', 'Piso externo',
    'Parede / revestimento', 'Escada', 'Área gourmet / churrasqueira', 'Mesa / móveis', 'Fachada'];
  const ESPESSURAS = [1, 2, 3];
  const STATUS = {
    disponivel: { rotulo: 'Disponível', cls: 'ok' },
    reservado: { rotulo: 'Reservado', cls: 'aviso' },
    sob_consulta: { rotulo: 'Sob consulta', cls: 'neutro' },
    esgotado: { rotulo: 'Esgotado', cls: 'fim' }
  };

  function criarCliente() {
    if (MODO_DEMO) return window.DemoSupabase.createClient();
    if (!window.supabase || !window.supabase.createClient) {
      throw new Error('Não foi possível carregar o Supabase. Verifique a internet e recarregue a página.');
    }
    return window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY);
  }

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const fmtBRL = (v) => v == null || v === '' || isNaN(Number(v)) ? '' :
    Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const fmtNum = (v, casas = 2) => v == null || v === '' || isNaN(Number(v)) ? '' :
    Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: casas });

  /* Aceita "1.250,50", "1250,5", "1250.5", "R$ 1.250" → número; vazio → null; inválido → NaN */
  function lerNumero(txt) {
    let s = String(txt == null ? '' : txt).replace(/[R$\s]/g, '').trim();
    if (!s) return null;
    if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
    else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
    const n = Number(s);
    return isFinite(n) ? n : NaN;
  }

  /* Medidas ficam guardadas em cm. Valor abaixo de 20 só pode ter sido digitado
     em metros (nenhuma chapa tem menos de 20 cm), então converte. */
  const emCm = (v) => { const n = Number(v); return n > 0 && n < 20 ? Math.round(n * 10000) / 100 : n; };

  /* m² de uma chapa e total do lote */
  function areas(p) {
    const c = emCm(p.comprimento_cm), a = emCm(p.altura_cm);
    if (!(c > 0 && a > 0)) return { chapa: null, total: null };
    const chapa = (c * a) / 10000;
    const q = Number(p.qtd_chapas);
    return { chapa, total: q > 0 ? chapa * q : null };
  }

  /* mídias da pedra (campo "fotos"): aceita ["caminho.jpg"], {g, p} para foto
     e {v, p, d} para vídeo (v = arquivo do vídeo, p = capa, d = duração em s) */
  function normalizarFotos(fotos) {
    return (Array.isArray(fotos) ? fotos : []).map((f) => {
      if (typeof f === 'string') return { tipo: 'foto', g: f, p: f };
      if (f && f.v) return { tipo: 'video', v: f.v, g: f.v, p: f.p || '', d: f.d || null };
      return f && f.g ? { tipo: 'foto', g: f.g, p: f.p || f.g } : null;
    }).filter(Boolean);
  }
  const temVideo = (fotos) => normalizarFotos(fotos).some((m) => m.tipo === 'video');
  const fmtDuracao = (s) => { s = Math.round(Number(s) || 0); return s ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : ''; };

  /* Vídeo: vai do jeito que saiu do celular (qualidade original).
     Limite por arquivo do plano gratuito do Supabase: 50 MB. */
  const LIMITE_VIDEO_MB = 50;
  function tipoVideo(arquivo) {
    if (arquivo.type) return arquivo.type;
    const ext = (arquivo.name.split('.').pop() || '').toLowerCase();
    return { mov: 'video/quicktime', mp4: 'video/mp4', m4v: 'video/x-m4v', webm: 'video/webm', '3gp': 'video/3gpp' }[ext] || 'video/mp4';
  }
  function extVideo(arquivo) {
    const ext = (arquivo.name.split('.').pop() || '').toLowerCase();
    if (/^(mov|mp4|m4v|webm|3gp)$/.test(ext)) return ext;
    const t = tipoVideo(arquivo);
    return /quicktime/.test(t) ? 'mov' : /webm/.test(t) ? 'webm' : 'mp4';
  }
  /* Tira uma "capa" do vídeo (quadro de 0,5 s). Se o navegador não conseguir
     ler o vídeo, devolve sem capa — o envio continua normalmente. */
  async function gerarCapa(arquivo) {
    const url = URL.createObjectURL(arquivo);
    const v = document.createElement('video');
    v.muted = true; v.playsInline = true; v.setAttribute('playsinline', ''); v.preload = 'auto'; v.src = url;
    try {
      await new Promise((ok, erro) => {
        v.onloadeddata = ok; v.onerror = () => erro(new Error('formato'));
        setTimeout(() => erro(new Error('tempo')), 15000);
      });
      const duracao = isFinite(v.duration) ? v.duration : null;
      await new Promise((ok) => { v.onseeked = ok; v.currentTime = Math.min(0.5, (duracao || 1) / 2); setTimeout(ok, 4000); });
      const w = v.videoWidth, h = v.videoHeight;
      if (!w || !h) return { capa: null, duracao };
      const e = Math.min(1, 960 / Math.max(w, h));
      const cv = document.createElement('canvas');
      cv.width = Math.round(w * e); cv.height = Math.round(h * e);
      cv.getContext('2d').drawImage(v, 0, 0, cv.width, cv.height);
      const capa = await new Promise((ok) => cv.toBlob(ok, 'image/jpeg', 0.8));
      return { capa, duracao };
    } catch (e) {
      return { capa: null, duracao: null };
    } finally { URL.revokeObjectURL(url); v.removeAttribute('src'); v.load(); }
  }
  function urlFoto(cliente, caminho) {
    if (!caminho) return '';
    if (/^(data:|blob:|https?:)/.test(caminho)) return caminho;
    return cliente.storage.from('fotos').getPublicUrl(caminho).data.publicUrl;
  }

  /* Reduz a foto no próprio celular antes de enviar (economiza espaço e internet) */
  async function comprimirImagem(arquivo, ladoMax, qualidade) {
    let fonte;
    try {
      fonte = await createImageBitmap(arquivo, { imageOrientation: 'from-image' });
    } catch (e) {
      fonte = await new Promise((ok, erro) => {
        const img = new Image();
        img.onload = () => ok(img);
        img.onerror = () => erro(new Error('Não consegui abrir essa imagem. Tente outra foto.'));
        img.src = URL.createObjectURL(arquivo);
      });
    }
    const w = fonte.width, h = fonte.height;
    const esc = Math.min(1, ladoMax / Math.max(w, h));
    const cv = document.createElement('canvas');
    cv.width = Math.round(w * esc); cv.height = Math.round(h * esc);
    cv.getContext('2d').drawImage(fonte, 0, 0, cv.width, cv.height);
    if (fonte.close) fonte.close();
    return await new Promise((ok, erro) => cv.toBlob((b) => b ? ok(b) : erro(new Error('Falha ao processar a foto.')),
      'image/jpeg', qualidade));
  }

  function rotuloStatus(s) { return (STATUS[s] || STATUS.disponivel).rotulo; }
  function badgeStatus(s) {
    const st = STATUS[s] || STATUS.disponivel;
    return `<span class="badge ${st.cls}">${st.rotulo}</span>`;
  }

  /* Texto normalizado para busca sem acento */
  const semAcento = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

  function avisoDemo() {
    if (!MODO_DEMO) return;
    const d = document.createElement('div');
    d.className = 'faixa-demo';
    d.innerHTML = '<strong>Modo demonstração</strong> — dados de exemplo salvos só neste aparelho.';
    document.body.prepend(d);
  }

  /* =====================================================================
     FILTROS — usados no catálogo (modo 'publico') e no painel (modo 'admin').
     Monta uma folha de filtros, guarda o estado e filtra/ordena a lista.
     ===================================================================== */
  function Filtros(opcoes) {
    const modo = opcoes.modo || 'publico';
    const aoMudar = opcoes.aoMudar || (() => {});
    const padrao = () => ({ busca: '', tipo: '', cor: '', acabamento: '', espessura: '', aplicacao: '', origem: '',
      precoMin: '', precoMax: '', areaMin: '', status: modo === 'publico' ? 'ativos' : '', publicado: '', semFoto: false, comVideo: false });
    let estado = padrao(), produtos = [];

    const uniq = (vals) => [...new Set(vals.filter((v) => v != null && v !== ''))].sort((a, b) =>
      typeof a === 'number' ? a - b : String(a).localeCompare(String(b), 'pt-BR'));
    const grupoOrigem = (o) => (o ? String(o).split('(')[0].trim() : '');
    const texto = (p) => semAcento([p.nome, p.codigo, p.lote, p.cor, p.tipo, p.origem, p.acabamento].join(' '));
    const totalM2 = (p) => areas(p).total;

    function passa(p, e) {
      e = e || estado;
      const termos = semAcento(e.busca).split(/\s+/).filter(Boolean);
      if (termos.length) { const t = texto(p); if (!termos.every((x) => t.includes(x))) return false; }
      if (e.tipo && p.tipo !== e.tipo) return false;
      if (e.cor && p.cor !== e.cor) return false;
      if (e.acabamento && p.acabamento !== e.acabamento) return false;
      if (e.espessura && Number(p.espessura_cm) !== Number(e.espessura)) return false;
      if (e.aplicacao && !(p.aplicacoes || []).includes(e.aplicacao)) return false;
      if (e.origem && grupoOrigem(p.origem) !== e.origem) return false;
      const pmin = lerNumero(e.precoMin), pmax = lerNumero(e.precoMax);
      if ((pmin > 0 || pmax > 0) && p.preco_m2 == null) return false;
      if (pmin > 0 && Number(p.preco_m2) < pmin) return false;
      if (pmax > 0 && Number(p.preco_m2) > pmax) return false;
      const amin = lerNumero(e.areaMin);
      if (amin > 0 && !(totalM2(p) >= amin)) return false;
      if (e.status === 'ativos' && p.status === 'esgotado') return false;
      if (e.status && e.status !== 'ativos' && p.status !== e.status) return false;
      if (e.publicado === 'sim' && !p.publicado) return false;
      if (e.publicado === 'nao' && p.publicado) return false;
      if (e.semFoto && normalizarFotos(p.fotos).some((m) => m.tipo === 'foto')) return false;
      if (e.comVideo && !temVideo(p.fotos)) return false;
      return true;
    }

    function ordenar(lista, ordem) {
      const porNome = (a, b) => String(a.nome).localeCompare(String(b.nome), 'pt-BR');
      const num = (v) => (v == null || v === '' ? null : Number(v));
      const nulosNoFim = (x, y, desc) => (x == null && y == null ? 0 : x == null ? 1 : y == null ? -1 : desc ? y - x : x - y);
      return lista.slice().sort((a, b) => {
        let r = 0;
        if (ordem === 'recentes') r = String(b.atualizado_em || '').localeCompare(String(a.atualizado_em || ''));
        else if (ordem === 'menor') r = nulosNoFim(num(a.preco_m2), num(b.preco_m2), false);
        else if (ordem === 'maior') r = nulosNoFim(num(a.preco_m2), num(b.preco_m2), true);
        else if (ordem === 'estoque') r = nulosNoFim(totalM2(a), totalM2(b), true);
        return r || porNome(a, b);
      });
    }

    /* ---------- folha de filtros ---------- */
    const fundo = document.createElement('div');
    fundo.className = 'filtros-fundo'; fundo.hidden = true;
    fundo.innerHTML = `<div class="filtros-folha" role="dialog" aria-modal="true" aria-labelledby="flt-titulo">
      <div class="filtros-topo"><h2 id="flt-titulo">Filtros</h2><button type="button" class="fechar-filtros" aria-label="Fechar filtros">×</button></div>
      <div class="filtros-corpo"></div>
      <div class="filtros-rodape"><button type="button" class="botao" id="flt-limpar">Limpar</button>
        <button type="button" class="botao primario" id="flt-ver">Ver resultados</button></div></div>`;
    document.body.appendChild(fundo);
    const corpo = fundo.querySelector('.filtros-corpo');

    const sel = (id, rotulo, valores, rotuloTodos, fmt) => valores.length < 1 ? '' :
      `<label class="campo"><span>${rotulo}</span><select id="${id}"><option value="">${rotuloTodos}</option>${valores.map((v) =>
        `<option value="${esc(v)}">${esc(fmt ? fmt(v) : v)}</option>`).join('')}</select></label>`;

    function montar() {
      const temPreco = produtos.some((p) => p.preco_m2 != null);
      const temArea = produtos.some((p) => totalM2(p) > 0);
      const statusPublico = `<label class="campo"><span>Disponibilidade</span><select id="flt-status">
          <option value="ativos">Ocultar esgotados</option><option value="disponivel">Só disponíveis</option>
          <option value="reservado">Só reservados</option><option value="sob_consulta">Só sob consulta</option><option value="">Mostrar todos</option></select></label>`;
      const statusAdmin = `<label class="campo"><span>Situação</span><select id="flt-status"><option value="">Todas</option>${Object.entries(STATUS).map(([k, v]) =>
          `<option value="${k}">${v.rotulo}</option>`).join('')}</select></label>
        <label class="campo"><span>No site</span><select id="flt-publicado"><option value="">Todas</option>
          <option value="sim">Aparecendo no site</option><option value="nao">Fora do site</option></select></label>`;
      corpo.innerHTML = `
        <div class="filtros-grade">
          ${sel('flt-tipo', 'Tipo de pedra', uniq(produtos.map((p) => p.tipo)), 'Todos')}
          ${sel('flt-cor', 'Cor', uniq(produtos.map((p) => p.cor)), 'Todas')}
          ${sel('flt-acabamento', 'Acabamento', uniq(produtos.map((p) => p.acabamento)), 'Todos')}
          ${sel('flt-espessura', 'Espessura', uniq(produtos.map((p) => p.espessura_cm == null ? null : Number(p.espessura_cm))), 'Todas', (v) => fmtNum(v) + ' cm')}
          ${sel('flt-aplicacao', 'Indicado para', uniq(produtos.flatMap((p) => p.aplicacoes || [])), 'Qualquer uso')}
          ${sel('flt-origem', 'Origem', uniq(produtos.map((p) => grupoOrigem(p.origem))), 'Todas')}
        </div>
        ${temPreco ? `<fieldset class="faixa"><legend>Preço por m² (R$)</legend>
          <label><span class="oculto-leitor">Preço mínimo</span><input id="flt-preco-min" type="text" inputmode="decimal" placeholder="de"></label>
          <span aria-hidden="true">até</span>
          <label><span class="oculto-leitor">Preço máximo</span><input id="flt-preco-max" type="text" inputmode="decimal" placeholder="até"></label></fieldset>` : ''}
        ${temArea ? `<label class="campo"><span>Estoque mínimo do lote (m²)</span><input id="flt-area-min" type="text" inputmode="decimal" placeholder="Ex.: 20"><small>Mostra só lotes com pelo menos essa metragem.</small></label>` : ''}
        <div class="filtros-grade">${modo === 'admin' ? statusAdmin : statusPublico}</div>
        <label class="marcar"><input type="checkbox" id="flt-video"> Só pedras com vídeo</label>
        ${modo === 'admin' ? '<label class="marcar"><input type="checkbox" id="flt-sem-foto"> Só pedras sem foto</label>' : ''}`;
      escreverNaTela();
    }

    const campos = { tipo: 'flt-tipo', cor: 'flt-cor', acabamento: 'flt-acabamento', espessura: 'flt-espessura', aplicacao: 'flt-aplicacao',
      origem: 'flt-origem', precoMin: 'flt-preco-min', precoMax: 'flt-preco-max', areaMin: 'flt-area-min', status: 'flt-status', publicado: 'flt-publicado' };
    const el = (id) => fundo.querySelector('#' + id);
    function escreverNaTela() {
      for (const [k, id] of Object.entries(campos)) {
        const x = el(id); if (!x) continue;
        if (x.tagName === 'SELECT' && estado[k] && ![...x.options].some((o) => o.value === String(estado[k]))) estado[k] = padrao()[k];
        x.value = estado[k];
      }
      if (el('flt-video')) el('flt-video').checked = estado.comVideo;
      if (el('flt-sem-foto')) el('flt-sem-foto').checked = estado.semFoto;
    }
    function lerDaTela() {
      const e = Object.assign({}, estado);
      for (const [k, id] of Object.entries(campos)) { const x = el(id); e[k] = x ? x.value : padrao()[k]; }
      e.comVideo = !!(el('flt-video') && el('flt-video').checked);
      e.semFoto = !!(el('flt-sem-foto') && el('flt-sem-foto').checked);
      return e;
    }
    function atualizarBotaoVer() {
      const n = produtos.filter((p) => passa(p, lerDaTela())).length;
      el('flt-ver').textContent = n === 1 ? 'Ver 1 pedra' : `Ver ${n} pedras`;
    }
    corpo.addEventListener('input', atualizarBotaoVer);
    corpo.addEventListener('change', atualizarBotaoVer);
    const fechar = () => { fundo.hidden = true; document.body.style.overflow = ''; if (opcoes.botao) opcoes.botao.focus(); };
    fundo.addEventListener('click', (ev) => {
      if (ev.target === fundo || ev.target.closest('.fechar-filtros')) return fechar();
      if (ev.target.closest('#flt-limpar')) {
        const busca = estado.busca; estado = padrao(); estado.busca = busca; escreverNaTela(); atualizarBotaoVer(); return;
      }
      if (ev.target.closest('#flt-ver')) { estado = lerDaTela(); fechar(); aoMudar(); }
    });
    fundo.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') fechar(); });

    function quantidadeAtivos() {
      const p = padrao();
      return ['tipo', 'cor', 'acabamento', 'espessura', 'aplicacao', 'origem', 'areaMin', 'status', 'publicado', 'semFoto', 'comVideo']
        .filter((k) => String(estado[k]) !== String(p[k])).length + ((estado.precoMin || estado.precoMax) ? 1 : 0);
    }

    return {
      definirProdutos(lista) { produtos = lista; montar(); },
      abrir() { escreverNaTela(); atualizarBotaoVer(); fundo.hidden = false; document.body.style.overflow = 'hidden'; const f = corpo.querySelector('select,input'); if (f) f.focus({ preventScroll: true }); },
      fechar,
      aplicar(lista, ordem) { return ordenar(lista.filter((p) => passa(p)), ordem); },
      definir(parcial) { Object.assign(estado, parcial); escreverNaTela(); },
      limpar() { estado = padrao(); escreverNaTela(); },
      get estado() { return Object.assign({}, estado); },
      quantidadeAtivos,
      temPreco: () => produtos.some((p) => p.preco_m2 != null)
    };
  }

  window.Catalogo = {
    MODO_DEMO, TIPOS, ACABAMENTOS, APLICACOES, ESPESSURAS, STATUS,
    criarCliente, esc, fmtBRL, fmtNum, lerNumero, areas, emCm, normalizarFotos, urlFoto,
    temVideo, fmtDuracao, LIMITE_VIDEO_MB, tipoVideo, extVideo, gerarCapa, Filtros,
    comprimirImagem, rotuloStatus, badgeStatus, semAcento, avisoDemo
  };
})();
