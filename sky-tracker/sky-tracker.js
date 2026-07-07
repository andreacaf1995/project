/*
Eu controlo aqui toda a lógica do Sky Tracker:
geolocalização, nascer/pôr do sol, fase da lua, meteorologia,
animação do céu e o modo de simulação por hora.
*/

document.addEventListener('DOMContentLoaded', () => {

    // ======================================================
    // 1. CONFIGURAÇÃO
    // ======================================================

    const CHAVE_STORAGE = 'skyTrackerDados';

    // Eu uso APIs públicas e gratuitas, sem necessidade de chave.
    const URL_SOL = 'https://api.sunrise-sunset.org/json';
    const URL_METEOROLOGIA = 'https://api.open-meteo.com/v1/forecast';
    const URL_GEOCODING = 'https://nominatim.openstreetmap.org/reverse';

    // Eu mapeio os códigos de tempo do Open-Meteo para um ícone e descrição.
    const CODIGOS_TEMPO = {
        0: { icone: '☀️', texto: 'Clear sky' },
        1: { icone: '🌤️', texto: 'Mostly clear' },
        2: { icone: '⛅', texto: 'Partly cloudy' },
        3: { icone: '☁️', texto: 'Overcast' },
        45: { icone: '🌫️', texto: 'Foggy' },
        48: { icone: '🌫️', texto: 'Icy fog' },
        51: { icone: '🌦️', texto: 'Light drizzle' },
        61: { icone: '🌧️', texto: 'Light rain' },
        63: { icone: '🌧️', texto: 'Moderate rain' },
        65: { icone: '🌧️', texto: 'Heavy rain' },
        71: { icone: '🌨️', texto: 'Light snow' },
        80: { icone: '🌦️', texto: 'Rain showers' },
        95: { icone: '⛈️', texto: 'Thunderstorm' }
    };


    // ======================================================
    // 2. ESTADO DA APLICAÇÃO
    // ======================================================

    let coordenadasAtuais = null;
    let horarioSol = null; // { nascer: Date, por: Date }
    let modoManual = false;
    let horaSimulada = 12;
    let temporizadorRelogio = null;

    let dados = carregarDados();


    // ======================================================
    // 3. REFERÊNCIAS DO DOM
    // ======================================================

    const localNomeEl = document.getElementById('local-nome');
    const relogioLocalEl = document.getElementById('relogio-local');
    const dataLocalEl = document.getElementById('data-local');

    const infoNascerSol = document.getElementById('info-nascer-sol');
    const infoPorSol = document.getElementById('info-por-sol');
    const infoFaseLua = document.getElementById('info-fase-lua');
    const infoTemperatura = document.getElementById('info-temperatura');
    const infoTempo = document.getElementById('info-tempo');

    const btnLocalizar = document.getElementById('btn-localizar');
    const sliderHora = document.getElementById('slider-hora');
    const badgeModo = document.getElementById('badge-modo');
    const btnHoraReal = document.getElementById('btn-hora-real');

    const camadaEstrelas = document.getElementById('camada-estrelas');
    const camadaCadentes = document.getElementById('camada-cadentes');
    const solAnimado = document.getElementById('sol-animado');
    const luaAnimada = document.getElementById('lua-animada');


    // ======================================================
    // 4. PERSISTÊNCIA (localStorage)
    // ======================================================

    function carregarDados() {
        const guardado = localStorage.getItem(CHAVE_STORAGE);
        if (guardado) {
            try {
                return JSON.parse(guardado);
            } catch (erro) {
                console.warn('Could not read saved preferences.', erro);
            }
        }
        return { ultimaLocalizacao: null, ultimoModo: 'automatico' };
    }

    function guardarDados() {
        dados.ultimaLocalizacao = coordenadasAtuais;
        dados.ultimoModo = modoManual ? 'manual' : 'automatico';
        localStorage.setItem(CHAVE_STORAGE, JSON.stringify(dados));
    }


    // ======================================================
    // 5. ESTRELAS E ESTRELAS CADENTES
    // ======================================================

    function gerarEstrelas() {
        for (let i = 0; i < 70; i++) {
            const estrela = document.createElement('div');
            estrela.className = 'estrela';
            estrela.style.top = `${Math.random() * 100}%`;
            estrela.style.left = `${Math.random() * 100}%`;
            estrela.style.animationDelay = `${Math.random() * 3}s`;
            camadaEstrelas.appendChild(estrela);
        }
    }

    function criarEstrelaCadente() {
        const cadente = document.createElement('div');
        cadente.className = 'estrela-cadente';
        cadente.style.top = `${Math.random() * 40}%`;
        cadente.style.left = `${Math.random() * 70}%`;
        camadaCadentes.appendChild(cadente);
        setTimeout(() => cadente.remove(), 1700);
    }

    // Eu lanço uma estrela cadente aleatoriamente a cada intervalo, só durante a noite.
    setInterval(() => {
        if (camadaCadentes.classList.contains('visivel') && Math.random() < 0.5) {
            criarEstrelaCadente();
        }
    }, 4000);


    // ======================================================
    // 6. FASE DA LUA (cálculo algorítmico simples)
    // ======================================================

    function calcularFaseLua(data) {
        const luaNovaReferencia = new Date('2000-01-06T18:14:00Z').getTime();
        const cicloLunarDias = 29.53058867;

        const diasDesdeReferencia = (data.getTime() - luaNovaReferencia) / 86400000;
        const posicaoNoCiclo = ((diasDesdeReferencia % cicloLunarDias) + cicloLunarDias) % cicloLunarDias;
        const indice = Math.floor((posicaoNoCiclo / cicloLunarDias) * 8) % 8;

        const nomes = ['New Moon', 'Waxing Crescent', 'First Quarter', 'Waxing Gibbous', 'Full Moon', 'Waning Gibbous', 'Last Quarter', 'Waning Crescent'];
        const emojis = ['🌑', '🌒', '🌓', '🌔', '🌕', '🌖', '🌗', '🌘'];

        return `${emojis[indice]} ${nomes[indice]}`;
    }


    // ======================================================
    // 7. API DE NASCER/PÔR DO SOL
    // ======================================================

    async function obterHorarioSol(latitude, longitude) {
        const url = `${URL_SOL}?lat=${latitude}&lng=${longitude}&formatted=0`;
        const resposta = await fetch(url);
        if (!resposta.ok) throw new Error('Could not get sunrise/sunset times.');
        const dadosSol = await resposta.json();

        return {
            nascer: new Date(dadosSol.results.sunrise),
            por: new Date(dadosSol.results.sunset)
        };
    }


    // ======================================================
    // 8. API DE METEOROLOGIA
    // ======================================================

    async function obterMeteorologia(latitude, longitude) {
        const url = `${URL_METEOROLOGIA}?latitude=${latitude}&longitude=${longitude}&current_weather=true`;
        const resposta = await fetch(url);
        if (!resposta.ok) throw new Error('Could not get weather data.');
        const dadosClima = await resposta.json();
        return dadosClima.current_weather;
    }


    // ======================================================
    // 9. GEOCODING (NOME DA CIDADE/PAÍS)
    // ======================================================

    async function obterNomeLocal(latitude, longitude) {
        const url = `${URL_GEOCODING}?format=json&lat=${latitude}&lon=${longitude}&zoom=10&addressdetails=1`;
        const resposta = await fetch(url);
        if (!resposta.ok) throw new Error('Could not get location name.');
        const geo = await resposta.json();
        const endereco = geo.address || {};
        const cidade = endereco.city || endereco.town || endereco.village || '';
        const pais = endereco.country || '';
        return cidade ? `${cidade}, ${pais}` : pais || 'Local desconhecido';
    }


    // ======================================================
    // 10. GEOLOCALIZAÇÃO E CARREGAMENTO DE DADOS
    // ======================================================

    function usarLocalizacaoAtual() {
        if (!navigator.geolocation) {
            localNomeEl.textContent = 'Geolocation is not supported by this browser.';
            return;
        }

        btnLocalizar.textContent = '📡 Locating...';

        navigator.geolocation.getCurrentPosition(
            async (posicao) => {
                coordenadasAtuais = { latitude: posicao.coords.latitude, longitude: posicao.coords.longitude };
                btnLocalizar.textContent = '📍 Use My Location';
                await carregarDadosDoLocal(coordenadasAtuais);
                guardarDados();
            },
            () => {
                btnLocalizar.textContent = '📍 Use My Location';
                localNomeEl.textContent = 'Could not get your location.';
            },
            { enableHighAccuracy: true, timeout: 10000 }
        );
    }

    async function carregarDadosDoLocal(coordenadas) {
        localNomeEl.textContent = 'Loading sky information...';

        try {
            const [nomeLocal, sol, clima] = await Promise.all([
                obterNomeLocal(coordenadas.latitude, coordenadas.longitude),
                obterHorarioSol(coordenadas.latitude, coordenadas.longitude),
                obterMeteorologia(coordenadas.latitude, coordenadas.longitude)
            ]);

            localNomeEl.textContent = nomeLocal;
            horarioSol = sol;

            infoNascerSol.textContent = sol.nascer.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
            infoPorSol.textContent = sol.por.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

            const infoTempoAtual = CODIGOS_TEMPO[clima.weathercode] || { icone: '🌡️', texto: 'Unavailable' };
            infoTemperatura.textContent = `${clima.temperature}°C`;
            infoTempo.textContent = `${infoTempoAtual.icone} ${infoTempoAtual.texto}`;
        } catch (erro) {
            console.warn('Could not load all sky data.', erro);
            localNomeEl.textContent = 'Some information is unavailable.';
        }
    }


    // ======================================================
    // 11. APLICAÇÃO VISUAL DO CÉU (COR + SOL/LUA)
    // ======================================================

    function determinarPeriodo(hora) {
        if (hora >= 0 && hora <= 5) return { id: 'noite', gradiente: 'linear-gradient(160deg, #050818 0%, #0b1230 100%)', eNoite: true };
        if (hora >= 6 && hora <= 11) return { id: 'manha', gradiente: 'linear-gradient(160deg, #ff9a5a 0%, #ff6fa5 45%, #6a4c93 100%)', eNoite: false };
        if (hora >= 12 && hora <= 17) return { id: 'dia', gradiente: 'linear-gradient(160deg, #4facfe 0%, #7ed6ff 45%, #c9f0ff 100%)', eNoite: false };
        if (hora >= 18 && hora <= 20) return { id: 'por-do-sol', gradiente: 'linear-gradient(160deg, #ff512f 0%, #dd2476 50%, #6a3093 100%)', eNoite: false };
        return { id: 'noite', gradiente: 'linear-gradient(160deg, #0b1026 0%, #05010d 100%)', eNoite: true };
    }

    function aplicarCeu(hora, minuto) {
        const periodo = determinarPeriodo(hora);
        document.body.style.background = periodo.gradiente;

        camadaEstrelas.classList.toggle('visivel', periodo.eNoite);
        camadaCadentes.classList.toggle('visivel', periodo.eNoite);
        luaAnimada.classList.toggle('visivel', periodo.eNoite);
        solAnimado.classList.toggle('visivel', !periodo.eNoite);

        const progressoDia = (hora + minuto / 60) / 24;
        const posicaoX = 10 + progressoDia * 80;
        const posicaoY = 45 - Math.sin(progressoDia * Math.PI) * 35;

        const corpoAtivo = periodo.eNoite ? luaAnimada : solAnimado;
        corpoAtivo.style.left = `${posicaoX}%`;
        corpoAtivo.style.top = `${posicaoY}%`;

        infoFaseLua.textContent = calcularFaseLua(new Date());
    }


    // ======================================================
    // 12. RELÓGIO E MODO SIMULAÇÃO
    // ======================================================

    function atualizarRelogioReal() {
        const agora = new Date();
        relogioLocalEl.textContent = agora.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
        dataLocalEl.textContent = agora.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
        aplicarCeu(agora.getHours(), agora.getMinutes());
    }

    function atualizarRelogioSimulado() {
        relogioLocalEl.textContent = `${horaSimulada.toString().padStart(2, '0')}:00`;
        dataLocalEl.textContent = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
        aplicarCeu(horaSimulada, 0);
    }

    sliderHora.addEventListener('input', () => {
        modoManual = true;
        horaSimulada = parseInt(sliderHora.value, 10);

        badgeModo.textContent = 'Manual';
        badgeModo.classList.add('manual');

        pararRelogioAutomatico();
        atualizarRelogioSimulado();
        guardarDados();
    });

    btnHoraReal.addEventListener('click', () => {
        modoManual = false;
        badgeModo.textContent = 'Automatic';
        badgeModo.classList.remove('manual');

        const agora = new Date();
        sliderHora.value = agora.getHours();

        iniciarRelogioAutomatico();
        guardarDados();
    });

    function iniciarRelogioAutomatico() {
        pararRelogioAutomatico();
        atualizarRelogioReal();
        temporizadorRelogio = setInterval(atualizarRelogioReal, 1000);
    }

    function pararRelogioAutomatico() {
        clearInterval(temporizadorRelogio);
    }


    // ======================================================
    // 13. EVENTOS GERAIS
    // ======================================================

    btnLocalizar.addEventListener('click', usarLocalizacaoAtual);


    // ======================================================
    // 14. INICIALIZAÇÃO DA APLICAÇÃO
    // ======================================================

    function inicializarApp() {
        gerarEstrelas();

        const agora = new Date();
        sliderHora.value = agora.getHours();
        iniciarRelogioAutomatico();

        // Eu tento recarregar automaticamente a última localização guardada.
        if (dados.ultimaLocalizacao) {
            coordenadasAtuais = dados.ultimaLocalizacao;
            carregarDadosDoLocal(coordenadasAtuais);
        } else {
            localNomeEl.textContent = 'Clica em "Use My Location" para começar.';
        }
    }

    inicializarApp();
});
