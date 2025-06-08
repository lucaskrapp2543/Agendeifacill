import React from 'react';
import { format, parseISO } from 'date-fns';
import { Star, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useToast } from './ui/Toaster';

interface PremiumSubscriber {
  id: string;
  display_name: string;
  whatsapp: string;
  is_winner?: boolean;
  winner_position?: number;
  last_draw_date?: string;
}

interface PremiumSubscribersProps {
  subscribers: PremiumSubscriber[];
  establishmentId: string;
  onUpdate: () => void;
  isLoading: boolean;
}

export const PremiumSubscribers = ({
  subscribers,
  establishmentId,
  onUpdate,
  isLoading
}: PremiumSubscribersProps) => {
  const { toast } = useToast();
  const [isDrawing, setIsDrawing] = React.useState(false);

  const handleDrawWinners = async () => {
    if (subscribers.length < 20) {
      toast('É necessário ter pelo menos 20 assinantes premium para realizar o sorteio', 'warning');
      return;
    }

    setIsDrawing(true);

    try {
      // Resetar vencedores anteriores
      const resetPromises = subscribers
        .filter(sub => sub.is_winner)
        .map(sub => supabase
          .from('premium_subscriptions')
          .update({
            is_winner: false,
            winner_position: null,
            last_draw_date: null
          })
          .eq('id', sub.id)
        );

      await Promise.all(resetPromises);

      // Selecionar 2 vencedores aleatórios
      const eligibleSubscribers = subscribers.filter(sub => !sub.is_winner);
      const shuffled = [...eligibleSubscribers].sort(() => Math.random() - 0.5);
      const winners = shuffled.slice(0, 2);

      // Atualizar vencedores
      const updatePromises = winners.map((winner, index) => supabase
        .from('premium_subscriptions')
        .update({
          is_winner: true,
          winner_position: index + 1,
          last_draw_date: new Date().toISOString()
        })
        .eq('id', winner.id)
      );

      await Promise.all(updatePromises);

      // Atualizar lista de assinantes
      onUpdate();
      toast('Sorteio realizado com sucesso!', 'success');
    } catch (error: any) {
      console.error('Erro ao realizar sorteio:', error);
      toast(error.message || 'Erro ao realizar sorteio', 'error');
    } finally {
      setIsDrawing(false);
    }
  };

  const handleRemoveSubscriber = async (subscriberId: string) => {
    try {
      const { error } = await supabase
        .from('premium_subscriptions')
        .delete()
        .eq('id', subscriberId);

      if (error) throw error;

      toast('Cliente premium removido com sucesso', 'success');
      onUpdate();
    } catch (error: any) {
      console.error('Error removing premium subscriber:', error);
      toast(error.message || 'Erro ao remover cliente premium', 'error');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Clientes Premium</h2>
        {subscribers.length >= 20 && (
          <button
            onClick={handleDrawWinners}
            disabled={isDrawing}
            className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 disabled:opacity-50"
          >
            <Star className="w-4 h-4" />
            {isDrawing ? 'Sorteando...' : 'Sortear Vencedores'}
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="text-center py-8">Carregando assinantes...</div>
      ) : subscribers.length === 0 ? (
        <div className="text-center py-8">Nenhum assinante premium ainda</div>
      ) : (
        <div className="grid gap-4">
          {subscribers.map((subscriber) => (
            <div
              key={subscriber.id}
              className={`p-4 rounded-lg border ${
                subscriber.is_winner
                  ? 'border-purple-500 bg-purple-50'
                  : 'border-gray-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {subscriber.is_winner && (
                    <div className="bg-purple-100 p-2 rounded-full">
                      <Star className="w-4 h-4 text-purple-600" />
                    </div>
                  )}
                  <div>
                    <h3 className="font-semibold">{subscriber.display_name}</h3>
                    <p className="text-sm text-gray-500">{subscriber.whatsapp}</p>
                    {subscriber.is_winner && subscriber.last_draw_date && (
                      <p className="text-sm text-purple-600">
                        {subscriber.winner_position}º Lugar - Sorteado em {format(parseISO(subscriber.last_draw_date), "dd/MM/yyyy")}
                      </p>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => handleRemoveSubscriber(subscriber.id)}
                  className="text-red-500 hover:text-red-700"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}; 