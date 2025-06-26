import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { CheckCircle } from 'lucide-react';

const TestarGratis = () => {
  const [formData, setFormData] = useState({
    nome: '',
    estabelecimento: '',
    whatsapp: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    
    // Formatação especial para o campo WhatsApp
    if (name === 'whatsapp') {
      // Remove tudo que não é número
      const numbersOnly = value.replace(/\D/g, '');
      // Formata o número como (XX) XXXXX-XXXX
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

  const isFormValid = () => {
    const whatsappNumbers = formData.whatsapp.replace(/\D/g, '');
    return formData.nome.trim() !== '' && 
           formData.estabelecimento.trim() !== '' && 
           whatsappNumbers.length === 11;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid()) return;

    setIsSubmitting(true);
    try {
      // Remove formatação do WhatsApp antes de enviar
      const whatsappNumbers = formData.whatsapp.replace(/\D/g, '');
      
      const { error } = await supabase
        .from('free_trials')
        .insert([{
          nome: formData.nome.trim(),
          estabelecimento: formData.estabelecimento.trim(),
          whatsapp: whatsappNumbers
        }]);

      if (error) {
        console.error('Erro ao enviar:', error);
        throw error;
      }

      setIsSuccess(true);
    } catch (error) {
      console.error('Erro detalhado:', error);
      alert('Erro ao enviar solicitação. Por favor, tente novamente em alguns instantes.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-black text-white py-20">
        <div className="max-w-md mx-auto px-4">
          <div className="bg-[#1a1b1c] p-8 rounded-2xl text-center">
            <div className="flex justify-center mb-6">
              <CheckCircle className="w-16 h-16 text-green-500" />
            </div>
            
            <h2 className="text-2xl font-bold mb-4">
              Solicitação enviada com sucesso!
            </h2>
            
            <p className="text-gray-300 mb-8">
              Nosso representante irá te enviar logo logo um WhatsApp com seu login e senha temporário
            </p>

            <a
              href="https://wa.link/o8ce5l"
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full py-4 px-6 bg-green-600 hover:bg-green-700 rounded-xl text-white font-medium transition-colors text-center"
            >
              Pedir acesso agora
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white py-20">
      <div className="max-w-md mx-auto px-4">
        <h1 className="text-3xl font-bold text-center mb-8">
          Teste Grátis AgendeiFácil
        </h1>
        
        <div className="bg-[#1a1b1c] p-6 rounded-2xl">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium mb-2">
                Seu Nome
              </label>
              <input
                type="text"
                name="nome"
                value={formData.nome}
                onChange={handleChange}
                className="w-full px-4 py-2 rounded-lg bg-gray-800 border border-gray-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-white"
                placeholder="Digite seu nome completo"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Nome do Estabelecimento
              </label>
              <input
                type="text"
                name="estabelecimento"
                value={formData.estabelecimento}
                onChange={handleChange}
                className="w-full px-4 py-2 rounded-lg bg-gray-800 border border-gray-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-white"
                placeholder="Nome do seu estabelecimento"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                WhatsApp
              </label>
              <input
                type="tel"
                name="whatsapp"
                value={formData.whatsapp}
                onChange={handleChange}
                className="w-full px-4 py-2 rounded-lg bg-gray-800 border border-gray-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-white"
                placeholder="(00) 00000-0000"
                required
                maxLength={15}
              />
              <p className="text-sm text-gray-400 mt-1">
                Formato: (00) 00000-0000
              </p>
            </div>

            <button
              type="submit"
              disabled={!isFormValid() || isSubmitting}
              className={`w-full py-3 px-6 rounded-lg text-white font-medium transition-colors ${
                isFormValid() && !isSubmitting
                  ? 'bg-green-600 hover:bg-green-700'
                  : 'bg-gray-600 cursor-not-allowed'
              }`}
            >
              {isSubmitting ? 'Enviando...' : 'TESTAR GRÁTIS'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default TestarGratis; 