import React, { useState, useEffect } from 'react';
import { format, parseISO, startOfDay, endOfDay, addDays, subDays, startOfMonth, endOfMonth, isToday, isSameMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar, Clock, User, LogOut, Scissors, Star, Copy, CheckCircle, Image as ImageIcon, Plus, Trash2, DollarSign, Settings, ChevronLeft, ChevronRight, Check, Crown, Phone, MessageSquare, CreditCard } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/ui/Toaster';
import { supabase } from '../lib/supabase';
import { getEstablishmentAppointments, createEstablishment, updateEstablishment, getEstablishmentPremiumSubscribers, removePremiumSubscriber } from '../lib/supabase';
import { ServiceForm } from '../components/ServiceForm';
import { DurationSelector } from '../components/DurationSelector';
import { TimeSelector } from '../components/TimeSelector';
import { AvailableTimesViewer } from '../components/AvailableTimesViewer';

interface BusinessHours {
  enabled: boolean;
  open1: string;
  close1: string;
  open2: string;
  close2: string;
}

interface Professional {
  id: string;
  name: string;
  specialties: string[];
}

interface Service {
  id: string;
  name: string;
  price: number;
  duration: number;
}

interface Establishment {
  id: string;
  name: string;
  description: string;
  code: string;
  owner_id: string;
  business_hours: Record<string, BusinessHours>;
  professionals: Professional[];
  services_with_prices: Service[];
  profile_image_url?: string;
  affiliate_link?: string;
  custom_photo_1_url?: string;
  custom_photo_2_url?: string;
  custom_photo_3_url?: string;
}

type TabType = 'appointments' | 'services' | 'settings' | 'premium-clients' | 'available-times';

interface Appointment {
  id: string;
  client_id: string;
  client_name: string;
  establishment_id: string;
  service: string;
  professional: string;
  appointment_date: string;
  appointment_time: string;
  status: 'pending' | 'confirmed' | 'cancelled';
  created_at: string;
  is_premium: boolean;
  duration: number;
  price: number;
  payment_method?: string;
}

interface PremiumClient {
  id: string;
  premium_user_id: string;
  establishment_id: string;
  client_name: string;
  client_phone: string;
  created_at: string;
}

const EstablishmentDashboard = () => {
  const { user, signOut } = useAuth();
  const { toast } = useToast();

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('appointments');
  const [premiumSubscribers, setPremiumSubscribers] = useState<any[]>([]);
  const [isLoadingSubscribers, setIsLoadingSubscribers] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  
  const [establishment, setEstablishment] = useState<Establishment | null>(null);
  const [isEstablishmentLoading, setIsEstablishmentLoading] = useState(false);
  
  const [establishmentName, setEstablishmentName] = useState('');
  const [establishmentDescription, setEstablishmentDescription] = useState('');
  const [establishmentCode, setEstablishmentCode] = useState('');
  const [affiliateLink, setAffiliateLink] = useState('');
  const [profileImage, setProfileImage] = useState<File | null>(null);
  const [profileImagePreview, setProfileImagePreview] = useState<string | null>(null);
  
  // Estados para fotos personalizadas
  const [customPhoto1, setCustomPhoto1] = useState<File | null>(null);
  const [customPhoto2, setCustomPhoto2] = useState<File | null>(null);
  const [customPhoto3, setCustomPhoto3] = useState<File | null>(null);
  const [customPhoto1Preview, setCustomPhoto1Preview] = useState<string | null>(null);
  const [customPhoto2Preview, setCustomPhoto2Preview] = useState<string | null>(null);
  const [customPhoto3Preview, setCustomPhoto3Preview] = useState<string | null>(null);
  
  const [businessHours, setBusinessHours] = useState<Record<string, BusinessHours>>({
    monday:    { enabled: true,  open1: '09:00', close1: '12:00', open2: '13:30', close2: '18:00' },
    tuesday:   { enabled: true,  open1: '09:00', close1: '12:00', open2: '13:30', close2: '18:00' },
    wednesday: { enabled: true,  open1: '09:00', close1: '12:00', open2: '13:30', close2: '18:00' },
    thursday:  { enabled: true,  open1: '09:00', close1: '12:00', open2: '13:30', close2: '18:00' },
    friday:    { enabled: true,  open1: '09:00', close1: '12:00', open2: '13:30', close2: '18:00' },
    saturday:  { enabled: false, open1: '09:00', close1: '12:00', open2: '13:30', close2: '18:00' },
    sunday:    { enabled: false, open1: '09:00', close1: '12:00', open2: '13:30', close2: '18:00' }
  });
  
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [servicesWithPrices, setServicesWithPrices] = useState<Service[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedProfessional, setSelectedProfessional] = useState<string>('all');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>('todos');
  const [monthlyAppointments, setMonthlyAppointments] = useState<Appointment[]>([]);

  const durationOptions = [
    { value: 15, label: '15 minutos' },
    { value: 30, label: '30 minutos' },
    { value: 45, label: '45 minutos' },
    { value: 60, label: '1 hora' },
    { value: 90, label: '1 hora e meia' }
  ];

  const formatDuration = (minutes: number): string => {
    if (!minutes) return '';
    if (minutes >= 60) {
      const hours = Math.floor(minutes / 60);
      const remainingMinutes = minutes % 60;
      return remainingMinutes > 0 
        ? `${hours}h${remainingMinutes}min` 
        : `${hours}h`;
    }
    return `${minutes}min`;
  };

  const generateRandomCode = () => {
    const code = Math.floor(1000 + Math.random() * 9000).toString();
    setEstablishmentCode(code);
  };

  useEffect(() => {
    if (!establishmentCode) {
      generateRandomCode();
    }
  }, []);

  const handlePreviousDay = () => {
    setSelectedDate(prev => subDays(prev, 1));
  };

  const handleNextDay = () => {
    setSelectedDate(prev => addDays(prev, 1));
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (!value) return;
    setSelectedDate(new Date(value));
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast("A imagem deve ter no máximo 5MB");
        return;
      }
      setProfileImage(file);
      setProfileImagePreview(URL.createObjectURL(file));
    }
  };

  const handleCustomPhotoChange = (photoNumber: 1 | 2 | 3, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast("A imagem deve ter no máximo 5MB");
        return;
      }
      
      if (photoNumber === 1) {
        setCustomPhoto1(file);
        setCustomPhoto1Preview(URL.createObjectURL(file));
      } else if (photoNumber === 2) {
        setCustomPhoto2(file);
        setCustomPhoto2Preview(URL.createObjectURL(file));
      } else if (photoNumber === 3) {
        setCustomPhoto3(file);
        setCustomPhoto3Preview(URL.createObjectURL(file));
      }
    }
  };

  const handleBusinessHoursChange = (
    day: keyof typeof businessHours,
    field: 'enabled' | 'open1' | 'close1' | 'open2' | 'close2',
    value: string | boolean
  ) => {
    setBusinessHours(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        [field]: value
      }
    }));
  };

  const handleAddProfessional = () => {
    if (professionals.length >= 10) {
      toast("Limite máximo de 10 profissionais atingido");
      return;
    }
    const newProfessional = {
      id: Math.random().toString(36).substring(2),
      name: '',
      specialties: []
    };
    setProfessionals(prev => [...prev, newProfessional]);
  };

  const handleRemoveProfessional = (id: string) => {
    setProfessionals(prev => prev.filter(p => p.id !== id));
  };

  const handleProfessionalChange = (id: string, field: keyof Professional, value: string | string[]) => {
    setProfessionals(prev => prev.map(p => 
      p.id === id ? { ...p, [field]: value } : p
    ));
  };

  const handleAddService = () => {
    const newService = {
      id: Math.random().toString(36).substring(2),
      name: '',
      price: 0,
      duration: 30
    };
    setServicesWithPrices(prev => [...prev, newService]);
  };

  const handleRemoveService = (id: string) => {
    setServicesWithPrices(prev => prev.filter(s => s.id !== id));
  };

  const handleServiceChange = (id: string, field: keyof Service, value: string | number) => {
    setServicesWithPrices(prev => prev.map(s => 
      s.id === id ? { ...s, [field]: value } : s
    ));
  };

  const handleCreateEstablishment = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!establishmentName.trim()) {
      toast({
        title: "Erro",
        description: "Por favor, informe o nome do estabelecimento",
        variant: "destructive"
      });
      return;
    }

    if (!establishmentCode.trim() || establishmentCode.length !== 4) {
      toast({
        title: "Erro",
        description: "Por favor, informe um código de 4 dígitos válido",
        variant: "destructive"
      });
      return;
    }

    setIsCreating(true);

    try {
      const { data, error } = await createEstablishment({
        name: establishmentName,
        description: establishmentDescription,
        code: establishmentCode,
        owner_id: user!.id,
        business_hours: businessHours,
        professionals: professionals,
        services_with_prices: servicesWithPrices
      });

      if (error) throw error;

      if (profileImage) {
        const file = profileImage;
        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const filePath = `${user!.id}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('profile-images')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('profile-images')
          .getPublicUrl(filePath);

        const { error: updateError } = await supabase
          .from('establishments')
          .update({ profile_image_url: publicUrl })
          .eq('id', data?.[0].id);

        if (updateError) throw updateError;
      }

      if (data?.[0]) {
        setEstablishment(data[0]);
        toast({
          title: "Sucesso",
          description: "Estabelecimento criado com sucesso!",
          variant: "default"
        });
      } else {
        throw new Error('Erro ao criar estabelecimento: dados não retornados');
      }
    } catch (error: any) {
      console.error('Erro ao criar estabelecimento:', error);
      toast({
        title: "Erro",
        description: error.message || 'Erro ao criar estabelecimento',
        variant: "destructive"
      });
    } finally {
      setIsCreating(false);
    }
  };

  const copyCodeToClipboard = () => {
    navigator.clipboard.writeText(establishmentCode);
    setCodeCopied(true);
    setTimeout(() => {
      setCodeCopied(false);
    }, 2000);
    
    toast({
      title: "Sucesso",
      description: "Código copiado para a área de transferência!",
      variant: "default"
    });
  };

  const handleUpdateEstablishment = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUpdating(true);

    try {
      const { data, error } = await updateEstablishment(establishment!.id, {
        name: establishmentName,
        description: establishmentDescription,
        business_hours: businessHours,
        professionals: professionals,
        services_with_prices: servicesWithPrices
      });

      if (error) throw error;

      if (profileImage) {
        const file = profileImage;
        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const filePath = `${user!.id}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('profile-images')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('profile-images')
          .getPublicUrl(filePath);

        const { error: updateError } = await supabase
          .from('establishments')
          .update({ profile_image_url: publicUrl })
          .eq('id', establishment!.id);

        if (updateError) throw updateError;
      }
        
      setEstablishment(data?.[0]);
      toast({
        title: "Sucesso",
        description: "Estabelecimento atualizado com sucesso!",
        variant: "default"
      });
        
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || 'Erro ao atualizar estabelecimento',
        variant: "destructive"
      });
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#121214] text-white">
      <div className="container mx-auto px-4 py-8">
        <div className="space-y-8">
          <div className="flex justify-between items-center">
            <h1 className="text-3xl font-bold">Meu Estabelecimento</h1>
            <button
              onClick={signOut}
              className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
            >
              <LogOut className="w-5 h-5" />
              <span>Sair</span>
            </button>
          </div>

          <div className="flex space-x-4 border-b border-gray-800 pb-4">
            <button
              onClick={() => setActiveTab('appointments')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                activeTab === 'appointments'
                  ? 'bg-primary text-white'
                  : 'bg-[#242628] text-gray-300 hover:bg-[#2a2b2d]'
              }`}
            >
              <Calendar className="w-5 h-5 inline-block mr-2" />
              Agendamentos
            </button>
            <button
              onClick={() => setActiveTab('services')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                activeTab === 'services'
                  ? 'bg-primary text-white'
                  : 'bg-[#242628] text-gray-300 hover:bg-[#2a2b2d]'
              }`}
            >
              <Scissors className="w-5 h-5 inline-block mr-2" />
              Serviços
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                activeTab === 'settings'
                  ? 'bg-primary text-white'
                  : 'bg-[#242628] text-gray-300 hover:bg-[#2a2b2d]'
              }`}
            >
              <Settings className="w-5 h-5 inline-block mr-2" />
              Configurações
            </button>
          </div>

          {isLoading ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Conteúdo específico de cada tab */}
              {activeTab === 'appointments' && (
                <div>
                  {/* Lista de agendamentos */}
                </div>
              )}

              {activeTab === 'services' && (
                <form onSubmit={handleUpdateEstablishment} className="space-y-6">
                  {/* Formulário de serviços */}
                </form>
              )}

              {activeTab === 'settings' && (
                <form onSubmit={establishment ? handleUpdateEstablishment : handleCreateEstablishment} className="space-y-6">
                  {/* Formulário de configurações */}
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EstablishmentDashboard; 