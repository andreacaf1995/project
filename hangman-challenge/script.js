/*
Eu controlo aqui toda a lógica do Hangman Challenge:
seleção de categoria/nível, palavra escondida, teclado virtual e físico,
desenho da forca, pontuação, estatísticas e sons.
*/

document.addEventListener('DOMContentLoaded', () => {

    // ======================================================
    // 1. DADOS DO JOGO (categorias, palavras e níveis)
    // ======================================================

    // Eu guardo as palavras sem acentos para simplificar a comparação
    // de letras digitadas no teclado físico.
    const CATEGORIAS = {
        animais: {
            nome: 'Animals',
            palavras: ['LION', 'ELEPHANT', 'GIRAFFE', 'PANDA', 'TIGER', 'DOLPHIN']
        },
        paises: {
            nome: 'Countries',
            palavras: ['PORTUGAL', 'BRAZIL', 'JAPAN', 'FRANCE', 'GERMANY', 'CANADA']
        },
        tecnologia: {
            nome: 'Technology',
            palavras: ['HTML', 'CSS', 'JAVASCRIPT', 'PHP', 'PYTHON', 'REACT']
        },
        programacao: {
            nome: 'Programming',
            palavras: ['VARIABLE', 'FUNCTION', 'ARRAY', 'OBJECT', 'LOOP', 'ALGORITHM']
        }
    };

    // Eu defino aqui os 6 níveis pedidos, cada um com o seu número de tentativas.
    const NIVEIS = [
        { numero: 1, tentativas: 8, descricao: 'Easy' },
        { numero: 2, tentativas: 7, descricao: 'Medium' },
        { numero: 3, tentativas: 6, descricao: 'Palavras maiores' },
        { numero: 4, tentativas: 5, descricao: 'Hard' },
        { numero: 5, tentativas: 4, descricao: 'Technical' },
        { numero: 6, tentativas: 3, descricao: 'Maximum challenge' }
    ];

    const MAX_PARTES_FORCA = 6;
    const CHAVE_STORAGE = 'hangmanChallengeDados';


    // ======================================================
    // 2. ESTADO DO JOGO
    // ======================================================

    let categoriaAtual = 'animais';
    let nivelEscolhidoMenu = 1;
    let nivelAtual = 1;

    let palavraAtual = '';
    let letrasReveladas = new Set();
    let letrasErradas = new Set();
    let tentativasRestantes = 8;
    let tentativasTotaisNivel = 8;

    let pontuacaoAtual = 0;
    let tempoDecorrido = 0;
    let temporizadorId = null;
    let jogoAtivo = false;

    let somAtivado = true;
    let contextoAudio = null;

    let dados = carregarDados();


    // ======================================================
    // 3. REFERÊNCIAS DO DOM
    // ======================================================

    const telaMenu = document.getElementById('tela-menu');
    const telaEstatisticas = document.getElementById('tela-estatisticas');
    const telaJogo = document.getElementById('tela-jogo');

    const grelhaCategorias = document.getElementById('grelha-categorias');
    const grelhaNiveis = document.getElementById('grelha-niveis');
    const btnComecar = document.getElementById('btn-comecar');

    const btnVerEstatisticas = document.getElementById('btn-ver-estatisticas');
    const btnFecharEstatisticas = document.getElementById('btn-fechar-estatisticas');

    const btnVoltarMenu = document.getElementById('btn-voltar-menu');
    const btnNovoJogo = document.getElementById('btn-novo-jogo');

    const valorCategoria = document.getElementById('valor-categoria');
    const valorPontuacao = document.getElementById('valor-pontuacao');
    const valorNivel = document.getElementById('valor-nivel');
    const valorTentativas = document.getElementById('valor-tentativas');
    const barraTentativasPreenchimento = document.getElementById('barra-tentativas-preenchimento');

    const palavraEscondidaEl = document.getElementById('palavra-escondida');
    const letrasUsadasEl = document.getElementById('letras-usadas');
    const tecladoVirtual = document.getElementById('teclado-virtual');

    const modalFim = document.getElementById('modal-fim');
    const fimIcon = document.getElementById('fim-icon');
    const fimTitulo = document.getElementById('fim-titulo');
    const fimSubtitulo = document.getElementById('fim-subtitulo');
    const fimPontos = document.getElementById('fim-pontos');
    const fimErros = document.getElementById('fim-erros');
    const fimTempo = document.getElementById('fim-tempo');
    const btnProximoNivelForca = document.getElementById('btn-proximo-nivel-forca');
    const btnJogarNovamente = document.getElementById('btn-jogar-novamente');
    const btnFimMenu = document.getElementById('btn-fim-menu');

    const btnSomMenu = document.getElementById('btn-som-menu');
    const iconSomMenu = document.getElementById('icon-som-menu');
    const btnSomJogo = document.getElementById('btn-som-jogo');
    const iconSomJogo = document.getElementById('icon-som-jogo');

    const statMelhorPontuacao = document.getElementById('stat-melhor-pontuacao');
    const statVitorias = document.getElementById('stat-vitorias');
    const statTaxaSucesso = document.getElementById('stat-taxa-sucesso');


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
            maiorNivel: 1,
            vitorias: 0,
            derrotas: 0,
            palavrasDescobertas: 0,
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

        if (tipo === 'certa') {
            tocarTom(660, 0.15, 'triangle');
        } else if (tipo === 'errada') {
            tocarTom(150, 0.2, 'sawtooth');
        } else if (tipo === 'vitoria') {
            tocarArpejo([523.25, 659.25, 783.99, 1046.5]);
        } else if (tipo === 'derrota') {
            tocarArpejo([392, 329.63, 261.63]);
        }
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
    // 6. CONSTRUÇÃO DO MENU INICIAL
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
                <span class="nivel-info">${nivel.tentativas} tentativas</span>
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

    function configurarSelecaoCategorias() {
        const botoesCategoria = grelhaCategorias.querySelectorAll('.categoria-card');
        botoesCategoria.forEach((botao) => {
            botao.addEventListener('click', () => {
                categoriaAtual = botao.dataset.categoria;
                botoesCategoria.forEach((b) => b.classList.remove('active'));
                botao.classList.add('active');
            });
        });
    }

    function atualizarPainelEstatisticasMenu() {
        const totalJogos = dados.vitorias + dados.derrotas;
        const taxa = totalJogos > 0 ? Math.round((dados.vitorias / totalJogos) * 100) : 0;

        statMelhorPontuacao.textContent = dados.melhorPontuacao;
        statVitorias.textContent = dados.vitorias;
        statTaxaSucesso.textContent = `${taxa}%`;
    }


    // ======================================================
    // 7. PAINEL DE ESTATÍSTICAS COMPLETO
    // ======================================================

    function abrirEstatisticas() {
        const totalJogos = dados.vitorias + dados.derrotas;
        const taxa = totalJogos > 0 ? Math.round((dados.vitorias / totalJogos) * 100) : 0;

        document.getElementById('full-melhor-pontuacao').textContent = dados.melhorPontuacao;
        document.getElementById('full-maior-nivel').textContent = dados.maiorNivel;
        document.getElementById('full-vitorias').textContent = dados.vitorias;
        document.getElementById('full-derrotas').textContent = dados.derrotas;
        document.getElementById('full-taxa-sucesso').textContent = `${taxa}%`;
        document.getElementById('full-palavras-descobertas').textContent = dados.palavrasDescobertas;

        const listaHistorico = document.getElementById('lista-historico');
        listaHistorico.innerHTML = '';

        if (dados.historico.length === 0) {
            listaHistorico.innerHTML = '<p class="historico-detalhe">You have not played any rounds yet.</p>';
        } else {
            dados.historico.forEach((item) => {
                const linha = document.createElement('div');
                linha.className = `historico-item ${item.vitoria ? 'vitoria' : 'derrota'}`;
                linha.innerHTML = `
                    <span class="historico-resultado">${item.vitoria ? '✅' : '❌'} ${item.palavra}</span>
                    <span class="historico-detalhe">Level ${item.nivel} · ${item.pontos} pts</span>
                `;
                listaHistorico.appendChild(linha);
            });
        }

        telaMenu.classList.add('escondido');
        telaEstatisticas.classList.remove('escondido');
    }

    function fecharEstatisticas() {
        telaEstatisticas.classList.add('escondido');
        telaMenu.classList.remove('escondido');
    }


    // ======================================================
    // 8. PREPARAÇÃO E ARRANQUE DO JOGO
    // ======================================================

    function escolherPalavra(nivel) {
        // No nível 6, a palavra vem de qualquer categoria (modo aleatório).
        if (nivel.numero === 6) {
            const todasCategorias = Object.values(CATEGORIAS);
            const categoriaSorteada = todasCategorias[Math.floor(Math.random() * todasCategorias.length)];
            const palavras = categoriaSorteada.palavras;
            return palavras[Math.floor(Math.random() * palavras.length)];
        }

        const palavras = CATEGORIAS[categoriaAtual].palavras;
        return palavras[Math.floor(Math.random() * palavras.length)];
    }

    function gerarTecladoVirtual() {
        tecladoVirtual.innerHTML = '';
        const alfabeto = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

        alfabeto.split('').forEach((letra) => {
            const tecla = document.createElement('button');
            tecla.className = 'tecla';
            tecla.textContent = letra;
            tecla.dataset.letra = letra;
            tecla.addEventListener('click', () => escolherLetra(letra));
            tecladoVirtual.appendChild(tecla);
        });
    }

    function renderizarPalavraEscondida() {
        palavraEscondidaEl.innerHTML = '';
        palavraAtual.split('').forEach((letra) => {
            const slot = document.createElement('div');
            slot.className = 'letra-slot';
            if (letrasReveladas.has(letra)) {
                slot.textContent = letra;
                slot.classList.add('revelada');
            } else {
                slot.textContent = '';
            }
            palavraEscondidaEl.appendChild(slot);
        });
    }

    function atualizarForca() {
        // Eu calculo quantas partes mostrar proporcionalmente ao número
        // máximo de tentativas do nível, para a forca ficar sempre completa
        // exatamente quando as tentativas chegam a zero.
        const errosCometidos = tentativasTotaisNivel - tentativasRestantes;
        const partesAMostrar = Math.ceil((errosCometidos / tentativasTotaisNivel) * MAX_PARTES_FORCA);

        document.querySelectorAll('.parte-jogo').forEach((parte) => {
            const numeroParte = parseInt(parte.dataset.parte, 10);
            parte.classList.toggle('mostrar', numeroParte <= partesAMostrar);
        });

        valorTentativas.textContent = `${tentativasRestantes} ${tentativasRestantes === 1 ? 'attempt' : 'attempts'} left`;

        const percentagem = (tentativasRestantes / tentativasTotaisNivel) * 100;
        barraTentativasPreenchimento.style.width = `${percentagem}%`;
        barraTentativasPreenchimento.style.background = percentagem > 40
            ? 'linear-gradient(90deg, var(--cor-sucesso), #aaff00)'
            : 'linear-gradient(90deg, var(--cor-erro), #ff8a00)';
    }

    function iniciarNivel(numeroNivel) {
        const nivel = NIVEIS[numeroNivel - 1];
        nivelAtual = numeroNivel;

        palavraAtual = escolherPalavra(nivel);
        letrasReveladas = new Set();
        letrasErradas = new Set();
        tentativasTotaisNivel = nivel.tentativas;
        tentativasRestantes = nivel.tentativas;
        tempoDecorrido = 0;
        jogoAtivo = true;

        valorCategoria.textContent = nivel.numero === 6 ? 'Random' : CATEGORIAS[categoriaAtual].nome;
        valorNivel.textContent = nivelAtual;
        valorPontuacao.textContent = pontuacaoAtual;

        letrasUsadasEl.innerHTML = '';
        gerarTecladoVirtual();
        renderizarPalavraEscondida();
        atualizarForca();
        iniciarTemporizador();
    }

    function iniciarJogo() {
        telaMenu.classList.add('escondido');
        telaJogo.classList.remove('escondido');
        pontuacaoAtual = 0;
        iniciarNivel(nivelEscolhidoMenu);
    }


    // ======================================================
    // 9. MECÂNICA DE ESCOLHA DE LETRAS
    // ======================================================

    function escolherLetra(letra) {
        if (!jogoAtivo) return;
        if (letrasReveladas.has(letra) || letrasErradas.has(letra)) return;

        const tecla = tecladoVirtual.querySelector(`[data-letra="${letra}"]`);

        if (palavraAtual.includes(letra)) {
            letrasReveladas.add(letra);
            if (tecla) {
                tecla.classList.add('certa');
                tecla.disabled = true;
            }
            tocarSom('certa');

            // Eu somo pontos por cada ocorrência da letra na palavra.
            const ocorrencias = palavraAtual.split('').filter((l) => l === letra).length;
            pontuacaoAtual += 15 * nivelAtual * ocorrencias;
            valorPontuacao.textContent = pontuacaoAtual;

            adicionarLetraUsada(letra, true);
            renderizarPalavraEscondida();

            const palavraCompleta = palavraAtual.split('').every((l) => letrasReveladas.has(l));
            if (palavraCompleta) {
                terminarRonda(true);
            }
        } else {
            letrasErradas.add(letra);
            if (tecla) {
                tecla.classList.add('errada');
                tecla.disabled = true;
            }
            tocarSom('errada');

            tentativasRestantes -= 1;
            adicionarLetraUsada(letra, false);
            atualizarForca();

            if (tentativasRestantes <= 0) {
                terminarRonda(false);
            }
        }
    }

    function adicionarLetraUsada(letra, correta) {
        const chip = document.createElement('span');
        chip.className = `letra-usada-chip ${correta ? 'certa' : 'errada'}`;
        chip.textContent = letra;
        letrasUsadasEl.appendChild(chip);
    }

    // Eu também permito jogar com o teclado físico.
    document.addEventListener('keydown', (evento) => {
        if (!jogoAtivo) return;
        const letra = evento.key.toUpperCase();
        if (letra.length === 1 && letra >= 'A' && letra <= 'Z') {
            escolherLetra(letra);
        }
    });


    // ======================================================
    // 10. TEMPORIZADOR
    // ======================================================

    function iniciarTemporizador() {
        pararTemporizador();
        temporizadorId = setInterval(() => {
            tempoDecorrido += 1;
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
    // 11. FIM DE RONDA (vitória ou derrota)
    // ======================================================

    function terminarRonda(venceu) {
        jogoAtivo = false;
        pararTemporizador();

        let bonus = 0;

        if (venceu) {
            tocarSom('vitoria');

            // Bónus por tentativas sobrantes e por terminar rápido.
            bonus = (tentativasRestantes * 25 * nivelAtual) + Math.max(0, 120 - tempoDecorrido) * 2;
            pontuacaoAtual += bonus;

            dados.vitorias += 1;
            dados.palavrasDescobertas += 1;
            if (nivelAtual < NIVEIS.length) {
                dados.maiorNivel = Math.max(dados.maiorNivel, nivelAtual + 1);
            } else {
                dados.maiorNivel = Math.max(dados.maiorNivel, nivelAtual);
            }
        } else {
            tocarSom('derrota');
            dados.derrotas += 1;
        }

        if (pontuacaoAtual > dados.melhorPontuacao) {
            dados.melhorPontuacao = pontuacaoAtual;
        }

        dados.historico.unshift({
            palavra: palavraAtual,
            nivel: nivelAtual,
            pontos: pontuacaoAtual,
            vitoria: venceu,
            data: new Date().toISOString()
        });
        dados.historico = dados.historico.slice(0, 10);

        guardarDados();
        mostrarModalFim(venceu, bonus);
    }

    function mostrarModalFim(venceu, bonus) {
        const ehUltimoNivel = nivelAtual === NIVEIS.length;

        fimIcon.textContent = venceu ? '🏆' : '💀';
        fimTitulo.textContent = venceu
            ? (ehUltimoNivel ? 'Hangman Master!' : 'You Won!')
            : 'You lost this round.';
        fimSubtitulo.textContent = `The word was: ${palavraAtual}`;

        fimPontos.textContent = venceu ? `+${bonus}` : '+0';
        fimErros.textContent = letrasErradas.size;
        fimTempo.textContent = formatarTempo(tempoDecorrido);

        btnProximoNivelForca.classList.toggle('escondido', !venceu || ehUltimoNivel);

        modalFim.classList.remove('escondido');
    }


    // ======================================================
    // 12. NAVEGAÇÃO ENTRE ECRÃS
    // ======================================================

    function voltarAoMenu() {
        jogoAtivo = false;
        pararTemporizador();
        modalFim.classList.add('escondido');
        telaJogo.classList.add('escondido');
        telaMenu.classList.remove('escondido');

        nivelEscolhidoMenu = Math.min(dados.maiorNivel, NIVEIS.length);
        gerarGrelhaNiveis();
        atualizarPainelEstatisticasMenu();
    }

    function jogarNovamenteMesmoNivel() {
        modalFim.classList.add('escondido');
        iniciarNivel(nivelAtual);
    }

    function avancarProximoNivel() {
        modalFim.classList.add('escondido');
        if (nivelAtual < NIVEIS.length) {
            iniciarNivel(nivelAtual + 1);
        }
    }


    // ======================================================
    // 13. EVENTOS GERAIS
    // ======================================================

    btnComecar.addEventListener('click', iniciarJogo);
    btnVerEstatisticas.addEventListener('click', abrirEstatisticas);
    btnFecharEstatisticas.addEventListener('click', fecharEstatisticas);

    btnVoltarMenu.addEventListener('click', voltarAoMenu);
    btnNovoJogo.addEventListener('click', () => iniciarNivel(nivelAtual));

    btnProximoNivelForca.addEventListener('click', avancarProximoNivel);
    btnJogarNovamente.addEventListener('click', jogarNovamenteMesmoNivel);
    btnFimMenu.addEventListener('click', voltarAoMenu);

    btnSomMenu.addEventListener('click', alternarSom);
    btnSomJogo.addEventListener('click', alternarSom);


    // ======================================================
    // 14. INICIALIZAÇÃO DA APLICAÇÃO
    // ======================================================

    function inicializarApp() {
        nivelEscolhidoMenu = Math.min(dados.maiorNivel, NIVEIS.length);
        configurarSelecaoCategorias();
        gerarGrelhaNiveis();
        atualizarPainelEstatisticasMenu();
    }

    inicializarApp();
});
