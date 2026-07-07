/*
Eu controlo aqui toda a lógica do Blackjack Royale:
baralho de 52 cartas, distribuição, apostas, jogada do dealer,
pontuação, estatísticas, sons e confetes.
*/

document.addEventListener('DOMContentLoaded', () => {

    // ======================================================
    // 1. DADOS DO JOGO (baralho e níveis)
    // ======================================================

    const NAIPES = [
        { simbolo: '♥', cor: 'vermelha' },
        { simbolo: '♦', cor: 'vermelha' },
        { simbolo: '♣', cor: 'preta' },
        { simbolo: '♠', cor: 'preta' }
    ];

    const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

    // Eu defino aqui os 6 níveis da mesa: cada um ajusta o saldo inicial
    // e o limiar a partir do qual o dealer para de pedir cartas.
    const NIVEIS = [
        { numero: 1, nome: 'Classic Table', saldoInicial: 1000, limiarDealer: 17, descricao: 'Normal dealer' },
        { numero: 2, nome: 'Advanced Table', saldoInicial: 1000, limiarDealer: 18, descricao: 'Aggressive dealer' },
        { numero: 3, nome: 'High Stakes', saldoInicial: 500, limiarDealer: 17, descricao: 'Fewer chips' },
        { numero: 4, nome: 'Special Challenge', saldoInicial: 500, limiarDealer: 18, descricao: 'Aggressive + low balance' },
        { numero: 5, nome: 'Professional', saldoInicial: 300, limiarDealer: 18, descricao: 'Balance reduzido' },
        { numero: 6, nome: 'Championship', saldoInicial: 200, limiarDealer: 19, descricao: 'Maximum challenge' }
    ];

    const CHAVE_STORAGE = 'blackjackRoyaleDados';


    // ======================================================
    // 2. ESTADO DO JOGO
    // ======================================================

    let nivelEscolhidoMenu = 1;
    let nivelAtual = NIVEIS[0];

    let baralho = [];
    let maoJogador = [];
    let maoDealer = [];

    let saldo = 1000;
    let apostaAtual = 0;
    let sequenciaAtual = 0;
    let rondaEmAndamento = false;

    let somAtivado = true;
    let contextoAudio = null;

    let dados = carregarDados();


    // ======================================================
    // 3. REFERÊNCIAS DO DOM
    // ======================================================

    const telaMenu = document.getElementById('tela-menu');
    const telaJogo = document.getElementById('tela-jogo');
    const grelhaNiveis = document.getElementById('grelha-niveis');
    const btnComecar = document.getElementById('btn-comecar');

    const btnVoltarMenu = document.getElementById('btn-voltar-menu');
    const btnReiniciarJogo = document.getElementById('btn-reiniciar-jogo');

    const valorNivel = document.getElementById('valor-nivel');
    const valorSaldo = document.getElementById('valor-saldo');
    const valorSequencia = document.getElementById('valor-sequencia');

    const cartasDealerEl = document.getElementById('cartas-dealer');
    const cartasJogadorEl = document.getElementById('cartas-jogador');
    const pontuacaoDealerEl = document.getElementById('pontuacao-dealer');
    const pontuacaoJogadorEl = document.getElementById('pontuacao-jogador');
    const mensagemJogoEl = document.getElementById('mensagem-jogo');

    const painelAposta = document.getElementById('painel-aposta');
    const chips = document.querySelectorAll('.chip');
    const valorApostaAtualEl = document.getElementById('valor-aposta-atual');
    const btnLimparAposta = document.getElementById('btn-limpar-aposta');
    const btnConfirmarAposta = document.getElementById('btn-confirmar-aposta');

    const controlosRonda = document.getElementById('controlos-ronda');
    const btnHit = document.getElementById('btn-hit');
    const btnStand = document.getElementById('btn-stand');
    const btnNovaPartida = document.getElementById('btn-nova-partida');

    const btnSomMenu = document.getElementById('btn-som-menu');
    const iconSomMenu = document.getElementById('icon-som-menu');
    const btnSomJogo = document.getElementById('btn-som-jogo');
    const iconSomJogo = document.getElementById('icon-som-jogo');

    const statVitorias = document.getElementById('stat-vitorias');
    const statMelhorSaldo = document.getElementById('stat-melhor-saldo');
    const statMelhorSequencia = document.getElementById('stat-melhor-sequencia');
    const statBlackjacks = document.getElementById('stat-blackjacks');

    const camadaConfetes = document.getElementById('camada-confetes');


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
            melhorSaldo: 1000,
            vitorias: 0,
            derrotas: 0,
            blackjacks: 0,
            melhorSequencia: 0,
            jogosRealizados: 0
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
        ganho.gain.setValueAtTime(0.18, ctx.currentTime);
        ganho.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duracao);
        osc.start();
        osc.stop(ctx.currentTime + duracao);
    }

    function tocarSom(tipo) {
        if (!somAtivado) return;

        if (tipo === 'distribuir') tocarTom(420, 0.06, 'square');
        else if (tipo === 'clique') tocarTom(300, 0.05, 'sine');
        else if (tipo === 'vitoria') tocarArpejo([523.25, 659.25, 783.99, 1046.5]);
        else if (tipo === 'derrota') tocarArpejo([392, 329.63, 261.63]);
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
            const inicio = ctx.currentTime + indice * 0.13;
            ganho.gain.setValueAtTime(0.001, inicio);
            ganho.gain.linearRampToValueAtTime(0.22, inicio + 0.02);
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
    // 6. BARALHO E CARTAS
    // ======================================================

    function embaralhar(array) {
        const copia = [...array];
        for (let i = copia.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [copia[i], copia[j]] = [copia[j], copia[i]];
        }
        return copia;
    }

    function criarBaralho() {
        let novoBaralho = [];
        NAIPES.forEach((naipe) => {
            RANKS.forEach((rank) => {
                let valor;
                if (rank === 'A') valor = 11;
                else if (['J', 'Q', 'K'].includes(rank)) valor = 10;
                else valor = parseInt(rank, 10);

                novoBaralho.push({ rank, naipe: naipe.simbolo, cor: naipe.cor, valor });
            });
        });
        return embaralhar(novoBaralho);
    }

    function tirarCarta() {
        if (baralho.length === 0) {
            baralho = criarBaralho();
        }
        return baralho.pop();
    }

    function calcularPontuacao(mao) {
        let total = mao.reduce((soma, carta) => soma + carta.valor, 0);
        let asesRestantes = mao.filter((carta) => carta.rank === 'A').length;

        // Eu reduzo o valor do Ás de 11 para 1 sempre que o total ultrapassa 21.
        while (total > 21 && asesRestantes > 0) {
            total -= 10;
            asesRestantes -= 1;
        }
        return total;
    }


    // ======================================================
    // 7. RENDERIZAÇÃO DAS CARTAS
    // ======================================================

    function renderizarMao(container, mao, esconderPrimeira) {
        container.innerHTML = '';

        mao.forEach((carta, indice) => {
            const cartaEl = document.createElement('div');
            cartaEl.className = 'carta-jogo';
            cartaEl.style.animationDelay = `${indice * 0.12}s`;

            if (esconderPrimeira && indice === 0) {
                cartaEl.classList.add('virada-costas');
            } else {
                cartaEl.classList.add(carta.cor);
                cartaEl.innerHTML = `
                    <span class="canto topo">${carta.rank}<br>${carta.naipe}</span>
                    <span class="simbolo-central">${carta.naipe}</span>
                    <span class="canto fundo">${carta.rank}<br>${carta.naipe}</span>
                `;
            }
            container.appendChild(cartaEl);
        });
    }

    function atualizarMesa(esconderPrimeiraDealer) {
        renderizarMao(cartasJogadorEl, maoJogador, false);
        renderizarMao(cartasDealerEl, maoDealer, esconderPrimeiraDealer);

        pontuacaoJogadorEl.textContent = calcularPontuacao(maoJogador);
        // Eu só mostro a pontuação real do dealer depois de revelar a carta escondida.
        pontuacaoDealerEl.textContent = esconderPrimeiraDealer
            ? calcularPontuacao([maoDealer[1]])
            : calcularPontuacao(maoDealer);
    }


    // ======================================================
    // 8. MENU INICIAL
    // ======================================================

    function gerarGrelhaNiveis() {
        grelhaNiveis.innerHTML = '';
        NIVEIS.forEach((nivel) => {
            const botao = document.createElement('button');
            botao.className = 'nivel-card';
            if (nivel.numero === nivelEscolhidoMenu) botao.classList.add('active');

            botao.innerHTML = `
                <span class="nivel-numero">${nivel.numero}</span>
                <span class="nivel-info">${nivel.descricao}</span>
            `;

            botao.addEventListener('click', () => {
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
        statVitorias.textContent = dados.vitorias;
        statMelhorSaldo.textContent = dados.melhorSaldo;
        statMelhorSequencia.textContent = dados.melhorSequencia;
        statBlackjacks.textContent = dados.blackjacks;
    }


    // ======================================================
    // 9. ARRANQUE DA MESA E APOSTAS
    // ======================================================

    function sentarNaMesa() {
        nivelAtual = NIVEIS[nivelEscolhidoMenu - 1];
        saldo = nivelAtual.saldoInicial;
        sequenciaAtual = 0;

        telaMenu.classList.add('escondido');
        telaJogo.classList.remove('escondido');

        valorNivel.textContent = nivelAtual.numero;
        atualizarCabecalhoJogo();
        prepararNovaRonda();
    }

    function atualizarCabecalhoJogo() {
        valorSaldo.textContent = saldo;
        valorSequencia.textContent = sequenciaAtual;
    }

    function prepararNovaRonda() {
        maoJogador = [];
        maoDealer = [];
        apostaAtual = 0;
        rondaEmAndamento = false;

        cartasJogadorEl.innerHTML = '';
        cartasDealerEl.innerHTML = '';
        pontuacaoJogadorEl.textContent = '0';
        pontuacaoDealerEl.textContent = '0';

        mensagemJogoEl.textContent = saldo > 0
            ? 'Place your bet to start the round.'
            : 'Out of chips! Restart the game to continue.';
        mensagemJogoEl.className = 'mensagem-jogo';

        valorApostaAtualEl.textContent = '0';
        atualizarChipsDisponiveis();

        painelAposta.classList.remove('escondido');
        controlosRonda.classList.add('escondido');
        btnNovaPartida.classList.add('escondido');
        btnConfirmarAposta.disabled = true;
    }

    function atualizarChipsDisponiveis() {
        chips.forEach((chip) => {
            const valor = chip.dataset.valor;
            const valorNumerico = valor === 'all' ? saldo : parseInt(valor, 10);
            chip.disabled = saldo <= 0 || (valorNumerico > saldo && valor !== 'all');
        });
    }

    chips.forEach((chip) => {
        chip.addEventListener('click', () => {
            tocarSom('clique');
            const valor = chip.dataset.valor;

            if (valor === 'all') {
                apostaAtual = saldo;
            } else {
                apostaAtual = Math.min(saldo, apostaAtual + parseInt(valor, 10));
            }

            valorApostaAtualEl.textContent = apostaAtual;
            btnConfirmarAposta.disabled = apostaAtual <= 0;
        });
    });

    btnLimparAposta.addEventListener('click', () => {
        apostaAtual = 0;
        valorApostaAtualEl.textContent = '0';
        btnConfirmarAposta.disabled = true;
    });

    btnConfirmarAposta.addEventListener('click', () => {
        if (apostaAtual <= 0 || apostaAtual > saldo) return;

        saldo -= apostaAtual;
        atualizarCabecalhoJogo();

        painelAposta.classList.add('escondido');
        distribuirCartasIniciais();
    });


    // ======================================================
    // 10. DISTRIBUIÇÃO INICIAL E JOGADAS DO JOGADOR
    // ======================================================

    function distribuirCartasIniciais() {
        baralho = criarBaralho();
        maoJogador = [tirarCarta(), tirarCarta()];
        maoDealer = [tirarCarta(), tirarCarta()];
        rondaEmAndamento = true;

        tocarSom('distribuir');
        atualizarMesa(true);

        const blackjackJogador = calcularPontuacao(maoJogador) === 21;

        if (blackjackJogador) {
            // Eu termino a ronda de imediato quando o jogador sai logo com Blackjack.
            setTimeout(() => jogadaDealerAutomatica(), 500);
        } else {
            controlosRonda.classList.remove('escondido');
            btnHit.disabled = false;
            btnStand.disabled = false;
        }
    }

    btnHit.addEventListener('click', () => {
        if (!rondaEmAndamento) return;
        tocarSom('distribuir');

        maoJogador.push(tirarCarta());
        atualizarMesa(true);

        const pontuacao = calcularPontuacao(maoJogador);

        if (pontuacao > 21) {
            terminarRonda('derrota', 'Bust! You went over 21.');
        } else if (pontuacao === 21) {
            jogadaDealerAutomatica();
        }
    });

    btnStand.addEventListener('click', () => {
        if (!rondaEmAndamento) return;
        jogadaDealerAutomatica();
    });


    // ======================================================
    // 11. JOGADA AUTOMÁTICA DO DEALER
    // ======================================================

    function jogadaDealerAutomatica() {
        controlosRonda.classList.add('escondido');
        btnHit.disabled = true;
        btnStand.disabled = true;

        atualizarMesa(false);
        tocarSom('distribuir');

        const passoDealer = () => {
            const pontuacaoJogador = calcularPontuacao(maoJogador);
            const pontuacaoDealer = calcularPontuacao(maoDealer);

            // Eu só faço o dealer pedir cartas se o jogador ainda estiver na ronda.
            if (pontuacaoJogador <= 21 && pontuacaoDealer < nivelAtual.limiarDealer) {
                setTimeout(() => {
                    maoDealer.push(tirarCarta());
                    tocarSom('distribuir');
                    atualizarMesa(false);
                    passoDealer();
                }, 700);
            } else {
                setTimeout(() => resolverRonda(), 500);
            }
        };

        passoDealer();
    }


    // ======================================================
    // 12. RESOLUÇÃO DA RONDA
    // ======================================================

    function resolverRonda() {
        const pontuacaoJogador = calcularPontuacao(maoJogador);
        const pontuacaoDealer = calcularPontuacao(maoDealer);
        const blackjackJogador = pontuacaoJogador === 21 && maoJogador.length === 2;
        const blackjackDealer = pontuacaoDealer === 21 && maoDealer.length === 2;

        if (pontuacaoJogador > 21) {
            terminarRonda('derrota', 'Bust! You went over 21.');
        } else if (blackjackJogador && !blackjackDealer) {
            terminarRonda('vitoria', 'Blackjack! 🃏', true);
        } else if (pontuacaoDealer > 21) {
            terminarRonda('vitoria', 'The dealer busted! You win.');
        } else if (pontuacaoJogador > pontuacaoDealer) {
            terminarRonda('vitoria', 'Nice play! You won the round.');
        } else if (pontuacaoJogador === pontuacaoDealer) {
            terminarRonda('empate', 'Push! Your bet was returned.');
        } else {
            terminarRonda('derrota', 'The dealer won this round.');
        }
    }

    function terminarRonda(resultado, mensagem, foiBlackjack) {
        rondaEmAndamento = false;
        atualizarMesa(false);

        mensagemJogoEl.textContent = mensagem;
        mensagemJogoEl.className = `mensagem-jogo ${resultado}`;

        dados.jogosRealizados += 1;

        if (resultado === 'vitoria') {
            tocarSom('vitoria');
            lancarConfetes();

            const ganho = foiBlackjack ? Math.round(apostaAtual * 2.5) : apostaAtual * 2;
            saldo += ganho;

            sequenciaAtual += 1;
            dados.vitorias += 1;
            if (foiBlackjack) dados.blackjacks += 1;
        } else if (resultado === 'empate') {
            saldo += apostaAtual;
            sequenciaAtual = 0;
        } else {
            tocarSom('derrota');
            sequenciaAtual = 0;
            dados.derrotas += 1;
        }

        if (saldo > dados.melhorSaldo) dados.melhorSaldo = saldo;
        if (sequenciaAtual > dados.melhorSequencia) dados.melhorSequencia = sequenciaAtual;

        guardarDados();
        atualizarCabecalhoJogo();

        btnNovaPartida.classList.remove('escondido');
    }

    btnNovaPartida.addEventListener('click', prepararNovaRonda);


    // ======================================================
    // 13. CONFETES
    // ======================================================

    function lancarConfetes() {
        const cores = ['#a445fe', '#ba70ff', '#ffc94d', '#00ff66', '#ff3d57'];

        for (let i = 0; i < 36; i++) {
            const confete = document.createElement('div');
            confete.className = 'confete';
            confete.style.left = `${Math.random() * 100}vw`;
            confete.style.backgroundColor = cores[Math.floor(Math.random() * cores.length)];
            confete.style.animationDuration = `${2 + Math.random() * 1.5}s`;
            confete.style.animationDelay = `${Math.random() * 0.3}s`;
            camadaConfetes.appendChild(confete);

            setTimeout(() => confete.remove(), 4000);
        }
    }


    // ======================================================
    // 14. NAVEGAÇÃO E REINÍCIO
    // ======================================================

    function voltarAoMenu() {
        rondaEmAndamento = false;
        telaJogo.classList.add('escondido');
        telaMenu.classList.remove('escondido');
        gerarGrelhaNiveis();
        atualizarPainelEstatisticasMenu();
    }

    function reiniciarJogoAtual() {
        saldo = nivelAtual.saldoInicial;
        sequenciaAtual = 0;
        atualizarCabecalhoJogo();
        prepararNovaRonda();
    }

    btnVoltarMenu.addEventListener('click', voltarAoMenu);
    btnReiniciarJogo.addEventListener('click', reiniciarJogoAtual);
    btnComecar.addEventListener('click', sentarNaMesa);

    btnSomMenu.addEventListener('click', alternarSom);
    btnSomJogo.addEventListener('click', alternarSom);


    // ======================================================
    // 15. INICIALIZAÇÃO DA APLICAÇÃO
    // ======================================================

    function inicializarApp() {
        gerarGrelhaNiveis();
        atualizarPainelEstatisticasMenu();
    }

    inicializarApp();
});
