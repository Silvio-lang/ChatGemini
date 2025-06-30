from utils import ler_json
def mesclar_conversas_continuadas(caminho_original, caminho_continuacao):
    original = ler_json(caminho_original)
    continuacao = ler_json(caminho_continuacao)
    if not original or not continuacao or 'messages' not in original or 'messages' not in continuacao:
        print("Erro: Arquivos inválidos."); return None
    
    msgs_orig = original['messages']
    msgs_cont = continuacao['messages']
    
    if msgs_cont[:len(msgs_orig)] == msgs_orig:
        print("Sobreposição encontrada. A conversa de continuação já contém a original.")
        return continuacao
    else:
        print("Aviso: As conversas não parecem ser continuação direta. Elas serão concatenadas.")
        continuacao['messages'] = msgs_orig + msgs_cont
        return continuacao