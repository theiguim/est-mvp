(() => {
  const STORAGE_KEY = 'observatorio-eventos-municipais:data:v1';
  const app = document.getElementById('app');
  const pageTitle = document.getElementById('pageTitle');
  const toastEl = document.getElementById('toast');
  const storageModeEl = document.getElementById('storageMode');
  const eventDialog = document.getElementById('eventDialog');
  const eventForm = document.getElementById('eventForm');
  const questionDialog = document.getElementById('questionDialog');
  const questionForm = document.getElementById('questionForm');
  const collectorDialog = document.getElementById('collectorDialog');
  const collectorForm = document.getElementById('collectorForm');

  let db = null;
  let canWriteFile = false;
  let selectedDashboardEventId = null;
  let compareA = null;
  let compareB = null;
  let collectStep = 0;
  let collectAnswers = {};

  const defaultGradients = [
    'linear-gradient(135deg,#086b5a,#20c997)',
    'linear-gradient(135deg,#0f172a,#38bdf8)',
    'linear-gradient(135deg,#7c2d12,#f59e0b)',
    'linear-gradient(135deg,#4c1d95,#a78bfa)',
    'linear-gradient(135deg,#14532d,#84cc16)'
  ];

  const standardQuestions = [
    { title: 'Cidade de origem', type: 'city', required: true, standard: true, metricKey: 'origin_city', order: 1, options: [] },
    { title: 'Estado', type: 'single_choice', required: true, standard: true, metricKey: 'origin_state', order: 2, options: ['MG','SP','RJ','ES','BA','GO','DF','Outro'] },
    { title: 'É morador(a) da cidade?', type: 'boolean', required: true, standard: true, metricKey: 'is_local_resident', order: 3, options: ['Sim','Não'] },
    { title: 'É turista?', type: 'boolean', required: true, standard: true, metricKey: 'is_tourist', order: 4, options: ['Sim','Não'] },
    { title: 'Faixa etária', type: 'single_choice', required: false, standard: true, metricKey: 'age_range', order: 5, options: ['Até 18','19 a 29','30 a 39','40 a 49','50 a 59','60+'] },
    { title: 'Tipo de hospedagem', type: 'single_choice', required: false, standard: true, metricKey: 'hotel_type', order: 6, options: ['Hotel','Pousada','Airbnb','Casa de familiares/amigos','Bate-volta','Não se aplica','Outro'] },
    { title: 'Quantidade de noites', type: 'number', required: false, standard: true, metricKey: 'nights_count', order: 7, options: [] },
    { title: 'Faixa de gasto no evento', type: 'single_choice', required: true, standard: true, metricKey: 'spent_range', order: 8, options: ['Até R$50','R$51 a R$100','R$101 a R$200','R$201 a R$500','Acima de R$500'] },
    { title: 'Setores onde consumiu', type: 'multi_choice', required: false, standard: true, metricKey: 'consumption_sectors', order: 9, options: ['Alimentação','Bebidas','Artesanato','Comércio local','Hospedagem','Transporte','Outro'] },
    { title: 'Nota geral do evento', type: 'rating', required: true, standard: true, metricKey: 'rating_general', order: 10, options: ['1','2','3','4','5'] },
    { title: 'Avaliação da estrutura', type: 'rating', required: false, standard: true, metricKey: 'rating_structure', order: 11, options: ['1','2','3','4','5'] },
    { title: 'Avaliação da segurança', type: 'rating', required: false, standard: true, metricKey: 'rating_security', order: 12, options: ['1','2','3','4','5'] },
    { title: 'Avaliação da limpeza', type: 'rating', required: false, standard: true, metricKey: 'rating_cleaning', order: 13, options: ['1','2','3','4','5'] },
    { title: 'Pretende voltar?', type: 'boolean', required: false, standard: true, metricKey: 'would_return', order: 14, options: ['Sim','Não'] },
    { title: 'Indicaria o evento?', type: 'boolean', required: false, standard: true, metricKey: 'would_recommend', order: 15, options: ['Sim','Não'] },
    { title: 'Comentário ou sugestão', type: 'textarea', required: false, standard: true, metricKey: 'comment', order: 16, options: [] }
  ];

  const fallbackDb = {
    version: 1,
    updatedAt: new Date().toISOString(),
    secretarias: [
      { id: 'sec-cultura', nome: 'Secretaria Municipal de Cultura e Turismo', sigla: 'Cultura' },
      { id: 'sec-agro', nome: 'Secretaria Municipal de Agropecuária', sigla: 'Agro' },
      { id: 'sec-saude', nome: 'Secretaria Municipal de Saúde', sigla: 'Saúde' }
    ],
    eventos: [],
    perguntas: [],
    coletores: [],
    respostas: []
  };

  function uid(prefix = 'id') {
    return `${prefix}-${Math.random().toString(16).slice(2, 10)}${Date.now().toString(16).slice(-4)}`;
  }

  function slugify(value) {
    return String(value || '')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase().trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || `evento-${Date.now()}`;
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function formatDate(value) {
    if (!value) return '-';
    const [year, month, day] = String(value).slice(0, 10).split('-');
    return `${day}/${month}/${year}`;
  }

  function formatCurrency(value) {
    return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
  }

  function formatNumber(value) {
    return Number(value || 0).toLocaleString('pt-BR');
  }

  function percent(value, digits = 0) {
    if (!Number.isFinite(value)) return '0%';
    return `${value.toFixed(digits).replace('.', ',')}%`;
  }

  function statusMeta(status) {
    const map = {
      rascunho: ['Rascunho', 'gray'],
      ativo: ['Ativo', 'blue'],
      coleta_aberta: ['Coleta aberta', 'green'],
      encerrado: ['Encerrado', 'amber'],
      arquivado: ['Arquivado', 'red']
    };
    return map[status] || ['Indefinido', 'gray'];
  }

  function toast(message) {
    const el = document.createElement('div');
    el.className = 'toast-message';
    el.textContent = message;
    toastEl.appendChild(el);
    setTimeout(() => el.remove(), 3400);
  }

  async function loadData() {
    const local = localStorage.getItem(STORAGE_KEY);
    try {
      const res = await fetch('/api/data', { cache: 'no-store' });
      if (res.ok && res.headers.get('X-Data-Mode') === 'file') {
        canWriteFile = true;
        db = await res.json();
        updateStorageMode();
        return;
      }
    } catch (_) {}

    if (local) {
      db = JSON.parse(local);
      canWriteFile = false;
      updateStorageMode();
      return;
    }

    try {
      const res = await fetch('db.json', { cache: 'no-store' });
      if (res.ok) {
        db = await res.json();
        canWriteFile = false;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
        updateStorageMode();
        return;
      }
    } catch (_) {}

    db = structuredClone(fallbackDb);
    createDemoEventIfNeeded();
    updateStorageMode();
  }

  function updateStorageMode() {
    storageModeEl.textContent = canWriteFile ? 'Arquivo db.json' : 'localStorage';
  }

  async function saveData(message = 'Dados salvos') {
    db.updatedAt = new Date().toISOString();
    if (canWriteFile) {
      try {
        const res = await fetch('/api/data', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(db)
        });
        if (!res.ok) throw new Error('Falha ao gravar arquivo');
        toast(message);
        return true;
      } catch (error) {
        canWriteFile = false;
        updateStorageMode();
        toast('Não consegui gravar no arquivo. Salvando no navegador.');
      }
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
    toast(message);
    return true;
  }

  function createDemoEventIfNeeded() {
    if (db.eventos.length) return;
    const event = {
      id: 'evt-demo', secretariaId: 'sec-cultura', nome: 'São João dos Queijos 2026', slug: 'sao-joao-dos-queijos-2026', categoria: 'Cultura e Turismo',
      descricao: 'Evento cultural e gastronômico com dados demonstrativos.', local: 'Praça Principal', cidade: 'São João del-Rei', dataInicio: '2026-06-12', dataFim: '2026-06-14', publicoEstimado: 12000,
      thumbnail: defaultGradients[2], status: 'coleta_aberta', createdAt: new Date().toISOString()
    };
    db.eventos.push(event);
    addStandardQuestions(event.id);
  }

  function addStandardQuestions(eventId) {
    const base = standardQuestions.map(q => ({ ...q, id: uid('q'), eventId }));
    db.perguntas.push(...base);
  }

  function eventById(id) { return db.eventos.find(e => e.id === id); }
  function eventBySlug(slug) { return db.eventos.find(e => e.slug === slug); }
  function secretariaById(id) { return db.secretarias.find(s => s.id === id); }
  function collectorByToken(token) { return db.coletores.find(c => c.token === token); }
  function questionsFor(eventId) { return db.perguntas.filter(q => q.eventId === eventId).sort((a,b) => (a.order || 0) - (b.order || 0)); }
  function responsesFor(eventId) { return db.respostas.filter(r => r.eventId === eventId); }
  function collectorsFor(eventId) { return db.coletores.filter(c => c.eventId === eventId); }

  function routeInfo() {
    const hash = location.hash.replace(/^#/, '') || 'dashboard';
    const [path, queryString = ''] = hash.split('?');
    const parts = path.split('/').filter(Boolean);
    const params = new URLSearchParams(queryString);
    return { name: parts[0] || 'dashboard', parts, params };
  }

  function setActiveNav(name) {
    document.querySelectorAll('.nav-link').forEach(link => {
      link.classList.toggle('active', link.dataset.route === name);
    });
  }

  function render() {
    const route = routeInfo();
    const mapTitle = {
      dashboard: 'Visão Geral',
      events: 'Eventos',
      event: 'Detalhe do Evento',
      compare: 'Comparação de Eventos',
      collect: 'Coleta Mobile',
      'collect-demo': 'Coleta Mobile'
    };
    pageTitle.textContent = mapTitle[route.name] || 'Observatório de Eventos Municipais';
    setActiveNav(route.name === 'event' ? 'events' : route.name);
    document.getElementById('sidebar').classList.remove('open');

    if (route.name === 'events') return renderEvents();
    if (route.name === 'event') return renderEventDetail(route.parts[1], route.params.get('tab') || 'overview');
    if (route.name === 'compare') return renderCompare();
    if (route.name === 'collect' || route.name === 'coleta') return renderCollect(route.parts[1], route.params.get('token') || route.params.get('collectorToken'));
    if (route.name === 'collect-demo') return renderCollectDemo();
    return renderDashboard();
  }

  function pageHead(title, subtitle, actions = '') {
    return `
      <div class="section-head">
        <div>
          <p class="eyebrow">Observatório municipal</p>
          <h2>${escapeHtml(title)}</h2>
          <p>${escapeHtml(subtitle)}</p>
        </div>
        <div class="section-actions">${actions}</div>
      </div>
    `;
  }

  function metricCard(label, value, hint = '', delta = '') {
    return `
      <article class="metric-card">
        <small>${escapeHtml(label)}</small>
        <strong>${value}</strong>
        ${hint ? `<span>${escapeHtml(hint)}</span>` : ''}
        ${delta ? delta : ''}
      </article>
    `;
  }

  function renderDashboard() {
    selectedDashboardEventId ||= db.eventos[0]?.id;
    const current = eventById(selectedDashboardEventId) || db.eventos[0];
    if (!current) {
      app.innerHTML = `${pageHead('Visão Geral', 'Cadastre o primeiro evento para iniciar o acompanhamento.', `<button class="btn primary" data-action="new-event">Novo evento</button>`)}${emptyState('Nenhum evento cadastrado', 'Crie um evento para começar a coletar dados.')}`;
      return;
    }
    const m = buildMetrics(current.id);
    app.innerHTML = `
      ${pageHead('Painel executivo', 'Acompanhe os principais indicadores de eventos em tempo real.', `
        <select class="btn ghost" id="dashboardEventSelect" aria-label="Selecionar evento">
          ${db.eventos.map(e => `<option value="${e.id}" ${e.id === current.id ? 'selected' : ''}>${escapeHtml(e.nome)}</option>`).join('')}
        </select>
        <a class="btn ghost" href="#event/${current.slug}?tab=dashboard">Abrir evento</a>
      `)}
      <div class="grid metrics">
        ${metricCard('Entrevistas', formatNumber(m.total), 'Respostas coletadas')}
        ${metricCard('Turistas', percent(m.touristPercent), 'Percentual da amostra')}
        ${metricCard('Gasto médio', formatCurrency(m.avgSpent), 'Estimativa declarada')}
        ${metricCard('Impacto projetado', formatCurrency(m.estimatedImpact), 'Público estimado × gasto médio')}
        ${metricCard('Nota geral', m.avgRating.toFixed(1).replace('.', ','), 'Média de 1 a 5')}
        ${metricCard('Pretendem voltar', percent(m.returnPercent), 'Intenção de retorno')}
        ${metricCard('Cidades alcançadas', formatNumber(m.uniqueCities), 'Origem dos entrevistados')}
        ${metricCard('Diárias estimadas', formatNumber(m.nightsTotal), 'Hospedagem informada')}
      </div>
      <div class="grid two" style="margin-top:16px">
        ${chartBar('Top cidades de origem', 'Cidades mais presentes na amostra.', m.topCities)}
        ${chartDonut('Turistas x moradores', 'Participação de visitantes não residentes.', m.touristPercent, 'turistas')}
        ${chartBar('Faixas de consumo', 'Distribuição de gasto declarado.', m.spentRanges)}
        ${chartLine('Entrevistas por hora', 'Ritmo de coleta durante o evento.', m.byHour)}
      </div>
    `;
    document.getElementById('dashboardEventSelect')?.addEventListener('change', event => {
      selectedDashboardEventId = event.target.value;
      renderDashboard();
    });
  }

  function renderEvents() {
    const query = sessionStorage.getItem('events:query') || '';
    const status = sessionStorage.getItem('events:status') || 'todos';
    const filtered = db.eventos.filter(e => {
      const q = `${e.nome} ${e.categoria} ${e.local} ${e.cidade}`.toLowerCase();
      return (!query || q.includes(query.toLowerCase())) && (status === 'todos' || e.status === status);
    });

    app.innerHTML = `
      ${pageHead('Eventos cadastrados', 'Crie, edite, acompanhe e compare eventos municipais.', `<button class="btn primary" data-action="new-event">Novo evento</button>`)}
      <div class="toolbar">
        <div class="searchbar">
          <input id="eventSearch" class="field-input" value="${escapeHtml(query)}" placeholder="Buscar evento, categoria ou local..." />
          <select id="eventStatusFilter">
            <option value="todos" ${status === 'todos' ? 'selected' : ''}>Todos os status</option>
            <option value="rascunho" ${status === 'rascunho' ? 'selected' : ''}>Rascunho</option>
            <option value="ativo" ${status === 'ativo' ? 'selected' : ''}>Ativo</option>
            <option value="coleta_aberta" ${status === 'coleta_aberta' ? 'selected' : ''}>Coleta aberta</option>
            <option value="encerrado" ${status === 'encerrado' ? 'selected' : ''}>Encerrado</option>
          </select>
        </div>
        <button class="btn ghost" data-action="reset-demo">Restaurar demo</button>
      </div>
      <div class="grid auto">
        ${filtered.map(eventCard).join('') || emptyState('Nenhum evento encontrado', 'Ajuste os filtros ou cadastre um novo evento.')}
      </div>
    `;
    document.getElementById('eventSearch')?.addEventListener('input', e => {
      sessionStorage.setItem('events:query', e.target.value);
      renderEvents();
    });
    document.getElementById('eventStatusFilter')?.addEventListener('change', e => {
      sessionStorage.setItem('events:status', e.target.value);
      renderEvents();
    });
  }

  function eventCard(e) {
    const [statusLabel, statusClass] = statusMeta(e.status);
    const sec = secretariaById(e.secretariaId)?.sigla || 'Secretaria';
    const responses = responsesFor(e.id).length;
    return `
      <article class="event-card">
        ${thumbHtml(e)}
        <div class="event-body">
          <div class="event-meta">
            <span class="badge ${statusClass}">${statusLabel}</span>
            <span class="badge blue">${escapeHtml(sec)}</span>
            <span class="badge gray">${formatNumber(responses)} entrevistas</span>
          </div>
          <h3>${escapeHtml(e.nome)}</h3>
          <p>${escapeHtml(e.descricao || 'Evento municipal cadastrado no observatório.')}</p>
          <div class="event-meta">
            <span class="badge gray">${formatDate(e.dataInicio)} a ${formatDate(e.dataFim)}</span>
            <span class="badge gray">${escapeHtml(e.local)}</span>
          </div>
          <div class="event-actions">
            <a class="btn primary small" href="#event/${e.slug}?tab=dashboard">Dashboard</a>
            <a class="btn ghost small" href="#event/${e.slug}?tab=overview">Gerenciar</a>
            <button class="btn ghost small" data-action="edit-event" data-id="${e.id}">Editar</button>
          </div>
        </div>
      </article>
    `;
  }

  function thumbHtml(e) {
    const thumb = e.thumbnail || defaultGradients[Math.floor(Math.random() * defaultGradients.length)];
    if (String(thumb).startsWith('data:image') || String(thumb).startsWith('http')) {
      return `<div class="event-thumb"><img src="${escapeHtml(thumb)}" alt="Arte do evento ${escapeHtml(e.nome)}"></div>`;
    }
    return `<div class="event-thumb" style="background:${escapeHtml(thumb)}"></div>`;
  }

  function renderEventDetail(slug, tab = 'overview') {
    const e = eventBySlug(slug) || eventById(slug);
    if (!e) {
      app.innerHTML = emptyState('Evento não encontrado', 'Volte para a lista de eventos e selecione um item válido.');
      return;
    }
    const [statusLabel, statusClass] = statusMeta(e.status);
    const tabs = [
      ['overview','Visão geral'], ['questionnaire','Questionário'], ['collectors','Coletores'], ['dashboard','Dashboard'], ['compare','Comparação'], ['exports','Exportações']
    ];
    app.innerHTML = `
      ${pageHead(e.nome, `${e.categoria} · ${e.local} · ${formatDate(e.dataInicio)} a ${formatDate(e.dataFim)}`, `
        <button class="btn ghost" data-action="edit-event" data-id="${e.id}">Editar evento</button>
        <a class="btn primary" href="#collect-demo">Testar coleta</a>
      `)}
      <div class="tabs">
        ${tabs.map(([key,label]) => `<a class="tab-btn ${tab === key ? 'active' : ''}" href="#event/${e.slug}?tab=${key}">${label}</a>`).join('')}
      </div>
      <div id="eventTabContent"></div>
    `;
    const container = document.getElementById('eventTabContent');
    if (tab === 'questionnaire') container.innerHTML = renderQuestionnaire(e);
    else if (tab === 'collectors') container.innerHTML = renderCollectors(e);
    else if (tab === 'dashboard') container.innerHTML = renderEventDashboard(e);
    else if (tab === 'compare') container.innerHTML = renderEventCompareTab(e);
    else if (tab === 'exports') container.innerHTML = renderExports(e);
    else container.innerHTML = renderOverview(e, statusLabel, statusClass);
  }

  function renderOverview(e, statusLabel, statusClass) {
    const m = buildMetrics(e.id);
    return `
      <div class="grid two">
        <article class="panel">
          <div class="section-head">
            <div>
              <p class="eyebrow">Resumo do evento</p>
              <h2>${escapeHtml(e.nome)}</h2>
              <p>${escapeHtml(e.descricao || 'Sem descrição cadastrada.')}</p>
            </div>
            <span class="badge ${statusClass}">${statusLabel}</span>
          </div>
          ${thumbHtml(e)}
          <div class="grid two" style="margin-top:16px">
            ${metricCard('Público estimado', formatNumber(e.publicoEstimado), 'Informado no cadastro')}
            ${metricCard('Entrevistas', formatNumber(m.total), 'Coleta realizada')}
            ${metricCard('Coletores', formatNumber(collectorsFor(e.id).length), 'Pessoas vinculadas')}
            ${metricCard('Perguntas', formatNumber(questionsFor(e.id).length), 'Padrão + extras')}
          </div>
        </article>
        <article class="panel">
          <div class="section-head">
            <div>
              <p class="eyebrow">Leitura executiva</p>
              <h2>Insights rápidos</h2>
              <p>Resumo automático com base nas respostas já coletadas.</p>
            </div>
          </div>
          ${insightList(m)}
        </article>
      </div>
    `;
  }

  function insightList(m) {
    const topCity = m.topCities[0]?.label || 'sem cidade predominante';
    return `
      <div class="report-card">
        <p><strong>${percent(m.touristPercent)}</strong> da amostra é composta por turistas ou visitantes não residentes.</p>
        <p>A cidade com maior presença até o momento é <strong>${escapeHtml(topCity)}</strong>.</p>
        <p>O gasto médio declarado está em <strong>${formatCurrency(m.avgSpent)}</strong>, com impacto projetado de <strong>${formatCurrency(m.estimatedImpact)}</strong>.</p>
        <p>A nota geral média é <strong>${m.avgRating.toFixed(1).replace('.', ',')}</strong>, e <strong>${percent(m.returnPercent)}</strong> afirmaram que pretendem voltar.</p>
      </div>
    `;
  }

  function renderQuestionnaire(e) {
    const qs = questionsFor(e.id);
    return `
      <section class="panel">
        ${pageHead('Questionário do evento', 'Perguntas padrão preservam os indicadores comparáveis. Perguntas extras dão flexibilidade ao gestor.', `<button class="btn primary" data-action="new-question" data-event="${e.id}">Adicionar pergunta extra</button>`)}
        <div class="question-list">
          ${qs.map(q => `
            <div class="question-item">
              <div>
                <strong>${escapeHtml(q.title)}</strong>
                <small>${q.standard ? 'Pergunta padrão' : 'Pergunta extra'} · ${labelQuestionType(q.type)} · ${q.required ? 'Obrigatória' : 'Opcional'}</small>
              </div>
              <div class="event-actions">
                <span class="badge ${q.standard ? 'blue' : 'green'}">${q.metricKey ? escapeHtml(q.metricKey) : 'extra'}</span>
                ${q.standard ? '' : `<button class="btn danger small" data-action="delete-question" data-id="${q.id}">Remover</button>`}
              </div>
            </div>
          `).join('')}
        </div>
      </section>
    `;
  }

  function labelQuestionType(type) {
    return ({ text: 'Texto curto', textarea: 'Texto longo', number: 'Número', money: 'Valor', single_choice: 'Escolha única', multi_choice: 'Múltipla escolha', rating: 'Nota', boolean: 'Sim/Não', city: 'Cidade' })[type] || type;
  }

  function renderCollectors(e) {
    const cols = collectorsFor(e.id);
    const counts = countBy(responsesFor(e.id), r => r.collectorId || 'sem-coletor');
    return `
      <section class="panel">
        ${pageHead('Coletores de dados', 'Cada coletor recebe um link individual. As respostas ficam vinculadas ao responsável pela coleta.', `<button class="btn primary" data-action="new-collector" data-event="${e.id}">Novo coletor</button>`)}
        <div class="collector-list">
          ${cols.map(c => {
            const url = `${location.origin}${location.pathname}#collect/${e.slug}?token=${c.token}`;
            return `
              <div class="collector-item">
                <div>
                  <strong>${escapeHtml(c.nome)}</strong>
                  <small>${escapeHtml(c.telefone || 'Sem telefone')} · ${formatNumber(counts[c.id] || 0)} entrevistas · ${c.ativo ? 'ativo' : 'inativo'}</small>
                  <small>${escapeHtml(url)}</small>
                </div>
                <div class="event-actions">
                  <button class="btn ghost small" data-action="copy" data-copy="${escapeHtml(url)}">Copiar link</button>
                  <a class="btn primary small" href="#collect/${e.slug}?token=${c.token}">Abrir</a>
                  <button class="btn ghost small" data-action="toggle-collector" data-id="${c.id}">${c.ativo ? 'Inativar' : 'Ativar'}</button>
                </div>
              </div>
            `;
          }).join('') || emptyState('Nenhum coletor cadastrado', 'Adicione pelo menos um coletor para gerar o link público de coleta.')}
        </div>
      </section>
    `;
  }

  function renderEventDashboard(e) {
    const m = buildMetrics(e.id);
    return `
      <section>
        <div class="grid metrics">
          ${metricCard('Entrevistas', formatNumber(m.total), 'Respostas coletadas')}
          ${metricCard('Turistas', percent(m.touristPercent), 'Da amostra')}
          ${metricCard('Gasto médio', formatCurrency(m.avgSpent), 'Declarado')}
          ${metricCard('Impacto projetado', formatCurrency(m.estimatedImpact), 'Público × gasto médio')}
          ${metricCard('Nota média', m.avgRating.toFixed(1).replace('.', ','), 'Escala de 1 a 5')}
          ${metricCard('Voltariam', percent(m.returnPercent), 'Intenção de retorno')}
          ${metricCard('Indicariam', percent(m.recommendPercent), 'Recomendação')}
          ${metricCard('Cidades', formatNumber(m.uniqueCities), 'Origem')}
        </div>
        <div class="grid two" style="margin-top:16px">
          ${chartLine('Entrevistas por hora', 'Acompanhamento do ritmo de coleta.', m.byHour)}
          ${chartDonut('Turistas x moradores', 'Amostra de visitantes.', m.touristPercent, 'turistas')}
          ${chartBar('Top cidades de origem', 'Principais cidades informadas.', m.topCities)}
          ${chartBar('Hospedagem', 'Tipo de permanência dos visitantes.', m.hotelTypes)}
          ${chartBar('Faixa de consumo', 'Gasto declarado no evento.', m.spentRanges)}
          ${chartBar('Respostas por coletor', 'Produtividade e auditoria da coleta.', m.byCollector)}
        </div>
      </section>
    `;
  }

  function renderEventCompareTab(e) {
    const options = db.eventos.filter(x => x.id !== e.id).map(x => `<option value="${x.id}">${escapeHtml(x.nome)}</option>`).join('');
    const other = db.eventos.find(x => x.id !== e.id) || null;
    if (!other) return emptyState('Comparação indisponível', 'Cadastre outro evento para comparar indicadores.');
    const a = buildMetrics(e.id);
    const b = buildMetrics(other.id);
    return `
      <section class="panel">
        ${pageHead('Comparar edição', 'Compare este evento com outro evento cadastrado.', `<select id="compareInsideSelect" class="btn ghost">${options}</select>`)}
        ${comparisonHtml(e, other, a, b)}
      </section>
    `;
  }

  function renderExports(e) {
    const m = buildMetrics(e.id);
    return `
      <section class="panel">
        ${pageHead('Exportações', 'Gere arquivos para prestação de contas, relatório gerencial e análise posterior.', `
          <button class="btn ghost" data-action="export-csv" data-event="${e.id}">Exportar respostas CSV</button>
          <button class="btn ghost" data-action="export-summary" data-event="${e.id}">Exportar resumo CSV</button>
          <button class="btn primary" data-action="print-report">Imprimir / salvar PDF</button>
        `)}
        <div class="report-card">
          <p class="eyebrow">Relatório executivo</p>
          <h2>${escapeHtml(e.nome)}</h2>
          <p>${escapeHtml(e.descricao || '')}</p>
          <div class="grid metrics" style="margin-top:16px">
            ${metricCard('Entrevistas', formatNumber(m.total), '')}
            ${metricCard('Turistas', percent(m.touristPercent), '')}
            ${metricCard('Gasto médio', formatCurrency(m.avgSpent), '')}
            ${metricCard('Impacto estimado', formatCurrency(m.estimatedImpact), '')}
          </div>
          ${insightList(m)}
        </div>
      </section>
    `;
  }

  function renderCompare() {
    compareA ||= db.eventos[0]?.id;
    compareB ||= db.eventos[1]?.id || db.eventos[0]?.id;
    const eventA = eventById(compareA) || db.eventos[0];
    const eventB = eventById(compareB) || db.eventos.find(e => e.id !== eventA?.id) || eventA;
    if (!eventA || !eventB || eventA.id === eventB.id) {
      app.innerHTML = emptyState('Comparação precisa de dois eventos', 'Cadastre pelo menos dois eventos para comparar indicadores históricos.');
      return;
    }
    const mA = buildMetrics(eventA.id);
    const mB = buildMetrics(eventB.id);
    app.innerHTML = `
      ${pageHead('Comparação entre eventos', 'Compare edições, anos e categorias para orientar decisões futuras.', '')}
      <section class="panel">
        <div class="form-grid two">
          <label class="field"><span>Evento A</span><select id="compareA">${db.eventos.map(e => `<option value="${e.id}" ${e.id === eventA.id ? 'selected' : ''}>${escapeHtml(e.nome)}</option>`).join('')}</select></label>
          <label class="field"><span>Evento B</span><select id="compareB">${db.eventos.map(e => `<option value="${e.id}" ${e.id === eventB.id ? 'selected' : ''}>${escapeHtml(e.nome)}</option>`).join('')}</select></label>
        </div>
        ${comparisonHtml(eventA, eventB, mA, mB)}
      </section>
    `;
    document.getElementById('compareA')?.addEventListener('change', e => { compareA = e.target.value; renderCompare(); });
    document.getElementById('compareB')?.addEventListener('change', e => { compareB = e.target.value; renderCompare(); });
  }

  function comparisonHtml(eventA, eventB, a, b) {
    const rows = [
      ['Entrevistas', a.total, b.total, 'number'],
      ['Turistas', a.touristPercent, b.touristPercent, 'percent'],
      ['Gasto médio', a.avgSpent, b.avgSpent, 'currency'],
      ['Impacto projetado', a.estimatedImpact, b.estimatedImpact, 'currency'],
      ['Nota geral', a.avgRating, b.avgRating, 'rating'],
      ['Intenção de retorno', a.returnPercent, b.returnPercent, 'percent'],
      ['Indicação', a.recommendPercent, b.recommendPercent, 'percent'],
      ['Cidades alcançadas', a.uniqueCities, b.uniqueCities, 'number'],
      ['Diárias estimadas', a.nightsTotal, b.nightsTotal, 'number']
    ];
    return `
      <div class="grid metrics" style="margin:16px 0">
        ${metricCard('Evento A', escapeHtml(eventA.nome), eventA.categoria)}
        ${metricCard('Evento B', escapeHtml(eventB.nome), eventB.categoria)}
        ${metricCard('Diferença turistas', deltaValue(a.touristPercent, b.touristPercent, 'percent'), 'A menos B', deltaPill(a.touristPercent - b.touristPercent))}
        ${metricCard('Diferença gasto médio', deltaValue(a.avgSpent, b.avgSpent, 'currency'), 'A menos B', deltaPill(a.avgSpent - b.avgSpent))}
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Indicador</th><th>${escapeHtml(eventA.nome)}</th><th>${escapeHtml(eventB.nome)}</th><th>Variação</th></tr></thead>
          <tbody>
            ${rows.map(([label, va, vb, type]) => `<tr><td><strong>${label}</strong></td><td>${formatByType(va, type)}</td><td>${formatByType(vb, type)}</td><td>${deltaValue(va, vb, type)}</td></tr>`).join('')}
          </tbody>
        </table>
      </div>
      <div class="report-card" style="margin-top:16px">
        <p><strong>Insight automático:</strong> ${escapeHtml(eventA.nome)} apresenta ${deltaSentence(a.touristPercent, b.touristPercent, 'turistas')} e ${deltaSentence(a.avgSpent, b.avgSpent, 'gasto médio')}. A nota média ficou em ${a.avgRating.toFixed(1).replace('.', ',')} contra ${b.avgRating.toFixed(1).replace('.', ',')}.</p>
      </div>
    `;
  }

  function formatByType(value, type) {
    if (type === 'currency') return formatCurrency(value);
    if (type === 'percent') return percent(value, 1);
    if (type === 'rating') return Number(value || 0).toFixed(1).replace('.', ',');
    return formatNumber(value);
  }

  function deltaValue(a, b, type) {
    const diff = Number(a || 0) - Number(b || 0);
    const sign = diff > 0 ? '+' : '';
    if (type === 'currency') return `${sign}${formatCurrency(diff)}`.replace('+R$', '+ R$').replace('-R$', '- R$');
    if (type === 'percent') return `${sign}${diff.toFixed(1).replace('.', ',')} p.p.`;
    if (type === 'rating') return `${sign}${diff.toFixed(1).replace('.', ',')}`;
    return `${sign}${formatNumber(diff)}`;
  }

  function deltaPill(diff) {
    const cls = diff > 0 ? 'up' : diff < 0 ? 'down' : 'flat';
    const label = diff > 0 ? 'maior' : diff < 0 ? 'menor' : 'estável';
    return `<span class="delta ${cls}">${label}</span>`;
  }

  function deltaSentence(a, b, label) {
    const diff = Number(a || 0) - Number(b || 0);
    if (Math.abs(diff) < 0.01) return `${label} estável em relação ao comparativo`;
    return `${label} ${diff > 0 ? 'superior' : 'inferior'} em ${Math.abs(diff).toFixed(1).replace('.', ',')}${label.includes('turistas') ? ' pontos percentuais' : ''}`;
  }

  function renderCollectDemo() {
    const event = db.eventos.find(e => e.status === 'coleta_aberta') || db.eventos[0];
    if (!event) {
      app.innerHTML = emptyState('Nenhum evento disponível', 'Cadastre um evento e um coletor para testar a coleta mobile.');
      return;
    }
    let collector = collectorsFor(event.id).find(c => c.ativo);
    if (!collector) {
      collector = { id: uid('col'), eventId: event.id, nome: 'Coletor demonstração', telefone: '', token: uid('token'), ativo: true, createdAt: new Date().toISOString() };
      db.coletores.push(collector);
      saveData('Coletor de demonstração criado');
    }
    const url = `${location.origin}${location.pathname}#collect/${event.slug}?token=${collector.token}`;
    app.innerHTML = `
      ${pageHead('Coleta mobile', 'Fluxo simples para servidores abordarem pessoas no evento sem login e com vínculo ao coletor.', `
        <button class="btn ghost" data-action="copy" data-copy="${escapeHtml(url)}">Copiar link</button>
        <a class="btn primary" href="#collect/${event.slug}?token=${collector.token}">Abrir formulário</a>
      `)}
      <div class="grid two">
        <article class="panel">
          <p class="eyebrow">Link individual</p>
          <h2>${escapeHtml(event.nome)}</h2>
          <p>Coletor vinculado: <strong>${escapeHtml(collector.nome)}</strong></p>
          <div class="report-card"><p>${escapeHtml(url)}</p></div>
          <p style="color:var(--muted);line-height:1.6">Na apresentação, você pode mostrar que cada servidor recebe seu próprio link. O gestor consegue saber quem coletou cada ficha.</p>
        </article>
        <article class="panel">
          <p class="eyebrow">Como demonstrar</p>
          <h2>Roteiro rápido</h2>
          <p>1. Abra o link no celular.</p>
          <p>2. Preencha uma entrevista fictícia.</p>
          <p>3. Volte no dashboard do evento e mostre a atualização dos indicadores.</p>
          <p>4. Exporte CSV ou imprima o relatório.</p>
        </article>
      </div>
    `;
  }

  function renderCollect(slug, token) {
    const event = eventBySlug(slug);
    const collector = collectorByToken(token);
    if (!event || !collector || collector.eventId !== event.id) {
      app.innerHTML = emptyState('Link de coleta inválido', 'O evento ou o token do coletor não foi encontrado.');
      return;
    }
    if (!collector.ativo || !['coleta_aberta', 'ativo'].includes(event.status)) {
      app.innerHTML = emptyState('Coleta indisponível', 'Este coletor está inativo ou a coleta do evento foi encerrada.');
      return;
    }

    const steps = collectSteps(event.id);
    collectStep = Math.min(collectStep, steps.length - 1);
    const current = steps[collectStep];
    const totalByCollector = responsesFor(event.id).filter(r => r.collectorId === collector.id).length;
    const progress = ((collectStep + 1) / steps.length) * 100;

    app.innerHTML = `
      <div class="collect-shell">
        <div class="collect-card">
          <div class="collect-hero" style="background:${escapeHtml(event.thumbnail || defaultGradients[0])}">
            <span class="badge green">Coleta ativa</span>
            <h2>${escapeHtml(event.nome)}</h2>
            <p>Coletor: <strong>${escapeHtml(collector.nome)}</strong> · ${formatNumber(totalByCollector)} entrevistas enviadas</p>
          </div>
          <div class="collect-progress"><span style="width:${progress}%"></span></div>
          <form id="collectForm">
            <p class="eyebrow">Etapa ${collectStep + 1} de ${steps.length}</p>
            <h2 style="margin-top:0;letter-spacing:-.04em">${escapeHtml(current.title)}</h2>
            <div class="collect-step active">
              ${current.questions.map(q => renderField(q, collectAnswers[q.metricKey || q.id])).join('')}
            </div>
            <div class="collect-actions">
              <button type="button" class="btn ghost" data-action="collect-back" ${collectStep === 0 ? 'disabled' : ''}>Voltar</button>
              ${collectStep === steps.length - 1
                ? `<button type="submit" class="btn primary">Salvar entrevista</button>`
                : `<button type="button" class="btn primary" data-action="collect-next">Avançar</button>`}
            </div>
          </form>
        </div>
      </div>
    `;

    document.getElementById('collectForm')?.addEventListener('submit', async ev => {
      ev.preventDefault();
      mergeCollectAnswers(ev.currentTarget);
      await saveCollectResponse(event, collector);
    });
  }

  function collectSteps(eventId) {
    const qs = questionsFor(eventId);
    const byKeys = keys => qs.filter(q => keys.includes(q.metricKey));
    const extras = qs.filter(q => !q.standard);
    return [
      { title: 'Perfil do entrevistado', questions: byKeys(['origin_city','origin_state','is_local_resident','is_tourist','age_range']) },
      { title: 'Turismo e hospedagem', questions: byKeys(['hotel_type','nights_count']) },
      { title: 'Consumo no evento', questions: byKeys(['spent_range','consumption_sectors']) },
      { title: 'Avaliação do evento', questions: byKeys(['rating_general','rating_structure','rating_security','rating_cleaning','would_return','would_recommend']) },
      { title: 'Comentários e perguntas extras', questions: [...extras, ...byKeys(['comment'])] }
    ].filter(s => s.questions.length);
  }

  function renderField(q, value) {
    const name = q.metricKey || q.id;
    const required = q.required ? 'required' : '';
    if (q.type === 'textarea') {
      return `<label class="field"><span>${escapeHtml(q.title)}</span><textarea name="${name}" rows="4" ${required}>${escapeHtml(value || '')}</textarea></label>`;
    }
    if (q.type === 'number' || q.type === 'money') {
      return `<label class="field"><span>${escapeHtml(q.title)}</span><input name="${name}" type="number" step="${q.type === 'money' ? '0.01' : '1'}" value="${escapeHtml(value || '')}" ${required}></label>`;
    }
    if (q.type === 'single_choice' || q.type === 'boolean' || q.type === 'rating') {
      const options = q.type === 'boolean' ? ['Sim','Não'] : q.options || [];
      return `
        <fieldset class="field">
          <span>${escapeHtml(q.title)}</span>
          <div class="choice-grid">
            ${options.map(opt => {
              const checked = String(value ?? '') === String(opt) || booleanToLabel(value) === String(opt) ? 'checked' : '';
              return `<label class="choice-pill"><input type="radio" name="${name}" value="${escapeHtml(opt)}" ${checked} ${required}> ${escapeHtml(opt)}</label>`;
            }).join('')}
          </div>
        </fieldset>
      `;
    }
    if (q.type === 'multi_choice') {
      const arr = Array.isArray(value) ? value : [];
      return `
        <fieldset class="field">
          <span>${escapeHtml(q.title)}</span>
          <div class="choice-grid">
            ${(q.options || []).map(opt => `<label class="choice-pill"><input type="checkbox" name="${name}" value="${escapeHtml(opt)}" ${arr.includes(opt) ? 'checked' : ''}> ${escapeHtml(opt)}</label>`).join('')}
          </div>
        </fieldset>
      `;
    }
    return `<label class="field"><span>${escapeHtml(q.title)}</span><input name="${name}" value="${escapeHtml(value || '')}" ${required}></label>`;
  }

  function booleanToLabel(value) {
    if (value === true) return 'Sim';
    if (value === false) return 'Não';
    return value;
  }

  function mergeCollectAnswers(form) {
    const fd = new FormData(form);
    for (const [key, value] of fd.entries()) {
      if (collectAnswers[key]) {
        if (Array.isArray(collectAnswers[key])) collectAnswers[key].push(value);
        else collectAnswers[key] = [collectAnswers[key], value];
      } else {
        collectAnswers[key] = value;
      }
    }
    form.querySelectorAll('input[type="checkbox"]').forEach(input => {
      if (!collectAnswers[input.name]) collectAnswers[input.name] = [];
    });
    Object.keys(collectAnswers).forEach(key => {
      if (collectAnswers[key] === 'Sim') collectAnswers[key] = true;
      if (collectAnswers[key] === 'Não') collectAnswers[key] = false;
    });
  }

  async function saveCollectResponse(event, collector) {
    const raw = { ...collectAnswers };
    const spentMap = { 'Até R$50': 35, 'R$51 a R$100': 78, 'R$101 a R$200': 148, 'R$201 a R$500': 315, 'Acima de R$500': 620 };
    const now = new Date().toISOString();
    db.respostas.push({
      id: uid('resp'),
      eventId: event.id,
      collectorId: collector.id,
      startedAt: raw.startedAt || now,
      submittedAt: now,
      origin_city: raw.origin_city || '',
      origin_state: raw.origin_state || '',
      is_local_resident: !!raw.is_local_resident,
      is_tourist: !!raw.is_tourist,
      spent_amount_estimated: spentMap[raw.spent_range] || Number(raw.spent_amount_estimated || 0),
      spent_range: raw.spent_range || '',
      hotel_type: raw.hotel_type || 'Não informado',
      nights_count: Number(raw.nights_count || 0),
      rating_general: Number(raw.rating_general || 0),
      would_return: !!raw.would_return,
      would_recommend: !!raw.would_recommend,
      raw_answers_json: raw,
      createdAt: now
    });
    collectAnswers = {};
    collectStep = 0;
    await saveData('Entrevista salva');
    app.innerHTML = `
      <div class="collect-shell">
        <div class="collect-card">
          <div class="empty-state">
            <strong>Entrevista salva com sucesso</strong>
            <p>Os dados já foram enviados para o dashboard do evento.</p>
          </div>
          <div class="collect-actions">
            <a class="btn ghost" href="#event/${event.slug}?tab=dashboard">Ver dashboard</a>
            <button class="btn primary" data-action="new-collect" data-url="#collect/${event.slug}?token=${collector.token}">Nova entrevista</button>
          </div>
        </div>
      </div>
    `;
  }

  function buildMetrics(eventId) {
    const event = eventById(eventId) || {};
    const rows = responsesFor(eventId);
    const total = rows.length;
    const tourists = rows.filter(r => truthy(r.is_tourist)).length;
    const locals = rows.filter(r => truthy(r.is_local_resident)).length;
    const avgSpent = average(rows.map(r => Number(r.spent_amount_estimated || 0)).filter(Boolean));
    const avgRating = average(rows.map(r => Number(r.rating_general || 0)).filter(Boolean));
    const returnPercent = ratio(rows.filter(r => truthy(r.would_return)).length, total);
    const recommendPercent = ratio(rows.filter(r => truthy(r.would_recommend)).length, total);
    const citySet = new Set(rows.map(r => r.origin_city).filter(Boolean));
    const nightsTotal = rows.reduce((acc, r) => acc + Number(r.nights_count || 0), 0);
    const estimatedImpact = avgSpent * Number(event.publicoEstimado || total || 0);
    return {
      total,
      touristPercent: ratio(tourists, total),
      localPercent: ratio(locals, total),
      avgSpent,
      estimatedImpact,
      avgRating,
      returnPercent,
      recommendPercent,
      uniqueCities: citySet.size,
      nightsTotal,
      topCities: topList(countBy(rows, r => r.origin_city || 'Não informado'), 8),
      spentRanges: topList(countBy(rows, r => r.spent_range || 'Não informado'), 7),
      hotelTypes: topList(countBy(rows, r => r.hotel_type || 'Não informado'), 7),
      byCollector: topList(countBy(rows, r => db.coletores.find(c => c.id === r.collectorId)?.nome || 'Sem coletor'), 8),
      byHour: countByHour(rows)
    };
  }

  function truthy(value) { return value === true || value === 'true' || value === 'Sim'; }
  function average(values) { return values.length ? values.reduce((a,b) => a + b, 0) / values.length : 0; }
  function ratio(part, total) { return total ? (part / total) * 100 : 0; }
  function countBy(rows, getter) {
    return rows.reduce((acc, row) => {
      const key = getter(row) || 'Não informado';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
  }
  function topList(obj, limit = 6) {
    return Object.entries(obj).map(([label, value]) => ({ label, value })).sort((a,b) => b.value - a.value).slice(0, limit);
  }
  function countByHour(rows) {
    const obj = {};
    rows.forEach(r => {
      const d = new Date(r.submittedAt || r.createdAt || Date.now());
      const label = `${String(d.getHours()).padStart(2,'0')}h`;
      obj[label] = (obj[label] || 0) + 1;
    });
    return Object.entries(obj).sort(([a],[b]) => a.localeCompare(b)).map(([label, value]) => ({ label, value }));
  }

  function chartBar(title, subtitle, data) {
    const max = Math.max(...data.map(d => d.value), 1);
    return `
      <article class="chart-card">
        <h3>${escapeHtml(title)}</h3>
        <p>${escapeHtml(subtitle)}</p>
        <div class="bar-list">
          ${data.map(d => `
            <div class="bar-row">
              <span title="${escapeHtml(d.label)}">${escapeHtml(truncate(d.label, 18))}</span>
              <div class="bar-track"><div class="bar-fill" style="width:${Math.max(4, (d.value / max) * 100)}%"></div></div>
              <strong>${formatNumber(d.value)}</strong>
            </div>
          `).join('') || '<p style="color:var(--muted)">Sem dados disponíveis.</p>'}
        </div>
      </article>
    `;
  }

  function chartDonut(title, subtitle, value, label) {
    return `
      <article class="chart-card">
        <h3>${escapeHtml(title)}</h3>
        <p>${escapeHtml(subtitle)}</p>
        <div class="donut-wrap">
          <div class="donut" style="--value:${Math.max(0, Math.min(100, value))}%">
            <div><strong>${percent(value)}</strong><span>${escapeHtml(label)}</span></div>
          </div>
        </div>
      </article>
    `;
  }

  function chartLine(title, subtitle, data) {
    const max = Math.max(...data.map(d => d.value), 1);
    const points = data.map((d, i) => {
      const x = data.length === 1 ? 10 : 10 + (i * 280 / (data.length - 1));
      const y = 180 - (d.value / max) * 150;
      return [x, y, d];
    });
    const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0]} ${p[1]}`).join(' ');
    return `
      <article class="chart-card">
        <h3>${escapeHtml(title)}</h3>
        <p>${escapeHtml(subtitle)}</p>
        <svg class="line-chart" viewBox="0 0 320 220" role="img" aria-label="${escapeHtml(title)}">
          <path d="M10 180 H300" stroke="#e2e8f0" stroke-width="1" />
          <path d="M10 130 H300" stroke="#e2e8f0" stroke-width="1" />
          <path d="M10 80 H300" stroke="#e2e8f0" stroke-width="1" />
          <path d="${path}" fill="none" stroke="#086b5a" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" />
          ${points.map(([x,y,d]) => `<circle cx="${x}" cy="${y}" r="5" fill="#086b5a"><title>${escapeHtml(d.label)}: ${d.value}</title></circle>`).join('')}
          ${points.map(([x,,d]) => `<text x="${x}" y="205" text-anchor="middle" font-size="10" fill="#64748b">${escapeHtml(d.label)}</text>`).join('')}
        </svg>
      </article>
    `;
  }

  function truncate(text, max) {
    text = String(text || '');
    return text.length > max ? text.slice(0, max - 1) + '…' : text;
  }

  function emptyState(title, subtitle) {
    return `<div class="empty-state"><strong>${escapeHtml(title)}</strong><p>${escapeHtml(subtitle)}</p></div>`;
  }

  function openEventDialog(eventId = null) {
    fillSecretariasSelect(eventForm.elements.secretariaId);
    const e = eventId ? eventById(eventId) : null;
    document.getElementById('eventDialogTitle').textContent = e ? 'Editar evento' : 'Novo evento';
    eventForm.reset();
    eventForm.elements.id.value = e?.id || '';
    eventForm.elements.nome.value = e?.nome || '';
    eventForm.elements.secretariaId.value = e?.secretariaId || db.secretarias[0]?.id || '';
    eventForm.elements.categoria.value = e?.categoria || '';
    eventForm.elements.status.value = e?.status || 'rascunho';
    eventForm.elements.dataInicio.value = e?.dataInicio || '';
    eventForm.elements.dataFim.value = e?.dataFim || '';
    eventForm.elements.local.value = e?.local || '';
    eventForm.elements.cidade.value = e?.cidade || 'São João del-Rei';
    eventForm.elements.publicoEstimado.value = e?.publicoEstimado || 0;
    eventForm.elements.descricao.value = e?.descricao || '';
    eventDialog.showModal();
  }

  function fillSecretariasSelect(select) {
    select.innerHTML = db.secretarias.map(s => `<option value="${s.id}">${escapeHtml(s.nome)}</option>`).join('');
  }

  async function readFileAsDataUrl(file) {
    if (!file) return null;
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function handleEventSubmit(ev) {
    ev.preventDefault();
    const fd = new FormData(eventForm);
    const id = fd.get('id');
    const existing = id ? eventById(id) : null;
    const file = eventForm.elements.thumbnailFile.files[0];
    const uploaded = await readFileAsDataUrl(file);
    const nome = String(fd.get('nome')).trim();
    const event = {
      id: existing?.id || uid('evt'),
      secretariaId: fd.get('secretariaId'),
      nome,
      slug: existing?.slug || uniqueSlug(slugify(nome)),
      categoria: String(fd.get('categoria')).trim(),
      descricao: String(fd.get('descricao') || '').trim(),
      local: String(fd.get('local')).trim(),
      cidade: String(fd.get('cidade')).trim(),
      dataInicio: fd.get('dataInicio'),
      dataFim: fd.get('dataFim'),
      publicoEstimado: Number(fd.get('publicoEstimado') || 0),
      thumbnail: uploaded || existing?.thumbnail || defaultGradients[db.eventos.length % defaultGradients.length],
      status: fd.get('status'),
      createdAt: existing?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    if (existing) Object.assign(existing, event);
    else {
      db.eventos.unshift(event);
      addStandardQuestions(event.id);
      db.coletores.push({ id: uid('col'), eventId: event.id, nome: 'Coletor demonstração', telefone: '', token: uid('token'), ativo: true, createdAt: new Date().toISOString() });
    }
    await saveData(existing ? 'Evento atualizado' : 'Evento criado');
    eventDialog.close();
    location.hash = `#event/${event.slug}?tab=overview`;
    render();
  }

  function uniqueSlug(base) {
    let slug = base;
    let i = 2;
    while (db.eventos.some(e => e.slug === slug)) slug = `${base}-${i++}`;
    return slug;
  }

  function openQuestionDialog(eventId) {
    questionForm.reset();
    questionForm.elements.eventId.value = eventId;
    questionDialog.showModal();
  }

  async function handleQuestionSubmit(ev) {
    ev.preventDefault();
    const fd = new FormData(questionForm);
    const eventId = fd.get('eventId');
    const order = Math.max(0, ...questionsFor(eventId).map(q => q.order || 0)) + 1;
    db.perguntas.push({
      id: uid('q'),
      eventId,
      title: String(fd.get('title')).trim(),
      type: fd.get('type'),
      options: String(fd.get('options') || '').split('\n').map(x => x.trim()).filter(Boolean),
      required: fd.get('required') === 'on',
      standard: false,
      metricKey: `extra_${slugify(fd.get('title')).replaceAll('-', '_').slice(0, 30)}`,
      order,
      createdAt: new Date().toISOString()
    });
    await saveData('Pergunta adicionada');
    questionDialog.close();
    render();
  }

  function openCollectorDialog(eventId) {
    collectorForm.reset();
    collectorForm.elements.eventId.value = eventId;
    collectorDialog.showModal();
  }

  async function handleCollectorSubmit(ev) {
    ev.preventDefault();
    const fd = new FormData(collectorForm);
    db.coletores.push({
      id: uid('col'),
      eventId: fd.get('eventId'),
      nome: String(fd.get('nome')).trim(),
      telefone: String(fd.get('telefone') || '').trim(),
      token: uid('token'),
      ativo: true,
      createdAt: new Date().toISOString()
    });
    await saveData('Coletor criado');
    collectorDialog.close();
    render();
  }

  function exportJson() {
    downloadFile(`observatorio-eventos-${new Date().toISOString().slice(0,10)}.json`, JSON.stringify(db, null, 2), 'application/json');
  }

  function exportCsv(eventId) {
    const rows = responsesFor(eventId);
    const cols = ['id','eventId','collectorId','submittedAt','origin_city','origin_state','is_local_resident','is_tourist','spent_amount_estimated','spent_range','hotel_type','nights_count','rating_general','would_return','would_recommend'];
    const csv = [cols.join(';'), ...rows.map(r => cols.map(c => csvCell(r[c])).join(';'))].join('\n');
    const event = eventById(eventId);
    downloadFile(`${event.slug}-respostas.csv`, csv, 'text/csv;charset=utf-8');
  }

  function exportSummaryCsv(eventId) {
    const event = eventById(eventId);
    const m = buildMetrics(eventId);
    const rows = [
      ['Indicador','Valor'],
      ['Evento', event.nome],
      ['Entrevistas', m.total],
      ['Turistas (%)', m.touristPercent.toFixed(2)],
      ['Gasto médio', m.avgSpent.toFixed(2)],
      ['Impacto projetado', m.estimatedImpact.toFixed(2)],
      ['Nota média', m.avgRating.toFixed(2)],
      ['Intenção de retorno (%)', m.returnPercent.toFixed(2)],
      ['Indicação (%)', m.recommendPercent.toFixed(2)],
      ['Cidades alcançadas', m.uniqueCities],
      ['Diárias estimadas', m.nightsTotal]
    ];
    downloadFile(`${event.slug}-resumo.csv`, rows.map(row => row.map(csvCell).join(';')).join('\n'), 'text/csv;charset=utf-8');
  }

  function csvCell(value) {
    return `"${String(value ?? '').replaceAll('"', '""')}"`;
  }

  function downloadFile(filename, content, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      toast('Link copiado');
    } catch (_) {
      const input = document.createElement('textarea');
      input.value = text;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      input.remove();
      toast('Link copiado');
    }
  }

  async function resetDemo() {
    if (!confirm('Restaurar o arquivo db.json original não é automático. Esta ação limpa apenas alterações salvas no navegador. Continuar?')) return;
    localStorage.removeItem(STORAGE_KEY);
    location.reload();
  }

  document.addEventListener('click', async event => {
    const close = event.target.closest('[data-close-modal]');
    if (close) close.closest('dialog')?.close();

    const actionEl = event.target.closest('[data-action]');
    if (!actionEl) return;
    const action = actionEl.dataset.action;

    if (action === 'new-event') openEventDialog();
    if (action === 'edit-event') openEventDialog(actionEl.dataset.id);
    if (action === 'new-question') openQuestionDialog(actionEl.dataset.event);
    if (action === 'new-collector') openCollectorDialog(actionEl.dataset.event);
    if (action === 'copy') copyText(actionEl.dataset.copy || '');
    if (action === 'toggle-collector') {
      const c = db.coletores.find(x => x.id === actionEl.dataset.id);
      if (c) { c.ativo = !c.ativo; await saveData('Coletor atualizado'); render(); }
    }
    if (action === 'delete-question') {
      if (confirm('Remover esta pergunta extra?')) {
        db.perguntas = db.perguntas.filter(q => q.id !== actionEl.dataset.id);
        await saveData('Pergunta removida'); render();
      }
    }
    if (action === 'export-csv') exportCsv(actionEl.dataset.event);
    if (action === 'export-summary') exportSummaryCsv(actionEl.dataset.event);
    if (action === 'print-report') window.print();
    if (action === 'reset-demo') resetDemo();
    if (action === 'collect-next') {
      const form = document.getElementById('collectForm');
      if (form && form.reportValidity()) {
        mergeCollectAnswers(form);
        collectStep += 1;
        render();
      }
    }
    if (action === 'collect-back') {
      const form = document.getElementById('collectForm');
      if (form) mergeCollectAnswers(form);
      collectStep = Math.max(0, collectStep - 1);
      render();
    }
    if (action === 'new-collect') {
      collectAnswers = {};
      collectStep = 0;
      location.hash = actionEl.dataset.url;
      render();
    }
  });

  document.getElementById('menuButton')?.addEventListener('click', () => document.getElementById('sidebar').classList.toggle('open'));
  document.getElementById('newEventBtn')?.addEventListener('click', () => openEventDialog());
  document.getElementById('exportJsonBtn')?.addEventListener('click', exportJson);
  eventForm.addEventListener('submit', handleEventSubmit);
  questionForm.addEventListener('submit', handleQuestionSubmit);
  collectorForm.addEventListener('submit', handleCollectorSubmit);
  window.addEventListener('hashchange', () => { collectStep = routeInfo().name === 'collect' ? collectStep : 0; render(); });

  loadData().then(() => {
    selectedDashboardEventId = db.eventos[0]?.id || null;
    compareA = db.eventos[0]?.id || null;
    compareB = db.eventos[1]?.id || null;
    render();
  });
})();
