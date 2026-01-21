import { format } from 'date-fns';
import { ArrowLeft, Calendar, Eye, EyeOff, MapPin } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { BusinessHoursSelector } from '../components/BusinessHoursSelector';
import ReadMore from '../components/ReadMore';
import { useToast } from '../components/ui/Toaster';
import { useAuth } from '../context/AuthContext';
import { createAppointment, signIn, supabase } from '../lib/supabase';
import type { Establishment } from '../types/supabase';

const EstablishmentDirectBooking: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { user, userRole, isLoading: authLoading } = useAuth();
  const location = useLocation();
  const { toast } = useToast();

  // Estados do estabelecimento
  const [establishment, setEstablishment] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ✅ Serviços por categorias (dropdown). Se existir, usamos isso no booking; senão, caímos no legado services_with_prices.
  const [categoriasDeServicos, setCategoriasDeServicos] = useState<any[]>([]);

  // Estados do agendamento  
  const [selectedService, setSelectedService] = useState<any>(null);
  const [selectedProfessional, setSelectedProfessional] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [clientName, setClientName] = useState('');
  const [existingAppointments, setExistingAppointments] = useState<any[]>([]);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('pagar_local'); // Estado para a forma de pagamento
  const [pixProofFile, setPixProofFile] = useState<File | null>(null); // Estado para o arquivo de comprovante PIX
  const [pixProofPreview, setPixProofPreview] = useState<string | null>(null); // Pré-visualização do comprovante
  const [showPixInfo, setShowPixInfo] = useState(false); // Mostrar informações do PIX
  // Novo estado para controlar a visibilidade do formulário de agendamento
  const [showBookingForm, setShowBookingForm] = useState(false);

  // Estados de autenticação
  const [showAuth, setShowAuth] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [authFormLoading, setAuthFormLoading] = useState(false);
  const [authData, setAuthData] = useState({
    email: '',
    password: ''
  });

  // Extrair código do slug (assume que o código são os últimos 4 dígitos)
  const extractCodeFromSlug = (slug: string): string => {
    const match = slug.match(/(\d{4})$/);
    return match ? match[1] : '';
  };

  // Função para buscar agendamentos existentes (funciona para usuários logados e anônimos)
  const fetchExistingAppointments = async (establishmentId: string, date: string, professional: string) => {
    if (!establishmentId || !date || !professional) {
      console.log('⚠️ fetchExistingAppointments: Parâmetros insuficientes, limpando agendamentos');
      console.log('📍 Parâmetros recebidos:', { establishmentId, date, professional });
      setExistingAppointments([]);
      return;
    }

    try {
      console.log('🔍 INICIANDO BUSCA DE AGENDAMENTOS - EstablishmentDirectBooking');
      console.log('📍 Parâmetros da busca:', { establishmentId, date, professional });

      // Buscar apenas dados necessários para verificar disponibilidade (sem dados pessoais)
      const { data, error } = await supabase
        .from('appointments')
        .select('appointment_date, appointment_time, duration, status, professional')
        .eq('establishment_id', establishmentId)
        .eq('appointment_date', date)
        .eq('professional', professional)
        .neq('status', 'cancelled');

      if (error) {
        console.log('❌ ERRO na consulta de agendamentos:', error);
        console.log('📝 Detalhes do erro:', {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint
        });
        // Em caso de erro, assumir que não há agendamentos (mais seguro)
        setExistingAppointments([]);
        return;
      }

      console.log('✅ CONSULTA REALIZADA COM SUCESSO');
      console.log('📊 Agendamentos encontrados:', data?.length || 0);

      if (data && data.length > 0) {
        console.log('📋 DETALHES DOS AGENDAMENTOS ENCONTRADOS:');
        data.forEach((apt, index) => {
          console.log(`   ${index + 1}: Data=${apt.appointment_date}, Hora=${apt.appointment_time}, Duração=${apt.duration}min, Status=${apt.status}, Profissional=${apt.professional}`);
        });
      } else {
        console.log('✅ NENHUM AGENDAMENTO ENCONTRADO - Todos os horários deveriam estar disponíveis!');
      }

      setExistingAppointments(data || []);

      // Log adicional para confirmar o que foi setado no estado
      console.log('📝 Estado existingAppointments atualizado com:', data?.length || 0, 'agendamentos');

    } catch (error) {
      console.log('💥 ERRO CATCH ao carregar agendamentos:', error);
      console.log('📝 Tipo do erro:', typeof error);
      console.log('📝 Erro completo:', JSON.stringify(error, null, 2));
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
          custom_photo_1_url,
          custom_photo_2_url,
          custom_photo_3_url,
          review_link,
          social_media_link,
          pix_payment_link,
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

        const establishmentDataFetched: Establishment | null = data as Establishment | null; // Forçar tipagem

        if (error) {
          console.error('❌ Erro detalhado:', error);
          setError('Estabelecimento não encontrado');
          return;
        }

        if (!establishmentDataFetched) {
          setError('Estabelecimento não encontrado');
          return;
        }

        // Garantir que os campos obrigatórios existam e aplicar valores padrão
        const establishmentData: Establishment = {
          ...establishmentDataFetched, // Usar o objeto com tipagem forçada
          name: establishmentDataFetched.name || 'Estabelecimento',
          description: establishmentDataFetched.description || 'Descrição não disponível',
          business_hours: establishmentDataFetched.business_hours || {
            monday: { enabled: true, open1: '09:00', close1: '18:00', open2: null, close2: null },
            tuesday: { enabled: true, open1: '09:00', close1: '18:00', open2: null, close2: null },
            wednesday: { enabled: true, open1: '09:00', close1: '18:00', open2: null, close2: null },
            thursday: { enabled: true, open1: '09:00', close1: '18:00', open2: null, close2: null },
            friday: { enabled: true, open1: '09:00', close1: '18:00', open2: null, close2: null },
            saturday: { enabled: false, open1: '09:00', close1: '12:00', open2: null, close2: null },
            sunday: { enabled: false, open1: '09:00', close1: '12:00', open2: null, close2: null }
          },
          professionals: establishmentDataFetched.professionals || [
            {
              id: '1',
              name: 'Profissional 1',
              specialties: ['Corte', 'Barba']
            }
          ],
          services_with_prices: establishmentDataFetched.services_with_prices || [
            {
              id: '1',
              name: 'Corte',
              price: 25.00,
              duration: 30
            },
            {
              id: '2',
              name: 'Barba',
              price: 15.00,
              duration: 20
            }
          ],
          pix_key_type: establishmentDataFetched.pix_key_type || undefined,
          pix_key: establishmentDataFetched.pix_key || undefined,
          review_link: establishmentDataFetched.review_link || undefined,
          social_media_link: establishmentDataFetched.social_media_link || undefined,
          pix_payment_link: establishmentDataFetched.pix_payment_link || undefined,
          // Certifique-se de que todos os campos obrigatórios da interface Establishment estão presentes
          id: establishmentDataFetched.id,
          code: establishmentDataFetched.code,
          owner_id: establishmentDataFetched.owner_id,
          created_at: establishmentDataFetched.created_at,
          updated_at: establishmentDataFetched.updated_at,
        };

        setEstablishment(establishmentData);
        setLoading(false);
      } catch (error) {
        console.error('❌ Erro ao carregar estabelecimento:', error);
        setError('Erro ao carregar estabelecimento');
        setLoading(false);
      }
    };

    loadEstablishment();
  }, [slug]);

  // ✅ Buscar categorias/subcategorias para refletir serviços criados via "Meus serviços" (dropdown) no dashboard
  useEffect(() => {
    const fetchCategorias = async () => {
      if (!establishment?.id) return;

      try {
        const { data: categories, error: categoriesError } = await supabase
          .from('service_categories')
          .select('*')
          .eq('establishment_id', establishment.id)
          .eq('is_active', true)
          .order('display_order', { ascending: true });

        if (categoriesError) {
          console.error('❌ DirectBooking - Erro ao buscar categorias:', categoriesError);
          setCategoriasDeServicos([]);
          return;
        }

        const { data: subcategories, error: subcategoriesError } = await supabase
          .from('service_subcategories')
          .select(
            `
            *,
            service_categories!inner (
              establishment_id
            )
          `
          )
          .eq('is_active', true)
          .eq('service_categories.establishment_id', establishment.id)
          .order('category_id', { ascending: true })
          .order('display_order', { ascending: true });

        if (subcategoriesError) {
          console.error('❌ DirectBooking - Erro ao buscar subcategorias:', subcategoriesError);
          setCategoriasDeServicos([]);
          return;
        }

        const categoriesWithSubcategories = (categories || []).map((category: any) => ({
          ...category,
          subcategories: (subcategories || []).filter((sub: any) => sub.category_id === category.id),
        }));

        setCategoriasDeServicos(categoriesWithSubcategories);
        console.log('✅ DirectBooking - Categorias/Subcategorias carregadas:', {
          categorias: categoriesWithSubcategories.length,
          subcategorias: (subcategories || []).length,
        });
      } catch (err) {
        console.error('💥 DirectBooking - Erro ao buscar categorias/subcategorias:', err);
        setCategoriasDeServicos([]);
      }
    };

    fetchCategorias();
  }, [establishment?.id]);

  // ✅ Fonte única de serviços para seleção: categorias (se houver) > services_with_prices (fallback)
  const servicosDisponiveis = useMemo(() => {
    const temCategoriasComServicos = categoriasDeServicos.some(
      (c: any) => Array.isArray(c?.subcategories) && c.subcategories.length > 0
    );

    if (temCategoriasComServicos) {
      return categoriasDeServicos.flatMap((c: any) =>
        (c.subcategories || []).map((sub: any) => ({
          id: sub.id,
          name: sub.name,
          price: Number(sub.price),
          duration: Number(sub.duration || 30),
          _categoria: c.name,
        }))
      );
    }

    return Array.isArray(establishment?.services_with_prices) ? establishment.services_with_prices : [];
  }, [categoriasDeServicos, establishment?.services_with_prices]);

  // Se a lista mudou e o serviço selecionado não existe mais, limpar seleção
  useEffect(() => {
    if (!selectedService) return;
    const selectedKey = String(selectedService?.id ?? selectedService?.name ?? '');
    const stillExists = servicosDisponiveis.some((s: any) => String(s?.id ?? s?.name ?? '') === selectedKey);
    if (!stillExists) {
      setSelectedService(null);
      setSelectedTime('');
    }
  }, [servicosDisponiveis, selectedService]);

  // Buscar agendamentos quando data e profissional mudarem (funciona para todos)
  useEffect(() => {
    if (establishment && selectedDate && selectedProfessional) {
      fetchExistingAppointments(establishment.id, selectedDate, selectedProfessional);
    } else {
      // Se não há dados suficientes, limpar agendamentos
      setExistingAppointments([]);
    }
  }, [establishment, selectedDate, selectedProfessional]);

  // Handle PIX info visibility
  const handlePaymentMethodChange = (method: string) => {
    setPaymentMethod(method);
    setShowPixInfo(method === 'pix_now');
  };

  // Handle PIX proof file change
  const handlePixProofChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPixProofFile(file);
      setPixProofPreview(URL.createObjectURL(file));
    }
  };

  // Handle PIX key copy
  const handleCopyPix = () => {
    if (establishment?.pix_key) {
      navigator.clipboard.writeText(establishment.pix_key);
      toast.success('Chave PIX copiada!');
    }
  };

  // Handle autenticação
  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthFormLoading(true);

    try {
      const { data, error } = await signIn(authData.email, authData.password);
      if (error) throw error;

      setShowAuth(false);
      // Recarregar a página para atualizar o estado de autenticação
      window.location.reload();
    } catch (error: any) {
      console.error('Erro no login:', error);
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

    if (!selectedService || !selectedProfessional || !selectedDate || !selectedTime || !clientName.trim() || !paymentMethod) {
      alert('Por favor, preencha todos os campos');
      return;
    }

    if (paymentMethod === 'pix_now' && !pixProofFile) {
      alert('Por favor, envie o comprovante do PIX');
      return;
    }

    setBookingLoading(true);

    try {
      let pixProofUrl = '';

      if (paymentMethod === 'pix_now' && pixProofFile) {
        // Upload do comprovante
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('pix_proofs')
          .upload(`${Date.now()}_${pixProofFile.name}`, pixProofFile);

        if (uploadError) throw uploadError;

        // Gerar URL pública
        const { data: { publicUrl } } = supabase.storage
          .from('pix_proofs')
          .getPublicUrl(uploadData.path);

        pixProofUrl = publicUrl;
      }

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
        duration: selectedService.duration,
        payment_method: paymentMethod === 'pix_now' ? 'pix' : 'pagar_local',
        pix_proof_url: pixProofUrl,
        pix_payment_status: paymentMethod === 'pix_now' ? 'confirmado' : 'confirmado'
      };

      const { data, error } = await createAppointment(appointmentData);

      if (error) throw error;

      alert('Agendamento realizado com sucesso!');
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
              <p className="text-gray-600">
                <ReadMore
                  text={establishment?.description || 'Descrição não disponível'}
                  maxLength={60}
                  className="text-gray-600"
                />
              </p>
              <p className="text-sm text-gray-500">Código: {extractCodeFromSlug(slug || '')}</p>

              {/* Botões de Ação Principal (visíveis antes de agendar) */}
              {!showBookingForm && (
                <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <button
                    onClick={() => setShowBookingForm(true)}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-md text-sm uppercase tracking-wide transition-colors duration-200"
                  >
                    AGENDAR
                  </button>
                  <a
                    href={establishment?.review_link || '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`flex items-center justify-center text-center font-bold py-3 px-4 rounded-md text-sm uppercase tracking-wide transition-colors duration-200 ${establishment?.review_link ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-gray-800 text-gray-500 cursor-not-allowed opacity-50'}`}
                  >
                    AVALIE A GENTE
                  </a>
                  <a
                    href={establishment?.social_media_link || '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`flex items-center justify-center text-center font-bold py-3 px-4 rounded-md text-sm uppercase tracking-wide transition-colors duration-200 ${establishment?.social_media_link ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-gray-800 text-gray-500 cursor-not-allowed opacity-50'}`}
                  >
                    NOSSAS REDES
                  </a>
                  <a
                    href={establishment?.pix_payment_link || '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`flex items-center justify-center text-center font-bold py-3 px-4 rounded-md text-sm uppercase tracking-wide transition-colors duration-200 ${establishment?.pix_payment_link ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-gray-800 text-gray-500 cursor-not-allowed opacity-50'}`}
                  >
                    PAGAR PIX
                  </a>
                </div>
              )}
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

          {/* Fotos customizadas */}
          {(establishment?.custom_photo_1_url || establishment?.custom_photo_2_url || establishment?.custom_photo_3_url) && (
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {establishment.custom_photo_1_url && (
                <img
                  src={establishment.custom_photo_1_url}
                  alt="Foto 1"
                  className="w-full h-48 object-cover rounded-lg"
                />
              )}
              {establishment.custom_photo_2_url && (
                <img
                  src={establishment.custom_photo_2_url}
                  alt="Foto 2"
                  className="w-full h-48 object-cover rounded-lg"
                />
              )}
              {establishment.custom_photo_3_url && (
                <img
                  src={establishment.custom_photo_3_url}
                  alt="Foto 3"
                  className="w-full h-48 object-cover rounded-lg"
                />
              )}
            </div>
          )}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8" style={{ backgroundColor: '#ffffff', color: '#111827' }}>
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
                            {hours.enabled === true ? (
                              // Verificar se tem intervalo (open2 e close2 diferentes de open1 e close1)
                              hours.open2 && hours.close2 && (hours.open2 !== hours.close1) ?
                                `${hours.open1 || ''} - ${hours.close1 || ''} e ${hours.open2 || ''} - ${hours.close2 || ''}` :
                                `${hours.open1 || ''} - ${hours.close2 || ''}`
                            ) : 'Fechado'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Serviços */}
            {Array.isArray(servicosDisponiveis) && servicosDisponiveis.length > 0 && (
              <div className="mt-6">
                <h3 className="font-semibold mb-3">Serviços:</h3>
                <div className="space-y-2">
                  {servicosDisponiveis.map((service: any, index: number) => {
                    // Verificar se service é um objeto válido
                    if (!service || typeof service !== 'object') return null;

                    const formattedPrice = service.price ? service.price.toFixed(2).replace('.', ',') : '0,00';
                    const isSelected = selectedService?.id === service.id;

                    return (
                      <div key={index} className="flex justify-between items-center p-3 bg-gray-50 rounded">
                        <span>
                          {service.name || 'Serviço'}
                          {service._categoria ? (
                            <span className="ml-2 text-xs text-gray-500">({service._categoria})</span>
                          ) : null}
                        </span>
                        <span className="font-semibold text-blue-600">R$ {formattedPrice}</span>
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
                    Você pode ver todas as informações do estabelecimento, horários e serviços.<br />
                    Para fazer um agendamento, faça login ou crie sua conta gratuita.
                  </p>
                </div>
                <div className="space-y-3">
                  <button
                    onClick={() => { setShowAuth(true); }}
                    className="w-full bg-blue-600 text-white py-3 px-4 rounded-md hover:bg-blue-700 font-medium"
                  >
                    Fazer Login
                  </button>
                  <Link
                    to={`/register?role=client`}
                    state={{ from: location.pathname }}
                    className="w-full border border-blue-600 text-blue-600 py-3 px-4 rounded-md hover:bg-blue-50 font-medium block text-center"
                  >
                    Criar Conta Gratuita
                  </Link>
                </div>
                <p className="text-xs text-gray-500 mt-4">
                  Criando uma conta você pode agendar em qualquer estabelecimento do AgendaFácil
                </p>
              </div>
            ) : (
              // Exibe o formulário de agendamento apenas se showBookingForm for true
              showBookingForm && (
                <form onSubmit={handleBooking} className="space-y-4">
                  {/* Conteúdo do formulário de agendamento (mantido o mesmo) */}
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
                    <div className="grid grid-cols-1 gap-2">
                      {servicosDisponiveis?.map((service: any) => {
                        if (!service || typeof service !== 'object') return null;
                        const formattedPrice = service.price ? service.price.toFixed(2).replace('.', ',') : '0,00';
                        const isSelected = selectedService?.id === service.id;

                        return (
                          <button
                            key={service.id ?? `${service.name}-${formattedPrice}-${service.duration ?? 0}`}
                            type="button"
                            onClick={() => {
                              setSelectedService(service);
                              setSelectedTime('');
                            }}
                            className={`w-full p-4 rounded-lg ${isSelected ? 'bg-[#242628] text-white' : 'bg-gray-50 text-gray-900'
                              }`}
                          >
                            <div className="flex flex-col items-start gap-1">
                              <span className="text-base font-medium">{service.name}</span>
                              {service._categoria && (
                                <span className="text-xs opacity-70">Categoria: {service._categoria}</span>
                              )}
                              <span className="text-sm opacity-80">R$ {formattedPrice}</span>
                              <span className="text-sm opacity-80">{service.duration}min</span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
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
                        professionalWorkHours={selectedProfessional ? establishment?.professionals?.find((p: any) => p.id === selectedProfessional)?.work_hours || null : null}
                      />
                    </div>
                  )}

                  {/* Resumo do Agendamento */}
                  {selectedTime && selectedService && selectedProfessional && clientName && (
                    <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                      <h3 className="text-lg font-medium text-gray-900 mb-3">Resumo do Agendamento</h3>
                      <div className="space-y-2 text-sm text-gray-600">
                        <p><strong>Cliente:</strong> {clientName}</p>
                        <p><strong>Serviço:</strong> {selectedService.name}</p>
                        <p><strong>Valor:</strong> R$ {selectedService.price.toFixed(2).replace('.', ',')}</p>
                        <p><strong>Profissional:</strong> {establishment?.professionals?.find((p: any) => p.id === selectedProfessional)?.name}</p>
                        <p><strong>Data:</strong> {new Date(selectedDate).toLocaleDateString('pt-BR')}</p>
                        <p><strong>Horário:</strong> {selectedTime}</p>
                        <p><strong>Duração:</strong> {selectedService.duration} minutos</p>
                      </div>

                      {/* Opções de Pagamento PIX */}
                      <div className="mt-6">
                        <h4 className="text-md font-medium text-gray-900 mb-3">Forma de Pagamento</h4>
                        <div className="space-y-3">
                          <button
                            type="button"
                            onClick={() => handlePaymentMethodChange('pix_now')}
                            className={`w-full p-3 rounded-lg border text-left transition-colors ${paymentMethod === 'pix_now'
                              ? 'bg-green-50 border-green-500 text-green-700'
                              : 'border-gray-300 hover:bg-gray-50'
                              }`}
                          >
                            <div className="flex items-center">
                              <div className={`w-4 h-4 rounded-full border-2 mr-3 ${paymentMethod === 'pix_now'
                                ? 'border-green-500 bg-green-500'
                                : 'border-gray-400'
                                }`} />
                              <span>Pagar agora via PIX</span>
                            </div>
                          </button>

                          <button
                            type="button"
                            onClick={() => handlePaymentMethodChange('pix_local')}
                            className={`w-full p-3 rounded-lg border text-left transition-colors ${paymentMethod === 'pix_local'
                              ? 'bg-orange-50 border-orange-500 text-orange-700'
                              : 'border-gray-300 hover:bg-gray-50'
                              }`}
                          >
                            <div className="flex items-center">
                              <div className={`w-4 h-4 rounded-full border-2 mr-3 ${paymentMethod === 'pix_local'
                                ? 'border-orange-500 bg-orange-500'
                                : 'border-gray-400'
                                }`} />
                              <span>Pagar no local</span>
                            </div>
                          </button>
                        </div>
                      </div>

                      {/* Informações do PIX e Upload do Comprovante */}
                      {showPixInfo && (
                        <div className="mt-4 p-4 bg-green-50 rounded-lg border border-green-200">
                          {establishment?.pix_key ? (
                            <>
                              <h5 className="font-medium text-green-800 mb-2">Dados para Pagamento</h5>
                              <p className="text-sm text-green-700 mb-4">
                                <strong>Tipo de Chave:</strong> {establishment.pix_key_type}<br />
                                <strong>Chave PIX:</strong> {establishment.pix_key}
                              </p>
                              <button
                                type="button"
                                onClick={handleCopyPix}
                                className="mb-4 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                              >
                                Copiar Chave PIX
                              </button>
                              <div>
                                <label className="block text-sm font-medium text-green-800 mb-2">
                                  Enviar Comprovante
                                </label>
                                <input
                                  type="file"
                                  accept="image/*"
                                  onChange={handlePixProofChange}
                                  className="block w-full text-sm text-green-700
                                    file:mr-4 file:py-2 file:px-4
                                    file:rounded-lg file:border-0
                                    file:text-sm file:font-medium
                                    file:bg-green-600 file:text-white
                                    hover:file:bg-green-700
                                    file:cursor-pointer cursor-pointer"
                                />
                                {pixProofPreview && (
                                  <div className="mt-2">
                                    <img
                                      src={pixProofPreview}
                                      alt="Comprovante"
                                      className="max-w-xs rounded-lg border border-green-200"
                                    />
                                  </div>
                                )}
                              </div>
                            </>
                          ) : (
                            <p className="text-sm text-red-600">
                              Este estabelecimento ainda não cadastrou uma chave PIX para pagamento.
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={bookingLoading || !selectedService || !selectedProfessional || !selectedTime || !clientName || !paymentMethod || (paymentMethod === 'pix_now' && !pixProofFile)}
                    className={`btn-primary w-full mt-6 ${(bookingLoading || !selectedService || !selectedProfessional || !selectedTime || !clientName || !paymentMethod || (paymentMethod === 'pix_now' && !pixProofFile))
                      && 'opacity-50 cursor-not-allowed'
                      }`}
                  >
                    {bookingLoading ? 'Agendando...' : 'Confirmar Agendamento'}
                  </button>
                </form>
              )
            )}

            {/* Botões de Ação Secundária (visíveis quando o formulário está visível) */}
            {showBookingForm && (
              <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
                <a
                  href={establishment?.review_link || '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`flex items-center justify-center text-center font-bold py-3 px-4 rounded-md text-sm uppercase tracking-wide transition-colors duration-200 ${establishment?.review_link ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-gray-800 text-gray-500 cursor-not-allowed opacity-50'}`}
                >
                  AVALIE A GENTE
                </a>
                <a
                  href={establishment?.social_media_link || '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`flex items-center justify-center text-center font-bold py-3 px-4 rounded-md text-sm uppercase tracking-wide transition-colors duration-200 ${establishment?.social_media_link ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-gray-800 text-gray-500 cursor-not-allowed opacity-50'}`}
                >
                  NOSSAS REDES
                </a>
                <a
                  href={establishment?.pix_payment_link || '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`flex items-center justify-center text-center font-bold py-3 px-4 rounded-md text-sm uppercase tracking-wide transition-colors duration-200 ${establishment?.pix_payment_link ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-gray-800 text-gray-500 cursor-not-allowed opacity-50'}`}
                >
                  PAGAR PIX
                </a>
              </div>
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
                <h2 className="text-xl font-bold">Fazer Login</h2>
                <button
                  onClick={() => setShowAuth(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ×
                </button>
              </div>

              <form onSubmit={handleAuth} className="space-y-4">
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

                <button
                  type="submit"
                  disabled={authFormLoading}
                  className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-400"
                >
                  {authFormLoading ? 'Processando...' : 'Entrar'}
                </button>

                <div className="mt-4 text-center">
                  <Link
                    to={`/register?role=client`}
                    state={{ from: location.pathname }}
                    className="text-blue-600 hover:text-blue-700 text-sm"
                    onClick={() => setShowAuth(false)}
                  >
                    Não tem conta? Criar conta
                  </Link>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EstablishmentDirectBooking;