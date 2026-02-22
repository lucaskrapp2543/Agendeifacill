import React from 'react';

export default function DataDeletionPage() {
  return (
    <div className="min-h-screen bg-[#0b0b0c] text-white">
      <div className="mx-auto w-full max-w-4xl px-4 py-10">
        <h1 className="text-3xl font-extrabold text-[#E6C78B]">Exclusao de Dados</h1>
        <p className="mt-2 text-sm text-white/70">Como solicitar exclusao de dados no Agendei Facil</p>

        <div className="mt-8 space-y-6 text-sm leading-6 text-white/90">
          <section>
            <h2 className="text-lg font-bold text-white">1. Solicitacao</h2>
            <p>
              Para solicitar exclusao de dados pessoais, envie uma mensagem para o canal de suporte oficial do Agendei
              Facil contendo: nome, telefone e email vinculados a conta.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white">2. Confirmacao de identidade</h2>
            <p>
              Podemos solicitar confirmacao adicional para garantir que somente o titular faca a solicitacao.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white">3. Prazo</h2>
            <p>
              A solicitacao sera analisada e processada em prazo razoavel, respeitando obrigacoes legais e
              regulatórias.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white">4. Escopo da exclusao</h2>
            <p>
              Dados sem obrigacao legal de retencao serao removidos ou anonimizados conforme as politicas internas e a
              legislacao aplicavel.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
