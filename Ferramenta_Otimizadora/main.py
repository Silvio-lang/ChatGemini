# main.py
import os
from utils import ler_json, salvar_json, selecionar_arquivo, selecionar_arquivos
from cleaner import remover_lixo
from deduplicator import mesclar_conversas_continuadas
from splitter import dividir_conversa

def menu_limpeza():
    print("\n--- 1. Remover Conteúdo Irrelevante ('Lixo') ---")
    caminho_arquivo = selecionar_arquivo("Selecione o arquivo JSON para limpar")
    if not caminho_arquivo: return

    dados_completos = ler_json(caminho_arquivo)
    if not dados_completos or 'messages' not in dados_completos:
        print("Erro: Arquivo inválido ou não contém a chave 'messages'.")
        return

    conversa_original = dados_completos.get('messages', [])
    conversa_limpa, removidas = remover_lixo(conversa_original)
    
    if not removidas:
        print("\nAnálise concluída. Nenhum 'lixo' encontrado para remover.")
        return

    print(f"\nAnálise concluída. Foram identificadas {len(removidas)} mensagens para remoção:")
    # ... (código de relatório que já tínhamos)
    for i, item in enumerate(removidas):
        role = item['mensagem'].get('role', 'desconhecido').capitalize()
        content = item['mensagem'].get('content', '')
        print(f"{i+1}. Motivo: {item['motivo']} | Conteúdo ({role}): \"{content[:50]}...\"")

    confirmacao = input("\nDeseja prosseguir e salvar o novo arquivo limpo? (s/n): ").lower()
    if confirmacao in ['s', 'sim']:
        dados_completos['messages'] = conversa_limpa
        base, ext = os.path.splitext(caminho_arquivo)
        novo_caminho = f"{base}_limpo{ext}"
        salvar_json(dados_completos, novo_caminho)

def menu_deduplicacao():
    print("\n--- 2. Mesclar Conversas Continuadas ---")
    print("Selecione o arquivo ORIGINAL (parte 1) e depois o de CONTINUAÇÃO (parte 2).")
    caminho_original = selecionar_arquivo("1. Selecione o arquivo ORIGINAL (parte 1)")
    if not caminho_original: return
    caminho_continuacao = selecionar_arquivo("2. Selecione o arquivo de CONTINUAÇÃO (parte 2)")
    if not caminho_continuacao: return

    conversa_mesclada = mesclar_conversas_continuadas(caminho_original, caminho_continuacao)
    if conversa_mesclada:
        base, ext = os.path.splitext(caminho_continuacao)
        novo_caminho = f"{base}_mesclado{ext}"
        salvar_json(conversa_mesclada, novo_caminho)

def menu_divisao():
    print("\n--- 3. Dividir Conversa por Assunto ---")
    caminho_arquivo = selecionar_arquivo("Selecione o arquivo JSON para dividir")
    if not caminho_arquivo: return

    dados_completos = ler_json(caminho_arquivo)
    if not dados_completos or 'messages' not in dados_completos:
        print("Erro: Arquivo inválido ou não contém a chave 'messages'.")
        return

    conversa_original = dados_completos.get('messages', [])
    parte1, parte2 = dividir_conversa(conversa_original)

    if parte1 and parte2:
        base, ext = os.path.splitext(caminho_arquivo)
        # Salva a parte 1
        dados_p1 = dados_completos.copy()
        dados_p1['messages'] = parte1
        caminho_p1 = f"{base}_parte1{ext}"
        salvar_json(dados_p1, caminho_p1)
        # Salva a parte 2
        dados_p2 = dados_completos.copy()
        dados_p2['messages'] = parte2
        caminho_p2 = f"{base}_parte2{ext}"
        salvar_json(dados_p2, caminho_p2)

def main():
    while True:
        print("\n==============================================")
        print("   Otimizador de Conversas WebGemini (Terminal) ")
        print("==============================================")
        print("1. Remover 'Lixo'")
        print("2. Mesclar Conversas Continuadas")
        print("3. Dividir Conversa por Assunto")
        print("0. Sair")
        print("----------------------------------------------")
        escolha = input("Escolha uma opção: ")
        if escolha == '1': menu_limpeza()
        elif escolha == '2': menu_deduplicacao()
        elif escolha == '3': menu_divisao()
        elif escolha == '0': break
        else: print("Opção inválida.")
        input("\nPressione Enter para continuar...")

if __name__ == "__main__":
    main()