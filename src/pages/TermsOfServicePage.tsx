import React from 'react';

export default function TermsOfServicePage() {
  const updatedAt = '22/02/2026';

  return (
    <div className="min-h-screen bg-[#0b0b0c] text-white">
      <div className="mx-auto w-full max-w-4xl px-4 py-10">
        <h1 className="text-3xl font-extrabold text-[#E6C78B]">Termos de Servico</h1>
        <p className="mt-2 text-sm text-white/70">Agendei Facil - ultima atualizacao: {updatedAt}</p>

        <div className="mt-8 space-y-6 text-sm leading-6 text-white/90">
          <section>
            <h2 className="text-lg font-bold text-white">1. Aceite</h2>
            <p>
              Ao utilizar o Agendei Facil, voce concorda com estes termos e com as regras de uso da plataforma.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white">2. Objeto do servico</h2>
            <p>
              O Agendei Facil oferece ferramentas para gestao de agendamentos, clientes, servicos e comunicacoes
              relacionadas ao atendimento.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white">3. Responsabilidade do usuario</h2>
            <p>
              O usuario se compromete a fornecer informacoes verdadeiras, manter seus acessos protegidos e utilizar a
              plataforma de forma legal e etica.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white">4. Disponibilidade</h2>
            <p>
              O servico pode passar por manutencoes e melhorias. O Agendei Facil busca alta disponibilidade, sem
              garantia absoluta de funcionamento ininterrupto.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white">5. Limitacao de responsabilidade</h2>
            <p>
              O Agendei Facil nao se responsabiliza por danos causados por uso indevido da plataforma, falhas externas
              de internet, energia ou servicos de terceiros.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white">6. Alteracoes dos termos</h2>
            <p>
              Estes termos podem ser atualizados periodicamente. A continuidade do uso apos atualizacao representa
              concordancia com a nova versao.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
