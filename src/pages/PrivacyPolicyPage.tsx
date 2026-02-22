import React from 'react';

export default function PrivacyPolicyPage() {
  const updatedAt = '22/02/2026';

  return (
    <div className="min-h-screen bg-[#0b0b0c] text-white">
      <div className="mx-auto w-full max-w-4xl px-4 py-10">
        <h1 className="text-3xl font-extrabold text-[#E6C78B]">Politica de Privacidade</h1>
        <p className="mt-2 text-sm text-white/70">Agendei Facil - ultima atualizacao: {updatedAt}</p>

        <div className="mt-8 space-y-6 text-sm leading-6 text-white/90">
          <section>
            <h2 className="text-lg font-bold text-white">1. Dados coletados</h2>
            <p>
              O Agendei Facil pode coletar dados fornecidos por voce durante o uso da plataforma, incluindo nome,
              telefone, email e informacoes de agendamento.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white">2. Uso das informacoes</h2>
            <p>
              Os dados sao utilizados para operacao do sistema, gestao de agendamentos, comunicacao com clientes,
              suporte e melhorias da plataforma.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white">3. Compartilhamento</h2>
            <p>
              Nao vendemos dados pessoais. O compartilhamento pode ocorrer apenas com provedores tecnicos necessarios
              para funcionamento do servico, sempre com objetivo operacional.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white">4. Seguranca</h2>
            <p>
              Adotamos medidas tecnicas e organizacionais para proteger os dados contra acesso nao autorizado,
              alteracao, divulgacao ou destruicao.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white">5. Direitos do usuario</h2>
            <p>
              O titular pode solicitar acesso, correcao e exclusao de dados, conforme legislacao aplicavel. Veja a
              pagina de exclusao de dados para orientacoes.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white">6. Contato</h2>
            <p>
              Para assuntos de privacidade, entre em contato pelo email oficial informado no app do Agendei Facil.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
