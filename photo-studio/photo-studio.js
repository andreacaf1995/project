/*
Eu controlo aqui toda a lógica do Photo Studio:
carregamento de imagem, edição em tempo real via Canvas,
filtros, presets, transformações, comparação e exportação.
*/

document.addEventListener('DOMContentLoaded', () => {

    // ======================================================
    // 1. CONFIGURAÇÃO DE PRESETS
    // ======================================================

    // Eu defino aqui combinações prontas de ajustes para cada preset.
    const PRESETS = {
        instagram: { brilho: 110, contraste: 105, saturacao: 130, desfoque: 0, escalaCinza: 0, sepia: 15 },
        cinema: { brilho: 95, contraste: 120, saturacao: 80, desfoque: 0, escalaCinza: 0, sepia: 10 },
        'vintage-preset': { brilho: 105, contraste: 90, saturacao: 75, desfoque: 0, escalaCinza: 0, sepia: 35 },
        dark: { brilho: 80, contraste: 115, saturacao: 90, desfoque: 0, escalaCinza: 0, sepia: 0 }
    };

    const CHAVE_STORAGE = 'photoStudioDados';


    // ======================================================
    // 2. ESTADO DA APLICAÇÃO
    // ======================================================

    let imagemCarregada = null;
    let rotacaoAtual = 0;
    let espelhoHorizontal = false;
    let espelhoVertical = false;
    let zoomAtual = 100;
    let modoComparar = false;

    let ajustes = { brilho: 100, contraste: 100, saturacao: 100, desfoque: 0, escalaCinza: 0, sepia: 0 };

    let dados = carregarDados();


    // ======================================================
    // 3. REFERÊNCIAS DO DOM
    // ======================================================

    const zonaUpload = document.getElementById('zona-upload');
    const inputImagem = document.getElementById('input-imagem');
    const palcoCanvas = document.getElementById('palco-canvas');
    const wrapperCanvas = document.getElementById('wrapper-canvas');
    const canvasOriginal = document.getElementById('canvas-original');
    const canvasEditado = document.getElementById('canvas-editado');
    const sliderComparar = document.getElementById('slider-comparar');

    const sliderBrilho = document.getElementById('slider-brilho');
    const sliderContraste = document.getElementById('slider-contraste');
    const sliderSaturacao = document.getElementById('slider-saturacao');
    const sliderDesfoque = document.getElementById('slider-desfoque');

    const valorBrilho = document.getElementById('valor-brilho');
    const valorContraste = document.getElementById('valor-contraste');
    const valorSaturacao = document.getElementById('valor-saturacao');
    const valorDesfoque = document.getElementById('valor-desfoque');

    const botoesFiltro = document.querySelectorAll('.btn-filtro');
    const botoesPreset = document.querySelectorAll('.btn-preset');

    const btnRodar = document.getElementById('btn-rodar');
    const btnEspelharH = document.getElementById('btn-espelhar-h');
    const btnEspelharV = document.getElementById('btn-espelhar-v');

    const btnResetar = document.getElementById('btn-resetar');
    const btnComparar = document.getElementById('btn-comparar');
    const btnFullscreen = document.getElementById('btn-fullscreen');
    const btnGuardar = document.getElementById('btn-guardar');
    const btnExportarPng = document.getElementById('btn-exportar-png');
    const btnExportarJpg = document.getElementById('btn-exportar-jpg');

    const controloZoom = document.getElementById('controlo-zoom');
    const btnZoomMais = document.getElementById('btn-zoom-mais');
    const btnZoomMenos = document.getElementById('btn-zoom-menos');
    const valorZoom = document.getElementById('valor-zoom');


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
        // Eu só guardo as configurações usadas, não as imagens em si,
        // porque o localStorage não é adequado para ficheiros binários grandes.
        return { historicoConfiguracoes: [] };
    }

    function guardarConfiguracaoNoHistorico() {
        dados.historicoConfiguracoes.unshift({
            ajustes: { ...ajustes },
            rotacao: rotacaoAtual,
            data: new Date().toISOString()
        });
        dados.historicoConfiguracoes = dados.historicoConfiguracoes.slice(0, 5);
        localStorage.setItem(CHAVE_STORAGE, JSON.stringify(dados));
    }


    // ======================================================
    // 5. CARREGAMENTO DE IMAGEM (upload e drag & drop)
    // ======================================================

    function carregarArquivoImagem(arquivo) {
        if (!arquivo || !arquivo.type.startsWith('image/')) return;

        const leitor = new FileReader();
        leitor.onload = (evento) => {
            const imagem = new Image();
            imagem.onload = () => {
                imagemCarregada = imagem;
                resetarEdicaoCompleta();
                mostrarPalcoCanvas();
            };
            imagem.src = evento.target.result;
        };
        leitor.readAsDataURL(arquivo);
    }

    inputImagem.addEventListener('change', (evento) => {
        carregarArquivoImagem(evento.target.files[0]);
    });

    ['dragover', 'dragenter'].forEach((tipoEvento) => {
        zonaUpload.addEventListener(tipoEvento, (evento) => {
            evento.preventDefault();
            zonaUpload.classList.add('arrastando');
        });
    });

    ['dragleave', 'dragend'].forEach((tipoEvento) => {
        zonaUpload.addEventListener(tipoEvento, () => zonaUpload.classList.remove('arrastando'));
    });

    zonaUpload.addEventListener('drop', (evento) => {
        evento.preventDefault();
        zonaUpload.classList.remove('arrastando');
        carregarArquivoImagem(evento.dataTransfer.files[0]);
    });

    function mostrarPalcoCanvas() {
        zonaUpload.classList.add('escondido');
        palcoCanvas.classList.remove('escondido');
        controloZoom.classList.remove('escondido');

        [btnComparar, btnFullscreen, btnResetar, btnGuardar].forEach((btn) => { btn.disabled = false; });
    }


    // ======================================================
    // 6. CONSTRUÇÃO DO FILTRO CSS PARA O CANVAS
    // ======================================================

    function obterFiltroCss() {
        return `brightness(${ajustes.brilho}%) contrast(${ajustes.contraste}%) saturate(${ajustes.saturacao}%) blur(${ajustes.desfoque}px) grayscale(${ajustes.escalaCinza}%) sepia(${ajustes.sepia}%)`;
    }


    // ======================================================
    // 7. DESENHO NO CANVAS (com rotação e espelho)
    // ======================================================

    function desenharNoCanvas(canvas, aplicarFiltro) {
        if (!imagemCarregada) return;

        const rotacao90 = rotacaoAtual % 180 !== 0;
        canvas.width = rotacao90 ? imagemCarregada.height : imagemCarregada.width;
        canvas.height = rotacao90 ? imagemCarregada.width : imagemCarregada.height;

        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.save();

        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate((rotacaoAtual * Math.PI) / 180);
        ctx.scale(espelhoHorizontal ? -1 : 1, espelhoVertical ? -1 : 1);
        ctx.filter = aplicarFiltro ? obterFiltroCss() : 'none';

        ctx.drawImage(imagemCarregada, -imagemCarregada.width / 2, -imagemCarregada.height / 2);
        ctx.restore();
    }

    function redesenharTudo() {
        desenharNoCanvas(canvasOriginal, false);
        desenharNoCanvas(canvasEditado, true);

        if (modoComparar) aplicarClipComparacao();
    }


    // ======================================================
    // 8. AJUSTES (SLIDERS)
    // ======================================================

    function atualizarAjuste(chave, valor, elementoTexto, sufixo) {
        ajustes[chave] = valor;
        elementoTexto.textContent = `${valor}${sufixo}`;
        redesenharTudo();
        guardarConfiguracaoNoHistorico();
    }

    sliderBrilho.addEventListener('input', () => atualizarAjuste('brilho', parseInt(sliderBrilho.value, 10), valorBrilho, '%'));
    sliderContraste.addEventListener('input', () => atualizarAjuste('contraste', parseInt(sliderContraste.value, 10), valorContraste, '%'));
    sliderSaturacao.addEventListener('input', () => atualizarAjuste('saturacao', parseInt(sliderSaturacao.value, 10), valorSaturacao, '%'));
    sliderDesfoque.addEventListener('input', () => atualizarAjuste('desfoque', parseInt(sliderDesfoque.value, 10), valorDesfoque, 'px'));

    function sincronizarSlidersComAjustes() {
        sliderBrilho.value = ajustes.brilho; valorBrilho.textContent = `${ajustes.brilho}%`;
        sliderContraste.value = ajustes.contraste; valorContraste.textContent = `${ajustes.contraste}%`;
        sliderSaturacao.value = ajustes.saturacao; valorSaturacao.textContent = `${ajustes.saturacao}%`;
        sliderDesfoque.value = ajustes.desfoque; valorDesfoque.textContent = `${ajustes.desfoque}px`;
    }


    // ======================================================
    // 9. FILTROS RÁPIDOS
    // ======================================================

    botoesFiltro.forEach((botao) => {
        botao.addEventListener('click', () => {
            const filtro = botao.dataset.filtro;

            if (filtro === 'normal') {
                ajustes.escalaCinza = 0;
                ajustes.sepia = 0;
            } else if (filtro === 'preto-branco') {
                ajustes.escalaCinza = 100;
                ajustes.sepia = 0;
            } else if (filtro === 'sepia') {
                ajustes.escalaCinza = 0;
                ajustes.sepia = 70;
            } else if (filtro === 'vintage') {
                ajustes.sepia = 35;
                ajustes.contraste = 90;
                ajustes.brilho = 105;
                ajustes.saturacao = 75;
                ajustes.escalaCinza = 0;
            }

            botoesFiltro.forEach((b) => b.classList.remove('active'));
            botao.classList.add('active');
            botoesPreset.forEach((b) => b.classList.remove('active'));

            sincronizarSlidersComAjustes();
            redesenharTudo();
            guardarConfiguracaoNoHistorico();
        });
    });


    // ======================================================
    // 10. PRESETS
    // ======================================================

    botoesPreset.forEach((botao) => {
        botao.addEventListener('click', () => {
            const preset = PRESETS[botao.dataset.preset];
            if (!preset) return;

            ajustes = { ...preset };

            botoesPreset.forEach((b) => b.classList.remove('active'));
            botao.classList.add('active');
            botoesFiltro.forEach((b) => b.classList.remove('active'));

            sincronizarSlidersComAjustes();
            redesenharTudo();
            guardarConfiguracaoNoHistorico();
        });
    });


    // ======================================================
    // 11. TRANSFORMAÇÕES (rodar e espelhar)
    // ======================================================

    btnRodar.addEventListener('click', () => {
        rotacaoAtual = (rotacaoAtual + 90) % 360;
        redesenharTudo();
    });

    btnEspelharH.addEventListener('click', () => {
        espelhoHorizontal = !espelhoHorizontal;
        redesenharTudo();
    });

    btnEspelharV.addEventListener('click', () => {
        espelhoVertical = !espelhoVertical;
        redesenharTudo();
    });


    // ======================================================
    // 12. RESET COMPLETO
    // ======================================================

    function resetarEdicaoCompleta() {
        ajustes = { brilho: 100, contraste: 100, saturacao: 100, desfoque: 0, escalaCinza: 0, sepia: 0 };
        rotacaoAtual = 0;
        espelhoHorizontal = false;
        espelhoVertical = false;
        zoomAtual = 100;

        sincronizarSlidersComAjustes();
        wrapperCanvas.style.transform = 'scale(1)';
        valorZoom.textContent = '100%';

        botoesFiltro.forEach((b) => b.classList.remove('active'));
        botoesPreset.forEach((b) => b.classList.remove('active'));
        document.querySelector('[data-filtro="normal"]').classList.add('active');

        redesenharTudo();
    }

    btnResetar.addEventListener('click', resetarEdicaoCompleta);


    // ======================================================
    // 13. COMPARAÇÃO ANTES/DEPOIS
    // ======================================================

    function aplicarClipComparacao() {
        const valor = sliderComparar.value;
        canvasEditado.style.clipPath = `inset(0 0 0 ${valor}%)`;
    }

    btnComparar.addEventListener('click', () => {
        modoComparar = !modoComparar;
        btnComparar.classList.toggle('active', modoComparar);
        sliderComparar.classList.toggle('escondido', !modoComparar);
        canvasOriginal.style.display = modoComparar ? 'block' : 'none';

        if (modoComparar) {
            aplicarClipComparacao();
        } else {
            canvasEditado.style.clipPath = 'none';
        }
    });

    sliderComparar.addEventListener('input', aplicarClipComparacao);


    // ======================================================
    // 14. ZOOM E ECRÃ INTEIRO
    // ======================================================

    function aplicarZoom() {
        wrapperCanvas.style.transform = `scale(${zoomAtual / 100})`;
        valorZoom.textContent = `${zoomAtual}%`;
    }

    btnZoomMais.addEventListener('click', () => {
        zoomAtual = Math.min(200, zoomAtual + 10);
        aplicarZoom();
    });

    btnZoomMenos.addEventListener('click', () => {
        zoomAtual = Math.max(50, zoomAtual - 10);
        aplicarZoom();
    });

    btnFullscreen.addEventListener('click', () => {
        if (!document.fullscreenElement) {
            palcoCanvas.requestFullscreen().catch(() => {
                console.warn('Could not enable fullscreen in this browser.');
            });
        } else {
            document.exitFullscreen();
        }
    });


    // ======================================================
    // 15. EXPORTAÇÃO DA IMAGEM
    // ======================================================

    function exportarImagem(formato) {
        // Eu crio um canvas temporário para garantir fundo branco em JPG
        // (o formato JPG não suporta transparência).
        const canvasExportacao = document.createElement('canvas');
        canvasExportacao.width = canvasEditado.width;
        canvasExportacao.height = canvasEditado.height;
        const ctx = canvasExportacao.getContext('2d');

        if (formato === 'jpg') {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvasExportacao.width, canvasExportacao.height);
        }

        ctx.drawImage(canvasEditado, 0, 0);

        const tipoMime = formato === 'jpg' ? 'image/jpeg' : 'image/png';
        const extensao = formato === 'jpg' ? 'jpg' : 'png';
        const dataUrl = canvasExportacao.toDataURL(tipoMime, 0.92);

        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = `photo-studio-${Date.now()}.${extensao}`;
        link.click();

        guardarConfiguracaoNoHistorico();
    }

    btnExportarPng.addEventListener('click', () => exportarImagem('png'));
    btnExportarJpg.addEventListener('click', () => exportarImagem('jpg'));
    btnGuardar.addEventListener('click', () => exportarImagem('png'));


    // ======================================================
    // 16. INICIALIZAÇÃO DA APLICAÇÃO
    // ======================================================

    function inicializarApp() {
        document.querySelector('[data-filtro="normal"]').classList.add('active');
    }

    inicializarApp();
});
