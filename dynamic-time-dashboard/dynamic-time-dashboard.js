/*
Eu controlo aqui toda a lógica do Dynamic Time Dashboard:
relógio em tempo real, troca de tema consoante a hora,
animação do sol/lua/estrelas e o modo de simulação manual.
*/

document.addEventListener('DOMContentLoaded', () => {

    // ======================================================
    // 1. CONFIGURAÇÃO DOS TEMAS POR PERÍODO DO DIA
    // ======================================================

    // Eu defino aqui cada período: hora de início, gradiente, ícone e saudação.
    const TEMAS = [
        {
            id: 'madrugada', inicio: 0, fim: 5,
            gradiente: 'linear-gradient(160deg, #050818 0%, #0b1230 100%)',
            icone: '🌌', nome: 'Late Night', saudacao: 'Good night', celeste: 'lua'
        },
        {
            id: 'manha', inicio: 6, fim: 11,
            gradiente: 'linear-gradient(160deg, #ff9a5a 0%, #ff6fa5 45%, #6a4c93 100%)',
            icone: '🌅', nome: 'Morning', saudacao: 'Good morning', celeste: 'sol'
        },
        {
            id: 'tarde', inicio: 12, fim: 17,
            gradiente: 'linear-gradient(160deg, #4facfe 0%, #7ed6ff 45%, #c9f0ff 100%)',
            icone: '☀️', nome: 'Afternoon', saudacao: 'Good afternoon', celeste: 'sol'
        },
        {
            id: 'por-do-sol', inicio: 18, fim: 20,
            gradiente: 'linear-gradient(160deg, #ff512f 0%, #dd2476 50%, #6a3093 100%)',
            icone: '🌇', nome: 'Sunset', saudacao: 'Good afternoon', celeste: 'sol'
        },
        {
            id: 'noite', inicio: 21, fim: 23,
            gradiente: 'linear-gradient(160deg, #0b1026 0%, #05010d 100%)',
            icone: '🌙', nome: 'Night', saudacao: 'Good evening', celeste: 'lua'
        }
    ];

    const DIAS_SEMANA = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const MESES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    const CHAVE_STORAGE = 'dynamicTimeDashboardDados';


    // ======================================================
    // 2. ESTADO DA APLICAÇÃO
    // ======================================================

    let modoManual = false;
    let horaSimulada = 12;
    let temporizadorRelogio = null;

    let dados = carregarDados();


    // ======================================================
    // 3. REFERÊNCIAS DO DOM
    // ======================================================

    const relogioEl = document.getElementById('relogio');
    const dataCompletaEl = document.getElementById('data-completa');
    const saudacaoEl = document.getElementById('saudacao');
    const iconeTemaEl = document.getElementById('icone-tema');
    const nomeTemaEl = document.getElementById('nome-tema');

    const sliderHora = document.getElementById('slider-hora');
    const badgeModo = document.getElementById('badge-modo');
    const btnHoraReal = document.getElementById('btn-hora-real');

    const camadaEstrelas = document.getElementById('camada-estrelas');
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
        return { ultimoTema: 'tarde', modoManual: false };
    }

    function guardarDados(temaId) {
        dados.ultimoTema = temaId;
        dados.modoManual = modoManual;
        localStorage.setItem(CHAVE_STORAGE, JSON.stringify(dados));
    }


    // ======================================================
    // 5. ESTRELAS DE FUNDO
    // ======================================================

    function gerarEstrelas() {
        // Eu gero 60 estrelas em posições e tamanhos aleatórios, uma única vez.
        for (let i = 0; i < 60; i++) {
            const estrela = document.createElement('div');
            estrela.className = 'estrela';
            estrela.style.top = `${Math.random() * 100}%`;
            estrela.style.left = `${Math.random() * 100}%`;
            estrela.style.animationDelay = `${Math.random() * 3}s`;
            const tamanho = 1 + Math.random() * 2;
            estrela.style.width = `${tamanho}px`;
            estrela.style.height = `${tamanho}px`;
            camadaEstrelas.appendChild(estrela);
        }
    }


    // ======================================================
    // 6. OBTER TEMA CONFORME A HORA
    // ======================================================

    function obterTemaPorHora(hora) {
        return TEMAS.find((tema) => hora >= tema.inicio && hora <= tema.fim) || TEMAS[2];
    }


    // ======================================================
    // 7. APLICAÇÃO DO TEMA VISUAL
    // ======================================================

    function aplicarTema(tema, hora, minuto) {
        document.body.style.background = tema.gradiente;
        iconeTemaEl.textContent = tema.icone;
        nomeTemaEl.textContent = tema.nome;
        saudacaoEl.textContent = tema.saudacao;

        const eNoite = tema.celeste === 'lua';
        camadaEstrelas.classList.toggle('visivel', eNoite);
        luaAnimada.classList.toggle('visivel', eNoite);
        solAnimado.classList.toggle('visivel', !eNoite);

        // Eu calculo a posição do sol/lua ao longo do dia através de um arco simples.
        const progressoDia = (hora + minuto / 60) / 24;
        const posicaoX = 10 + progressoDia * 80; // percentagem horizontal
        const posicaoY = 45 - Math.sin(progressoDia * Math.PI) * 35; // arco vertical

        const alvo = eNoite ? luaAnimada : solAnimado;
        alvo.style.left = `${posicaoX}%`;
        alvo.style.top = `${posicaoY}%`;

        guardarDados(tema.id);
    }


    // ======================================================
    // 8. RELÓGIO
    // ======================================================

    function formatarDataCompleta(data) {
        const diaSemana = DIAS_SEMANA[data.getDay()];
        const dia = data.getDate();
        const mes = MESES[data.getMonth()];
        const ano = data.getFullYear();
        return `${diaSemana}, ${mes} ${dia}, ${ano}`;
    }

    function atualizarRelogioReal() {
        const agora = new Date();
        const horas = agora.getHours().toString().padStart(2, '0');
        const minutos = agora.getMinutes().toString().padStart(2, '0');
        const segundos = agora.getSeconds().toString().padStart(2, '0');

        relogioEl.textContent = `${horas}:${minutos}:${segundos}`;
        dataCompletaEl.textContent = formatarDataCompleta(agora);

        const tema = obterTemaPorHora(agora.getHours());
        aplicarTema(tema, agora.getHours(), agora.getMinutes());
    }

    function atualizarRelogioSimulado() {
        const horas = horaSimulada.toString().padStart(2, '0');
        relogioEl.textContent = `${horas}:00:00`;
        dataCompletaEl.textContent = formatarDataCompleta(new Date());

        const tema = obterTemaPorHora(horaSimulada);
        aplicarTema(tema, horaSimulada, 0);
    }


    // ======================================================
    // 9. MODO SIMULAÇÃO (SLIDER)
    // ======================================================

    sliderHora.addEventListener('input', () => {
        modoManual = true;
        horaSimulada = parseInt(sliderHora.value, 10);

        badgeModo.textContent = 'Manual';
        badgeModo.classList.add('manual');

        pararRelogioAutomatico();
        atualizarRelogioSimulado();
    });

    btnHoraReal.addEventListener('click', () => {
        modoManual = false;
        badgeModo.textContent = 'Automatic';
        badgeModo.classList.remove('manual');

        const agora = new Date();
        sliderHora.value = agora.getHours();

        iniciarRelogioAutomatico();
    });


    // ======================================================
    // 10. CONTROLO DO TEMPORIZADOR
    // ======================================================

    function iniciarRelogioAutomatico() {
        pararRelogioAutomatico();
        atualizarRelogioReal();
        temporizadorRelogio = setInterval(atualizarRelogioReal, 1000);
    }

    function pararRelogioAutomatico() {
        clearInterval(temporizadorRelogio);
    }


    // ======================================================
    // 11. INICIALIZAÇÃO DA APLICAÇÃO
    // ======================================================

    function inicializarApp() {
        gerarEstrelas();

        const agora = new Date();
        sliderHora.value = agora.getHours();
        iniciarRelogioAutomatico();
    }

    inicializarApp();
});
