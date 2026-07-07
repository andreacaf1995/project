/*
Eu controlo aqui toda a lógica do 2048 Challenge:
tabuleiro 4x4, movimentos, combinações, níveis com objetivo,
pontuação, pausa, tema, sons, partículas e estatísticas.
*/

document.addEventListener('DOMContentLoaded', () => {

    // ======================================================
    // 1. CONFIGURAÇÃO DE NÍVEIS
    // ======================================================

    // Eu defino aqui os 6 níveis: cada um tem um objetivo de peça a alcançar.
    // O nível 6 é o modo infinito, por isso o objetivo fica a null.
    const NIVEIS = [
        { numero: 1, objetivo: 128 },
        { numero: 2, objetivo: 256 },
        { numero: 3, objetivo: 512 },
        { numero: 4, objetivo: 1024 },
        { numero: 5, objetivo: 2048 },
        { numero: 6, objetivo: null }
    ];

    const GAP_TABULEIRO = 10;
    const CHAVE_STORAGE = 'jogo2048ChallengeDados';


    // ======================================================
    // 2. ESTADO DO JOGO
    // ======================================================

    let nivelEscolhidoMenu = 1;
    let nivelAtual = NIVEIS[0];

    let grelha = [];           // matriz 4x4 com o id da peça ou null
    let pecas = {};            // dicionário id -> { valor, linha, coluna, mesclada }
    let elementosPecas = {};   // dicionário id -> elemento DOM
    let proximoId = 1;

    let pontuacaoAtual = 0;
    let movimentos = 0;
    let tempoDecorrido = 0;
    let temporizadorId = null;

    let jogoAtivo = false;
    let pausado = false;
    let venceuNivelAtual = false;

    let somAtivado = true;
    let temaClaro = false;
    let contextoAudio = null;

    let dados = carregarDados();


    // ======================================================
    // 3. REFERÊNCIAS DO DOM
    // ======================================================

    const telaMenu = document.getElementById('tela-menu');
    const telaHistorico = document.getElementById('tela-historico');
    const telaJogo = document.getElementById('tela-jogo');

    const grelhaNiveis = document.getElementById('grelha-niveis');
    const btnComecar = document.getElementById('btn-comecar');
    const btnVerHistorico = document.getElementById('btn-ver-historico');
    const btnFecharHistorico = document.getElementById('btn-fechar-historico');

    const btnVoltarMenu = document.getElementById('btn-voltar-menu');
    const btnNovoJogo = document.getElementById('btn-novo-jogo');
    const btnPausa = document.getElementById('btn-pausa');
    const btnContinuarPausa = document.getElementById('btn-continuar-pausa');

    const valorPontuacao = document.getElementById('valor-pontuacao');
    const valorMelhorPontuacao = document.getElementById('valor-melhor-pontuacao');
    const valorMovimentos = document.getElementById('valor-movimentos');
    const valorNivel = document.getElementById('valor-nivel');

    const textoObjetivo = document.getElementById('texto-objetivo');
    const barraObjetivoPreenchimento = document.getElementById('barra-objetivo-preenchimento');

    const tabuleiroFundo = document.getElementById('tabuleiro-fundo');
    const camadaPecas = document.getElementById('camada-pecas');
    const overlayPausa = document.getElementById('overlay-pausa');

    const modalVitoria = document.getElementById('modal-vitoria');
    const vitoriaTitulo = document.getElementById('vitoria-titulo');
    const vitoriaPontos = document.getElementById('vitoria-pontos');
    const vitoriaMovimentos = document.getElementById('vitoria-movimentos');
    const vitoriaTempo = document.getElementById('vitoria-tempo');
    const btnContinuarJogo = document.getElementById('btn-continuar-jogo');
    const btnProximoNivel2048 = document.getElementById('btn-proximo-nivel-2048');
    const btnVitoriaMenu = document.getElementById('btn-vitoria-menu');

    const modalFimJogo = document.getElementById('modal-fim-jogo');
    const fimPontos = document.getElementById('fim-pontos');
    const fimMaiorPeca = document.getElementById('fim-maior-peca');
    const fimTempo = document.getElementById('fim-tempo');
    const btnTentarNovamente = document.getElementById('btn-tentar-novamente');
    const btnFimMenu = document.getElementById('btn-fim-menu');

    const btnSomMenu = document.getElementById('btn-som-menu');
    const iconSomMenu = document.getElementById('icon-som-menu');
    const btnSomJogo = document.getElementById('btn-som-jogo');
    const iconSomJogo = document.getElementById('icon-som-jogo');
    const btnTemaMenu = document.getElementById('btn-tema-menu');
    const iconTemaMenu = document.getElementById('icon-tema-menu');
    const btnTemaJogo = document.getElementById('btn-tema-jogo');
    const iconTemaJogo = document.getElementById('icon-tema-jogo');

    const statMelhorPontuacao = document.getElementById('stat-melhor-pontuacao');
    const statMaiorPeca = document.getElementById('stat-maior-peca');
    const statVitorias = document.getElementById('stat-vitorias');
    const statPartidas = document.getElementById('stat-partidas');

    const camadaParticulas = document.getElementById('camada-particulas');


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
        return {
            melhorPontuacao: 0,
            maiorPeca: 0,
            numeroPartidas: 0,
            vitorias: 0,
            tempoTotalJogado: 0,
            maiorNivel: 1,
            temaClaro: false,
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
        ganho.gain.setValueAtTime(0.16, ctx.currentTime);
        ganho.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duracao);
        osc.start();
        osc.stop(ctx.currentTime + duracao);
    }

    function tocarSom(tipo) {
        if (!somAtivado) return;

        if (tipo === 'mover') tocarTom(220, 0.05, 'sine');
        else if (tipo === 'combinar') tocarTom(520, 0.13, 'triangle');
        else if (tipo === 'vitoria') tocarArpejo([523.25, 659.25, 783.99, 1046.5]);
    }

    function tocarArpejo(notas) {
        const ctx = obterContextoAudio();
        notas.forEach((freq, indice) => {
            const osc = ctx.createOscillator();
            const ganho = ctx.createGain();
            osc.connect(ganho);
            ganho.connect(ctx.destination);
            osc.type = 'sine';
            osc.frequency.value = freq;
            const inicio = ctx.currentTime + indice * 0.12;
            ganho.gain.setValueAtTime(0.001, inicio);
            ganho.gain.linearRampToValueAtTime(0.2, inicio + 0.02);
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

    function alternarTema() {
        temaClaro = !temaClaro;
        document.body.classList.toggle('tema-claro', temaClaro);
        const icone = temaClaro ? '☀️' : '🌙';
        iconTemaMenu.textContent = icone;
        iconTemaJogo.textContent = icone;
        dados.temaClaro = temaClaro;
        guardarDados();
    }


    // ======================================================
    // 6. MENU INICIAL E HISTÓRICO
    // ======================================================

    function gerarGrelhaNiveis() {
        grelhaNiveis.innerHTML = '';
        NIVEIS.forEach((nivel) => {
            const desbloqueado = nivel.numero <= dados.maiorNivel;

            const botao = document.createElement('button');
            botao.className = 'nivel-card';
            botao.disabled = !desbloqueado;
            if (nivel.numero === nivelEscolhidoMenu) botao.classList.add('active');

            botao.innerHTML = `
                <span class="nivel-numero">${desbloqueado ? nivel.numero : '🔒'}</span>
                <span class="nivel-info">${nivel.objetivo ? 'Goal ' + nivel.objetivo : 'Infinite'}</span>
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

    function atualizarPainelEstatisticasMenu() {
        statMelhorPontuacao.textContent = dados.melhorPontuacao;
        statMaiorPeca.textContent = dados.maiorPeca;
        statVitorias.textContent = dados.vitorias;
        statPartidas.textContent = dados.numeroPartidas;
    }

    function abrirHistorico() {
        const lista = document.getElementById('lista-historico');
        lista.innerHTML = '';

        if (dados.historico.length === 0) {
            lista.innerHTML = '<p class="historico-detalhe">You have no saved games yet.</p>';
        } else {
            dados.historico.forEach((item) => {
                const linha = document.createElement('div');
                linha.className = 'historico-item';
                linha.innerHTML = `
                    <span class="historico-resultado">Level ${item.nivel} · ${item.pontuacao} pts</span>
                    <span class="historico-detalhe">Highest tile: ${item.maiorPeca}</span>
                `;
                lista.appendChild(linha);
            });
        }

        telaMenu.classList.add('escondido');
        telaHistorico.classList.remove('escondido');
    }

    function fecharHistorico() {
        telaHistorico.classList.add('escondido');
        telaMenu.classList.remove('escondido');
    }


    // ======================================================
    // 7. TABULEIRO — CONSTRUÇÃO E DIMENSIONAMENTO
    // ======================================================

    function construirFundoTabuleiro() {
        tabuleiroFundo.innerHTML = '';
        for (let i = 0; i < 16; i++) {
            const celula = document.createElement('div');
            celula.className = 'celula-fundo';
            tabuleiroFundo.appendChild(celula);
        }
    }

    function obterTamanhoCelula() {
        const larguraTabuleiro = tabuleiroFundo.clientWidth;
        const tamanho = (larguraTabuleiro - GAP_TABULEIRO * 3) / 4;
        return tamanho;
    }


    // ======================================================
    // 8. ARRANQUE DE NÍVEL
    // ======================================================

    function iniciarNivel(numeroNivel) {
        nivelAtual = NIVEIS[numeroNivel - 1];
        valorNivel.textContent = nivelAtual.numero;

        grelha = Array(4).fill().map(() => Array(4).fill(null));
        pecas = {};
        camadaPecas.innerHTML = '';
        elementosPecas = {};
        proximoId = 1;

        pontuacaoAtual = 0;
        movimentos = 0;
        tempoDecorrido = 0;
        jogoAtivo = true;
        pausado = false;
        venceuNivelAtual = false;

        adicionarNovaPeca();
        adicionarNovaPeca();

        atualizarObjetivo();
        atualizarHud();
        renderizarPecas();
        iniciarTemporizador();
    }

    function iniciarJogo() {
        telaMenu.classList.add('escondido');
        telaJogo.classList.remove('escondido');
        construirFundoTabuleiro();

        // Eu espero um instante para garantir que o tabuleiro já tem largura definida.
        requestAnimationFrame(() => iniciarNivel(nivelEscolhidoMenu));
    }

    function atualizarObjetivo() {
        if (nivelAtual.objetivo) {
            textoObjetivo.textContent = `Goal: reach ${nivelAtual.objetivo}`;
        } else {
            textoObjetivo.textContent = 'Infinite Mode: get the highest score you can';
        }
    }

    function atualizarHud() {
        valorPontuacao.textContent = pontuacaoAtual;
        valorMelhorPontuacao.textContent = Math.max(dados.melhorPontuacao, pontuacaoAtual);
        valorMovimentos.textContent = movimentos;

        const maiorPecaAtual = obterMaiorPeca();

        if (nivelAtual.objetivo) {
            const progresso = Math.min(1, Math.log2(Math.max(2, maiorPecaAtual)) / Math.log2(nivelAtual.objetivo));
            barraObjetivoPreenchimento.style.width = `${progresso * 100}%`;
        } else {
            barraObjetivoPreenchimento.style.width = '100%';
        }
    }

    function obterMaiorPeca() {
        return Object.values(pecas).reduce((maior, peca) => Math.max(maior, peca.valor), 0);
    }


    // ======================================================
    // 9. CRIAÇÃO DE PEÇAS NOVAS
    // ======================================================

    function adicionarNovaPeca() {
        const celulasVazias = [];
        for (let linha = 0; linha < 4; linha++) {
            for (let coluna = 0; coluna < 4; coluna++) {
                if (grelha[linha][coluna] === null) celulasVazias.push({ linha, coluna });
            }
        }

        if (celulasVazias.length === 0) return;

        const posicao = celulasVazias[Math.floor(Math.random() * celulasVazias.length)];
        const id = proximoId++;
        const valor = Math.random() < 0.9 ? 2 : 4;

        pecas[id] = { valor, linha: posicao.linha, coluna: posicao.coluna, mesclada: false, nova: true };
        grelha[posicao.linha][posicao.coluna] = id;
    }


    // ======================================================
    // 10. MOVIMENTAÇÃO E COMBINAÇÃO DE PEÇAS
    // ======================================================

    function obterPosicoesLinha(direcao, indice) {
        if (direcao === 'esquerda') return [0, 1, 2, 3].map((c) => ({ linha: indice, coluna: c }));
        if (direcao === 'direita') return [3, 2, 1, 0].map((c) => ({ linha: indice, coluna: c }));
        if (direcao === 'cima') return [0, 1, 2, 3].map((r) => ({ linha: r, coluna: indice }));
        return [3, 2, 1, 0].map((r) => ({ linha: r, coluna: indice })); // baixo
    }

    function colapsarLinha(idsOrdenados, idsParaRemover, fusoes) {
        const idsValidos = idsOrdenados.filter((id) => id !== null);
        const novaOrdem = [];
        let pontosGanhos = 0;
        let i = 0;

        while (i < idsValidos.length) {
            const idAtual = idsValidos[i];
            const idProximo = idsValidos[i + 1];

            if (idProximo !== undefined && pecas[idAtual].valor === pecas[idProximo].valor) {
                pecas[idAtual].valor *= 2;
                pecas[idAtual].mesclada = true;
                pontosGanhos += pecas[idAtual].valor;
                idsParaRemover.push(idProximo);
                // Eu registo o par para animar a peça absorvida até à célula da que sobrevive.
                fusoes.push({ alvoId: idAtual, removidoId: idProximo });
                novaOrdem.push(idAtual);
                i += 2;
            } else {
                novaOrdem.push(idAtual);
                i += 1;
            }
        }

        while (novaOrdem.length < 4) novaOrdem.push(null);
        return { novaOrdem, pontosGanhos };
    }

    // Eu guardo aqui as peças absorvidas que ainda estão a animar,
    // para as limpar de imediato se o jogador mover muito depressa.
    let remocoesPendentes = [];

    function limparRemocoesPendentes() {
        remocoesPendentes.forEach((id) => {
            if (elementosPecas[id]) {
                elementosPecas[id].remove();
                delete elementosPecas[id];
            }
            delete pecas[id];
        });
        remocoesPendentes = [];
    }

    function mover(direcao) {
        if (!jogoAtivo || pausado) return;

        // Se ainda houver peças da fusão anterior no ecrã, removo-as já.
        limparRemocoesPendentes();

        const idsParaRemover = [];
        const fusoes = [];
        let pontosRonda = 0;
        let houveMudanca = false;

        for (let indice = 0; indice < 4; indice++) {
            const posicoes = obterPosicoesLinha(direcao, indice);
            const idsOrdenados = posicoes.map((p) => grelha[p.linha][p.coluna]);
            const { novaOrdem, pontosGanhos } = colapsarLinha(idsOrdenados, idsParaRemover, fusoes);
            pontosRonda += pontosGanhos;

            novaOrdem.forEach((id, idx) => {
                const pos = posicoes[idx];
                grelha[pos.linha][pos.coluna] = id;
                if (id !== null) {
                    if (pecas[id].linha !== pos.linha || pecas[id].coluna !== pos.coluna) houveMudanca = true;
                    pecas[id].linha = pos.linha;
                    pecas[id].coluna = pos.coluna;
                    pecas[id].nova = false;
                }
            });
        }

        if (idsParaRemover.length > 0) houveMudanca = true;

        if (!houveMudanca) return;

        // FIX DO BUG DE FUSÃO: antes, a peça absorvida era apagada do DOM
        // imediatamente, antes da animação — parecia desaparecer do nada.
        // Agora, posiciono-a na célula da peça que a absorve para as duas
        // deslizarem juntas, e só a removo depois da transição (150ms).
        fusoes.forEach(({ alvoId, removidoId }) => {
            if (pecas[removidoId] && pecas[alvoId]) {
                pecas[removidoId].linha = pecas[alvoId].linha;
                pecas[removidoId].coluna = pecas[alvoId].coluna;
                if (elementosPecas[removidoId]) {
                    elementosPecas[removidoId].classList.add('a-fundir');
                }
            }
        });

        remocoesPendentes = idsParaRemover.slice();
        setTimeout(() => {
            limparRemocoesPendentes();
        }, 150);

        pontuacaoAtual += pontosRonda;
        movimentos += 1;

        adicionarNovaPeca();
        renderizarPecas();
        atualizarHud();
        tocarSom(pontosRonda > 0 ? 'combinar' : 'mover');

        verificarObjetivoNivel();
        verificarFimDeJogo();
    }


    // ======================================================
    // 11. RENDERIZAÇÃO DAS PEÇAS
    // ======================================================

    function renderizarPecas() {
        const tamanhoCelula = obterTamanhoCelula();

        Object.keys(elementosPecas).forEach((id) => {
            if (!pecas[id]) {
                elementosPecas[id].remove();
                delete elementosPecas[id];
            }
        });

        Object.keys(pecas).forEach((id) => {
            const peca = pecas[id];
            const left = peca.coluna * (tamanhoCelula + GAP_TABULEIRO);
            const top = peca.linha * (tamanhoCelula + GAP_TABULEIRO);

            let elemento = elementosPecas[id];

            if (!elemento) {
                elemento = document.createElement('div');
                elemento.className = 'peca';
                elemento.style.width = `${tamanhoCelula}px`;
                elemento.style.height = `${tamanhoCelula}px`;
                elemento.style.left = `${left}px`;
                elemento.style.top = `${top}px`;
                camadaPecas.appendChild(elemento);
                elementosPecas[id] = elemento;
                requestAnimationFrame(() => elemento.classList.add('aparecer'));
            } else {
                elemento.style.left = `${left}px`;
                elemento.style.top = `${top}px`;
                elemento.style.width = `${tamanhoCelula}px`;
                elemento.style.height = `${tamanhoCelula}px`;
            }

            elemento.textContent = peca.valor;
            elemento.dataset.valor = peca.valor;

            if (peca.mesclada) {
                elemento.classList.remove('mesclar');
                void elemento.offsetWidth; // Eu forço o reflow para a animação repetir.
                elemento.classList.add('mesclar');
                peca.mesclada = false;
            }
        });
    }

    window.addEventListener('resize', () => {
        if (jogoAtivo) renderizarPecas();
    });


    // ======================================================
    // 12. TEMPORIZADOR
    // ======================================================

    function iniciarTemporizador() {
        pararTemporizador();
        temporizadorId = setInterval(() => {
            if (!pausado) tempoDecorrido += 1;
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


    // ======================================================
    // 13. VERIFICAÇÃO DE OBJETIVO E FIM DE JOGO
    // ======================================================

    function verificarObjetivoNivel() {
        if (venceuNivelAtual || !nivelAtual.objetivo) return;

        if (obterMaiorPeca() >= nivelAtual.objetivo) {
            venceuNivelAtual = true;
            jogoAtivo = false;
            tocarSom('vitoria');

            if (nivelAtual.objetivo === 2048) lancarParticulas();

            dados.vitorias += 1;
            if (nivelAtual.numero < NIVEIS.length) {
                dados.maiorNivel = Math.max(dados.maiorNivel, nivelAtual.numero + 1);
            }
            registarFimDePartida();

            vitoriaTitulo.textContent = `You reached ${nivelAtual.objetivo}!`;
            vitoriaPontos.textContent = pontuacaoAtual;
            vitoriaMovimentos.textContent = movimentos;
            vitoriaTempo.textContent = formatarTempo(tempoDecorrido);
            btnProximoNivel2048.classList.toggle('escondido', nivelAtual.numero === NIVEIS.length);

            modalVitoria.classList.remove('escondido');
        }
    }

    function existeMovimentoPossivel() {
        for (let linha = 0; linha < 4; linha++) {
            for (let coluna = 0; coluna < 4; coluna++) {
                if (grelha[linha][coluna] === null) return true;

                const idAtual = grelha[linha][coluna];
                const valorAtual = pecas[idAtual].valor;

                const idDireita = coluna < 3 ? grelha[linha][coluna + 1] : null;
                const idBaixo = linha < 3 ? grelha[linha + 1][coluna] : null;

                if (idDireita !== null && pecas[idDireita].valor === valorAtual) return true;
                if (idBaixo !== null && pecas[idBaixo].valor === valorAtual) return true;
            }
        }
        return false;
    }

    function verificarFimDeJogo() {
        if (existeMovimentoPossivel()) return;

        jogoAtivo = false;
        pararTemporizador();
        registarFimDePartida();

        fimPontos.textContent = pontuacaoAtual;
        fimMaiorPeca.textContent = obterMaiorPeca();
        fimTempo.textContent = formatarTempo(tempoDecorrido);

        modalFimJogo.classList.remove('escondido');
    }

    function registarFimDePartida() {
        dados.numeroPartidas += 1;
        dados.tempoTotalJogado += tempoDecorrido;

        if (pontuacaoAtual > dados.melhorPontuacao) dados.melhorPontuacao = pontuacaoAtual;

        const maiorPecaAtual = obterMaiorPeca();
        if (maiorPecaAtual > dados.maiorPeca) dados.maiorPeca = maiorPecaAtual;

        dados.historico.unshift({
            nivel: nivelAtual.numero,
            pontuacao: pontuacaoAtual,
            maiorPeca: maiorPecaAtual,
            data: new Date().toISOString()
        });
        dados.historico = dados.historico.slice(0, 10);

        guardarDados();
    }


    // ======================================================
    // 14. PARTÍCULAS (efeito especial ao chegar ao 2048)
    // ======================================================

    function lancarParticulas() {
        const cores = ['#ffd23d', '#a445fe', '#ba70ff', '#00ff66', '#ff6b6b'];
        const centroX = window.innerWidth / 2;
        const centroY = window.innerHeight / 2;

        for (let i = 0; i < 40; i++) {
            const particula = document.createElement('div');
            particula.className = 'particula';
            particula.style.left = `${centroX}px`;
            particula.style.top = `${centroY}px`;
            particula.style.backgroundColor = cores[Math.floor(Math.random() * cores.length)];

            const angulo = Math.random() * Math.PI * 2;
            const distancia = 100 + Math.random() * 150;
            const destinoX = Math.cos(angulo) * distancia;
            const destinoY = Math.sin(angulo) * distancia;
            particula.style.setProperty('--destino-particula', `translate(${destinoX}px, ${destinoY}px)`);

            camadaParticulas.appendChild(particula);
            setTimeout(() => particula.remove(), 1200);
        }
    }


    // ======================================================
    // 15. CONTROLOS: TECLADO E GESTOS
    // ======================================================

    document.addEventListener('keydown', (evento) => {
        if (!jogoAtivo || pausado) return;

        const teclasDirecao = {
            ArrowLeft: 'esquerda',
            ArrowRight: 'direita',
            ArrowUp: 'cima',
            ArrowDown: 'baixo'
        };

        if (teclasDirecao[evento.key]) {
            evento.preventDefault();
            mover(teclasDirecao[evento.key]);
        }
    });

    let toqueInicioX = 0;
    let toqueInicioY = 0;

    document.getElementById('tabuleiro').addEventListener('touchstart', (evento) => {
        toqueInicioX = evento.touches[0].clientX;
        toqueInicioY = evento.touches[0].clientY;
    }, { passive: true });

    document.getElementById('tabuleiro').addEventListener('touchend', (evento) => {
        const deltaX = evento.changedTouches[0].clientX - toqueInicioX;
        const deltaY = evento.changedTouches[0].clientY - toqueInicioY;
        const LIMIAR = 30;

        if (Math.max(Math.abs(deltaX), Math.abs(deltaY)) < LIMIAR) return;

        if (Math.abs(deltaX) > Math.abs(deltaY)) {
            mover(deltaX > 0 ? 'direita' : 'esquerda');
        } else {
            mover(deltaY > 0 ? 'baixo' : 'cima');
        }
    }, { passive: true });


    // ======================================================
    // 16. PAUSA
    // ======================================================

    function alternarPausa() {
        if (!jogoAtivo) return;
        pausado = !pausado;
        overlayPausa.classList.toggle('escondido', !pausado);
    }

    btnPausa.addEventListener('click', alternarPausa);
    btnContinuarPausa.addEventListener('click', alternarPausa);


    // ======================================================
    // 17. NAVEGAÇÃO ENTRE ECRÃS
    // ======================================================

    function voltarAoMenu() {
        jogoAtivo = false;
        pararTemporizador();
        modalVitoria.classList.add('escondido');
        modalFimJogo.classList.add('escondido');
        telaJogo.classList.add('escondido');
        telaMenu.classList.remove('escondido');

        nivelEscolhidoMenu = Math.min(dados.maiorNivel, NIVEIS.length);
        gerarGrelhaNiveis();
        atualizarPainelEstatisticasMenu();
    }

    function continuarAJogar() {
        modalVitoria.classList.add('escondido');
        jogoAtivo = true;
        iniciarTemporizador();
    }

    function avancarProximoNivel() {
        modalVitoria.classList.add('escondido');
        if (nivelAtual.numero < NIVEIS.length) {
            iniciarNivel(nivelAtual.numero + 1);
        }
    }

    function tentarNovamente() {
        modalFimJogo.classList.add('escondido');
        iniciarNivel(nivelAtual.numero);
    }


    // ======================================================
    // 18. EVENTOS GERAIS
    // ======================================================

    btnComecar.addEventListener('click', iniciarJogo);
    btnVerHistorico.addEventListener('click', abrirHistorico);
    btnFecharHistorico.addEventListener('click', fecharHistorico);

    btnVoltarMenu.addEventListener('click', voltarAoMenu);
    btnNovoJogo.addEventListener('click', () => iniciarNivel(nivelAtual.numero));

    btnContinuarJogo.addEventListener('click', continuarAJogar);
    btnProximoNivel2048.addEventListener('click', avancarProximoNivel);
    btnVitoriaMenu.addEventListener('click', voltarAoMenu);

    btnTentarNovamente.addEventListener('click', tentarNovamente);
    btnFimMenu.addEventListener('click', voltarAoMenu);

    btnSomMenu.addEventListener('click', alternarSom);
    btnSomJogo.addEventListener('click', alternarSom);
    btnTemaMenu.addEventListener('click', alternarTema);
    btnTemaJogo.addEventListener('click', alternarTema);


    // ======================================================
    // 19. INICIALIZAÇÃO DA APLICAÇÃO
    // ======================================================

    function inicializarApp() {
        if (dados.temaClaro) {
            temaClaro = true;
            document.body.classList.add('tema-claro');
            iconTemaMenu.textContent = '☀️';
            iconTemaJogo.textContent = '☀️';
        }

        nivelEscolhidoMenu = Math.min(dados.maiorNivel, NIVEIS.length);
        gerarGrelhaNiveis();
        atualizarPainelEstatisticasMenu();
    }

    inicializarApp();
});
