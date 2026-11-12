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

  /* fotos: aceita ["caminho.jpg"] ou [{g:"grande.jpg", p:"pequena.jpg"}] */
  function normalizarFotos(fotos) {
    return (Array.isArray(fotos) ? fotos : []).map((f) =>
      typeof f === 'string' ? { g: f, p: f } : { g: f.g, p: f.p || f.g }).filter((f) => f.g);
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

  window.Catalogo = {
    MODO_DEMO, TIPOS, ACABAMENTOS, APLICACOES, ESPESSURAS, STATUS,
    criarCliente, esc, fmtBRL, fmtNum, lerNumero, areas, emCm, normalizarFotos, urlFoto,
    comprimirImagem, rotuloStatus, badgeStatus, semAcento, avisoDemo
  };
})();
