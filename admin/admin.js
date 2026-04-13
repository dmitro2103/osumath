(function() {
    'use strict';

    var state = { token: '', repo: '', branch: 'main', data: {}, sha: {}, section: 'staff' };
    var FILES = { staff: 'content/staff.json', disciplines: 'content/disciplines.json', week: 'content/week.json', dpo: 'content/dpo.json', materials: 'content/materials.json' };

    function esc(s) { if (!s) return ''; var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
    function toast(msg, type) { var t = document.getElementById('toast'); t.textContent = msg; t.className = 'toast toast-' + (type||'info') + ' show'; setTimeout(function() { t.classList.remove('show'); }, 3000); }
    function saving(on) { document.getElementById('saving').classList.toggle('active', on); }

    // === GitHub API ===
    function gh(path, opts) {
        opts = opts || {};
        var h = { 'Authorization': 'token ' + state.token, 'Accept': 'application/vnd.github.v3+json' };
        if (opts.body) h['Content-Type'] = 'application/json';
        return fetch('https://api.github.com/repos/' + state.repo + '/' + path, {
            method: opts.method || 'GET', headers: h,
            body: opts.body ? JSON.stringify(opts.body) : undefined
        }).then(function(r) { return r.ok ? r.json() : r.json().then(function(e) { return Promise.reject(e); }); });
    }

    function loadFile(key) {
        return gh('contents/' + FILES[key] + '?ref=' + state.branch).then(function(res) {
            state.sha[key] = res.sha;
            var raw = atob(res.content.replace(/\n/g, ''));
            var bytes = new Uint8Array(raw.length);
            for (var i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
            state.data[key] = JSON.parse(new TextDecoder('utf-8').decode(bytes));
        });
    }

    function saveFile(key) {
        var json = JSON.stringify(state.data[key], null, 2);
        var bytes = new TextEncoder().encode(json);
        var bin = ''; for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
        return gh('contents/' + FILES[key], {
            method: 'PUT',
            body: { message: 'Update ' + FILES[key] + ' via admin', content: btoa(bin), sha: state.sha[key], branch: state.branch }
        }).then(function(res) { state.sha[key] = res.content.sha; });
    }

    // === Login ===
    function initLogin() {
        var saved = sessionStorage.getItem('pck_admin');
        if (saved) { try { var s = JSON.parse(saved); state.token = s.token; state.repo = s.repo; state.branch = s.branch || 'main'; doLogin(true); return; } catch(e) {} }
        document.getElementById('login-form').addEventListener('submit', function(e) {
            e.preventDefault();
            state.token = document.getElementById('inp-token').value.trim();
            state.repo = document.getElementById('inp-repo').value.trim();
            state.branch = document.getElementById('inp-branch').value.trim() || 'main';
            if (state.token && state.repo) doLogin(false);
        });
    }

    function doLogin(fromSession) {
        var err = document.getElementById('login-error');
        err.style.display = 'none';
        gh('contents/' + FILES.staff + '?ref=' + state.branch).then(function() {
            sessionStorage.setItem('pck_admin', JSON.stringify({ token: state.token, repo: state.repo, branch: state.branch }));
            document.getElementById('login-screen').style.display = 'none';
            var layout = document.querySelector('.admin-layout');
            layout.style.display = 'flex';
            document.getElementById('hdr-repo').textContent = state.repo;
            loadAll();
        }).catch(function(e) {
            if (fromSession) { sessionStorage.removeItem('pck_admin'); document.getElementById('login-screen').style.display = 'flex'; return; }
            err.textContent = e.message || 'Не удалось подключиться'; err.style.display = 'block';
        });
    }

    // === Data ===
    function loadAll() {
        saving(true);
        Promise.all([loadFile('staff'), loadFile('disciplines'), loadFile('week'), loadFile('dpo'), loadFile('materials')]).then(function() {
            render(); saving(false); toast('Данные загружены', 'success');
        }).catch(function(e) { saving(false); toast('Ошибка: ' + (e.message || ''), 'error'); });
    }

    function save(key) {
        saving(true);
        saveFile(key).then(function() { render(); saving(false); toast('Сохранено!', 'success'); })
            .catch(function(e) { saving(false); toast('Ошибка: ' + (e.message || ''), 'error'); });
    }

    // === Navigation ===
    function initNav() {
        document.querySelectorAll('.sidebar-nav a').forEach(function(a) {
            a.addEventListener('click', function(e) {
                e.preventDefault();
                document.querySelectorAll('.sidebar-nav a').forEach(function(l) { l.classList.remove('active'); });
                this.classList.add('active'); state.section = this.dataset.section; render();
            });
        });
    }

    function render() {
        document.querySelectorAll('.section-panel').forEach(function(p) { p.classList.remove('active'); });
        var panel = document.getElementById('p-' + state.section);
        if (panel) panel.classList.add('active');
        var fn = { staff: renderStaff, disciplines: renderDisc, week: renderWeek, dpo: renderDpo, materials: renderMaterials };
        if (fn[state.section]) fn[state.section]();
    }

    // === STAFF ===
    function renderStaff() {
        var t = (state.data.staff || {}).teachers || [];
        var hi = t.filter(function(x) { return x.category === 'high'; }).length;
        document.getElementById('staff-stats').innerHTML =
            sb('var(--primary)', 'fa-users', t.length, 'Преподавателей') +
            sb('var(--success)', 'fa-award', hi, 'Высшая') +
            sb('var(--warning)', 'fa-star', t.length - hi, 'Первая') +
            sb('#8b5cf6', 'fa-graduation-cap', t.filter(function(x) { return x.degree; }).length, 'Канд. наук');
        var html = '';
        t.forEach(function(r, i) {
            html += '<tr><td>' + (i+1) + '</td><td><strong>' + esc(r.name) + '</strong>' +
                (r.degree ? '<br><small style="color:var(--muted)">' + esc(r.degree) + '</small>' : '') +
                '</td><td>' + esc(r.curator) + '</td><td><span class="badge ' + (r.category==='high'?'badge-green':'badge-blue') + '">' +
                esc(r.categoryLabel) + '</span></td><td>' + ((r.awards||[]).length || '-') +
                '</td><td class="actions"><button class="btn btn-sm btn-primary" onclick="A.editStaff(' + i + ')"><i class="fas fa-edit"></i></button>' +
                '<button class="btn btn-sm btn-danger" onclick="A.delStaff(' + i + ')"><i class="fas fa-trash"></i></button></td></tr>';
        });
        document.getElementById('staff-tbody').innerHTML = html;
    }

    function editStaff(idx) {
        var t = idx !== undefined ? state.data.staff.teachers[idx] : null;
        var n = !t; if (n) t = { name:'', degree:'', curator:'-', category:'high', categoryLabel:'Высшая', categoryOrder:'', awards:[] };
        modal(n ? 'Добавить преподавателя' : 'Редактировать',
            fg('s-name', 'ФИО *', t.name) +
            fg('s-degree', 'Ученая степень', t.degree, 'Оставьте пустым если нет') +
            fg('s-curator', 'Кураторство', t.curator) +
            '<div class="form-group"><label>Категория</label><select id="s-cat"><option value="high"' + (t.category==='high'?' selected':'') + '>Высшая</option><option value="first"' + (t.category==='first'?' selected':'') + '>Первая</option></select></div>' +
            fg('s-order', 'Приказ', t.categoryOrder) +
            '<div class="form-group"><label>Награды (по одной на строку)</label><textarea id="s-awards" rows="4">' + esc((t.awards||[]).join('\n')) + '</textarea></div>',
            function() {
                var obj = { id: n ? state.data.staff.teachers.length+1 : t.id, name: v('s-name'), degree: v('s-degree'),
                    curator: v('s-curator') || '-', category: v('s-cat'), categoryLabel: v('s-cat')==='high'?'Высшая':'Первая',
                    categoryOrder: v('s-order'), awards: v('s-awards').split('\n').filter(function(a){return a.trim();}) };
                if (!obj.name) { toast('Заполните ФИО', 'error'); return; }
                if (n) state.data.staff.teachers.push(obj); else state.data.staff.teachers[idx] = obj;
                closeModal(); save('staff');
            });
    }

    function delStaff(i) { if (!confirm('Удалить "' + state.data.staff.teachers[i].name + '"?')) return; state.data.staff.teachers.splice(i, 1); save('staff'); }

    // === DISCIPLINES ===
    function renderDisc() {
        var d = (state.data.disciplines || {}).disciplines || [];
        var labels = { math:'Математика', professional:'Профессиональные', statistics:'Статистика' };
        var html = '';
        d.forEach(function(r, i) {
            html += '<tr><td>' + (i+1) + '</td><td><i class="' + esc(r.icon) + '" style="color:var(--primary);margin-right:8px"></i><strong>' +
                esc(r.name) + '</strong></td><td><span class="badge badge-blue">' + esc(labels[r.category]||r.category) + '</span></td>' +
                '<td class="actions"><button class="btn btn-sm btn-primary" onclick="A.editDisc(' + i + ')"><i class="fas fa-edit"></i></button>' +
                '<button class="btn btn-sm btn-danger" onclick="A.delDisc(' + i + ')"><i class="fas fa-trash"></i></button></td></tr>';
        });
        document.getElementById('disc-tbody').innerHTML = html;
    }

    function editDisc(idx) {
        var d = idx !== undefined ? state.data.disciplines.disciplines[idx] : null;
        var n = !d; if (n) d = { name:'', icon:'fas fa-book', category:'math', description:'', tags:[] };
        modal(n ? 'Добавить дисциплину' : 'Редактировать',
            fg('d-name', 'Название *', d.name) +
            fg('d-icon', 'Иконка (Font Awesome)', d.icon) +
            '<div class="form-group"><label>Категория</label><select id="d-cat"><option value="math"' + (d.category==='math'?' selected':'') + '>Математика</option><option value="professional"' + (d.category==='professional'?' selected':'') + '>Профессиональные</option><option value="statistics"' + (d.category==='statistics'?' selected':'') + '>Статистика</option></select></div>' +
            '<div class="form-group"><label>Описание</label><textarea id="d-desc" rows="3">' + esc(d.description) + '</textarea></div>' +
            fg('d-tags', 'Теги (через запятую)', (d.tags||[]).join(', ')),
            function() {
                var obj = { id: n ? state.data.disciplines.disciplines.length+1 : d.id, name: v('d-name'), icon: v('d-icon') || 'fas fa-book',
                    category: v('d-cat'), description: v('d-desc'), tags: v('d-tags').split(',').map(function(s){return s.trim();}).filter(Boolean) };
                if (!obj.name) { toast('Заполните название', 'error'); return; }
                if (n) state.data.disciplines.disciplines.push(obj); else state.data.disciplines.disciplines[idx] = obj;
                closeModal(); save('disciplines');
            });
    }

    function delDisc(i) { if (!confirm('Удалить?')) return; state.data.disciplines.disciplines.splice(i, 1); save('disciplines'); }

    // === WEEK ===
    function renderWeek() {
        var w = state.data.week || {};
        document.getElementById('week-stats').innerHTML =
            sb('var(--primary)', 'fa-calendar', w.year || '-', w.dateRange || '') +
            sb('var(--success)', 'fa-list', (w.events||[]).length, 'Мероприятий') +
            sb('var(--warning)', 'fa-users', (w.stats||{}).participants || 0, 'Участников');
        var html = '';
        (w.events || []).forEach(function(ev, i) {
            html += '<tr><td>' + esc(ev.date) + ' ' + esc(ev.time) + '</td><td><strong>' + esc(ev.name) + '</strong></td>' +
                '<td>' + esc(ev.responsible) + '</td><td>' + esc(ev.location) + '</td>' +
                '<td class="actions"><button class="btn btn-sm btn-primary" onclick="A.editEv(' + i + ')"><i class="fas fa-edit"></i></button>' +
                '<button class="btn btn-sm btn-danger" onclick="A.delEv(' + i + ')"><i class="fas fa-trash"></i></button></td></tr>';
        });
        document.getElementById('week-tbody').innerHTML = html;
    }

    function editWeekSettings() {
        var w = state.data.week || {};
        modal('Настройки недели ПЦК',
            fg('w-year', 'Год', w.year) + fg('w-dates', 'Период', w.dateRange) +
            '<div class="form-group"><label>Описание</label><textarea id="w-desc" rows="3">' + esc(w.description) + '</textarea></div>' +
            fg('w-se', 'Мероприятий', (w.stats||{}).events, '', 'number') + fg('w-sp', 'Участников', (w.stats||{}).participants, '', 'number') +
            fg('w-st', 'Преподавателей', (w.stats||{}).teachers, '', 'number') + fg('w-sg', 'Групп', (w.stats||{}).groups, '', 'number') +
            '<div class="form-group"><label>Ключевые мероприятия (по строкам)</label><textarea id="w-hl" rows="4">' + esc((w.highlights||[]).join('\n')) + '</textarea></div>',
            function() {
                state.data.week.year = v('w-year'); state.data.week.dateRange = v('w-dates'); state.data.week.description = v('w-desc');
                state.data.week.stats = { events: +v('w-se')||0, participants: +v('w-sp')||0, teachers: +v('w-st')||0, groups: +v('w-sg')||0 };
                state.data.week.highlights = v('w-hl').split('\n').filter(Boolean);
                closeModal(); save('week');
            });
    }

    function editEv(idx) {
        var ev = idx !== undefined ? state.data.week.events[idx] : null;
        var n = !ev; if (n) ev = { day:'mon', date:'', time:'', name:'', description:'', responsible:'', initials:'', location:'', participants:'' };
        var days = { mon:'Понедельник', tue:'Вторник', wed:'Среда', thu:'Четверг', fri:'Пятница' };
        var sel = ''; for (var k in days) sel += '<option value="'+k+'"'+(ev.day===k?' selected':'')+'>'+days[k]+'</option>';
        modal(n ? 'Добавить мероприятие' : 'Редактировать',
            fg('e-name', 'Название *', ev.name) +
            '<div class="form-group"><label>День</label><select id="e-day">' + sel + '</select></div>' +
            fg('e-date', 'Дата (дд.мм)', ev.date, '15.04') + fg('e-time', 'Время', ev.time, '10:00 - 12:00') +
            '<div class="form-group"><label>Описание</label><textarea id="e-desc" rows="2">' + esc(ev.description) + '</textarea></div>' +
            fg('e-resp', 'Ответственный', ev.responsible) + fg('e-init', 'Инициалы', ev.initials, 'ТА') +
            fg('e-loc', 'Место', ev.location) + fg('e-part', 'Участники', ev.participants),
            function() {
                var dayVal = v('e-day');
                var obj = { id: n ? (state.data.week.events||[]).length+1 : ev.id, day: dayVal, dayLabel: days[dayVal],
                    date: v('e-date'), time: v('e-time'), name: v('e-name'), description: v('e-desc'),
                    responsible: v('e-resp'), initials: v('e-init'), location: v('e-loc'), participants: v('e-part') };
                if (!obj.name) { toast('Заполните название', 'error'); return; }
                if (n) { if (!state.data.week.events) state.data.week.events = []; state.data.week.events.push(obj); }
                else state.data.week.events[idx] = obj;
                closeModal(); save('week');
            });
    }

    function delEv(i) { if (!confirm('Удалить?')) return; state.data.week.events.splice(i, 1); save('week'); }

    // === DPO ===
    function renderDpo() {
        var d = state.data.dpo || {};
        document.getElementById('dpo-adult-tbody').innerHTML = dpoRows(d.adult_programs, 'adult');
        document.getElementById('dpo-qual-tbody').innerHTML = dpoRows(d.qualification_programs, 'qual');
    }

    function dpoRows(arr, type) {
        if (!arr || !arr.length) return '<tr><td colspan="4" style="text-align:center;color:var(--muted)">Нет программ</td></tr>';
        return arr.map(function(p, i) {
            return '<tr><td>' + (i+1) + '</td><td>' + esc(p.title) + '</td><td>' + esc(p.responsible) + '</td>' +
                '<td class="actions"><button class="btn btn-sm btn-primary" onclick="A.editDpo(\'' + type + '\',' + i + ')"><i class="fas fa-edit"></i></button>' +
                '<button class="btn btn-sm btn-danger" onclick="A.delDpo(\'' + type + '\',' + i + ')"><i class="fas fa-trash"></i></button></td></tr>';
        }).join('');
    }

    function editDpo(type, idx) {
        var key = type === 'adult' ? 'adult_programs' : 'qualification_programs';
        var p = idx !== undefined ? state.data.dpo[key][idx] : null;
        var n = !p; if (n) p = { title: '', responsible: '' };
        modal((n ? 'Добавить' : 'Редактировать') + ' программу',
            '<div class="form-group"><label>Название *</label><textarea id="p-title" rows="3">' + esc(p.title) + '</textarea></div>' +
            fg('p-resp', 'Ответственный', p.responsible),
            function() {
                var obj = { title: v('p-title'), responsible: v('p-resp') };
                if (!obj.title) { toast('Заполните название', 'error'); return; }
                if (n) { if (!state.data.dpo[key]) state.data.dpo[key] = []; state.data.dpo[key].push(obj); }
                else state.data.dpo[key][idx] = obj;
                closeModal(); save('dpo');
            });
    }

    function delDpo(type, i) {
        var key = type === 'adult' ? 'adult_programs' : 'qualification_programs';
        if (!confirm('Удалить?')) return; state.data.dpo[key].splice(i, 1); save('dpo');
    }

    // === MATERIALS ===
    function renderMaterials() {
        var d = state.data.materials || {};
        var cats = d.categories || [];
        var items = d.materials || [];
        var catMap = {};
        cats.forEach(function(c) { catMap[c.id] = c.name; });
        document.getElementById('mat-stats').innerHTML =
            sb('var(--primary)', 'fa-folder-open', items.length, 'Материалов') +
            sb('var(--success)', 'fa-tags', cats.length, 'Категорий');
        var html = '';
        if (!items.length) html = '<tr><td colspan="6" style="text-align:center;color:var(--muted)">Нет материалов</td></tr>';
        else items.forEach(function(m, i) {
            html += '<tr><td>' + (i+1) + '</td><td><strong>' + esc(m.title) + '</strong>' +
                (m.description ? '<br><small style="color:var(--muted)">' + esc(m.description).substring(0, 80) + (m.description.length > 80 ? '...' : '') + '</small>' : '') +
                '</td><td><span class="badge badge-blue">' + esc(catMap[m.category] || m.category) + '</span></td>' +
                '<td>' + esc(m.author || '-') + '</td><td>' + esc(m.date || '-') + '</td>' +
                '<td class="actions"><button class="btn btn-sm btn-primary" onclick="A.editMat(' + i + ')"><i class="fas fa-edit"></i></button>' +
                '<button class="btn btn-sm btn-danger" onclick="A.delMat(' + i + ')"><i class="fas fa-trash"></i></button></td></tr>';
        });
        document.getElementById('mat-tbody').innerHTML = html;
        var chtml = '';
        if (!cats.length) chtml = '<tr><td colspan="4" style="text-align:center;color:var(--muted)">Нет категорий</td></tr>';
        else cats.forEach(function(c, i) {
            chtml += '<tr><td>' + esc(c.id) + '</td><td><i class="' + esc(c.icon) + '" style="margin-right:6px;color:var(--primary)"></i>' + esc(c.name) + '</td>' +
                '<td class="actions"><button class="btn btn-sm btn-primary" onclick="A.editMatCat(' + i + ')"><i class="fas fa-edit"></i></button>' +
                '<button class="btn btn-sm btn-danger" onclick="A.delMatCat(' + i + ')"><i class="fas fa-trash"></i></button></td></tr>';
        });
        document.getElementById('matcat-tbody').innerHTML = chtml;
    }

    function editMat(idx) {
        var d = state.data.materials || {};
        var m = idx !== undefined ? d.materials[idx] : null;
        var n = !m; if (n) m = { title: '', category: '', author: '', description: '', file_url: '', date: '' };
        var cats = d.categories || [];
        var sel = '<div class="form-group"><label>Категория</label><select id="m-cat">';
        cats.forEach(function(c) { sel += '<option value="' + esc(c.id) + '"' + (m.category === c.id ? ' selected' : '') + '>' + esc(c.name) + '</option>'; });
        sel += '</select></div>';
        modal((n ? 'Добавить' : 'Редактировать') + ' материал',
            fg('m-title', 'Название *', m.title) + sel +
            fg('m-author', 'Автор', m.author) +
            '<div class="form-group"><label>Описание</label><textarea id="m-desc" rows="3">' + esc(m.description) + '</textarea></div>' +
            fg('m-url', 'Ссылка на файл', m.file_url, 'https://drive.google.com/...') +
            fg('m-date', 'Дата', m.date, '2024-01-15'),
            function() {
                var obj = { title: v('m-title'), category: v('m-cat'), author: v('m-author'),
                    description: v('m-desc'), file_url: v('m-url'), date: v('m-date') };
                if (!obj.title) { toast('Заполните название', 'error'); return; }
                if (!d.materials) d.materials = [];
                if (n) d.materials.push(obj); else d.materials[idx] = obj;
                closeModal(); save('materials');
            });
    }

    function delMat(i) {
        if (!confirm('Удалить "' + state.data.materials.materials[i].title + '"?')) return;
        state.data.materials.materials.splice(i, 1); save('materials');
    }

    function editMatCat(idx) {
        var cats = (state.data.materials || {}).categories || [];
        var c = idx !== undefined ? cats[idx] : null;
        var n = !c; if (n) c = { id: '', name: '', icon: 'fas fa-file' };
        modal((n ? 'Добавить' : 'Редактировать') + ' категорию',
            fg('mc-id', 'ID (латиница) *', c.id, 'presentations') +
            fg('mc-name', 'Название *', c.name, 'Презентации') +
            fg('mc-icon', 'Иконка (Font Awesome)', c.icon, 'fas fa-file-powerpoint'),
            function() {
                var obj = { id: v('mc-id'), name: v('mc-name'), icon: v('mc-icon') || 'fas fa-file' };
                if (!obj.id || !obj.name) { toast('Заполните ID и название', 'error'); return; }
                if (!state.data.materials.categories) state.data.materials.categories = [];
                if (n) state.data.materials.categories.push(obj); else state.data.materials.categories[idx] = obj;
                closeModal(); save('materials');
            });
    }

    function delMatCat(i) {
        if (!confirm('Удалить категорию?')) return;
        state.data.materials.categories.splice(i, 1); save('materials');
    }

    // === Helpers ===
    function sb(bg, icon, val, label) { return '<div class="stat-box"><div class="icon" style="background:'+bg+'"><i class="fas '+icon+'"></i></div><div><h3>'+esc(''+val)+'</h3><p>'+esc(label)+'</p></div></div>'; }
    function fg(id, label, val, ph, type) { return '<div class="form-group"><label>'+label+'</label><input id="'+id+'" type="'+(type||'text')+'" value="'+esc(val||'')+'" placeholder="'+esc(ph||'')+'"></div>'; }
    function v(id) { var el = document.getElementById(id); return el ? (el.value||'').trim() : ''; }

    function modal(title, body, onSave) {
        document.getElementById('modal-title').textContent = title;
        document.getElementById('modal-body').innerHTML = body;
        document.getElementById('modal-save').onclick = onSave;
        document.getElementById('modal-overlay').classList.add('active');
    }
    function closeModal() { document.getElementById('modal-overlay').classList.remove('active'); }

    // === Init ===
    document.addEventListener('DOMContentLoaded', function() {
        initLogin(); initNav();
        document.getElementById('btn-logout').addEventListener('click', function() { sessionStorage.removeItem('pck_admin'); location.reload(); });
        document.getElementById('modal-close').addEventListener('click', closeModal);
        document.getElementById('modal-cancel').addEventListener('click', closeModal);
        document.getElementById('modal-overlay').addEventListener('click', function(e) { if (e.target === this) closeModal(); });
        var mobileBtn = document.getElementById('btn-mobile-menu');
        var sidebar = document.getElementById('admin-sidebar');
        if (mobileBtn && sidebar) {
            mobileBtn.addEventListener('click', function() { sidebar.classList.toggle('open'); });
            document.querySelector('.admin-main').addEventListener('click', function() { sidebar.classList.remove('open'); });
        }
    });

    window.A = { editStaff: editStaff, delStaff: delStaff, editDisc: editDisc, delDisc: delDisc,
        editEv: editEv, delEv: delEv, editWeekSettings: editWeekSettings, editDpo: editDpo, delDpo: delDpo,
        editMat: editMat, delMat: delMat, editMatCat: editMatCat, delMatCat: delMatCat };
})();
