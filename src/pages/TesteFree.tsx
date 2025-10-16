import { ArrowLeft, Building, CheckCircle, Eye, EyeOff, Lock, Mail, Phone, User } from 'lucide-react';
import React, { useState } from 'react';
import { toast } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

interface RegistrationData {
  clientName: string;
  establishmentName: string;
  email: string;
  password: string;
  whatsapp: string;
  acceptTestAccount: boolean;
}

const TesteFree = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState<RegistrationData>({
    clientName: '',
    establishmentName: '',
    email: '',
    password: '',
    whatsapp: '',
    acceptTestAccount: false
  });

  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Partial<RegistrationData>>({});

  const validateForm = (): boolean => {
    const newErrors: Partial<RegistrationData> = {};

    if (!formData.clientName.trim()) {
      newErrors.clientName = 'Nome do cliente é obrigatório';
    }

    if (!formData.establishmentName.trim()) {
      newErrors.establishmentName = 'Nome do estabelecimento é obrigatório';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'E-mail é obrigatório';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'E-mail inválido';
    }

    if (!formData.password) {
      newErrors.password = 'Senha é obrigatória';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Senha deve ter pelo menos 6 caracteres';
    }

    if (!formData.whatsapp.trim()) {
      newErrors.whatsapp = 'WhatsApp é obrigatório';
    } else {
      // Validar formato do WhatsApp (apenas números, com DDD)
      const cleanWhatsapp = formData.whatsapp.replace(/\D/g, '');
      if (cleanWhatsapp.length < 10 || cleanWhatsapp.length > 11) {
        newErrors.whatsapp = 'WhatsApp deve ter 10 ou 11 dígitos';
      }
    }

    if (!formData.acceptTestAccount) {
      newErrors.acceptTestAccount = true;
      toast.error('Você deve aceitar criar conta para teste no Agendei Fácil');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      toast.error('Por favor, corrija os erros no formulário');
      return;
    }

    setIsSubmitting(true);

    try {
      // Limpar WhatsApp (apenas números)
      const cleanWhatsapp = formData.whatsapp.replace(/\D/g, '');

      const registrationData = {
        client_name: formData.clientName.trim(),
        establishment_name: formData.establishmentName.trim(),
        email: formData.email.trim().toLowerCase(),
        password: formData.password, // SENHA EM TEXTO CLARO (sem hash)
        client_whatsapp: cleanWhatsapp,
        account_type: 'test', // Marca como conta de teste
        ip_address: '127.0.0.1', // Em produção, pegar IP real
        user_agent: navigator.userAgent
      };

      // Enviar para o Supabase
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(
        import.meta.env.VITE_SUPABASE_URL,
        import.meta.env.VITE_SUPABASE_ANON_KEY
      );

      const { error } = await supabase
        .from('registration_forms')
        .insert([registrationData]);

      if (error) {
        console.error('Erro ao enviar formulário:', error);
        throw new Error('Erro ao enviar formulário. Tente novamente.');
      }

      // Sucesso
      toast.success('Formulário de teste enviado com sucesso!');
      navigate('/registrationfree-success');

    } catch (error: any) {
      console.error('Erro:', error);
      toast.error(error.message || 'Erro ao enviar formulário');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (field: keyof RegistrationData, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));

    // Limpar erro do campo quando usuário começar a digitar
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex flex-col">
      {/* Header com botão voltar */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-md mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-800 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="text-sm font-medium">Voltar</span>
            </button>
          </div>
        </div>
      </div>

      {/* Conteúdo principal */}
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-2xl">
            {/* Header */}
            <div className="bg-gradient-to-r from-green-600 to-blue-600 rounded-t-2xl p-6 text-white">
              <div className="text-center">
                <h2 className="text-2xl font-bold">Criar Conta Teste</h2>
                <p className="text-green-100 mt-1">Agendei Fácil - Teste Grátis</p>
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {/* Nome do Cliente */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nome do Cliente
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="text"
                    value={formData.clientName}
                    onChange={(e) => handleInputChange('clientName', e.target.value)}
                    className={`w-full pl-10 pr-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-black bg-white ${errors.clientName ? 'border-red-500' : 'border-gray-300'
                      }`}
                    placeholder="Seu nome completo"
                  />
                </div>
                {errors.clientName && (
                  <p className="text-red-500 text-sm mt-1">{errors.clientName}</p>
                )}
              </div>

              {/* Nome do Estabelecimento */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nome do Estabelecimento
                </label>
                <div className="relative">
                  <Building className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="text"
                    value={formData.establishmentName}
                    onChange={(e) => handleInputChange('establishmentName', e.target.value)}
                    className={`w-full pl-10 pr-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-black bg-white ${errors.establishmentName ? 'border-red-500' : 'border-gray-300'
                      }`}
                    placeholder="Nome da sua barbearia/salão"
                  />
                </div>
                {errors.establishmentName && (
                  <p className="text-red-500 text-sm mt-1">{errors.establishmentName}</p>
                )}
              </div>

              {/* E-mail */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  E-mail
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    className={`w-full pl-10 pr-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-black bg-white ${errors.email ? 'border-red-500' : 'border-gray-300'
                      }`}
                    placeholder="seu@email.com"
                  />
                </div>
                {errors.email && (
                  <p className="text-red-500 text-sm mt-1">{errors.email}</p>
                )}
              </div>

              {/* WhatsApp */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  WhatsApp
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="tel"
                    value={formData.whatsapp}
                    onChange={(e) => {
                      // Formatar WhatsApp automaticamente
                      let value = e.target.value.replace(/\D/g, '');
                      if (value.length <= 11) {
                        value = value.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
                        if (value.length <= 14) {
                          value = value.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
                        }
                      }
                      handleInputChange('whatsapp', value);
                    }}
                    className={`w-full pl-10 pr-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-black bg-white ${errors.whatsapp ? 'border-red-500' : 'border-gray-300'
                      }`}
                    placeholder="(11) 99999-9999"
                  />
                </div>
                {errors.whatsapp && (
                  <p className="text-red-500 text-sm mt-1">{errors.whatsapp}</p>
                )}
              </div>

              {/* Senha */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Senha
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={(e) => handleInputChange('password', e.target.value)}
                    className={`w-full pl-10 pr-12 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-black bg-white ${errors.password ? 'border-red-500' : 'border-gray-300'
                      }`}
                    placeholder="Mínimo 6 caracteres"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-red-500 text-sm mt-1">{errors.password}</p>
                )}
              </div>

              {/* Checkbox aceite teste OBRIGATÓRIO */}
              <div>
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    id="acceptTestAccount"
                    checked={formData.acceptTestAccount}
                    onChange={(e) => handleInputChange('acceptTestAccount', e.target.checked)}
                    className={`mt-1 w-5 h-5 text-green-600 border-gray-300 rounded focus:ring-green-500 focus:ring-2 ${errors.acceptTestAccount ? 'border-red-500' : ''
                      }`}
                  />
                  <label
                    htmlFor="acceptTestAccount"
                    className={`text-sm text-gray-700 cursor-pointer ${errors.acceptTestAccount ? 'text-red-600' : ''
                      }`}
                  >
                    <span className="font-semibold">Aceito criar conta para teste no Agendei Fácil</span>
                    <span className="block text-xs text-gray-500 mt-1">
                      * Campo obrigatório - Esta é uma conta de teste gratuita
                    </span>
                  </label>
                </div>
                {errors.acceptTestAccount && (
                  <p className="text-red-500 text-sm mt-2">Você deve aceitar os termos para continuar</p>
                )}
              </div>

              {/* Botão de envio */}
              <div>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={`w-full py-3 px-4 rounded-lg font-semibold text-white transition-colors flex items-center justify-center gap-2 ${isSubmitting
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700'
                    }`}
                >
                  {isSubmitting ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
                      Enviando...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-5 h-5" />
                      Criar Conta Teste
                    </>
                  )}
                </button>
              </div>

              {/* Info */}
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-sm text-green-800">
                  🎉 Teste o Agendei Fácil gratuitamente e conheça o sistema mais completo do Brasil.
                </p>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TesteFree;

