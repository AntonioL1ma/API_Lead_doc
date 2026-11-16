/* ==========================================================================
   LEAD API - Documentação interativa
   ========================================================================== */
(function () {
    'use strict';

    const $ = (s, el = document) => el.querySelector(s);
    const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));

    // URL oficial da API (usada nos exemplos e no "Testar agora")
    const API_URL = 'https://services.ultraacademia.com.br/Modulo_LEAD_API/index.php';
    const ENDPOINT = API_URL + '?AC=ActionLeads&a2=incluir';

    const armazenamento = {
        get(tipo, chave) { try { return window[tipo].getItem(chave); } catch (e) { return null; } },
        set(tipo, chave, valor) { try { window[tipo].setItem(chave, valor); } catch (e) { /* sem storage */ } }
    };

    const escapar = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

    // ── Toast ────────────────────────────────────────────────────────────
    let toastTimer;
    function toast(msg) {
        const t = $('#toast');
        t.textContent = msg;
        t.classList.add('visivel');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => t.classList.remove('visivel'), 1600);
    }

    // ── Tema ─────────────────────────────────────────────────────────────
    const temaSalvo = armazenamento.get('localStorage', 'leadapi-tema');
    if (temaSalvo) document.documentElement.dataset.theme = temaSalvo;

    $('#temaBtn').addEventListener('click', () => {
        const escuroAtual = document.documentElement.dataset.theme
            ? document.documentElement.dataset.theme === 'dark'
            : matchMedia('(prefers-color-scheme: dark)').matches;
        const novo = escuroAtual ? 'light' : 'dark';
        document.documentElement.dataset.theme = novo;
        armazenamento.set('localStorage', 'leadapi-tema', novo);
    });

    // ── Menu (mobile + link ativo) ───────────────────────────────────────
    const menu = $('#menu');
    $('#menuBtn').addEventListener('click', () => menu.classList.toggle('aberto'));
    $$('a', menu).forEach(a => a.addEventListener('click', () => menu.classList.remove('aberto')));

    const links = new Map($$('a[href^="#"]', menu).map(a => [a.getAttribute('href').slice(1), a]));
    if ('IntersectionObserver' in window) {
        const obs = new IntersectionObserver(entradas => {
            entradas.forEach(e => {
                if (!e.isIntersecting) return;
                links.forEach(a => a.classList.remove('ativo'));
                const link = links.get(e.target.id);
                if (link) link.classList.add('ativo');
            });
        }, { rootMargin: '-30% 0px -60% 0px' });
        $$('main section[id]').forEach(s => obs.observe(s));
    }

    // ── Abas ─────────────────────────────────────────────────────────────
    function ativarAba(grupo, aba) {
        $$(`.abas[data-grupo="${grupo}"] .aba`).forEach(b => b.classList.toggle('ativa', b.dataset.aba === aba));
        $$(`[data-painel^="${grupo}:"]`).forEach(p => p.classList.toggle('ativo', p.dataset.painel === `${grupo}:${aba}`));
    }
    $$('.abas').forEach(abas => {
        abas.addEventListener('click', e => {
            const b = e.target.closest('.aba');
            if (b) ativarAba(abas.dataset.grupo, b.dataset.aba);
        });
    });

    // ── Copiar ───────────────────────────────────────────────────────────
    document.addEventListener('click', async e => {
        const b = e.target.closest('[data-copiar]');
        if (!b) return;
        const alvo = $(b.dataset.copiar);
        const texto = alvo ? alvo.textContent : '';
        try {
            await navigator.clipboard.writeText(texto);
        } catch (err) {
            const ta = document.createElement('textarea');
            ta.value = texto;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            ta.remove();
        }
        toast('Copiado!');
    });

    // ── Destaque de JSON ─────────────────────────────────────────────────
    function destacarJson(obj) {
        const json = typeof obj === 'string' ? obj : JSON.stringify(obj, null, 2);
        return escapar(json).replace(
            /(&quot;(?:\\.|[^\\&]|&(?!quot;))*?&quot;)(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g,
            (m, str, doisPontos, bool) => {
                if (str) return doisPontos ? `<span class="json-chave">${str}</span>${doisPontos}` : `<span class="json-texto">${str}</span>`;
                if (bool) return `<span class="json-bool">${m}</span>`;
                return `<span class="json-num">${m}</span>`;
            }
        );
    }

    // ── Console ──────────────────────────────────────────────────────────
    const campos = {
        unidade: $('#tUnidade'),
        chave: $('#tChave'),
        nome: $('#tNome'),
        pais: $('#tPais'),
        telefone: $('#tTelefone'),
        email: $('#tEmail'),
        origem: $('#tOrigem'),
        campanha: $('#tCampanha'),
        chaveEvento: $('#tChaveEvento')
    };

    // unidade lembrada no navegador; chave só durante a sessão da aba
    campos.unidade.value = armazenamento.get('localStorage', 'leadapi-unidade') || campos.unidade.value;
    campos.chave.value = armazenamento.get('sessionStorage', 'leadapi-chave') || '';

    const formato = () => ($('input[name="tFormato"]:checked') || {}).value || 'json';
    const novaChaveEvento = () => 'doc-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
    campos.chaveEvento.value = novaChaveEvento();

    function corpo() {
        const dados = {};
        ['nome', 'telefone', 'email', 'pais', 'origem', 'campanha', 'chaveEvento'].forEach(c => {
            const v = campos[c].value.trim();
            if (v !== '') dados[c] = v;
        });
        return dados;
    }

    function chaveMascarada() {
        const c = campos.chave.value.trim();
        if (!c) return 'SUA_CHAVE_DE_48_CARACTERES';
        return c.length > 12 ? c.slice(0, 8) + '…' + c.slice(-4) : c;
    }

    function corpoTexto(dados) {
        return formato() === 'json'
            ? JSON.stringify(dados, null, 2)
            : new URLSearchParams(dados).toString();
    }

    function validarChave() {
        const c = campos.chave.value.trim();
        const info = $('#chaveInfo');
        campos.chave.classList.remove('erro');
        info.className = 'dica';
        if (!c) { info.textContent = ''; return; }
        if (/^[0-9a-f]{48}$/i.test(c)) {
            info.textContent = 'Formato válido.';
            info.classList.add('ok');
        } else {
            info.textContent = `Formato inválido: ${c.length} de 48 caracteres hexadecimais.`;
            info.classList.add('ruim');
            campos.chave.classList.add('erro');
        }
    }

    function atualizarPreview() {
        const dados = corpo();
        const url = new URL(ENDPOINT);
        const tipo = formato() === 'json' ? 'application/json' : 'application/x-www-form-urlencoded';

        $('#previewReq').textContent =
            `POST ${url.pathname}${url.search} HTTP/1.1\n` +
            `Host: ${url.host}\n` +
            `X-Unidade: ${campos.unidade.value.trim()}\n` +
            `X-Api-Key: ${chaveMascarada()}\n` +
            `Content-Type: ${tipo}\n\n` +
            corpoTexto(dados);

        atualizarExemplos(dados);
    }

    // ── Exemplos de código ───────────────────────────────────────────────
    function atualizarExemplos(dados) {
        const unidade = campos.unidade.value.trim() || '00';
        const chave = chaveMascarada();
        const json = JSON.stringify(dados, null, 2);
        const jsonLinha = JSON.stringify(dados);

        $('#exCurl').textContent =
`curl -X POST "${ENDPOINT}" \\
  -H "X-Unidade: ${unidade}" \\
  -H "X-Api-Key: ${chave}" \\
  -H "Content-Type: application/json" \\
  -d '${jsonLinha.replace(/'/g, "'\\''")}'`;

        const phpArray = Object.entries(dados)
            .map(([k, v]) => `    '${k}' => '${String(v).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}',`).join('\n');

        $('#exPhp').textContent =
`<?php
$dados = [
${phpArray}
];

$ch = curl_init('${ENDPOINT}');
curl_setopt_array($ch, [
    CURLOPT_POST           => true,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT        => 30,
    CURLOPT_HTTPHEADER     => [
        'X-Unidade: ${unidade}',
        'X-Api-Key: ${chave}',
        'Content-Type: application/json',
    ],
    CURLOPT_POSTFIELDS     => json_encode($dados),
]);

$resposta = json_decode(curl_exec($ch), true);
$http     = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($resposta['codigo'] === 'LEAD_CRIADO') {
    echo 'Lead criado: ' . $resposta['dados']['ID_LEADS'];
} else {
    echo "[$http] {$resposta['codigo']}: {$resposta['mensagem']}";
}`;

        $('#exNode').textContent =
`// Node.js 18+ (fetch nativo) - rode no servidor, nunca no navegador
const resposta = await fetch('${ENDPOINT}', {
  method: 'POST',
  headers: {
    'X-Unidade': '${unidade}',
    'X-Api-Key': process.env.LEAD_API_KEY, // ${chave}
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(${json.replace(/\n/g, '\n  ')})
});

const r = await resposta.json();
if (r.codigo === 'LEAD_CRIADO') {
  console.log('Lead criado:', r.dados.ID_LEADS);
} else {
  console.log(\`[\${resposta.status}] \${r.codigo}: \${r.mensagem}\`);
}`;

        $('#exPython').textContent =
`import requests

resposta = requests.post(
    "${ENDPOINT}",
    headers={
        "X-Unidade": "${unidade}",
        "X-Api-Key": "${chave}",
    },
    json=${json.replace(/\n/g, '\n    ').replace(/: null/g, ': None')},
    timeout=30,
)

r = resposta.json()
if r["codigo"] == "LEAD_CRIADO":
    print("Lead criado:", r["dados"]["ID_LEADS"])
else:
    print(f"[{resposta.status_code}] {r['codigo']}: {r['mensagem']}")`;

        $('#curlRapido').textContent =
`curl -X POST "${ENDPOINT}" \\
  -H "X-Unidade: ${unidade}" \\
  -H "X-Api-Key: ${chave}" \\
  -H "Content-Type: application/json" \\
  -d '{"nome": "Maria Silva", "telefone": "(11) 99999-0000", "email": "maria@exemplo.com"}'`;
    }

    // eventos dos campos
    Object.values(campos).forEach(c => c.addEventListener('input', atualizarPreview));
    $$('input[name="tFormato"]').forEach(r => r.addEventListener('change', atualizarPreview));
    campos.chave.addEventListener('input', () => {
        validarChave();
        armazenamento.set('sessionStorage', 'leadapi-chave', campos.chave.value.trim());
    });
    campos.unidade.addEventListener('input', () => armazenamento.set('localStorage', 'leadapi-unidade', campos.unidade.value.trim()));

    $('#verChave').addEventListener('click', () => {
        campos.chave.type = campos.chave.type === 'password' ? 'text' : 'password';
    });
    $('#novaChaveEvento').addEventListener('click', () => {
        campos.chaveEvento.value = novaChaveEvento();
        atualizarPreview();
    });
    $('#limpar').addEventListener('click', () => {
        ['nome', 'telefone', 'email', 'origem', 'campanha'].forEach(c => { campos[c].value = ''; });
        campos.pais.value = '55';
        campos.chaveEvento.value = novaChaveEvento();
        atualizarPreview();
    });

    // envio real
    $('#enviar').addEventListener('click', async () => {
        const botao = $('#enviar');
        const status = $('#resStatus');
        const dados = corpo();
        const json = formato() === 'json';

        botao.disabled = true;
        botao.textContent = 'Enviando...';
        ativarAba('console', 'res');
        status.className = 'res-status vazio';
        status.textContent = 'Aguardando resposta...';
        $('#resHeaders').textContent = '-';
        $('#resBody').textContent = '-';

        const inicio = performance.now();
        try {
            const resp = await fetch(ENDPOINT, {
                method: 'POST',
                headers: {
                    'X-Unidade': campos.unidade.value.trim(),
                    'X-Api-Key': campos.chave.value.trim(),
                    'Content-Type': json ? 'application/json' : 'application/x-www-form-urlencoded'
                },
                body: json ? JSON.stringify(dados) : new URLSearchParams(dados)
            });
            const ms = Math.round(performance.now() - inicio);
            const texto = await resp.text();

            const cabecalhos = ['content-type', 'x-ratelimit-limit', 'x-ratelimit-remaining', 'retry-after']
                .filter(h => resp.headers.has(h))
                .map(h => `${h}: ${resp.headers.get(h)}`)
                .join('\n');
            $('#resHeaders').textContent = cabecalhos || '-';

            let codigo = '';
            try {
                const obj = JSON.parse(texto);
                codigo = obj.codigo || '';
                $('#resBody').innerHTML = destacarJson(obj);
            } catch (e) {
                $('#resBody').textContent = texto || '(vazio)';
            }

            const faixa = Math.floor(resp.status / 100);
            status.className = 'res-status ' + (faixa === 2 ? 's2' : faixa === 5 ? 's5' : 's4');
            status.innerHTML = `<span>${resp.status} ${escapar(resp.statusText || '')}</span>` +
                (codigo ? `<code>${escapar(codigo)}</code>` : '') +
                `<span class="tempo">${ms} ms</span>`;

            // lead criado: próxima requisição já sai com chaveEvento nova
            if (codigo === 'LEAD_CRIADO') {
                campos.chaveEvento.value = novaChaveEvento();
                atualizarPreview();
            }
        } catch (err) {
            status.className = 'res-status s5';
            status.textContent = 'Falha de rede: ' + err.message;
        } finally {
            botao.disabled = false;
            botao.textContent = 'Enviar requisição';
        }
    });

    // ── Filtro de códigos ────────────────────────────────────────────────
    let faixaAtual = 'todos';
    function filtrarCodigos() {
        const termo = $('#filtroCodigos').value.trim().toLowerCase();
        let visiveis = 0;
        $$('#tabelaCodigos tbody tr').forEach(tr => {
            const http = tr.cells[0].textContent.trim();
            const ok = (faixaAtual === 'todos' || http.startsWith(faixaAtual)) &&
                       (!termo || tr.textContent.toLowerCase().includes(termo));
            tr.hidden = !ok;
            if (ok) visiveis++;
        });
        $('#semCodigos').hidden = visiveis > 0;
    }
    $('#filtroCodigos').addEventListener('input', filtrarCodigos);
    $('#chipsCodigos').addEventListener('click', e => {
        const chip = e.target.closest('.chip');
        if (!chip) return;
        faixaAtual = chip.dataset.faixa;
        $$('.chip', $('#chipsCodigos')).forEach(c => c.classList.toggle('ativo', c === chip));
        filtrarCodigos();
    });

    // ── Simulador de limite ──────────────────────────────────────────────
    const LIMITE = 30;
    function simular() {
        const n = Number($('#simRange').value);
        $('#simValor').textContent = n;
        const barra = $('#simBarra');
        barra.style.width = (n / 60 * 100) + '%';

        let texto;
        if (n <= LIMITE) {
            barra.style.background = n > LIMITE * 0.8 ? 'var(--amarelo)' : 'var(--verde)';
            texto = `Todas aceitas. X-RateLimit-Remaining: ${LIMITE - n}.`;
        } else {
            barra.style.background = 'var(--vermelho)';
            texto = `As ${LIMITE} primeiras são aceitas; a ${LIMITE + 1}ª recebe 429 LIMITE_EXCEDIDO e bloqueia a chave por 30 min. ` +
                    `As ${n - LIMITE - 1 > 0 ? n - LIMITE - 1 + ' seguintes recebem' : 'próximas recebem'} 429 CHAVE_BLOQUEADA.`;
        }
        $('#simTexto').textContent = texto;
    }
    $('#simRange').addEventListener('input', simular);

    // ── Inicialização ────────────────────────────────────────────────────
    $('#baseUrl').textContent = API_URL;
    validarChave();
    atualizarPreview();
    simular();
})();
