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

  /* O que aparece no site — configuração geral (vale para todas as pedras).
     'preco' usa a coluna mostrar_preco; os demais ficam em configuracoes.exibir. */
  const CAMPOS_EXIBICAO = [
    { k: 'preco', rotulo: 'Preço por m²', ajuda: 'Desligado, o site mostra “Valor sob consulta”.' },
    { k: 'codigo', rotulo: 'Código' },
    { k: 'lote', rotulo: 'Lote' },
    { k: 'tipo', rotulo: 'Tipo de pedra' },
    { k: 'cor', rotulo: 'Cor' },
    { k: 'acabamento', rotulo: 'Acabamento' },
    { k: 'espessura', rotulo: 'Espessura' },
    { k: 'medidas', rotulo: 'Medida da chapa', ajuda: 'Comprimento × altura e m² por chapa.' },
    { k: 'estoque', rotulo: 'Estoque', ajuda: 'Chapas no lote e total em m².' },
    { k: 'origem', rotulo: 'Origem' },
    { k: 'aplicacoes', rotulo: 'Indicado para' },
    { k: 'observacoes', rotulo: 'Observações' },
    { k: 'situacao', rotulo: 'Situação', ajuda: 'Selos Disponível, Reservado, Esgotado…' },
    { k: 'videos', rotulo: 'Vídeos' },
    { k: 'whatsapp', rotulo: 'Botão do WhatsApp' }
  ];
  function exibe(config, campo) {
    if (!config) return true;
    if (campo === 'preco') return config.mostrar_preco !== false;
    const e = config.exibir || {};
    return e[campo] !== false;
  }
  /* Garante no navegador o mesmo que a vitrine do banco já faz (proteção dupla) */
  function aplicarExibicao(p, config) {
    const x = Object.assign({}, p);
    const zera = { codigo: ['codigo'], lote: ['lote'], tipo: ['tipo'], cor: ['cor'], origem: ['origem'], acabamento: ['acabamento'],
      espessura: ['espessura_cm'], medidas: ['comprimento_cm', 'altura_cm'], estoque: ['qtd_chapas'], observacoes: ['observacoes'] };
    for (const [campo, cols] of Object.entries(zera)) if (!exibe(config, campo)) cols.forEach((col) => (x[col] = null));
    if (!exibe(config, 'aplicacoes')) x.aplicacoes = [];
    if (!exibe(config, 'preco')) x.preco_m2 = null;
    if (!exibe(config, 'videos')) x.fotos = (Array.isArray(x.fotos) ? x.fotos : []).filter((f) => !(f && f.v));
    return x;
  }

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
     COMPACTAR VÍDEO no próprio celular antes de enviar
     - converte para H.264 (MP4) com no máximo 1920 px no lado maior (1080p)
     - taxa ajustada para o arquivo ficar até ~45 MB; vídeos curtos ficam bem menores
     - sem áudio (vídeos de chapa não precisam de som e o arquivo fica mais leve)
     - leva mais ou menos o tempo do vídeo; a tela precisa ficar aberta
     ===================================================================== */
  const MUXER_URL = 'https://cdn.jsdelivr.net/npm/mp4-muxer@5.2.2/build/mp4-muxer.js';
  const ALVO_MB = 45, TAXA_MAX = 6e6, TAXA_MIN = 2e6;
  function carregarMuxer() {
    if (window.Mp4Muxer) return Promise.resolve(window.Mp4Muxer);
    return new Promise((ok, erro) => {
      const s = document.createElement('script'); s.src = MUXER_URL;
      s.onload = () => (window.Mp4Muxer ? ok(window.Mp4Muxer) : erro(new Error('compactador não carregou')));
      s.onerror = () => erro(new Error('Sem internet para carregar o compactador de vídeo.'));
      document.head.appendChild(s);
    });
  }
  const podeCompactar = () => typeof window.VideoEncoder === 'function' && typeof window.VideoFrame === 'function';

  async function compactarVideo(arquivo, aoProgresso) {
    aoProgresso = aoProgresso || (() => {});
    if (!podeCompactar()) throw Object.assign(new Error('Este navegador não consegue compactar vídeo. Atualize o iPhone (iOS 17 ou mais novo).'), { codigo: 'sem-suporte' });
    const Mp4 = await carregarMuxer();
    const url = URL.createObjectURL(arquivo);
    const v = document.createElement('video');
    v.muted = true; v.playsInline = true; v.setAttribute('playsinline', ''); v.preload = 'auto'; v.src = url;
    v.style.cssText = 'position:fixed;left:-9999px;top:0;width:2px;height:2px;opacity:0;pointer-events:none';
    document.body.appendChild(v);
    let encoder = null;
    const limpar = () => { try { v.pause(); } catch (e) {} v.remove(); URL.revokeObjectURL(url); if (encoder && encoder.state !== 'closed') try { encoder.close(); } catch (e) {} };
    try {
      await new Promise((ok, erro) => { v.onloadedmetadata = ok; v.onerror = () => erro(Object.assign(new Error('Não consegui abrir esse vídeo.'), { codigo: 'formato' })); setTimeout(() => erro(new Error('O vídeo demorou demais para abrir.')), 20000); });
      const duracao = v.duration;
      if (!(duracao > 0) || !isFinite(duracao)) throw new Error('Não consegui ler a duração do vídeo.');
      const taxaIdeal = (ALVO_MB * 1048576 * 8) / duracao;
      if (taxaIdeal < TAXA_MIN) throw Object.assign(new Error(`Vídeo longo demais (${Math.round(duracao)} s). Envie trechos de até ${fmtNum((ALVO_MB * 8388608) / TAXA_MIN / 60, 1)} min.`), { codigo: 'longo' });
      const taxa = Math.round(Math.min(TAXA_MAX, taxaIdeal * 0.92));
      const esc = Math.min(1, 1920 / Math.max(v.videoWidth, v.videoHeight));
      const W = Math.max(2, Math.round(v.videoWidth * esc / 2) * 2), H = Math.max(2, Math.round(v.videoHeight * esc / 2) * 2);
      let config = null;
      for (const codec of ['avc1.640028', 'avc1.4d0028', 'avc1.42002a', 'avc1.42001f']) {
        const c = { codec, width: W, height: H, bitrate: taxa, framerate: 30, latencyMode: 'quality', avc: { format: 'avc' } };
        try { const r = await VideoEncoder.isConfigSupported(c); if (r.supported) { config = r.config; break; } } catch (e) {}
      }
      if (!config) throw Object.assign(new Error('Este celular não consegue gerar vídeo MP4 no navegador.'), { codigo: 'sem-suporte' });
      const alvo = new Mp4.ArrayBufferTarget();
      const muxer = new Mp4.Muxer({ target: alvo, video: { codec: 'avc', width: W, height: H }, fastStart: 'in-memory', firstTimestampBehavior: 'offset' });
      let erroEnc = null;
      encoder = new VideoEncoder({ output: (chunk, meta) => muxer.addVideoChunk(chunk, meta), error: (e) => { erroEnc = e; } });
      encoder.configure(config);
      const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
      const ctx = cv.getContext('2d', { alpha: false });
      let ultimoT = -1, quadros = 0, ultimaChave = -10;
      const capturar = (t) => {
        if (t <= ultimoT || erroEnc) return;
        ultimoT = t;
        ctx.drawImage(v, 0, 0, W, H);
        const frame = new VideoFrame(cv, { timestamp: Math.round(t * 1e6) });
        const chave = t - ultimaChave >= 2; if (chave) ultimaChave = t;
        encoder.encode(frame, { keyFrame: chave }); frame.close(); quadros++;
        aoProgresso(Math.min(0.99, t / duracao));
        if (encoder.encodeQueueSize > 30) v.pause(), setTimeout(() => { if (!v.ended) v.play().catch(() => {}); }, 60);
      };
      const voltar = () => { if (document.visibilityState === 'visible' && v.paused && !v.ended) v.play().catch(() => {}); };
      document.addEventListener('visibilitychange', voltar);
      await new Promise((ok, erro) => {
        const usarRVFC = typeof v.requestVideoFrameCallback === 'function';
        const passo = (agora, meta) => { capturar(meta ? meta.mediaTime : v.currentTime); if (!v.ended) v.requestVideoFrameCallback(passo); };
        let timer = null;
        if (usarRVFC) v.requestVideoFrameCallback(passo);
        else timer = setInterval(() => capturar(v.currentTime), 1000 / 30);
        v.onended = () => { if (timer) clearInterval(timer); capturar(duracao); ok(); };
        v.onerror = () => { if (timer) clearInterval(timer); erro(new Error('O vídeo parou de tocar durante a compactação.')); };
        v.play().catch((e) => erro(e));
      });
      document.removeEventListener('visibilitychange', voltar);
      await encoder.flush();
      if (erroEnc) throw erroEnc;
      muxer.finalize();
      if (quadros < 2) throw new Error('A compactação não capturou o vídeo. Mantenha a tela aberta e tente de novo.');
      aoProgresso(1);
      return { blob: new Blob([alvo.buffer], { type: 'video/mp4' }), duracao, largura: W, altura: H, quadros };
    } finally { limpar(); }
  }

  /* =====================================================================
     FILTROS — usados no catálogo (modo 'publico') e no painel (modo 'admin').
     Monta uma folha de filtros, guarda o estado e filtra/ordena a lista.
     ===================================================================== */
  function Filtros(opcoes) {
    const modo = opcoes.modo || 'publico';
    let semSituacao = !!opcoes.semSituacao;
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
        ${temPreco ? `<fieldset class="faixa"><legend>Faixa de preço por m²</legend>
          <div class="faixa-campos">
            <label class="campo"><span>Mínimo</span><span class="com-prefixo"><i aria-hidden="true">R$</i><input id="flt-preco-min" type="text" inputmode="decimal" placeholder="0,00" aria-label="Preço mínimo por m², em reais"></span></label>
            <label class="campo"><span>Máximo</span><span class="com-prefixo"><i aria-hidden="true">R$</i><input id="flt-preco-max" type="text" inputmode="decimal" placeholder="sem limite" aria-label="Preço máximo por m², em reais"></span></label>
          </div><small class="ajuda-faixa">Preencha só um dos dois se quiser. Ex.: máximo 500 mostra pedras de até R$ 500/m².</small></fieldset>` : ''}
        ${temArea ? `<label class="campo"><span>Estoque mínimo do lote (m²)</span><input id="flt-area-min" type="text" inputmode="decimal" placeholder="Ex.: 20"><small>Mostra só lotes com pelo menos essa metragem.</small></label>` : ''}
        <div class="filtros-grade">${modo === 'admin' ? statusAdmin : (semSituacao ? '' : statusPublico)}</div>
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
      semSituacao() { semSituacao = true; },
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
    CAMPOS_EXIBICAO, exibe, aplicarExibicao,
    temVideo, fmtDuracao, LIMITE_VIDEO_MB, tipoVideo, extVideo, gerarCapa, Filtros, compactarVideo, podeCompactar,
    comprimirImagem, rotuloStatus, badgeStatus, semAcento, avisoDemo
  };
})();
