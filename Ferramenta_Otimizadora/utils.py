import json
import os
import tkinter as tk
from tkinter import filedialog

# Esconde a janela principal do Tkinter
root = tk.Tk()
root.withdraw()

def ler_json(caminho_arquivo):
    try:
        with open(caminho_arquivo, 'r', encoding='utf-8') as f: return json.load(f)
    except Exception as e:
        print(f"Erro ao ler o arquivo {caminho_arquivo}: {e}"); return None

def salvar_json(dados, caminho_arquivo):
    try:
        with open(caminho_arquivo, 'w', encoding='utf-8') as f: json.dump(dados, f, indent=2, ensure_ascii=False)
        print(f"Arquivo salvo com sucesso em: {caminho_arquivo}")
    except Exception as e: print(f"Erro ao salvar o arquivo {caminho_arquivo}: {e}")

def selecionar_arquivo(titulo="Selecione um arquivo JSON"):
    return filedialog.askopenfilename(title=titulo, filetypes=[("JSON files", "*.json")])

def selecionar_arquivos(titulo="Selecione os arquivos JSON"):
    return filedialog.askopenfilenames(title=titulo, filetypes=[("JSON files", "*.json")])