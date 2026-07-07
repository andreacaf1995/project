/*
Eu controlo aqui toda a lógica do jogo Memory Master:
seleção de tema/nível, mecânica das cartas, pontuação,
temporizador, sons e persistência em localStorage.
*/

document.addEventListener('DOMContentLoaded', () => {

    // ======================================================
    // 1. DADOS DO JOGO (temas e níveis)
    // ======================================================

    // Eu defino aqui os símbolos de cada tema.
    // Animais e Bandeiras usam emojis nativos (não preciso de imagens).
    const TEMAS = {
        animais: {
            tipo: 'emoji',
            simbolos: ['🦁', '🐼', '🐸', '🐯', '🐵', '🐶', '🐱', '🦊', '🐨', '🦄', '🐷', '🐔', '🐙', '🦋', '🐢']
        },
        bandeiras: {
            tipo: 'emoji',
            simbolos: ['🇵🇹', '🇧🇷', '🇫🇷', '🇯🇵', '🇺🇸', '🇩🇪', '🇪🇸', '🇮🇹', '🇬🇧', '🇨🇦', '🇰🇷', '🇲🇽', '🇳🇱', '🇨🇭', '🇸🇪']
        },
        // Eu uso "badges" coloridos em vez de ícones, para não depender de ficheiros externos.
        tecnologia: {
            tipo: 'badge',
            simbolos: [
                { nome: 'HTML', cor: '#e34f26' },
                { nome: 'CSS', cor: '#264de4' },
                { nome: 'JS', cor: '#f0db4f', corTexto: '#1f1f1f' },
                { nome: 'PHP', cor: '#777bb4' },
                { nome: 'Python', cor: '#3776ab' },
                { nome: 'React', cor: '#61dafb', corTexto: '#1f1f1f' },
                { nome: 'Java', cor: '#f89820' },
                { nome: 'C++', cor: '#00599c' },
                { nome: 'Node', cor: '#3c873a' },
                { nome: 'TS', cor: '#3178c6' },
                { nome: 'SQL', cor: '#cc2927' },
                { nome: 'Git', cor: '#f05032' },
                { nome: 'Vue', cor: '#42b883', corTexto: '#1f1f1f' },
                { nome: 'Sass', cor: '#cf649a' },
                { nome: 'Go', cor: '#00add8', corTexto: '#1f1f1f' }
            ]
        }
    };

    // Eu defino aqui os 6 níveis de dificuldade pedidos.
    const NIVEIS = [
        { numero: 1, pares: 4, colunas: 4 },
        { numero: 2, pares: 6, colunas: 4 },
        { numero: 3, pares: 8, colunas: 4 },
        { numero: 4, pares: 10, colunas: 5 },
        { numero: 5, pares: 12, colunas: 6 },
        { numero: 6, pares: 15, colunas: 6 }
    ];

    const CHAVE_STORAGE = 'memoryMasterDados';


    // ======================================================
    // 2. ESTADO DO JOGO
    // ======================================================

    let temaAtual = 'animais';
    let nivelEscolhidoMenu = 1;
    let nivelAtual = 1;

    let cartasViradas = [];
    let bloqueado = false;
    let paresEncontrados = 0;
    let totalPares = 0;

    let tentativas = 0;
    let pontuacaoAtual = 0;
    let tempoDecorrido = 0;
    let temporizadorId = null;

    let somAtivado = true;
    let contextoAudio = null;

    let dados = carregarDados();


    // ======================================================
    // 3. REFERÊNCIAS DO DOM
    // ======================================================

    const telaMenu = document.getElementById('tela-menu');
    const telaJogo = document.getElementById('tela-jogo');
    const grelhaTemas = document.getElementById('grelha-temas');
    const grelhaNiveis = document.getElementById('grelha-niveis');
    const btnComecar = document.getElementById('btn-comecar');

    const gridCartas = document.getElementById('grid-cartas');
    const btnVoltarMenu = document.getElementById('btn-voltar-menu');
    const btnReiniciar = document.getElementById('btn-reiniciar');

    const valorTentativas = document.getElementById('valor-tentativas');
    const valorTempo = document.getElementById('valor-tempo');
    const valorPontuacao = document.getElementById('valor-pontuacao');
    const valorNivel = document.getElementById('valor-nivel');

    const modalVitoria = document.getElementById('modal-vitoria');
    const vitoriaTitulo = document.getElementById('vitoria-titulo');
    const vitoriaSubtitulo = document.getElementById('vitoria-subtitulo');
    const vitoriaPontos = document.getElementById('vitoria-pontos');
    const vitoriaTentativas = document.getElementById('vitoria-tentativas');
    const vitoriaTempo = document.getElementById('vitoria-tempo');
    const btnProximoNivel = document.getElementById('btn-proximo-nivel');
    const btnVitoriaMenu = document.getElementById('btn-vitoria-menu');

    const btnSomMenu = document.getElementById('btn-som-menu');
    const iconSomMenu = document.getElementById('icon-som-menu');
    const btnSomJogo = document.getElementById('btn-som-jogo');
    const iconSomJogo = document.getElementById('icon-som-jogo');

    const statMelhorPontuacao = document.getElementById('stat-melhor-pontuacao');
    const statMelhorTempo = document.getElementById('stat-melhor-tempo');
    const statTotalJogos = document.getElementById('stat-total-jogos');


    // ======================================================
    // 4. PERSISTÊNCIA (localStorage)
    // ======================================================

    function carregarDados() {
        const guardado = localStorage.getItem(CHAVE_STORAGE);
        if (guardado) {
            try {
                return JSON.parse(guardado);
            } catch (erro) {
                console.warn('I could not read the saved data, starting fresh.', erro);
            }
        }
        // Estrutura inicial caso não exista nada guardado ainda.
        return {
            melhorPontuacao: 0,
            nivelDesbloqueado: 1,
            totalJogos: 0,
            melhorTempo: null,
            historico: []
        };
    }

    function guardarDados() {
        localStorage.setItem(CHAVE_STORAGE, JSON.stringify(dados));
    }


    // ======================================================
    // 5. SONS (Web Audio API — sem ficheiros externos)
    // ======================================================

    function obterContextoAudio() {
        if (!contextoAudio) {
            const AudioContextClasse = window.AudioContext || window.webkitAudioContext;
            contextoAudio = new AudioContextClasse();
        }
        return contextoAudio;
    }

    function tocarTom(frequencia, duracao, tipoOnda) {
        const ctx = obterContextoAudio();
        const osc = ctx.createOscillator();
        const ganho = ctx.createGain();

        osc.connect(ganho);
        ganho.connect(ctx.destination);

        osc.type = tipoOnda || 'sine';
        osc.frequency.value = frequencia;

        ganho.gain.setValueAtTime(0.2, ctx.currentTime);
        ganho.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duracao);

        osc.start();
        osc.stop(ctx.currentTime + duracao);
    }

    function tocarSom(tipo) {
        if (!somAtivado) return;

        // Eu gero pequenos "beeps" sintetizados em vez de carregar áudio externo.
        if (tipo === 'virar') {
            tocarTom(320, 0.08, 'sine');
        } else if (tipo === 'par') {
            tocarTom(660, 0.18, 'triangle');
        } else if (tipo === 'erro') {
            tocarTom(150, 0.2, 'sawtooth');
        } else if (tipo === 'nivel') {
            tocarArpejoVitoria();
        }
    }

    function tocarArpejoVitoria() {
        const ctx = obterContextoAudio();
        const notas = [523.25, 659.25, 783.99, 1046.5];

        notas.forEach((freq, indice) => {
            const osc = ctx.createOscillator();
            const ganho = ctx.createGain();
            osc.connect(ganho);
            ganho.connect(ctx.destination);

            osc.type = 'sine';
            osc.frequency.value = freq;

            const inicio = ctx.currentTime + indice * 0.12;
            ganho.gain.setValueAtTime(0.001, inicio);
            ganho.gain.linearRampToValueAtTime(0.25, inicio + 0.02);
            ganho.gain.exponentialRampToValueAtTime(0.001, inicio + 0.25);

            osc.start(inicio);
            osc.stop(inicio + 0.3);
        });
    }

    function alternarSom() {
        somAtivado = !somAtivado;
        const icone = somAtivado ? '🔊' : '🔇';
        iconSomMenu.textContent = icone;
        iconSomJogo.textContent = icone;
    }


    // ======================================================
    // 6. CONSTRUÇÃO DO MENU INICIAL
    // ======================================================

    function gerarGrelhaNiveis() {
        grelhaNiveis.innerHTML = '';

        NIVEIS.forEach((nivel) => {
            const desbloqueado = nivel.numero <= dados.nivelDesbloqueado;

            const botao = document.createElement('button');
            botao.className = 'nivel-card';
            botao.disabled = !desbloqueado;
            if (nivel.numero === nivelEscolhidoMenu) {
                botao.classList.add('active');
            }

            botao.innerHTML = `
                <span class="nivel-numero">${desbloqueado ? nivel.numero : '🔒'}</span>
                <span class="nivel-pares">${nivel.pares} pares</span>
            `;

            botao.addEventListener('click', () => {
                if (!desbloqueado) return;
                nivelEscolhidoMenu = nivel.numero;
                atualizarSelecaoNiveis();
            });

            grelhaNiveis.appendChild(botao);
        });
    }

    function atualizarSelecaoNiveis() {
        const botoes = grelhaNiveis.querySelectorAll('.nivel-card');
        botoes.forEach((botao, indice) => {
            botao.classList.toggle('active', NIVEIS[indice].numero === nivelEscolhidoMenu);
        });
    }

    function configurarSelecaoTemas() {
        const botoesTema = grelhaTemas.querySelectorAll('.tema-card');
        botoesTema.forEach((botao) => {
            botao.addEventListener('click', () => {
                temaAtual = botao.dataset.tema;
                botoesTema.forEach((b) => b.classList.remove('active'));
                botao.classList.add('active');
            });
        });
    }

    function atualizarPainelEstatisticas() {
        statMelhorPontuacao.textContent = dados.melhorPontuacao;
        statMelhorTempo.textContent = dados.melhorTempo !== null ? formatarTempo(dados.melhorTempo) : '--:--';
        statTotalJogos.textContent = dados.totalJogos;
    }


    // ======================================================
    // 7. PREPARAÇÃO E ARRANQUE DO JOGO
    // ======================================================

    function embaralhar(array) {
        // Eu uso o algoritmo de Fisher-Yates para baralhar as cartas.
        const copia = [...array];
        for (let i = copia.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [copia[i], copia[j]] = [copia[j], copia[i]];
        }
        return copia;
    }

    function criarBaralho(nivel) {
        const tema = TEMAS[temaAtual];
        const simbolosEscolhidos = tema.simbolos.slice(0, nivel.pares);

        // Eu duplico cada símbolo para formar os pares.
        let baralho = [];
        simbolosEscolhidos.forEach((simbolo, indice) => {
            baralho.push({ parId: indice, simbolo });
            baralho.push({ parId: indice, simbolo });
        });

        return embaralhar(baralho);
    }

    function renderizarCartaConteudo(simbolo) {
        const tema = TEMAS[temaAtual];

        if (tema.tipo === 'badge') {
            const corTexto = simbolo.corTexto || '#ffffff';
            return `<span class="badge-tech" style="background-color:${simbolo.cor}; color:${corTexto};">${simbolo.nome}</span>`;
        }

        // Tipo emoji (animais e bandeiras)
        return simbolo;
    }

    function renderizarCartas(baralho, colunas) {
        gridCartas.innerHTML = '';
        gridCartas.style.setProperty('--colunas', colunas);

        baralho.forEach((dadosCarta, indice) => {
            const carta = document.createElement('div');
            carta.className = 'carta';
            carta.dataset.indice = indice;
            carta.dataset.parId = dadosCarta.parId;

            carta.innerHTML = `
                <div class="carta-inner">
                    <div class="carta-face carta-tras">❔</div>
                    <div class="carta-face carta-frente">${renderizarCartaConteudo(dadosCarta.simbolo)}</div>
                </div>
            `;

            carta.addEventListener('click', () => virarCarta(carta));
            gridCartas.appendChild(carta);
        });
    }

    function iniciarNivel(numeroNivel) {
        const nivel = NIVEIS[numeroNivel - 1];
        nivelAtual = numeroNivel;

        cartasViradas = [];
        bloqueado = false;
        paresEncontrados = 0;
        totalPares = nivel.pares;
        tentativas = 0;
        tempoDecorrido = 0;

        const baralho = criarBaralho(nivel);
        renderizarCartas(baralho, nivel.colunas);

        atualizarPlacar();
        iniciarTemporizador();
    }

    function iniciarJogo() {
        telaMenu.classList.add('escondido');
        telaJogo.classList.remove('escondido');
        pontuacaoAtual = 0;
        iniciarNivel(nivelEscolhidoMenu);
    }


    // ======================================================
    // 8. MECÂNICA DAS CARTAS
    // ======================================================

    function virarCarta(carta) {
        if (bloqueado) return;
        if (carta.classList.contains('virada') || carta.classList.contains('correta')) return;
        if (cartasViradas.length === 2) return;

        carta.classList.add('virada');
        tocarSom('virar');
        cartasViradas.push(carta);

        if (cartasViradas.length === 2) {
            tentativas += 1;
            atualizarPlacar();
            verificarPar();
        }
    }

    function verificarPar() {
        bloqueado = true;
        const [primeira, segunda] = cartasViradas;
        const saoIguais = primeira.dataset.parId === segunda.dataset.parId;

        if (saoIguais) {
            setTimeout(() => {
                primeira.classList.add('correta');
                segunda.classList.add('correta');
                tocarSom('par');

                paresEncontrados += 1;
                pontuacaoAtual += 50 * nivelAtual;
                atualizarPlacar();

                cartasViradas = [];
                bloqueado = false;

                if (paresEncontrados === totalPares) {
                    terminarNivel();
                }
            }, 350);
        } else {
            primeira.classList.add('erro');
            segunda.classList.add('erro');
            tocarSom('erro');

            setTimeout(() => {
                primeira.classList.remove('virada', 'erro');
                segunda.classList.remove('virada', 'erro');
                cartasViradas = [];
                bloqueado = false;
            }, 900);
        }
    }


    // ======================================================
    // 9. TEMPORIZADOR E PLACAR
    // ======================================================

    function iniciarTemporizador() {
        pararTemporizador();
        temporizadorId = setInterval(() => {
            tempoDecorrido += 1;
            valorTempo.textContent = formatarTempo(tempoDecorrido);
        }, 1000);
    }

    function pararTemporizador() {
        clearInterval(temporizadorId);
    }

    function formatarTempo(segundosTotais) {
        const minutos = Math.floor(segundosTotais / 60).toString().padStart(2, '0');
        const segundos = (segundosTotais % 60).toString().padStart(2, '0');
        return `${minutos}:${segundos}`;
    }

    function atualizarPlacar() {
        valorTentativas.textContent = tentativas;
        valorTempo.textContent = formatarTempo(tempoDecorrido);
        valorPontuacao.textContent = pontuacaoAtual;
        valorNivel.textContent = nivelAtual;
    }


    // ======================================================
    // 10. FIM DE NÍVEL E PONTUAÇÃO
    // ======================================================

    function calcularBonusNivel(nivel, tentativasFeitas, tempoGasto, pares) {
        // Eu premio quem usa menos tentativas e menos tempo.
        const bonusTentativas = Math.max(0, (pares * 3) - tentativasFeitas) * 20;
        const bonusTempo = Math.max(0, 300 - tempoGasto) * nivel;
        return bonusTentativas + bonusTempo;
    }

    function terminarNivel() {
        pararTemporizador();
        tocarSom('nivel');

        const bonus = calcularBonusNivel(nivelAtual, tentativas, tempoDecorrido, totalPares);
        pontuacaoAtual += bonus;
        atualizarPlacar();

        // Eu desbloqueio o próximo nível, se existir.
        if (nivelAtual < NIVEIS.length) {
            dados.nivelDesbloqueado = Math.max(dados.nivelDesbloqueado, nivelAtual + 1);
        }

        // Eu atualizo os recordes guardados.
        dados.totalJogos += 1;
        if (pontuacaoAtual > dados.melhorPontuacao) {
            dados.melhorPontuacao = pontuacaoAtual;
        }
        if (dados.melhorTempo === null || tempoDecorrido < dados.melhorTempo) {
            dados.melhorTempo = tempoDecorrido;
        }

        // Eu guardo um histórico simples, limitado às últimas 10 partidas.
        dados.historico.unshift({
            nivel: nivelAtual,
            pontuacao: pontuacaoAtual,
            tentativas: tentativas,
            tempo: tempoDecorrido,
            data: new Date().toISOString()
        });
        dados.historico = dados.historico.slice(0, 10);

        guardarDados();
        mostrarModalVitoria(bonus);
    }

    function mostrarModalVitoria(bonus) {
        const ehUltimoNivel = nivelAtual === NIVEIS.length;

        vitoriaTitulo.textContent = ehUltimoNivel ? 'Memory Master Complete!' : 'Level Concluído!';
        vitoriaSubtitulo.textContent = ehUltimoNivel
            ? 'You completed the highest difficulty level.'
            : 'Great job, keep it up.';

        vitoriaPontos.textContent = `+${bonus}`;
        vitoriaTentativas.textContent = tentativas;
        vitoriaTempo.textContent = formatarTempo(tempoDecorrido);

        btnProximoNivel.classList.toggle('escondido', ehUltimoNivel);

        modalVitoria.classList.remove('escondido');
    }


    // ======================================================
    // 11. NAVEGAÇÃO ENTRE ECRÃS
    // ======================================================

    function voltarAoMenu() {
        pararTemporizador();
        modalVitoria.classList.add('escondido');
        telaJogo.classList.add('escondido');
        telaMenu.classList.remove('escondido');

        nivelEscolhidoMenu = Math.min(dados.nivelDesbloqueado, NIVEIS.length);
        gerarGrelhaNiveis();
        atualizarPainelEstatisticas();
    }

    function avancarProximoNivel() {
        modalVitoria.classList.add('escondido');
        if (nivelAtual < NIVEIS.length) {
            iniciarNivel(nivelAtual + 1);
        }
    }


    // ======================================================
    // 12. EVENTOS GERAIS
    // ======================================================

    btnComecar.addEventListener('click', iniciarJogo);
    btnVoltarMenu.addEventListener('click', voltarAoMenu);
    btnReiniciar.addEventListener('click', () => iniciarNivel(nivelAtual));

    btnProximoNivel.addEventListener('click', avancarProximoNivel);
    btnVitoriaMenu.addEventListener('click', voltarAoMenu);

    btnSomMenu.addEventListener('click', alternarSom);
    btnSomJogo.addEventListener('click', alternarSom);


    // ======================================================
    // 13. INICIALIZAÇÃO DA APLICAÇÃO
    // ======================================================

    function inicializarApp() {
        nivelEscolhidoMenu = Math.min(dados.nivelDesbloqueado, NIVEIS.length);
        configurarSelecaoTemas();
        gerarGrelhaNiveis();
        atualizarPainelEstatisticas();
    }

    inicializarApp();
});
