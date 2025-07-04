// script.js (versão final com bugfix de safety_settings e carregamento de arquivo restaurado)

import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from 'https://esm.run/@google/generative-ai';
import * as pdfjsLib from "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.min.mjs";
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs`;

let messages = [];
let systemPrompt = null;

const safetySettings = [
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
];

// ... (todo o resto do código, como as constantes de preço, etc., permanece igual) ...

let ultimoTextoCarregado = "";
let requestCount = 0;
const FREE_TIER_RPM_LIMIT = 60;
const REQUEST_COUNT_STORAGE_KEY = "gemini_request_count";
const SYSTEM_PROMPT_FILE_PATH = "./system_prompt.json";

const getGeminiApiKey = () => localStorage.getItem("google_gemini_api_key");

// ... (as funções de loadSystemPrompt, loadRequestCount, etc., permanecem iguais) ...

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

function loadRequestCount() {
    requestCount = parseInt(localStorage.getItem(REQUEST_COUNT_STORAGE_KEY) || "0", 10);
    updateRequestInfoDisplay();
}

function updateRequestInfoDisplay() {
    document.getElementById("requestInfo").textContent = `Requisições: ${requestCount} | Limite Grátis: ${FREE_TIER_RPM_LIMIT} RPM`;
}

function incrementRequestCount() {
    requestCount++;
    localStorage.setItem(REQUEST_COUNT_STORAGE_KEY, requestCount);
    updateRequestInfoDisplay();
}

document.getElementById("fileInput").addEventListener("change", async function () {
    const file = this.files[0];
    const status = document.getElementById("status");
    if (!file) return;
    const ext = file.name.split('.').pop().toLowerCase();
    if (!["txt", "pdf"].includes(ext)) return;
    status.textContent = "Processando arquivo...";
    const reader = new FileReader();
    reader.onload = async (e) => {
        let texto = "";
        if (ext === "txt") {
            texto = e.target.result;
        } else {
            const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(e.target.result) }).promise;
            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                texto += (await page.getTextContent()).items.map(s => s.str).join(" ") + "\n";
            }
        }
        ultimoTextoCarregado = texto;
        status.textContent = `📄 Arquivo ${file.name} carregado.`;
    };
    if (ext === "txt") reader.readAsText(file); else reader.readAsArrayBuffer(file);
});

async function enviarPrompt() {
    const userPromptText = document.getElementById("userPrompt").value.trim();
    let promptParaEnviar = userPromptText;
    if (ultimoTextoCarregado) promptParaEnviar = `Contexto:\n${ultimoTextoCarregado}\n\nPrompt:\n${userPromptText}`;
    if (!userPromptText && ultimoTextoCarregado) promptParaEnviar = `Contexto:\n${ultimoTextoCarregado}`;
    if (!promptParaEnviar) return;
    const userMessage = { role: "user", content: promptParaEnviar, timestamp: new Date().toISOString() };
    messages.push(userMessage);
    atualizarChat({ ...userMessage, content: userPromptText || "(Arquivo enviado)" });
    document.getElementById("userPrompt").value = "";
    ultimoTextoCarregado = "";
    document.getElementById("fileName").textContent = "Nenhum arquivo escolhido";
    document.getElementById("fileInput").value = "";
    await enviarParaAPI();
}

function atualizarChat(message) {
    const chatDiv = document.getElementById("chat");
    const div = document.createElement("div");
    const origem = message.role === "model" ? "assistant" : message.role;
    div.className = `mensagem ${origem}`;
    let timestampHtml = message.timestamp ? `<span class="timestamp">${new Date(message.timestamp).toLocaleString('pt-BR')}</span>` : '';
    div.innerHTML = timestampHtml + marked.parse(`**${origem === "user" ? "Você" : "IA"}:** ${message.content}`);
    chatDiv.appendChild(div);
    chatDiv.scrollTop = chatDiv.scrollHeight;
}

function limparConversa() {
    if (confirm("Deseja realmente limpar a conversa?")) {
        messages = [];
        document.getElementById("chat").innerHTML = "";
        document.getElementById("status").textContent = "Conversa limpa.";
        document.getElementById("infoArquivoCarregado").textContent = "";
    }
}

function formatMessagesForGemini(msgs, sysPrompt) {
    const geminiMessages = [];
    if (sysPrompt) {
        geminiMessages.push({ role: "user", parts: [{ text: sysPrompt }] });
        geminiMessages.push({ role: "model", parts: [{ text: "Entendido." }] });
    }
    msgs.forEach(msg => {
        geminiMessages.push({ role: msg.role === 'assistant' ? 'model' : msg.role, parts: [{ text: msg.content }] });
    });
    return geminiMessages;
}

// Substitua sua função enviarParaAPI por esta versão
async function enviarParaAPI() {
    const apiKey = getGeminiApiKey();
    if (!apiKey || apiKey === "FAKE") return mostrarCampoChave();

    incrementRequestCount();
    document.getElementById("status").textContent = "Enviando...";
    
    const modeloSelecionado = document.getElementById("modelo").value;
    const historyForGemini = formatMessagesForGemini(messages.slice(0, -1), systemPrompt);
    
    // Pega o texto original do último prompt do usuário
    let ultimoPromptTexto = messages.at(-1).content;

    // NOVO: Verifica se o checkbox de incluir data/hora está marcado
    if (document.getElementById("incluirData").checked) {
        // Cria uma string de data/hora bem completa
        const agora = new Date().toLocaleString('pt-BR', { dateStyle: 'full', timeStyle: 'long' });
        
        // Monta o prompt final com o contexto de tempo
        const promptComContexto = 
`[CONTEXTO DE TEMPO ATUAL]
Data e Hora: ${agora}

[PROMPT DO USUÁRIO]
${ultimoPromptTexto}`;
        
        // Atualiza a variável que será enviada para a API
        ultimoPromptTexto = promptComContexto;
    }

    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: modeloSelecionado });
        const chat = model.startChat({ history: historyForGemini, safetySettings: safetySettings });
        
        // Envia o prompt (com ou sem o contexto de tempo) para a API
        const result = await chat.sendMessage(ultimoPromptTexto);
        
        const response = await result.response;
        const respostaTexto = response.text();
        const assistantMessage = { role: "model", content: respostaTexto, timestamp: new Date().toISOString() };
        messages.push(assistantMessage);
        atualizarChat(assistantMessage);
        document.getElementById("status").textContent = "Pronto.";
    } catch (error) {
        console.error("Erro API Gemini:", error);
        document.getElementById("status").textContent = `❌ Erro: ${error.message}`;
        atualizarChat({ role: 'assistant', content: `[Erro: ${error.message}]`, timestamp: new Date().toISOString() });
        if (messages.at(-1)?.role === "user") messages.pop();
    }
}

async function resumirConversa() {
    if (messages.length < 2) return;
    if (!confirm("Isso irá resumir a conversa atual. Continuar?")) return;
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
    document.getElementById("infoArquivoCarregado").textContent = `(Ativo: ${a.download})`;
}

// CORREÇÃO: Voltando para a lógica original e garantida de carregamento de arquivo
document.getElementById("carregarJson").addEventListener("change", function () {
    const file = this.files[0];
    if (!file) return;
    
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
        } catch (err) {
            alert("Erro ao ler arquivo JSON: " + err.message);
        }
        document.getElementById("carregarJson").value = ""; // Limpa o input para permitir carregar o mesmo arquivo novamente
    };
    reader.readAsText(file);
});


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
function desativarChave() { if (confirm("Desativar a chave?")) localStorage.setItem("google_gemini_api_key", "FAKE"); }
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

async function iniciarTutorial() {
    if (messages.length > 0 && !confirm("Isso irá limpar a conversa atual e mostrar uma mensagem de boas-vindas com instruções. Deseja continuar?")) {
        return;
    }

    const status = document.getElementById("status");
    status.textContent = "Carregando instruções...";

    try {
        const response = await fetch('./mensagem_boas_vindas.txt');
        if (!response.ok) throw new Error(`Arquivo de boas-vindas não encontrado.`);
        
        const textoBoasVindas = await response.text();

        messages = []; // Limpa o histórico de dados
        document.getElementById("chat").innerHTML = ""; // Limpa o chat visual
        
        // Cria e exibe a mensagem de boas-vindas
        const mensagem = { 
            role: 'model', // Usamos 'model' para o estilo verde
            content: textoBoasVindas,
            timestamp: new Date().toISOString()
        };
        
        // IMPORTANTE: Não adicionamos esta mensagem ao `messages` array!
        // Ela é apenas visual e não deve fazer parte do histórico enviado para a IA.
        atualizarChat(mensagem); 
        
        status.textContent = "✅ Pronto! Leia as instruções e envie seu primeiro prompt.";

    } catch (error) {
        status.textContent = `❌ Erro ao carregar instruções: ${error.message}`;
        console.error(error);
    }
}
window.enviarPrompt = enviarPrompt;
window.limparConversa = limparConversa;
window.salvarConversa = salvarConversa;
window.resumirConversa = resumirConversa;
window.iniciarTutorial = iniciarTutorial; // <-- ADICIONE ESTA LINHA
window.salvarChave = salvarChave;
window.trocarChave = trocarChave;
window.desativarChave = desativarChave;
window.localizarTexto = localizarTexto;
window.limparBusca = limparBusca;

async function inicializarApp() {
    await loadSystemPrompt();
    loadRequestCount();
    if (!getGeminiApiKey() || getGeminiApiKey() === "FAKE") mostrarCampoChave();
}

inicializarApp();