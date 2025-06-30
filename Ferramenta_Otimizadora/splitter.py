def dividir_conversa(conversa):
    print("\n--- Visualização da Conversa para Divisão ---")
    for i, msg in enumerate(conversa):
        if isinstance(msg, dict):
            role = msg.get("role", "n/a").capitalize()
            content = msg.get("content", "")
            preview = (content[:75] + '...') if len(content) > 75 else content
            print(f"[{i:03d}] {role}: {preview.replace(chr(10), ' ')}")
    
    try:
        ponto_corte = int(input("\nDigite o número da mensagem onde a NOVA conversa (parte 2) deve começar: "))
        if 0 < ponto_corte < len(conversa):
            return conversa[:ponto_corte], conversa[ponto_corte:]
        else:
            print("Número inválido."); return None, None
    except ValueError:
        print("Entrada inválida."); return None, None