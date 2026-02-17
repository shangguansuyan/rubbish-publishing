(function(){
  // 自动适配 GitHub Pages 项目页 base path
  // 例如 https://user.github.io/rubbish-publishing/ -> basePath = "/rubbish-publishing"
  const pathParts = window.location.pathname.split('/').filter(Boolean);
  const isProjectPage = window.location.hostname.endsWith('github.io') && pathParts.length > 0;
  const basePath = isProjectPage ? `/${pathParts[0]}` : '';
  window.__BASE_PATH__ = basePath;

  function withBase(p){
    if(!p) return p;
    if(p.startsWith('http')) return p;
    if(p.startsWith(basePath + '/')) return p;
    if(p.startsWith('/')) return basePath + p;
    return basePath + '/' + p;
  }

  async function fetchJSON(url){
    const res = await fetch(withBase(url), { cache: 'no-store' });
    if(!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
    return await res.json();
  }

  function escapeHTML(s){
    return (s ?? '').toString()
      .replaceAll('&','&amp;')
      .replaceAll('<','&lt;')
      .replaceAll('>','&gt;')
      .replaceAll('"','&quot;')
      .replaceAll("'","&#039;");
  }

  function el(html){
    const t = document.createElement('template');
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  }

  // -------- Journals render --------
  async function renderJournals(opts){
    const {
      mountId,
      kpiId,
      searchId,
      limit,          // optional
      dataUrl = '/data/journals.json'
    } = opts;

    const mount = document.getElementById(mountId);
    if(!mount) return;

    let journals = [];
    try{
      journals = await fetchJSON(dataUrl);
    }catch(e){
      mount.innerHTML = '';
      mount.appendChild(el(`<div class="alert">无法读取期刊数据（${escapeHTML(e.message)}）。请检查：<br/>1) GitHub Pages 是否已启用；2) data/journals.json 是否存在且为合法 JSON；3) 路径是否正确。</div>`));
      return;
    }

    // KPI
    if(kpiId){
      const kpi = document.getElementById(kpiId);
      if(kpi){
        const total = journals.length;
        const open = journals.filter(j=>j.open_access !== false).length;
        const topics = new Set(journals.map(j=>j.field).filter(Boolean));
        kpi.innerHTML = `
          <div class="card"><div class="num">${total}</div><div class="lbl">Journals</div></div>
          <div class="card"><div class="num">${open}</div><div class="lbl">Open access</div></div>
          <div class="card"><div class="num">${topics.size}</div><div class="lbl">Fields</div></div>
        `;
      }
    }

    const input = searchId ? document.getElementById(searchId) : null;

    function render(list){
      mount.innerHTML = '';
      const shown = typeof limit === 'number' ? list.slice(0, limit) : list;

      if(shown.length === 0){
        mount.appendChild(el(`<div class="alert">未检索到匹配期刊。</div>`));
        return;
      }

      for(const j of shown){
        const slug = j.slug;
        const cover = withBase(j.cover || '/assets/images/journals/rubbish.webp');
        const href = withBase(`/journals/${slug}/index.html`);
        const desc = j.description || '—';
        const field = j.field || 'General';
        const issn = j.e_issn || j.p_issn || 'ISSN pending';
        const count = (typeof j.article_count === 'number') ? j.article_count : '—';

        mount.appendChild(el(`
          <a class="card" href="${href}">
            <div class="cover"><img src="${cover}" alt="${escapeHTML(j.name)}"/></div>
            <div class="body">
              <h3 class="title">${escapeHTML(j.name)}</h3>
              <p class="desc">${escapeHTML(desc)}</p>
              <div class="meta">
                <span class="badge">${escapeHTML(field)}</span>
                <span class="small">${escapeHTML(issn)} · Articles: ${escapeHTML(count)}</span>
              </div>
            </div>
          </a>
        `));
      }
    }

    // initial render
    render(journals);

    if(input){
      input.addEventListener('input', ()=>{
        const q = (input.value || '').trim().toLowerCase();
        const filtered = journals.filter(j=>{
          const hay = `${j.name||''} ${j.slug||''} ${j.field||''} ${j.description||''}`.toLowerCase();
          return hay.includes(q);
        });
        render(filtered);
      });
    }
  }

  // -------- Editorial board render --------
  async function renderBoard(opts){
    const { mountId, searchId, dataUrl='/data/members.json' } = opts;
    const mount = document.getElementById(mountId);
    if(!mount) return;

    let members = [];
    try{
      members = await fetchJSON(dataUrl);
    }catch(e){
      mount.innerHTML = '';
      mount.appendChild(el(`<div class="alert">无法读取编委会数据（${escapeHTML(e.message)}）。请检查 data/members.json 是否存在且为合法 JSON。</div>`));
      return;
    }

    const input = searchId ? document.getElementById(searchId) : null;

    function normAff(a){
      if(Array.isArray(a)) return a.join('; ');
      return a || '';
    }

    function render(list){
      mount.innerHTML = '';
      if(list.length === 0){
        mount.appendChild(el(`<div class="alert">未检索到匹配成员。</div>`));
        return;
      }

      const table = el(`
        <table class="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Role</th>
              <th>Affiliation(s)</th>
              <th>Interests</th>
              <th>ORCID</th>
            </tr>
          </thead>
          <tbody></tbody>
        </table>
      `);

      const tb = table.querySelector('tbody');
      for(const m of list){
        const orcid = m.orcid ? `<a href="https://orcid.org/${escapeHTML(m.orcid)}" target="_blank" rel="noreferrer">${escapeHTML(m.orcid)}</a>` : '—';
        const email = m.email ? `<span class="small">${escapeHTML(m.email)}</span>` : '';
        tb.appendChild(el(`
          <tr>
            <td><strong>${escapeHTML(m.name||'')}</strong><br/>${email}</td>
            <td>${escapeHTML(m.role||'')}</td>
            <td>${escapeHTML(normAff(m.affiliations))}</td>
            <td>${escapeHTML(m.interests||'')}</td>
            <td>${orcid}</td>
          </tr>
        `));
      }

      mount.appendChild(table);
    }

    render(members);

    if(input){
      input.addEventListener('input', ()=>{
        const q = (input.value||'').trim().toLowerCase();
        const filtered = members.filter(m=>{
          const hay = `${m.name||''} ${m.role||''} ${normAff(m.affiliations)||''} ${m.interests||''} ${m.email||''} ${m.orcid||''}`.toLowerCase();
          return hay.includes(q);
        });
        render(filtered);
      });
    }
  }

  // -------- Articles render for journal --------
  async function renderArticles(opts){
    const { mountId, searchId, dataUrl, limit } = opts;
    const mount = document.getElementById(mountId);
    if(!mount) return;

    let articles = [];
    try{
      articles = await fetchJSON(dataUrl);
    }catch(e){
      mount.innerHTML = '';
      mount.appendChild(el(`<div class="alert">无法读取文章数据（${escapeHTML(e.message)}）。请检查：${escapeHTML(dataUrl)} 是否存在且为合法 JSON。</div>`));
      return;
    }

    // sort by date desc if exists
    articles.sort((a,b)=> (b.date||'').localeCompare(a.date||''));

    const input = searchId ? document.getElementById(searchId) : null;

    function render(list){
      mount.innerHTML = '';
      const shown = typeof limit === 'number' ? list.slice(0, limit) : list;

      if(shown.length === 0){
        mount.appendChild(el(`<div class="alert">未检索到匹配文章。</div>`));
        return;
      }

      const table = el(`
        <table class="table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Title</th>
              <th>Type</th>
              <th>DOI</th>
            </tr>
          </thead>
          <tbody></tbody>
        </table>
      `);
      const tb = table.querySelector('tbody');

      for(const a of shown){
        const doi = a.doi ? `<span class="badge">${escapeHTML(a.doi)}</span>` : '—';
        const link = a.url ? `<a href="${escapeHTML(a.url)}" target="_blank" rel="noreferrer">${escapeHTML(a.title||'')}</a>` : `<span>${escapeHTML(a.title||'')}</span>`;
        tb.appendChild(el(`
          <tr>
            <td>${escapeHTML(a.date||'')}</td>
            <td><strong>${link}</strong><br/><span class="small">${escapeHTML(a.authors||'')}</span></td>
            <td>${escapeHTML(a.type||'')}</td>
            <td>${doi}</td>
          </tr>
        `));
      }

      mount.appendChild(table);
    }

    render(articles);

    if(input){
      input.addEventListener('input', ()=>{
        const q = (input.value||'').trim().toLowerCase();
        const filtered = articles.filter(a=>{
          const hay = `${a.title||''} ${a.authors||''} ${a.abstract||''} ${a.doi||''} ${a.type||''}`.toLowerCase();
          return hay.includes(q);
        });
        render(filtered);
      });
    }
  }

  window.Site = { renderJournals, renderBoard, renderArticles, withBase };
})();
