import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from 'https://esm.run/@google/generative-ai';

// --- Variáveis Globais e de Sessão ---
let messages = [];
let systemPrompt = null;
let requestCount = 0;
let totalTokensEntradaSessao = 0;
let totalTokensSaidaSessao = 0;

const safetySettings = [
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
];
const SYSTEM_PROMPT_FILE_PATH = "./system_prompt.json";
const getGeminiApiKey = () => localStorage.getItem("google_gemini_api_key");

async function loadSystemPrompt() {
    try {
        const response = await fetch(SYSTEM_PROMPT_FILE_PATH);
        if (response.ok) {
            const data = await response.json();
            let instrucaoFinal = "";
            if (data && data.instrucaoDeSistema) {
                instrucaoFinal = Array.isArray(data.instrucaoDeSistema) ? data.instrucaoDeSistema.join("\n").trim() : String(data.instrucaoDeSistema).trim();
            }
            if (instrucaoFinal) {
                systemPrompt = instrucaoFinal;
                document.getElementById("systemPromptInfo").textContent = `ℹ️ Instrução de sistema carregada: "${systemPrompt.substring(0, 70)}..."`;
            }
        }
    } catch (error) { /* falha silenciosa se não encontrar */ }
}

function inicializarMetricasSessao() {
    requestCount = 0;
    totalTokensEntradaSessao = 0;
    totalTokensSaidaSessao = 0;
    atualizarMetricasDisplay();
}

function atualizarMetricasDisplay() {
    document.getElementById('requestCountDisplay').textContent = requestCount;
    document.getElementById('tokenInputDisplay').textContent = totalTokensEntradaSessao;
    document.getElementById('tokenOutputDisplay').textContent = totalTokensSaidaSessao;
}

async function enviarPrompt() {
    const userPromptText = document.getElementById("userPrompt").value.trim();
    if (!userPromptText) {
        return;
    }
    
    const promptParaEnviar = userPromptText;
    const userMessage = { role: "user", content: promptParaEnviar, timestamp: new Date().toISOString() };
    messages.push(userMessage);
    
    atualizarChat({ ...userMessage, content: userPromptText });
    document.getElementById("userPrompt").value = "";

    console.log("PROMPT FINAL SENDO ENVIADO:", promptParaEnviar);
    await enviarParaAPI();
}

async function enviarParaAPI() {
    const apiKey = getGeminiApiKey();
    if (!apiKey || apiKey === "FAKE") {
        return mostrarCampoChave();
    }
    
    document.getElementById("status").textContent = "Enviando...";
    requestCount++;

    const ultimoPromptCompleto = messages.at(-1).content;
    const historico = messages.slice(0, -1).map(msg => ({
        role: msg.role === 'assistant' ? 'model' : msg.role,
        parts: [{ text: msg.content }]
    }));

    if (systemPrompt) {
        historico.unshift(
            { role: "user", parts: [{ text: systemPrompt }] },
            { role: "model", parts: [{ text: "Entendido." }] }
        );
    }
    
    let promptFinal = ultimoPromptCompleto;
    if (document.getElementById("incluirData").checked) {
        const agora = new Date().toLocaleString('pt-BR', { dateStyle: 'full', timeStyle: 'long' });
        promptFinal = `[Data e Hora Atuais: ${agora}]\n\n${ultimoPromptCompleto}`;
    }

    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const modeloSelecionado = document.getElementById("modelo").value;
        const model = genAI.getGenerativeModel({ model: modeloSelecionado, safetySettings });
        const chat = model.startChat({ history: historico });
        const result = await chat.sendMessage(promptFinal);
        const response = await result.response;
        const respostaTexto = response.text();
        
        if (response.usageMetadata) {
            totalTokensEntradaSessao += response.usageMetadata.promptTokenCount;
            totalTokensSaidaSessao += response.usageMetadata.candidatesTokenCount;
        }

        const assistantMessage = { role: "model", content: respostaTexto, timestamp: new Date().toISOString() };
        messages.push(assistantMessage);
        atualizarChat(assistantMessage);
        
        document.getElementById("status").textContent = "Pronto.";
        atualizarMetricasDisplay();

    } catch (error) {
        console.error("Erro API Gemini:", error);
        document.getElementById("status").textContent = `❌ Erro: ${error.message}`;
        if (messages.at(-1)?.role === "user") {
            messages.pop(); 
        }
        atualizarChat({ role: 'assistant', content: `[Erro: ${error.message}]`, timestamp: new Date().toISOString() });
        atualizarMetricasDisplay();
    }
}

function atualizarChat(message) {
    const chatDiv = document.getElementById("chat");
    const div = document.createElement("div");
    const origem = message.role === "model" ? "assistant" : message.role;
    div.className = `mensagem ${origem}`;

    // Para saber o "endereço" da mensagem, pegamos seu índice no array.
    // Como ela acabou de ser adicionada, é sempre a última.
    const indiceDaMensagem = messages.length - 1;

    let timestampHtml = message.timestamp ? `<span class="timestamp">${new Date(message.timestamp).toLocaleString('pt-BR')}</span>` : '';
    
    // Agrupamos os botões de ação da mensagem
    let botoesDeAcaoHtml = `<div class="botoes-mensagem">`;
    if (origem === 'assistant') {
        botoesDeAcaoHtml += `<button class="play-button" onclick="reproduzirAudio(this)" title="Ouvir resposta">🔊</button>`;
    }
    // Adicionamos o botão de remover para TODAS as mensagens
    botoesDeAcaoHtml += `<button class="play-button" onclick="removerMensagem(${indiceDaMensagem})" title="Remover mensagem">🗑️</button>`;
    botoesDeAcaoHtml += `</div>`;


    const conteudoHtml = `<div class="conteudo-mensagem">${marked.parse(`**${origem === "user" ? "Você" : "IA"}:** ${message.content}`)}</div>`;
    
    // A ordem do HTML agora é: timestamp, conteúdo, e por último a div de botões
    div.innerHTML = timestampHtml + conteudoHtml + botoesDeAcaoHtml;
    
    chatDiv.appendChild(div);
    chatDiv.scrollTop = chatDiv.scrollHeight;
}
function limparConversa() {
    if (confirm("Deseja realmente limpar a conversa?")) {
        pararAudio(); // Para o áudio antes de limpar
        messages = [];
        document.getElementById("chat").innerHTML = "";
        document.getElementById("status").textContent = "Conversa limpa.";
        document.getElementById("infoArquivoCarregado").textContent = "";
    }
}

// --- NOVAS FUNÇÕES DE ÁUDIO ---
function reproduzirAudio(buttonElement) {
    window.speechSynthesis.cancel(); // Para qualquer áudio anterior

    const mensagemDiv = buttonElement.closest('.mensagem');
    // Agora pegamos o texto do nosso container '.conteudo-mensagem'
    const elementoConteudo = mensagemDiv.querySelector('.conteudo-mensagem');
    const textoCompleto = elementoConteudo ? elementoConteudo.innerText : '';

    if (textoCompleto) {
        // Remove o prefixo "IA:" do início do texto para não ser falado
        const textoParaFalar = textoCompleto.replace(/^IA:\s*/, '').trim();

        const utterance = new SpeechSynthesisUtterance(textoParaFalar);
        utterance.lang = 'pt-BR';
        window.speechSynthesis.speak(utterance);
    }
}

function pararAudio() {
    window.speechSynthesis.cancel();
}

// --- FUNÇÕES DE GERENCIAMENTO DE CONVERSA ---
async function resumirConversa() {
    if (messages.length < 2) return;
    if (!confirm("Isso irá resumir a conversa atual. Continuar?")) return;
    pararAudio();
    const status = document.getElementById("status");
    status.textContent = "Resumindo...";
    const historicoCompleto = messages.map(msg => `${msg.role === 'user' ? 'Usuário' : 'IA'}: ${msg.content}`).join('\n---\n');
    const promptDeResumo = `Analise o diálogo a seguir e crie um resumo conciso e estruturado em Markdown:\n\n---\n${historicoCompleto}`;
    const apiKey = getGeminiApiKey();
    if (!apiKey || apiKey === "FAKE") return mostrarCampoChave();
    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const result = await model.generateContent({ contents: [{ role: 'user', parts: [{ text: promptDeResumo }] }], safetySettings: safetySettings });
        const resumoTexto = (await result.response).text();
        const timestamp = new Date().toISOString();
        messages = [{ role: 'user', content: '(Conversa resumida)', timestamp }, { role: 'model', content: resumoTexto, timestamp }];
        document.getElementById("chat").innerHTML = "";
        messages.forEach(atualizarChat);
        status.textContent = "✅ Conversa resumida!";
    } catch (error) { status.textContent = `❌ Erro ao resumir: ${error.message}`; }
}

function salvarConversa() {
    const dataToSave = { messages, systemPrompt };
    const blob = new Blob([JSON.stringify(dataToSave, null, 2)], { type: "application/json" });
    let nomeInput = document.getElementById("nomeArquivoSalvar").value.trim() || `conversa-${new Date().toISOString().slice(0,10)}`;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${nomeInput}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    document.getElementById("status").textContent = `💾 Salvo como ${a.download}`;
    document.getElementById("infoArquivoCarregado").textContent = `(Salvo: ${a.download})`;
}

document.getElementById("carregarJson").addEventListener("change", function () {
    const file = this.files[0];
    if (!file) return;
    pararAudio();
    document.getElementById("infoArquivoCarregado").textContent = `(Carregado: ${file.name})`;
    const reader = new FileReader();
    reader.onload = function (e) {
        try {
            const carregado = JSON.parse(e.target.result);
            messages = carregado.messages || [];
            systemPrompt = carregado.systemPrompt || null;
            document.getElementById("chat").innerHTML = "";
            messages.forEach(atualizarChat);
            document.getElementById("status").textContent = "✅ Conversa carregada com sucesso.";
        } catch (err) { alert("Erro ao ler arquivo JSON: " + err.message); }
        this.value = "";
    };
    reader.readAsText(file);
});

async function iniciarTutorial() {
    if (messages.length > 0 && !confirm("Isso irá limpar a conversa atual e mostrar uma mensagem de boas-vindas com instruções. Deseja continuar?")) {
        return;
    }
    limparConversa();
    const status = document.getElementById("status");
    status.textContent = "Carregando instruções...";
    try {
        const response = await fetch('./mensagem_boas_vindas.txt');
        if (!response.ok) throw new Error(`Arquivo de boas-vindas não encontrado.`);
        const textoBoasVindas = await response.text();
        const mensagem = { 
            role: 'model',
            content: textoBoasVindas,
            timestamp: new Date().toISOString()
        };
        atualizarChat(mensagem); 
        status.textContent = "✅ Pronto! Leia as instruções e envie seu primeiro prompt.";
    } catch (error) {
        status.textContent = `❌ Erro ao carregar instruções: ${error.message}`;
        console.error(error);
    }
}

function mostrarCampoChave() {
    const campo = document.getElementById("campoChave");
    campo.style.display = "flex";
    campo.querySelector("input").focus();
}

function salvarChave() {
    const novaChave = document.getElementById("novaChave").value.trim();
    if (novaChave) {
        localStorage.setItem("google_gemini_api_key", novaChave);
        document.getElementById("campoChave").style.display = "none";
    }
}

function trocarChave() { mostrarCampoChave(); }
function desativarChave() { 
    if (confirm("Tem certeza que deseja limpar a chave API salva? Você precisará inseri-la novamente.")) {
        localStorage.setItem("google_gemini_api_key", "FAKE");
    }
}
function escapeRegex(string) { return string.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'); }
function limparBusca() {
    document.querySelectorAll('#chat .mensagem').forEach(div => {
        if (div.dataset.originalContent) div.innerHTML = div.dataset.originalContent;
        delete div.dataset.originalContent;
    });
    document.getElementById('clearSearchButton').style.display = 'none';
}
function localizarTexto() {
    limparBusca();
    const query = document.getElementById('searchInput').value.trim();
    if (!query) return;
    const regex = new RegExp(escapeRegex(query), 'gi');
    let totalFound = 0;
    document.querySelectorAll('#chat .mensagem').forEach(div => {
        div.dataset.originalContent = div.innerHTML;
        const newHTML = div.innerHTML.replace(regex, match => {
            totalFound++;
            return `<span class="highlight">${match}</span>`;
        });
        if (div.innerHTML !== newHTML) div.innerHTML = newHTML;
    });
    document.getElementById('status').textContent = `🔎 ${totalFound} ocorrência(s) encontrada(s).`;
    if (totalFound > 0) document.getElementById('clearSearchButton').style.display = 'inline-block';
}

// Função de teste/ativação de áudio com a nova frase
function testarAudio() {
  console.log("Ativando o sistema de áudio...");
  const utterance = new SpeechSynthesisUtterance("Ok"); // MUDANÇA AQUI
  utterance.lang = 'pt-BR';
  utterance.rate = 0.8; 
  window.speechSynthesis.speak(utterance);
}

// ADICIONE ESTA NOVA FUNÇÃO ABAIXO DA SUA FUNÇÃO 'limparConversa'

function removerMensagem(indiceParaRemover) {
    // 1. Pede confirmação por segurança
    const confirmacao = confirm("Tem certeza que deseja remover esta mensagem e seu conteúdo do histórico?");
    if (!confirmacao) {
        return; // Se o usuário cancelar, não faz nada.
    }

    // 2. Remove a mensagem do nosso array "memória"
    messages.splice(indiceParaRemover, 1);

    // 3. Redesenha a tela do zero para refletir a mudança
    const chatDiv = document.getElementById("chat");
    chatDiv.innerHTML = ""; // Limpa o chat visualmente

    // Recria cada mensagem na tela com o índice correto
    messages.forEach((mensagem, indiceAtual) => {
        // Esta parte recria o HTML da mensagem, similar à função 'atualizarChat'
        const div = document.createElement("div");
        const origem = mensagem.role === "model" ? "assistant" : mensagem.role;
        div.className = `mensagem ${origem}`;

        let timestampHtml = mensagem.timestamp ? `<span class="timestamp">${new Date(mensagem.timestamp).toLocaleString('pt-BR')}</span>` : '';
        
        let botoesDeAcaoHtml = `<div class="botoes-mensagem">`;
        if (origem === 'assistant') {
            botoesDeAcaoHtml += `<button class="play-button" onclick="reproduzirAudio(this)" title="Ouvir resposta">🔊</button>`;
        }
        botoesDeAcaoHtml += `<button class="play-button" onclick="removerMensagem(${indiceAtual})" title="Remover mensagem">🗑️</button>`;
        botoesDeAcaoHtml += `</div>`;

        const conteudoHtml = `<div class="conteudo-mensagem">${marked.parse(`**${origem === "user" ? "Você" : "IA"}:** ${mensagem.content}`)}</div>`;
        div.innerHTML = timestampHtml + conteudoHtml + botoesDeAcaoHtml;
        chatDiv.appendChild(div);
    });

    chatDiv.scrollTop = chatDiv.scrollHeight;
}

// --- Exposição das Funções para o HTML ---
window.enviarPrompt = enviarPrompt;
window.limparConversa = limparConversa;
window.salvarConversa = salvarConversa;
window.resumirConversa = resumirConversa;
window.iniciarTutorial = iniciarTutorial;
window.salvarChave = salvarChave;
window.trocarChave = trocarChave;
window.desativarChave = desativarChave;
window.localizarTexto = localizarTexto;
window.limparBusca = limparBusca;
window.reproduzirAudio = reproduzirAudio;
window.pararAudio = pararAudio; 
window.testarAudio = testarAudio; 
window.removerMensagem = removerMensagem; // ADICIONE ESTA LINHA

// --- Inicialização da Aplicação ---
async function inicializarApp() {
    await loadSystemPrompt();
    inicializarMetricasSessao();
    if (!getGeminiApiKey() || getGeminiApiKey() === "FAKE") mostrarCampoChave();
    else document.getElementById("status").textContent = "Pronto.";
}

inicializarApp();