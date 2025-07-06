// --- SEÇÃO GLOBAL: Variáveis e Funções de Áudio ---
// Colocamos aqui o que precisa ser acessível pelo HTML (onclick)
let listaDeVozes = [];
const synth = window.speechSynthesis;

// Função para carregar as vozes do navegador. Essencial para compatibilidade móvel.
function carregarVozes() {
    listaDeVozes = synth.getVoices();
}
carregarVozes();
if (synth.onvoiceschanged !== undefined) {
    synth.onvoiceschanged = carregarVozes;
}

// Função para REPRODUZIR o áudio de uma mensagem
function reproduzAudio(botao) {
    paraAudio(); // Garante que qualquer áudio anterior pare.

    const mensagemDiv = botao.closest('.mensagem');
    const conteudo = mensagemDiv.querySelector('.conteudo-mensagem').textContent;

    if (synth.speaking) {
        console.error('O sintetizador já está falando.');
        return;
    }
    if (conteudo) {
        const utterance = new SpeechSynthesisUtterance(conteudo);

        utterance.onerror = function(event) {
            console.error('Erro na síntese de voz:', event.error);
            alert('Ocorreu um erro ao tentar reproduzir o áudio. Seu navegador pode não ser compatível.');
        };

        // Procura por uma voz em português do Brasil para maior confiabilidade
        const vozBrasileira = listaDeVozes.find(voz => voz.lang === 'pt-BR');
        if (vozBrasileira) {
            utterance.voice = vozBrasileira;
        }

        synth.speak(utterance);
    }
}

// Função para PARAR qualquer áudio em reprodução
function paraAudio() {
    if (synth.speaking) {
        synth.cancel();
    }
}
// --- FIM DA SEÇÃO GLOBAL ---


// --- LÓGICA PRINCIPAL DA APLICAÇÃO ---
// Este código só roda depois que o HTML estiver completamente carregado
document.addEventListener('DOMContentLoaded', () => {
    // Mapeamento dos elementos do HTML
    const apiKeyInput = document.getElementById('api-key');
    const salvarChaveBtn = document.getElementById('salvar-chave');
    const promptUsuarioInput = document.getElementById('prompt-usuario');
    const enviarBtn = document.getElementById('enviar-btn');
    const chatContainer = document.getElementById('chat-container');
    const modeloSelect = document.getElementById('modelo-select');
    const resumirBtn = document.getElementById('resumir-btn');
    const salvarConversaBtn = document.getElementById('salvar-conversa-btn');
    const carregarConversaInput = document.getElementById('carregar-conversa-input');
    const nomeArquivoSalvoSpan = document.getElementById('nome-arquivo-salvo');
    const guiaInicialBtn = document.getElementById('guia-inicial-btn');
    const incluirDataHoraCheckbox = document.getElementById('incluir-data-hora-checkbox');

    let apiKey = '';
    let conversa = [];

    // Função para adicionar uma nova mensagem na tela
    function adicionarMensagem(remetente, texto) {
        const mensagemDiv = document.createElement('div');
        mensagemDiv.classList.add('mensagem', `${remetente}-mensagem`);

        const conteudoFormatado = texto.replace(/\n/g, '<br>');

        let botoesHtml = '';
        if (remetente === 'gemini') {
            botoesHtml = `<button class="botao-reproduzir" onclick="reproduzAudio(this)" title="Reproduzir Áudio">▶️</button>`;
        }

        mensagemDiv.innerHTML = `
            <div class="remetente">${remetente === 'usuario' ? 'Você' : 'WebGemini'}</div>
            <div class="conteudo-mensagem">${conteudoFormatado}</div>
            <div class="botoes-mensagem">${botoesHtml}</div>
        `;
        chatContainer.appendChild(mensagemDiv);
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }

    // Função para carregar a chave de API do armazenamento local
    function carregarChave() {
        const chaveSalva = localStorage.getItem('geminiApiKey');
        if (chaveSalva) {
            apiKeyInput.value = chaveSalva;
            apiKey = chaveSalva;
            apiKeyInput.style.backgroundColor = '#d4edda';
        }
    }

    // Função para salvar a chave de API
    function salvarChave() {
        apiKey = apiKeyInput.value.trim();
        if (apiKey) {
            localStorage.setItem('geminiApiKey', apiKey);
            apiKeyInput.style.backgroundColor = '#d4edda';
            alert('Chave de API salva no armazenamento local do navegador.');
        } else {
            localStorage.removeItem('geminiApiKey');
            apiKeyInput.style.backgroundColor = '#f8d7da';
            alert('Chave de API removida.');
        }
    }
    
    // Função principal para enviar a mensagem para a API do Gemini
    async function enviarMensagem() {
        const prompt = promptUsuarioInput.value.trim();
        if (!prompt) return;

        if (!apiKey) {
            alert('Por favor, insira e salve sua chave de API do Google AI Studio.');
            return;
        }

        adicionarMensagem('usuario', prompt);
        conversa.push({ role: 'user', parts: [{ text: prompt }] });
        promptUsuarioInput.value = '';
        adicionarMensagem('gemini', '...'); // Indicador de carregamento

        try {
            const modelo = modeloSelect.value;
            let systemPrompt = { role: 'system', parts: [{ text: 'Você é um assistente prestativo.' }] };

            try {
                const response = await fetch('system_prompt.json');
                if (response.ok) {
                    const systemPromptJson = await response.json();
                    if (systemPromptJson.parts && systemPromptJson.parts.length > 0) {
                        systemPrompt = systemPromptJson;
                    }
                }
            } catch (error) {
                console.warn('Não foi possível carregar o system_prompt.json. Usando prompt padrão.');
            }
            
            let dataHoraInfo = '';
            if (incluirDataHoraCheckbox.checked) {
                const agora = new Date();
                dataHoraInfo = `(Data e hora atual para sua referência: ${agora.toLocaleString('pt-BR')}) `;
            }

            // Clona o histórico para não modificar o original com a data/hora
            const historicoParaEnvio = JSON.parse(JSON.stringify(conversa));
            // Adiciona a data/hora apenas na última mensagem do usuário a ser enviada
            const ultimaMensagemUsuario = historicoParaEnvio[historicoParaEnvio.length - 1];
            if (ultimaMensagemUsuario.role === 'user') {
                ultimaMensagemUsuario.parts[0].text = dataHoraInfo + ultimaMensagemUsuario.parts[0].text;
            }

            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [systemPrompt, ...historicoParaEnvio],
                    generationConfig: {
                        temperature: 1,
                        topP: 0.95,
                        topK: 64,
                        maxOutputTokens: 8192,
                    }
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`Erro ${response.status}: ${errorData.error.message}`);
            }

            const data = await response.json();
            const respostaGemini = data.candidates[0].content.parts[0].text;
            
            chatContainer.removeChild(chatContainer.lastChild); // Remove "..."
            adicionarMensagem('gemini', respostaGemini);
            conversa.push({ role: 'model', parts: [{ text: respostaGemini }] });

        } catch (error) {
            console.error(error);
            chatContainer.removeChild(chatContainer.lastChild); // Remove "..."
            adicionarMensagem('gemini', `Ocorreu um erro: ${error.message}`);
        }
    }
    
    // Função para resumir a conversa
    async function resumirConversa() {
        if (conversa.length < 2) {
            alert("Não há histórico suficiente para resumir.");
            return;
        }

        const confirmacao = confirm("Isso substituirá o histórico atual por um resumo. A conversa original será perdida. Deseja continuar?");
        if (!confirmacao) return;

        adicionarMensagem('gemini', 'Resumindo a conversa, por favor aguarde...');

        const promptResumo = "Por favor, resuma toda a nossa conversa até este ponto em um único parágrafo conciso. O resumo deve capturar os pontos principais, as perguntas feitas e as conclusões alcançadas, para que possamos continuar a conversa a partir dele sem perder o contexto essencial. Seja objetivo e direto.";
        
        try {
            const historicoCompleto = JSON.parse(JSON.stringify(conversa));
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modeloSelect.value}:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [...historicoCompleto, { role: 'user', parts: [{ text: promptResumo }] }]
                })
            });

            if (!response.ok) throw new Error('Falha ao gerar o resumo.');

            const data = await response.json();
            const resumo = data.candidates[0].content.parts[0].text;

            chatContainer.innerHTML = '';
            conversa = [{ role: 'model', parts: [{ text: `Resumo da conversa anterior: ${resumo}` }] }];
            
            adicionarMensagem('gemini', `Resumo da conversa anterior: ${resumo}`);
            alert("Conversa resumida com sucesso!");

        } catch (error) {
            console.error("Erro ao resumir:", error);
            adicionarMensagem('gemini', 'Erro ao tentar resumir a conversa.');
        }
    }

    // Função para salvar a conversa em um arquivo .json
    function salvarConversa() {
        if (conversa.length === 0) {
            alert('Não há conversa para salvar.');
            return;
        }
        const blob = new Blob([JSON.stringify(conversa, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const data = new Date().toISOString().slice(0, 10);
        a.download = `conversa-webgemini-${data}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // Função para carregar uma conversa de um arquivo .json
    function carregarConversa() {
        const arquivo = carregarConversaInput.files[0];
        if (!arquivo) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const historicoCarregado = JSON.parse(event.target.result);
                if (Array.isArray(historicoCarregado)) {
                    conversa = historicoCarregado;
                    chatContainer.innerHTML = '';
                    historicoCarregado.forEach(msg => {
                        const remetente = msg.role === 'user' ? 'usuario' : 'gemini';
                        adicionarMensagem(remetente, msg.parts[0].text);
                    });
                    nomeArquivoSalvoSpan.textContent = `(${arquivo.name})`;
                    alert('Conversa carregada com sucesso!');
                } else {
                    throw new Error('Formato de arquivo inválido.');
                }
            } catch (error) {
                alert(`Erro ao carregar o arquivo: ${error.message}`);
            }
        };
        reader.readAsText(arquivo);
    }
    
    // Função para carregar a mensagem de boas-vindas
    async function carregarGuiaInicial() {
        try {
            const response = await fetch('mensagem_boas_vindas.txt');
            if (!response.ok) {
                throw new Error('Não foi possível carregar o guia inicial.');
            }
            const textoGuia = await response.text();
            chatContainer.innerHTML = '';
            conversa = [];
            adicionarMensagem('gemini', textoGuia);
        } catch (error) {
            console.error(error);
            adicionarMensagem('gemini', 'Bem-vindo! Você pode começar digitando sua pergunta abaixo.');
        }
    }

    // Registro de todos os Event Listeners da aplicação
    salvarChaveBtn.addEventListener('click', salvarChave);
    enviarBtn.addEventListener('click', enviarMensagem);
    promptUsuarioInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            enviarMensagem();
        }
    });
    resumirBtn.addEventListener('click', resumirConversa);
    salvarConversaBtn.addEventListener('click', salvarConversa);
    carregarConversaInput.addEventListener('change', carregarConversa);
    guiaInicialBtn.addEventListener('click', carregarGuiaInicial);

    // Funções de inicialização da página
    carregarChave();
    carregarGuiaInicial();
});
