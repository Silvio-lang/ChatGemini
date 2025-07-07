// --- Variáveis Globais e de Sessão ---
let messages = [];
let systemPrompt = null;
let requestCount = 0;
let totalTokensEntradaSessao = 0;
let totalTokensSaidaSessao = 0;

// Pegamos as ferramentas do objeto global 'google.generativeai' que o script do HTML carregou
const { HarmCategory, HarmBlockThreshold } = google.generativeai;

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
    if (!userPromptText) return;
    
    const userMessage = { role: "user", content: userPromptText, timestamp: new Date().toISOString() };
    messages.push(userMessage);
    
    atualizarChat({ ...userMessage, content: userPromptText });
    document.getElementById("userPrompt").value = "";

    await enviarParaAPI();
}

async function enviarParaAPI() {
    const apiKey = getGeminiApiKey();
    if (!apiKey || apiKey === "FAKE") return mostrarCampoChave();
    
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
        const genAI = new google.generativeai.GoogleGenerativeAI(apiKey);
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
        if (messages.at(-1)?.role === "user") messages.pop(); 
        atualizarChat({ role: 'assistant', content: `[Erro: ${error.message}]`, timestamp: new Date().toISOString() });
        atualizarMetricasDisplay();
    }
}

function atualizarChat(message) {
    const chatDiv = document.getElementById("chat");
    const div = document.createElement("div");
    const origem = message.role === "model" ? "assistant" : message.role;
    div.className = `mensagem ${origem}`;

    let timestampHtml = message.timestamp ? `<span class="timestamp">${new Date(message.timestamp).toLocaleString('pt-BR')}</span>` : '';
    let audioButtonHtml = (origem === 'assistant') ? `<button class="play-button" onclick="reproduzirAudio(this)" title="Ouvir resposta">🔊</button>` : '';
    
    const conteudoHtml = `<div class="conteudo-mensagem">${marked.parse(`**${origem === "user" ? "Você" : "IA"}:** ${message.content}`)}</div>`;
    div.innerHTML = timestampHtml + conteudoHtml + audioButtonHtml;
    
    chatDiv.appendChild(div);
    chatDiv.scrollTop = chatDiv.scrollHeight;
}

function limparConversa() {
    if (confirm("Deseja realmente limpar a conversa?")) {
        pararAudio();
        messages = [];
        document.getElementById("chat").innerHTML = "";
        document.getElementById("status").textContent = "Conversa limpa.";
        document.getElementById("infoArquivoCarregado").textContent = "";
    }
}

let listaDeVozes = [];
function carregarVozes() {
    listaDeVozes = window.speechSynthesis.getVoices();
}
carregarVozes();
if (window.speechSynthesis.onvoiceschanged !== undefined) {
    window.speechSynthesis.onvoiceschanged = carregarVozes;
}

function reproduzirAudio(buttonElement) {
    window.speechSynthesis.cancel();
    const mensagemDiv = buttonElement.closest('.mensagem');
    const elementoConteudo = mensagemDiv.querySelector('.conteudo-mensagem');
    const textoCompleto = elementoConteudo ? elementoConteudo.innerText : '';
    if (textoCompleto) {
        const textoParaFalar = textoCompleto.replace(/^IA:\s*/, '').trim();
        const utterance = new SpeechSynthesisUtterance(textoParaFalar);
        const vozBrasileira = listaDeVozes.find(voz => voz.lang === 'pt-BR');
        if (vozBrasileira) utterance.voice = vozBrasileira;
        else utterance.lang = 'pt-BR';
        window.speechSynthesis.speak(utterance);
    }
}

function pararAudio() {
    window.speechSynthesis.cancel();
}

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
        const genAI = new google.generativeai.GoogleGenerativeAI(apiKey);
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
    pararAudio();
    limparConversa(); // Adicionado para garantir que a conversa seja limpa antes do tutorial
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

async function inicializarApp() {
    await loadSystemPrompt();
    inicializarMetricasSessao();
    if (!getGeminiApiKey() || getGeminiApiKey() === "FAKE") mostrarCampoChave();
    else document.getElementById("status").textContent = "Pronto.";
}

inicializarApp();
