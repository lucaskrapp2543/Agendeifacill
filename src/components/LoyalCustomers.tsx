import React, { useState, useEffect } from 'react';
import { Star, Shuffle, MessageSquare, ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useToast } from './ui/Toaster';
import { format, subMonths, addMonths, startOfMonth, endOfMonth, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface LoyalCustomer {
  id: string;
  customer_name: string;
  whatsapp: string;
  created_at: string;
}

interface LoyalCustomersProps {
  establishmentId: string;
}

const LoyalCustomers: React.FC<LoyalCustomersProps> = ({ establishmentId }) => {
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [customers, setCustomers] = useState<LoyalCustomer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<LoyalCustomer | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [formData, setFormData] = useState({
    customerName: '',
    whatsapp: '',
    registrationDate: format(new Date(), 'yyyy-MM-dd')
  });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadCustomers();
  }, [establishmentId, selectedMonth]);

  const loadCustomers = async () => {
    try {
      const start = startOfMonth(selectedMonth);
      const end = endOfMonth(selectedMonth);

      const { data, error } = await supabase
        .from('loyal_customers')
        .select('*')
        .eq('establishment_id', establishmentId)
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString())
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Erro ao carregar clientes:', error);
        toast('Erro ao carregar clientes. Por favor, tente novamente.', 'error');
        return;
      }
      
      setCustomers(data || []);
      setSelectedCustomer(null); // Limpa o cliente sorteado ao mudar de mês
    } catch (error) {
      console.error('Erro ao carregar clientes:', error);
      toast('Erro ao carregar clientes. Por favor, tente novamente.', 'error');
    }
  };

  const handlePreviousMonth = () => {
    setSelectedMonth(prev => subMonths(prev, 1));
  };

  const handleNextMonth = () => {
    setSelectedMonth(prev => addMonths(prev, 1));
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    
    if (name === 'whatsapp') {
      const numbersOnly = value.replace(/\D/g, '');
      let formattedNumber = numbersOnly;
      if (numbersOnly.length <= 11) {
        formattedNumber = numbersOnly
          .replace(/(\d{2})/, '($1) ')
          .replace(/(\d{5})/, '$1-')
          .replace(/(-\d{4})\d+?$/, '$1');
      }
      setFormData(prev => ({
        ...prev,
        [name]: formattedNumber
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.customerName.trim() || !formData.whatsapp.trim()) {
      toast('Por favor, preencha todos os campos.', 'error');
      return;
    }

    setIsLoading(true);

    try {
      const whatsappNumbers = formData.whatsapp.replace(/\D/g, '');
      
      const { error } = await supabase
        .from('loyal_customers')
        .insert([{
          establishment_id: establishmentId,
          customer_name: formData.customerName.trim(),
          whatsapp: whatsappNumbers,
          created_at: new Date(formData.registrationDate).toISOString()
        }]);

      if (error) {
        console.error('Erro ao salvar cliente:', error);
        toast('Erro ao salvar cliente. Por favor, tente novamente.', 'error');
        return;
      }

      toast('Cliente salvo com sucesso!', 'success');
      setFormData({ 
        customerName: '', 
        whatsapp: '',
        registrationDate: format(new Date(), 'yyyy-MM-dd')
      });
      await loadCustomers();
      setShowForm(false);
    } catch (error) {
      console.error('Erro ao salvar cliente:', error);
      toast('Erro ao salvar cliente. Por favor, tente novamente.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDraw = () => {
    if (customers.length === 0) {
      toast('Adicione clientes antes de realizar o sorteio!', 'error');
      return;
    }

    const randomIndex = Math.floor(Math.random() * customers.length);
    setSelectedCustomer(customers[randomIndex]);
    toast('Cliente sorteado com sucesso!', 'success');
  };

  const getWhatsAppLink = (whatsapp: string) => {
    const cleanNumber = whatsapp.replace(/\D/g, '');
    return `https://wa.me/55${cleanNumber}`;
  };

  return (
    <div className="bg-gray-900 rounded-lg p-6 mt-6">
      <div className="flex justify-between items-center mb-6">
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded-lg transition-colors"
        >
          <Star className="w-5 h-5" />
          Clientes Fiel
        </button>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <button
              onClick={handlePreviousMonth}
              className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
            >
              <ChevronLeft className="w-5 h-5 text-gray-400" />
            </button>
            
            <span className="text-white font-medium">
              {format(selectedMonth, 'MMMM yyyy', { locale: ptBR })}
            </span>
            
            <button
              onClick={handleNextMonth}
              className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
            >
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </button>
          </div>

          <button
            onClick={handleDraw}
            disabled={customers.length === 0}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              customers.length > 0
                ? 'bg-purple-600 hover:bg-purple-700 text-white'
                : 'bg-gray-700 text-gray-400 cursor-not-allowed'
            }`}
          >
            <Shuffle className="w-5 h-5" />
            Sortear
          </button>
        </div>
      </div>

      {/* Formulário de Cadastro */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-gray-800 p-4 rounded-lg mb-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-200 mb-1">
                Nome Completo
              </label>
              <input
                type="text"
                name="customerName"
                value={formData.customerName}
                onChange={handleChange}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-yellow-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-200 mb-1">
                WhatsApp
              </label>
              <input
                type="tel"
                name="whatsapp"
                value={formData.whatsapp}
                onChange={handleChange}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-yellow-500"
                placeholder="(00) 00000-0000"
                required
                maxLength={15}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-200 mb-1 flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Data de Cadastro
              </label>
              <input
                type="date"
                name="registrationDate"
                value={formData.registrationDate}
                onChange={handleChange}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-yellow-500"
                required
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-green-600 hover:bg-green-700 text-white py-2 rounded-md transition-colors"
            >
              {isLoading ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
      )}

      {/* Cliente Sorteado */}
      {selectedCustomer && (
        <div className="bg-purple-900/50 p-4 rounded-lg mb-6 text-center">
          <h3 className="text-xl font-bold text-white mb-2">🎉 Cliente Sorteado!</h3>
          <p className="text-purple-200 mb-3">{selectedCustomer.customer_name}</p>
          <a
            href={getWhatsAppLink(selectedCustomer.whatsapp)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors"
          >
            <MessageSquare className="w-5 h-5" />
            Enviar WhatsApp
          </a>
        </div>
      )}

      {/* Lista de Clientes */}
      <div>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold text-white">CLIENTES</h3>
          <span className="text-gray-400">
            {customers.length} cliente{customers.length !== 1 ? 's' : ''} em {format(selectedMonth, 'MMMM', { locale: ptBR })}
          </span>
        </div>
        
        <div className="space-y-2">
          {customers.map(customer => (
            <div
              key={customer.id}
              className="bg-gray-800 p-3 rounded-lg flex justify-between items-center"
            >
              <div className="flex-1">
                <p className="text-white font-medium">{customer.customer_name}</p>
                <div className="flex items-center gap-2">
                  <p className="text-gray-400 text-sm">
                    {customer.whatsapp.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')}
                  </p>
                  <a
                    href={getWhatsAppLink(customer.whatsapp)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-green-500 hover:text-green-400 transition-colors"
                  >
                    <MessageSquare className="w-4 h-4" />
                  </a>
                </div>
              </div>
              <Star className="w-5 h-5 text-yellow-500" />
            </div>
          ))}
          {customers.length === 0 && (
            <p className="text-gray-400 text-center py-4">
              Nenhum cliente cadastrado em {format(selectedMonth, 'MMMM', { locale: ptBR })}.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default LoyalCustomers; 