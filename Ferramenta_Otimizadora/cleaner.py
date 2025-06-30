MARCADOR_REMOCAO = "[APAGAR]"
def remover_lixo(conversa):
    conversa_limpa, mensagens_removidas = [], []
    SAUDACOES_LIXO = ["oi","olá","bom dia","boa tarde","boa noite","tudo bem?","ok","obrigado","obrigada","certo","entendi","valeu","grato"]
    for item in conversa:
        if isinstance(item, dict):
            conteudo_original = item.get("content", "")
            conteudo_normalizado = conteudo_original.strip().lower()
            motivo = None
            if MARCADOR_REMOCAO in conteudo_original: motivo = "Marcação manual"
            elif not conteudo_normalizado: motivo = "Mensagem vazia"
            elif len(conteudo_normalizado) < 10: motivo = "Mensagem curta"
            elif conteudo_normalizado in SAUDACOES_LIXO: motivo = "Saudação/Lixo"
            if motivo: mensagens_removidas.append({"motivo": motivo, "mensagem": item})
            else: conversa_limpa.append(item)
        else: conversa_limpa.append(item)
    return conversa_limpa, mensagens_removidas