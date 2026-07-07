/*
Eu controlo aqui toda a lógica do Geo Explorer:
mapa Leaflet, geolocalização do navegador, geocoding reverso,
meteorologia e o histórico de locais visitados.
*/

document.addEventListener('DOMContentLoaded', () => {

    // ======================================================
    // 1. CONFIGURAÇÃO
    // ======================================================

    const CHAVE_STORAGE = 'geoExplorerDados';

    // Eu uso APIs públicas e gratuitas, sem necessidade de chave:
    // Nominatim para geocoding reverso e Open-Meteo para o tempo.
    const URL_GEOCODING = 'https://nominatim.openstreetmap.org/reverse';
    const URL_METEOROLOGIA = 'https://api.open-meteo.com/v1/forecast';


    // ======================================================
    // 2. ESTADO DA APLICAÇÃO
    // ======================================================

    let mapa = null;
    let marcadorAtual = null;
    let dados = carregarDados();


    // ======================================================
    // 3. REFERÊNCIAS DO DOM
    // ======================================================

    const btnEncontrar = document.getElementById('btn-encontrar');
    const cartaoInfo = document.getElementById('cartao-info');
    const btnFecharInfo = document.getElementById('btn-fechar-info');
    const mensagemVisitante = document.getElementById('mensagem-visitante');

    const infoBandeira = document.getElementById('info-bandeira');
    const infoPais = document.getElementById('info-pais');
    const infoCidade = document.getElementById('info-cidade');
    const infoRegiao = document.getElementById('info-regiao');
    const infoCoordenadas = document.getElementById('info-coordenadas');
    const infoFuso = document.getElementById('info-fuso');
    const infoHoraLocal = document.getElementById('info-hora-local');
    const infoTemperatura = document.getElementById('info-temperatura');

    const btnAbrirRecentes = document.getElementById('btn-abrir-recentes');
    const btnFecharRecentes = document.getElementById('btn-fechar-recentes');
    const painelRecentes = document.getElementById('painel-recentes');
    const listaRecentes = document.getElementById('lista-recentes');


    // ======================================================
    // 4. PERSISTÊNCIA (localStorage)
    // ======================================================

    function carregarDados() {
        const guardado = localStorage.getItem(CHAVE_STORAGE);
        if (guardado) {
            try {
                return JSON.parse(guardado);
            } catch (erro) {
                console.warn('Could not read the saved history.', erro);
            }
        }
        return { historico: [] };
    }

    function guardarLocalNoHistorico(pais, cidade, latitude, longitude) {
        dados.historico.unshift({
            pais, cidade, latitude, longitude,
            data: new Date().toISOString()
        });
        dados.historico = dados.historico.slice(0, 8);
        localStorage.setItem(CHAVE_STORAGE, JSON.stringify(dados));
    }


    // ======================================================
    // 5. MAPA (LEAFLET)
    // ======================================================

    function inicializarMapa() {
        mapa = L.map('mapa', { zoomControl: true }).setView([20, 0], 2);

        // Eu uso o estilo escuro do CartoDB para combinar com o resto do portfolio.
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; OpenStreetMap &copy; CARTO',
            maxZoom: 19
        }).addTo(mapa);
    }

    function moverMapaParaLocal(latitude, longitude) {
        mapa.flyTo([latitude, longitude], 11, { duration: 1.4 });

        if (marcadorAtual) mapa.removeLayer(marcadorAtual);

        const iconeNeon = L.divIcon({ className: 'marcador-neon', iconSize: [20, 20] });
        marcadorAtual = L.marker([latitude, longitude], { icon: iconeNeon }).addTo(mapa);
    }


    // ======================================================
    // 6. BANDEIRA A PARTIR DO CÓDIGO DO PAÍS
    // ======================================================

    // Eu uso imagens do flagcdn.com em vez de emojis de bandeira,
    // porque o Windows não renderiza emojis de bandeira (mostraria só "PT").
    function atualizarBandeira(codigoPais) {
        if (codigoPais) {
            infoBandeira.innerHTML = `<img src="https://flagcdn.com/48x36/${codigoPais.toLowerCase()}.png" alt="${codigoPais.toUpperCase()}" class="bandeira-img">`;
        } else {
            infoBandeira.textContent = '🌐';
        }
    }


    // ======================================================
    // 7. GEOCODING REVERSO (COORDENADAS → PAÍS/CIDADE)
    // ======================================================

    async function obterInformacaoLocal(latitude, longitude) {
        const url = `${URL_GEOCODING}?format=json&lat=${latitude}&lon=${longitude}&zoom=10&addressdetails=1`;
        const resposta = await fetch(url);
        if (!resposta.ok) throw new Error('Could not get geocoding data.');
        return resposta.json();
    }

    async function obterTemperaturaAtual(latitude, longitude) {
        const url = `${URL_METEOROLOGIA}?latitude=${latitude}&longitude=${longitude}&current_weather=true`;
        const resposta = await fetch(url);
        if (!resposta.ok) throw new Error('Could not get weather data.');
        const dadosClima = await resposta.json();
        return dadosClima.current_weather ? dadosClima.current_weather.temperature : null;
    }


    // ======================================================
    // 8. PREENCHIMENTO DO CARTÃO DE INFORMAÇÃO
    // ======================================================

    async function mostrarInformacaoDoLocal(latitude, longitude) {
        infoCoordenadas.textContent = `${latitude.toFixed(3)}, ${longitude.toFixed(3)}`;
        cartaoInfo.classList.remove('escondido');

        try {
            const geo = await obterInformacaoLocal(latitude, longitude);
            const endereco = geo.address || {};

            const nomePais = endereco.country || 'Unknown';
            const nomeCidade = endereco.city || endereco.town || endereco.village || endereco.municipality || '--';
            const nomeRegiao = endereco.state || endereco.region || '--';
            const codigoPais = endereco.country_code;

            atualizarBandeira(codigoPais);
            infoPais.textContent = nomePais;
            infoCidade.textContent = nomeCidade;
            infoRegiao.textContent = nomeRegiao;

            // Eu assumo o fuso horário do próprio navegador, já que a localização é a do utilizador.
            const fusoHorario = Intl.DateTimeFormat().resolvedOptions().timeZone;
            infoFuso.textContent = fusoHorario;
            infoHoraLocal.textContent = new Date().toLocaleTimeString('en-GB', { timeZone: fusoHorario, hour: '2-digit', minute: '2-digit' });

            guardarLocalNoHistorico(nomePais, nomeCidade, latitude, longitude);
            renderizarRecentes();
        } catch (erro) {
            console.warn('Could not load location details.', erro);
            infoPais.textContent = 'Unavailable';
        }

        try {
            const temperatura = await obterTemperaturaAtual(latitude, longitude);
            infoTemperatura.textContent = temperatura !== null ? `${temperatura}°C` : '--';
        } catch (erro) {
            infoTemperatura.textContent = '--';
        }
    }


    // ======================================================
    // 9. GEOLOCALIZAÇÃO DO NAVEGADOR
    // ======================================================

    function encontrarLocalizacao() {
        if (!navigator.geolocation) {
            mostrarModoVisitante();
            return;
        }

        btnEncontrar.textContent = '📡 Locating...';

        navigator.geolocation.getCurrentPosition(
            (posicao) => {
                const { latitude, longitude } = posicao.coords;
                btnEncontrar.textContent = '📍 Find My Location';
                mensagemVisitante.classList.add('escondido');

                moverMapaParaLocal(latitude, longitude);
                mostrarInformacaoDoLocal(latitude, longitude);
            },
            () => {
                btnEncontrar.textContent = '📍 Find My Location';
                mostrarModoVisitante();
            },
            { enableHighAccuracy: true, timeout: 10000 }
        );
    }

    function mostrarModoVisitante() {
        mensagemVisitante.classList.remove('escondido');
        setTimeout(() => mensagemVisitante.classList.add('escondido'), 4000);
    }


    // ======================================================
    // 10. LOCAIS RECENTES
    // ======================================================

    function renderizarRecentes() {
        listaRecentes.innerHTML = '';

        if (dados.historico.length === 0) {
            listaRecentes.innerHTML = '<p class="recente-detalhe">You have not visited any locations yet.</p>';
            return;
        }

        dados.historico.forEach((item) => {
            const linha = document.createElement('button');
            linha.className = 'recente-item';
            linha.innerHTML = `
                <span>${item.cidade}, ${item.pais}</span>
                <span class="recente-detalhe">${new Date(item.data).toLocaleDateString('en-GB')}</span>
            `;
            linha.addEventListener('click', () => {
                moverMapaParaLocal(item.latitude, item.longitude);
                mostrarInformacaoDoLocal(item.latitude, item.longitude);
                painelRecentes.classList.add('escondido');
            });
            listaRecentes.appendChild(linha);
        });
    }


    // ======================================================
    // 11. EVENTOS GERAIS
    // ======================================================

    btnEncontrar.addEventListener('click', encontrarLocalizacao);
    btnFecharInfo.addEventListener('click', () => cartaoInfo.classList.add('escondido'));

    btnAbrirRecentes.addEventListener('click', () => {
        renderizarRecentes();
        painelRecentes.classList.remove('escondido');
    });
    btnFecharRecentes.addEventListener('click', () => painelRecentes.classList.add('escondido'));


    // ======================================================
    // 12. INICIALIZAÇÃO DA APLICAÇÃO
    // ======================================================

    inicializarMapa();
});
