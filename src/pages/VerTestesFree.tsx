import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAuth } from '../context/AuthContext';
import { Navigate } from 'react-router-dom';

interface FreeTrial {
  id: string;
  nome: string;
  estabelecimento: string;
  whatsapp: string;
  data_criacao: string;
  status: string;
  visualizado: boolean;
}

const VerTestesFree = () => {
  const { user, userRole } = useAuth();
  const [trials, setTrials] = useState<FreeTrial[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userRole !== 'support') return;
    
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
  }, [userRole]);

  const handleMarkAsViewed = async (id: string) => {
    try {
      const { error } = await supabase
        .from('free_trials')
        .update({ visualizado: true })
        .eq('id', id);

      if (error) throw error;

      setTrials(trials.map(trial => 
        trial.id === id ? { ...trial, visualizado: true } : trial
      ));
    } catch (error) {
      console.error('Erro ao marcar como visualizado:', error);
    }
  };

  if (userRole !== 'support') {
    return <Navigate to="/login" replace />;
  }

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
        <h1 className="text-3xl font-bold mb-8">Solicitações de Teste Grátis</h1>

        <div className="grid gap-6">
          {trials.map(trial => (
            <div 
              key={trial.id} 
              className={`bg-[#1a1b1c] p-6 rounded-2xl border ${
                trial.visualizado ? 'border-gray-700' : 'border-blue-500'
              }`}
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
                  {!trial.visualizado && (
                    <span className="inline-block bg-blue-500 text-white text-xs px-2 py-1 rounded-full mt-2">
                      Novo
                    </span>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <p className="flex items-center">
                  <span className="text-gray-400 mr-2">WhatsApp:</span>
                  <a 
                    href={(() => {
                      let phoneNumber = trial.whatsapp.replace(/\D/g, '');
                      if (!phoneNumber.startsWith('55')) {
                        phoneNumber = '55' + phoneNumber;
                      }
                      return `https://wa.me/${phoneNumber}`;
                    })()}
                    target="_blank"
                    rel="noopener noreferrer" 
                    className="text-blue-400 hover:text-blue-300"
                  >
                    {trial.whatsapp}
                  </a>
                </p>
              </div>

              {!trial.visualizado && (
                <button
                  onClick={() => handleMarkAsViewed(trial.id)}
                  className="mt-4 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition-colors"
                >
                  Marcar como visualizado
                </button>
              )}
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

export default VerTestesFree; 