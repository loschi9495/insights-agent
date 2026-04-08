"""
CLI interativo para o Agente de Insights da Onfly.

Uso:
    python cli.py
    python cli.py "Quanto gastamos com voos no Q1 2026?"
"""
import sys
from src.agent import InsightsAgent


def main():
    agent = InsightsAgent()

    # Modo single-question
    if len(sys.argv) > 1:
        question = " ".join(sys.argv[1:])
        print(agent.ask(question))
        return

    # Modo interativo
    print("=" * 60)
    print("  Onfly Insights Agent")
    print("  Digite sua pergunta ou 'sair' para encerrar.")
    print("  'limpar' para resetar a conversa.")
    print("=" * 60)

    while True:
        try:
            question = input("\n📊 Pergunta: ").strip()
        except (KeyboardInterrupt, EOFError):
            print("\nAté logo!")
            break

        if not question:
            continue
        if question.lower() in ("sair", "exit", "quit"):
            print("Até logo!")
            break
        if question.lower() in ("limpar", "clear", "reset"):
            agent.reset()
            print("Conversa resetada.")
            continue

        print("\n⏳ Consultando dados...\n")
        try:
            answer = agent.ask(question)
            print(answer)
        except Exception as e:
            print(f"❌ Erro: {e}")


if __name__ == "__main__":
    main()
