import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface FreeTrial {
  id: string;
  nome: string;
  estabelecimento: string;
  whatsapp: string;
  data_criacao: string;
  status: string;
  visualizado: boolean;
}

const VerUsuariosGratis060622 = () => {
  const [trials, setTrials] = useState<FreeTrial[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTrials = async () => {
      try {
        const { data, error } = await supabase
          .from('free_trials')
          .select('*')
          .order('data_criacao', { ascending: false });

        if (error) throw error;
        setTrials(data || []);
      } catch (error) {
        console.error('Erro ao carregar testes:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchTrials();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Solicitações de Teste Grátis</h1>
          <span className="bg-blue-500 text-white px-3 py-1 rounded-full text-sm">
            Total: {trials.length}
          </span>
        </div>

        <div className="grid gap-6">
          {trials.map(trial => (
            <div 
              key={trial.id} 
              className="bg-[#1a1b1c] p-6 rounded-2xl border border-gray-700"
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-xl font-semibold">{trial.estabelecimento}</h3>
                  <p className="text-gray-400">Responsável: {trial.nome}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-400">
                    {format(new Date(trial.data_criacao), "dd 'de' MMMM 'às' HH:mm", { locale: ptBR })}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <p className="flex items-center">
                  <span className="text-gray-400 mr-2">WhatsApp:</span>
                  <a 
                    href={`https://wa.me/${trial.whatsapp.replace(/\D/g, '')}`}
                    target="_blank"
                    rel="noopener noreferrer" 
                    className="text-blue-400 hover:text-blue-300"
                  >
                    {trial.whatsapp}
                  </a>
                </p>
              </div>
            </div>
          ))}

          {trials.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              Nenhuma solicitação de teste grátis encontrada.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VerUsuariosGratis060622; 