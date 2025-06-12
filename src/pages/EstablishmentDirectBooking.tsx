import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getEstablishmentByCode, createAppointment, signIn, signUp, supabase } from '../lib/supabase';
import { Calendar, Clock, User, MapPin, Phone, Mail, Eye, EyeOff, ArrowLeft } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { BusinessHoursSelector } from '../components/BusinessHoursSelector';

const EstablishmentDirectBooking: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { user, userRole, isLoading: authLoading } = useAuth();

  // Estados do estabelecimento
  const [establishment, setEstablishment] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Estados do agendamento  
  const [selectedService, setSelectedService] = useState<any>(null);
  const [selectedProfessional, setSelectedProfessional] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [clientName, setClientName] = useState('');
  const [existingAppointments, setExistingAppointments] = useState<any[]>([]);
  const [bookingLoading, setBookingLoading] = useState(false);

  // Estados de autenticação
  const [showAuth, setShowAuth] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authData, setAuthData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    fullName: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [authFormLoading, setAuthFormLoading] = useState(false);

  // Extrair código do slug (assume que o código são os últimos 4 dígitos)
  const extractCodeFromSlug = (slug: string): string => {
    const match = slug.match(/(\d{4})$/);
    return match ? match[1] : '';
  };

  // Função para buscar agendamentos existentes (funciona para usuários logados e anônimos)
  const fetchExistingAppointments = async (establishmentId: string, date: string, professional: string) => {
    if (!establishmentId || !date || !professional) {
      setExistingAppointments([]);
      return;
    }
    
    try {
      console.log('📋 Buscando agendamentos existentes (acesso público)...');
      console.log('📍 Parâmetros:', { establishmentId, date, professional });
      
      // Buscar apenas dados necessários para verificar disponibilidade (sem dados pessoais)
      const { data, error } = await supabase
        .from('appointments')
        .select('appointment_date, appointment_time, duration, status, professional')
        .eq('establishment_id', establishmentId)
        .eq('appointment_date', date)
        .eq('professional', professional)
        .neq('status', 'cancelled');
        
      if (error) {
        console.log('⚠️ Erro ao buscar agendamentos:', error);
        // Em caso de erro, assumir que não há agendamentos (mais seguro)
        setExistingAppointments([]);
        return;
      }
      
      console.log('✅ Agendamentos existentes carregados:', data?.length || 0);
      console.log('📊 Detalhes dos agendamentos:');
      data?.forEach((apt, index) => {
        console.log(`   ${index + 1}: ${apt.appointment_time} (${apt.duration}min) - Status: ${apt.status}`);
      });
      
      setExistingAppointments(data || []);
    } catch (error) {
      console.log('⚠️ Erro catch ao carregar agendamentos:', error);
      setExistingAppointments([]);
    }
  };

  // Função mais robusta para buscar estabelecimento (funciona sem login)
  const loadEstablishmentDirect = async (code: string) => {
    try {
      console.log('🔍 Tentando buscar estabelecimento diretamente no Supabase...');
      console.log('📊 Código extraído:', code);
      
      // Busca direta no Supabase com acesso público
      const { data, error } = await supabase
        .from('establishments')
        .select(`
          id,
          name,
          description,
          code,
          owner_id,
          services_with_prices,
          professionals,
          business_hours,
          profile_image_url,
          affiliate_link,
          created_at,
          updated_at
        `)
        .eq('code', code)
        .maybeSingle(); // Usar maybeSingle() em vez de single() para evitar erro se não encontrar
      
      if (error) {
        console.log('❌ Erro na busca:', error);
        
        // Se erro for de RLS/permissão, tentar busca mais básica
        if (error.code === 'PGRST116' || error.message?.includes('406') || error.message?.includes('RLS')) {
          console.log('🔄 Tentando busca básica devido a erro de RLS...');
          
          const basicResult = await supabase
            .from('establishments')
            .select('id, name, description, code, services_with_prices, professionals, business_hours, profile_image_url')
            .eq('code', code)
            .limit(1);
          
          if (basicResult.data && basicResult.data.length > 0) {
            console.log('✅ Estabelecimento encontrado com busca básica:', basicResult.data[0]);
            return { data: basicResult.data[0], error: null };
          }
        }
        
        return { data: null, error };
      }
      
      if (!data) {
        console.log('⚠️ Estabelecimento não encontrado');
        return { data: null, error: { message: 'Estabelecimento não encontrado' } };
      }
      
      console.log('✅ Estabelecimento encontrado:', data);
      return { data, error: null };
      
    } catch (err: any) {
      console.error('💥 Erro catch loadEstablishmentDirect:', err);
      return { data: null, error: err };
    }
  };

  // Carregar estabelecimento
  useEffect(() => {
    const loadEstablishment = async () => {
      if (!slug) return;
      
      try {
        setLoading(true);
        setError(null);
        
        const code = extractCodeFromSlug(slug);
        
        if (!code) {
          setError('Código do estabelecimento inválido');
          return;
        }
        
        if (code.length !== 4) {
          setError('Código deve ter 4 dígitos');
          return;
        }

        console.log('🚀 Iniciando busca do estabelecimento...');
        
        const { data, error } = await loadEstablishmentDirect(code);
        
        if (error) {
          console.error('❌ Erro detalhado:', error);
          
          // Mensagens de erro mais amigáveis
          if (error.message?.includes('406') || error.code === 'PGRST301') {
            setError('Erro de conectividade com o servidor. Tente novamente em alguns segundos.');
          } else if (error.message?.includes('not found') || error.code === 'PGRST116') {
            setError('Estabelecimento não encontrado. Verifique se o link está correto.');
          } else if (error.message?.includes('RLS') || error.message?.includes('permission')) {
            setError('Erro de permissão. Recarregue a página ou tente novamente.');
          } else {
            setError('Estabelecimento não encontrado. Verifique o link e tente novamente.');
          }
          return;
        }
        
        if (!data) {
          setError('Estabelecimento não encontrado');
          return;
        }
        
        console.log('✅ Estabelecimento carregado com sucesso!');
        console.log('📋 Dados:', JSON.stringify(data, null, 2));
        setEstablishment(data);
        
        // Pré-selecionar primeiro serviço e profissional se disponível
        if (data.services_with_prices && data.services_with_prices.length > 0) {
          setSelectedService(data.services_with_prices[0]);
        }
        if (data.professionals && data.professionals.length > 0) {
          const firstProf = data.professionals[0];
          setSelectedProfessional(typeof firstProf === 'object' ? firstProf.id : firstProf);
        }
        
      } catch (err: any) {
        console.error('💥 Erro catch loadEstablishment:', err);
        setError('Erro inesperado. Tente recarregar a página.');
      } finally {
        setLoading(false);
      }
    };

    loadEstablishment();
  }, [slug]);

  // Buscar agendamentos quando data e profissional mudarem (funciona para todos)
  useEffect(() => {
    if (establishment && selectedDate && selectedProfessional) {
      fetchExistingAppointments(establishment.id, selectedDate, selectedProfessional);
    } else {
      // Se não há dados suficientes, limpar agendamentos
      setExistingAppointments([]);
    }
  }, [establishment, selectedDate, selectedProfessional]);



  // Handle autenticação
  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthFormLoading(true);
    
    try {
      if (authMode === 'login') {
        const { data, error } = await signIn(authData.email, authData.password);
        if (error) throw error;
        
        setShowAuth(false);
        // Aguardar um pouco para o contexto atualizar
        setTimeout(() => {
          window.location.reload();
        }, 1000);
        
      } else {
        // Validações de registro
        if (authData.password !== authData.confirmPassword) {
          alert('Senhas não coincidem');
          return;
        }
        
        if (authData.password.length < 6) {
          alert('Senha deve ter pelo menos 6 caracteres');
          return;
        }
        
        const { data, error } = await signUp(
          authData.email, 
          authData.password, 
          'client',
          { full_name: authData.fullName }
        );
        
        if (error) throw error;
        
        alert('Conta criada com sucesso! Agora faça login.');
        setAuthMode('login');
        setAuthData(prev => ({ ...prev, password: '', confirmPassword: '', fullName: '' }));
      }
      
    } catch (error: any) {
      console.error('Erro na autenticação:', error);
      alert(`Erro: ${error.message}`);
    } finally {
      setAuthFormLoading(false);
    }
  };

  // Handle agendamento
  const handleBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      setShowAuth(true);
      return;
    }
    
    if (!selectedService || !selectedProfessional || !selectedDate || !selectedTime || !clientName.trim()) {
      alert('Por favor, preencha todos os campos');
      return;
    }
    
    setBookingLoading(true);
    
    try {
      const appointmentData = {
        client_id: user.id,
        establishment_id: establishment.id,
        service: selectedService.name,
        professional: selectedProfessional,
        appointment_date: selectedDate,
        appointment_time: selectedTime,
        status: 'pending',
        client_name: clientName.trim(),
        price: selectedService.price,
        duration: selectedService.duration
      };
      
      console.log('Criando agendamento:', appointmentData);
      const { data, error } = await createAppointment(appointmentData);
      
      if (error) throw error;
      
      alert('Agendamento realizado com sucesso!');
      // Redirecionar para dashboard do cliente
      navigate('/dashboard/client');
      
    } catch (error: any) {
      console.error('Erro ao criar agendamento:', error);
      alert(`Erro: ${error.message}`);
    } finally {
      setBookingLoading(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-white text-gray-900 flex items-center justify-center" style={{ backgroundColor: '#ffffff', color: '#111827' }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Carregando estabelecimento...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-white text-gray-900 flex items-center justify-center" style={{ backgroundColor: '#ffffff', color: '#111827' }}>
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Erro</h1>
          <p className="text-gray-600 mb-4">{error}</p>
          <div className="space-y-2">
            <button
              onClick={() => window.location.reload()}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 mr-2"
            >
              Tentar Novamente
            </button>
            <button
              onClick={() => navigate('/')}
              className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700"
            >
              Voltar ao Início
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Página principal
  return (
    <div className="min-h-screen bg-white text-gray-900" style={{ backgroundColor: '#ffffff', color: '#111827' }}>
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <button
            onClick={() => navigate('/')}
            className="flex items-center text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft size={20} className="mr-2" />
            Voltar
          </button>
          
          <div className="flex items-center space-x-4">
            {establishment?.profile_image_url && (
              <img
                src={establishment.profile_image_url}
                alt={establishment.name}
                className="w-16 h-16 rounded-full object-cover"
              />
            )}
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{establishment?.name || 'Estabelecimento'}</h1>
              <p className="text-gray-600">{establishment?.description || 'Descrição não disponível'}</p>
              <p className="text-sm text-gray-500">Código: {extractCodeFromSlug(slug || '')}</p>
            </div>
          </div>
          
          {/* Botão Premium se houver link afiliado */}
          {establishment?.affiliate_link && (
            <div className="mt-4">
              <button
                onClick={() => window.open(establishment.affiliate_link, '_blank')}
                className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-6 rounded-md text-sm uppercase tracking-wide transition-colors duration-200"
              >
                SER PREMIUM AQUI
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8" style={{ backgroundColor: '#ffffff' }}>
        <div className="grid md:grid-cols-2 gap-8">
          {/* Informações do Estabelecimento */}
          <div className="bg-white rounded-lg shadow-md p-6 text-gray-900" style={{ backgroundColor: '#ffffff', color: '#111827' }}>
            <h2 className="text-xl font-bold mb-4">Informações</h2>
            
            <div className="space-y-3">
              <div className="flex items-center text-gray-600">
                <MapPin size={18} className="mr-3" />
                <span>Endereço disponível no agendamento</span>
              </div>
              
              {establishment?.business_hours && typeof establishment.business_hours === 'object' && (
                <div>
                  <h3 className="font-semibold mb-2">Horários de Funcionamento:</h3>
                  <div className="text-sm text-gray-600 space-y-1">
                    {Object.entries(establishment.business_hours).map(([day, hours]: [string, any]) => {
                      // Verificar se hours é um objeto válido
                      if (!hours || typeof hours !== 'object') return null;
                      
                      return (
                        <div key={day} className="flex justify-between">
                          <span className="capitalize">
                            {day === 'monday' ? 'Segunda' :
                             day === 'tuesday' ? 'Terça' :
                             day === 'wednesday' ? 'Quarta' :
                             day === 'thursday' ? 'Quinta' :
                             day === 'friday' ? 'Sexta' :
                             day === 'saturday' ? 'Sábado' : 'Domingo'}:
                          </span>
                          <span>
                            {hours.enabled === true ? `${hours.open || ''} - ${hours.close || ''}` : 'Fechado'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Serviços */}
            {establishment?.services_with_prices && Array.isArray(establishment.services_with_prices) && establishment.services_with_prices.length > 0 && (
              <div className="mt-6">
                <h3 className="font-semibold mb-3">Serviços:</h3>
                <div className="space-y-2">
                  {establishment.services_with_prices.map((service: any, index: number) => {
                    // Verificar se service é um objeto válido
                    if (!service || typeof service !== 'object') return null;
                    
                    return (
                      <div key={index} className="flex justify-between items-center p-3 bg-gray-50 rounded">
                        <span>{service.name || 'Serviço'}</span>
                        <span className="font-semibold text-blue-600">R$ {service.price || '0,00'}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Formulário de Agendamento */}
          <div className="bg-white rounded-lg shadow-md p-6 text-gray-900" style={{ backgroundColor: '#ffffff', color: '#111827' }}>
            <h2 className="text-xl font-bold mb-4">Fazer Agendamento</h2>
            
            {!user ? (
              <div className="text-center py-8">
                <div className="mb-6">
                  <Calendar className="h-12 w-12 mx-auto mb-3 text-blue-600" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Pronto para agendar?</h3>
                  <p className="text-gray-600 mb-4">
                    Você pode ver todas as informações do estabelecimento, horários e serviços.<br/>
                    Para fazer um agendamento, faça login ou crie sua conta gratuita.
                  </p>
                </div>
                <div className="space-y-3">
                  <button
                    onClick={() => { setAuthMode('login'); setShowAuth(true); }}
                    className="w-full bg-blue-600 text-white py-3 px-4 rounded-md hover:bg-blue-700 font-medium"
                  >
                    Fazer Login
                  </button>
                  <button
                    onClick={() => { setAuthMode('register'); setShowAuth(true); }}
                    className="w-full border border-blue-600 text-blue-600 py-3 px-4 rounded-md hover:bg-blue-50 font-medium"
                  >
                    Criar Conta Gratuita
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-4">
                  Criando uma conta você pode agendar em qualquer estabelecimento do AgendaFácil
                </p>
              </div>
            ) : (
              <form onSubmit={handleBooking} className="space-y-4">
                {/* Nome do Cliente */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nome do Cliente
                  </label>
                  <input
                    type="text"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                    style={{ backgroundColor: '#ffffff', color: '#111827' }}
                    placeholder="Digite seu nome completo"
                    required
                  />
                </div>

                {/* Serviço */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Serviço
                  </label>
                  <select
                    value={selectedService?.id || ''}
                    onChange={e => {
                      const service = establishment?.services_with_prices.find((s: any) => s.id === e.target.value);
                      setSelectedService(service || null);
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                    style={{ backgroundColor: '#ffffff', color: '#111827' }}
                    required
                  >
                    <option value="">Selecione um serviço</option>
                    {establishment?.services_with_prices?.map((service: any) => {
                      if (!service || typeof service !== 'object') return null;
                      return (
                        <option key={service.id} value={service.id}>
                          {service.name} - R$ {service.price ? service.price.toFixed(2).replace('.', ',') : '0,00'} ({service.duration || 0}min)
                        </option>
                      );
                    })}
                  </select>
                </div>

                {/* Profissional */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Profissional
                  </label>
                  <select
                    value={selectedProfessional}
                    onChange={(e) => setSelectedProfessional(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                    style={{ backgroundColor: '#ffffff', color: '#111827' }}
                    required
                  >
                    <option value="">Selecione um profissional</option>
                    {establishment?.professionals?.map((prof: any) => (
                      <option key={prof.id} value={prof.id}>{prof.name}</option>
                    ))}
                  </select>
                </div>

                {/* Data */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Data
                  </label>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    min={format(new Date(), 'yyyy-MM-dd')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                    style={{ backgroundColor: '#ffffff', color: '#111827' }}
                    required
                  />
                </div>

                {/* Horário com BusinessHoursSelector */}
                {selectedDate && selectedService && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Horário
                    </label>
                    <BusinessHoursSelector
                      value={selectedTime}
                      onChange={setSelectedTime}
                      selectedDate={new Date(selectedDate + 'T00:00:00')}
                      businessHours={establishment?.business_hours || {}}
                      existingAppointments={existingAppointments}
                      selectedProfessional={selectedProfessional}
                      selectedServiceDuration={selectedService?.duration || 30}
                    />
                  </div>
                )}

                <button
                  type="submit"
                  disabled={bookingLoading}
                  className="w-full bg-blue-600 text-white py-3 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-400 font-medium"
                >
                  {bookingLoading ? 'Agendando...' : 'Confirmar Agendamento'}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>

      {/* Modal de Autenticação */}
      {showAuth && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full text-gray-900" style={{ backgroundColor: '#ffffff', color: '#111827' }}>
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold">
                  {authMode === 'login' ? 'Fazer Login' : 'Criar Conta'}
                </h2>
                <button
                  onClick={() => setShowAuth(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ×
                </button>
              </div>

              <form onSubmit={handleAuth} className="space-y-4">
                {authMode === 'register' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Nome Completo
                    </label>
                    <input
                      type="text"
                      value={authData.fullName}
                      onChange={(e) => setAuthData(prev => ({ ...prev, fullName: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                      style={{ backgroundColor: '#ffffff', color: '#111827' }}
                      required
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={authData.email}
                    onChange={(e) => setAuthData(prev => ({ ...prev, email: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                    style={{ backgroundColor: '#ffffff', color: '#111827' }}
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Senha
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={authData.password}
                      onChange={(e) => setAuthData(prev => ({ ...prev, password: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                      style={{ backgroundColor: '#ffffff', color: '#111827' }}
                      required
                      minLength={6}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    >
                      {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                </div>

                {authMode === 'register' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Confirmar Senha
                    </label>
                    <input
                      type="password"
                      value={authData.confirmPassword}
                      onChange={(e) => setAuthData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                      style={{ backgroundColor: '#ffffff', color: '#111827' }}
                      required
                      minLength={6}
                    />
                  </div>
                )}

                <button
                  type="submit"
                  disabled={authFormLoading}
                  className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-400"
                >
                  {authFormLoading ? 'Processando...' : (authMode === 'login' ? 'Entrar' : 'Criar Conta')}
                </button>
              </form>

              <div className="mt-4 text-center">
                <button
                  onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}
                  className="text-blue-600 hover:text-blue-700 text-sm"
                >
                  {authMode === 'login' ? 'Não tem conta? Criar conta' : 'Já tem conta? Fazer login'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EstablishmentDirectBooking;