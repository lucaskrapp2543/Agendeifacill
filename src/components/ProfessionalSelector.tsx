import { Camera, Lock, Users } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { getProfessionalGoalProgress, supabase } from '../lib/supabase';
import { GoalProgressBar } from './GoalProgressBar';

interface Professional {
  id: string;
  name: string;
  photo_url?: string;
  whatsapp?: string;
}

interface ProfessionalSelectorProps {
  professionals: Professional[];
  selectedProfessional: string | null;
  onSelectProfessional: (professionalId: string | null) => void;
  establishmentId: string;
  onProfessionalUpdate?: () => void;
  // Props para controle de autenticação do profissional
  authenticatedProfessionalId?: string | null;
  showPhotoEditButtons?: boolean;
  // Props para verificar senhas dos profissionais
  establishment?: any;
  // Prop para definir qual mês/ano buscar a meta
  selectedDate?: Date;
  // Prop para mostrar ou não a barra de progresso da meta
  showGoalProgress?: boolean;
}

export function ProfessionalSelector({
  professionals,
  selectedProfessional,
  onSelectProfessional,
  establishmentId,
  onProfessionalUpdate,
  authenticatedProfessionalId = null,
  showPhotoEditButtons = false,
  establishment,
  selectedDate = new Date(),
  showGoalProgress = true
}: ProfessionalSelectorProps) {
  const [uploadingPhoto, setUploadingPhoto] = useState<string | null>(null);
  const [showPinModal, setShowPinModal] = useState(false);
  const [pin, setPin] = useState('');
  const [isVerifyingPin, setIsVerifyingPin] = useState(false);
  const [pendingFile, setPendingFile] = useState<{ file: File; professionalId: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Estados para metas
  const [goalProgress, setGoalProgress] = useState<Record<string, {
    goalAmount: number;
    completedServices: number;
    progressPercentage: number;
    remainingServices: number;
    professionalName: string;
  }>>({});

  // Função para carregar progresso da meta de um profissional
  const loadGoalProgress = async (professionalId: string) => {
    if (!establishmentId) {
      console.log('❌ establishmentId não encontrado');
      return;
    }

    try {
      // Usar a data selecionada no calendário para buscar agendamentos do mês
      const year = selectedDate.getFullYear();
      const month = selectedDate.getMonth() + 1;

      console.log('🔍 Carregando meta para profissional:', professionalId, 'ano:', year, 'mês:', month, 'data selecionada:', selectedDate.toISOString());

      const { data, error } = await getProfessionalGoalProgress(
        establishmentId,
        professionalId,
        year,
        month
      );

      if (error) {
        console.error('❌ Erro ao carregar progresso da meta:', error);
        return;
      }

      console.log('✅ Dados da meta carregados:', data);

      if (data && data.goalAmount > 0) {
        setGoalProgress(prev => ({
          ...prev,
          [professionalId]: data
        }));
        console.log('🎯 Meta mantida:', data.goalAmount, 'serviços | Progresso atualizado para', year + '/' + month);
      } else {
        console.log('ℹ️ Nenhuma meta definida para este profissional');
      }
    } catch (error) {
      console.error('❌ Erro ao carregar progresso da meta:', error);
    }
  };

  // Carregar progresso da meta quando um profissional é selecionado ou quando a data muda
  useEffect(() => {
    // Só carregar meta se showGoalProgress for true (dashboard do estabelecimento)
    if (!showGoalProgress) {
      console.log('🚫 Meta não será carregada - showGoalProgress = false (tela de agendamento)');
      return;
    }

    const currentMonth = selectedDate.getMonth() + 1;
    const currentYear = selectedDate.getFullYear();

    console.log('🎯 useEffect disparado - selectedProfessional:', selectedProfessional, 'establishmentId:', establishmentId, 'selectedDate:', selectedDate.toISOString(), 'mês/ano:', currentMonth + '/' + currentYear);

    if (selectedProfessional && selectedProfessional !== null) {
      console.log('✅ Carregando meta para profissional selecionado:', selectedProfessional, 'mês:', currentMonth, 'ano:', currentYear);
      loadGoalProgress(selectedProfessional);
    }
  }, [selectedProfessional, establishmentId, selectedDate.getMonth(), selectedDate.getFullYear(), showGoalProgress]);

  // Função para verificar se o profissional precisa de senha para alterar foto
  const checkIfNeedsPassword = async (professionalId: string): Promise<boolean> => {
    try {
      // Se já temos os dados do establishment, usar eles
      if (establishment?.professionals_pins) {
        const professionalPin = establishment.professionals_pins.find(
          p => p.professional_id === professionalId
        );

        // Se não tem senha configurada, senha está vazia, ou é "0000", NÃO precisa de senha
        if (!professionalPin?.pin ||
          professionalPin.pin.length === 0 ||
          professionalPin.pin === '0000') {
          return false;
        }

        return true; // Precisa de senha
      }

      // Se não temos os dados, buscar no banco
      const { data: establishmentData, error } = await supabase
        .from('establishments')
        .select('professionals_pins')
        .eq('id', establishmentId)
        .single();

      if (error || !establishmentData) {
        return false; // Em caso de erro, não pedir senha
      }

      // Encontrar o PIN do profissional específico
      const professionalPin = establishmentData.professionals_pins?.find(
        p => p.professional_id === professionalId
      );

      // Se não tem senha configurada, senha está vazia, ou é "0000", NÃO precisa de senha
      if (!professionalPin?.pin ||
        professionalPin.pin.length === 0 ||
        professionalPin.pin === '0000') {
        return false;
      }

      return true; // Precisa de senha
    } catch (error) {
      console.error('Erro ao verificar se precisa de senha:', error);
      return false; // Em caso de erro, não pedir senha
    }
  };

  const verifyPin = async (pin: string, professionalId: string): Promise<boolean> => {
    try {
      // Buscar o estabelecimento para verificar o PIN do profissional
      const { data: establishment, error } = await supabase
        .from('establishments')
        .select('professionals_pins')
        .eq('id', establishmentId)
        .single();

      if (error || !establishment) {
        return false;
      }

      // Encontrar o PIN do profissional específico
      const professionalPin = establishment.professionals_pins?.find(
        p => p.professional_id === professionalId
      );

      // Se não tem senha configurada, senha está vazia, ou é "0000", libera o acesso
      if (!professionalPin?.pin ||
        professionalPin.pin.length === 0 ||
        professionalPin.pin === '0000') {
        return true;
      }

      return professionalPin.pin === pin;
    } catch (error) {
      console.error('Erro ao verificar PIN:', error);
      return false;
    }
  };

  const handlePhotoUpload = async (professionalId: string, file: File) => {
    try {
      setUploadingPhoto(professionalId);

      // Criar nome único para o arquivo
      const fileExt = file.name.split('.').pop();
      const fileName = `${professionalId}_${Date.now()}.${fileExt}`;
      const filePath = `professional-photos/${establishmentId}/${fileName}`;

      // Upload para o Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('establishment-assets')
        .upload(filePath, file);

      if (uploadError) {
        throw uploadError;
      }

      // Obter URL pública
      const { data: { publicUrl } } = supabase.storage
        .from('establishment-assets')
        .getPublicUrl(filePath);

      // Atualizar o profissional no estabelecimento (JSONB)
      const { data: establishmentData, error: fetchError } = await supabase
        .from('establishments')
        .select('professionals')
        .eq('id', establishmentId)
        .single();

      if (fetchError || !establishmentData) {
        throw fetchError || new Error('Estabelecimento não encontrado');
      }

      // Encontrar e atualizar o profissional específico
      const updatedProfessionals = establishmentData.professionals.map((professional: any) => {
        if (professional.id === professionalId) {
          return { ...professional, photo_url: publicUrl };
        }
        return professional;
      });

      const { error: updateError } = await supabase
        .from('establishments')
        .update({ professionals: updatedProfessionals })
        .eq('id', establishmentId);

      if (updateError) {
        throw updateError;
      }

      toast.success('Foto atualizada com sucesso!');

      // Atualizar a lista de profissionais
      if (onProfessionalUpdate) {
        onProfessionalUpdate();
      }
    } catch (error: any) {
      console.error('Erro ao fazer upload da foto:', error);
      toast.error('Erro ao fazer upload da foto');
    } finally {
      setUploadingPhoto(null);
    }
  };

  const handlePhotoChange = async (professionalId: string, file: File) => {
    console.log('🔍 DEBUG - handlePhotoChange chamado para profissional:', professionalId);

    // Verificar se o profissional precisa de senha para alterar foto
    const needsPassword = await checkIfNeedsPassword(professionalId);

    if (needsPassword) {
      console.log('🔒 Profissional precisa de senha, mostrando modal');
      // Armazenar o arquivo pendente e mostrar modal de PIN
      setPendingFile({ file, professionalId });
      setShowPinModal(true);
    } else {
      console.log('✅ Profissional não precisa de senha, fazendo upload direto');
      // Fazer upload direto sem pedir senha
      await handlePhotoUpload(professionalId, file);
    }
  };

  const handlePinSubmit = async () => {
    if (!pendingFile || !pin.trim()) {
      toast.error('Por favor, digite sua senha');
      return;
    }

    setIsVerifyingPin(true);

    try {
      const isValidPin = await verifyPin(pin, pendingFile.professionalId);

      if (isValidPin) {
        // Senha correta, fazer upload da foto
        await handlePhotoUpload(pendingFile.professionalId, pendingFile.file);
        setShowPinModal(false);
        setPin('');
        setPendingFile(null);
      } else {
        toast.error('Senha incorreta');
      }
    } catch (error) {
      toast.error('Erro ao verificar senha');
    } finally {
      setIsVerifyingPin(false);
    }
  };



  const getPhotoUrl = (professional: Professional) => {
    // Verificar se a propriedade photo_url existe antes de usar
    return (professional as any).photo_url || '/fotopessoa.png';
  };

  // Função para verificar se o profissional pode editar sua foto
  const canEditPhoto = (professionalId: string): boolean => {
    // Pode editar se:
    // 1. A opção de edição está habilitada
    // 2. É o próprio profissional autenticado OU não tem senha configurada
    if (!showPhotoEditButtons) return false;

    // Se é o profissional autenticado, pode editar
    if (authenticatedProfessionalId === professionalId) return true;

    // Se não tem senha configurada (senha padrão "0000"), pode editar
    // Precisamos verificar se o profissional tem senha personalizada
    const professional = professionals.find(p => p.id === professionalId);
    if (professional) {
      // Verificar se tem senha personalizada (não "0000")
      const hasPersonalPassword = establishment?.professionals_pins?.find(
        p => p.professional_id === professionalId && p.pin !== '0000'
      );

      // Se não tem senha personalizada, pode editar
      if (!hasPersonalPassword) return true;
    }

    return false;
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium text-gray-700 mb-3">
        Escolha o Profissional
      </h3>

      <div className="flex flex-wrap gap-4">
        {/* Opção "Qualquer Profissional" - Só aparece se houver mais de 1 profissional E não for no contexto de booking */}
        {professionals.length > 1 && showGoalProgress !== false && (
          <div className="flex flex-col items-center">
            <button
              type="button"
              onClick={() => onSelectProfessional(null)}
              className={`relative w-16 h-16 rounded-full flex items-center justify-center transition-all duration-200 ${selectedProfessional === null
                ? 'bg-blue-600 text-white shadow-lg scale-105'
                : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                }`}
            >
              <Users className="w-6 h-6" />
              {selectedProfessional === null && (
                <div className="absolute -top-1 -right-1 w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center">
                  <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
                </div>
              )}
            </button>
            <span className="text-sm font-medium text-gray-700 mt-2 text-center">
              Qualquer Profissional
            </span>
          </div>
        )}

        {/* Profissionais individuais */}
        {professionals.length <= 2 ? (
          // Layout normal para 2 ou menos profissionais
          professionals.map((professional) => (
            <div key={professional.id} className="flex flex-col items-center">
              <div className="relative group">
                <button
                  type="button"
                  onClick={() => onSelectProfessional(professional.id)}
                  className={`relative w-16 h-16 rounded-full overflow-hidden transition-all duration-200 ${selectedProfessional === professional.id
                    ? 'ring-3 ring-blue-600 shadow-lg scale-105'
                    : 'ring-2 ring-gray-200 hover:ring-blue-400'
                    }`}
                >
                  <img
                    src={getPhotoUrl(professional)}
                    alt={professional.name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.src = '/fotopessoa.png';
                    }}
                  />
                  {uploadingPhoto === professional.id && (
                    <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
                    </div>
                  )}
                </button>

                {/* Botão de alterar foto desabilitado - agora é feito nas configurações */}
                {false && canEditPhoto(professional.id) && (
                  <button
                    type="button"
                    onClick={() => {
                      if (fileInputRef.current) {
                        fileInputRef.current.dataset.professionalId = professional.id;
                        fileInputRef.current.click();
                      }
                    }}
                    className="absolute -bottom-1 -right-1 w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center opacity-100 transition-opacity duration-200 hover:bg-blue-700 hover:scale-110"
                    title="Alterar minha foto"
                  >
                    <Camera className="w-2.5 h-2.5 text-white" />
                  </button>
                )}

                {selectedProfessional === professional.id && (
                  <div className="absolute -top-1 -right-1 w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center">
                    <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
                  </div>
                )}
              </div>

              <span className="text-sm font-medium text-gray-700 mt-2 text-center max-w-20">
                {professional.name}
              </span>
            </div>
          ))
        ) : (
          // Carrossel horizontal para 3+ profissionais
          <div className="flex-1 overflow-hidden">
            <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
              {professionals.map((professional) => (
                <div key={professional.id} className="flex flex-col items-center flex-shrink-0">
                  <div className="relative group">
                    <button
                      type="button"
                      onClick={() => onSelectProfessional(professional.id)}
                      className={`relative w-16 h-16 rounded-full overflow-hidden transition-all duration-200 ${selectedProfessional === professional.id
                        ? 'ring-3 ring-blue-600 shadow-lg scale-105'
                        : 'ring-2 ring-gray-200 hover:ring-blue-400'
                        }`}
                    >
                      <img
                        src={getPhotoUrl(professional)}
                        alt={professional.name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.src = '/fotopessoa.png';
                        }}
                      />
                      {uploadingPhoto === professional.id && (
                        <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
                        </div>
                      )}
                    </button>

                    {/* Botão de alterar foto desabilitado - agora é feito nas configurações */}
                    {false && canEditPhoto(professional.id) && (
                      <button
                        type="button"
                        onClick={() => {
                          if (fileInputRef.current) {
                            fileInputRef.current.dataset.professionalId = professional.id;
                            fileInputRef.current.click();
                          }
                        }}
                        className="absolute -bottom-1 -right-1 w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center opacity-100 transition-opacity duration-200 hover:bg-blue-700 hover:scale-110"
                        title="Alterar minha foto"
                      >
                        <Camera className="w-2.5 h-2.5 text-white" />
                      </button>
                    )}

                    {selectedProfessional === professional.id && (
                      <div className="absolute -top-1 -right-1 w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center">
                        <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
                      </div>
                    )}
                  </div>

                  <span className="text-sm font-medium text-gray-700 mt-2 text-center max-w-20">
                    {professional.name}
                  </span>

                  {/* Ícone WhatsApp do profissional */}
                  {professional.whatsapp && (
                    <button
                      type="button"
                      onClick={() => {
                        const cleanWhatsapp = professional.whatsapp?.replace(/\D/g, '');
                        const whatsappUrl = `https://wa.me/55${cleanWhatsapp}?text=Olá`;
                        window.open(whatsappUrl, '_blank');
                      }}
                      className="mt-1 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center hover:bg-green-600 transition-colors"
                      title={`Falar com ${professional.name} no WhatsApp`}
                    >
                      <img
                        src="/wppiconpro.png"
                        alt="WhatsApp"
                        className="w-4 h-4"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                        }}
                      />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Exibição da Meta do Profissional Selecionado - APENAS no dashboard */}
      {showGoalProgress && selectedProfessional && selectedProfessional !== null && goalProgress[selectedProfessional] && goalProgress[selectedProfessional].goalAmount > 0 && (
        <div className="mt-4">
          {console.log('🎯 Renderizando barra de progresso para:', selectedProfessional, goalProgress[selectedProfessional])}
          <GoalProgressBar
            goalAmount={goalProgress[selectedProfessional].goalAmount}
            completedServices={goalProgress[selectedProfessional].completedServices}
            professionalName={goalProgress[selectedProfessional].professionalName}
            isCompact={true}
          />
        </div>
      )}

      {/* Meta sempre aparece se estiver definida para o profissional */}

      {/* Debug info - removido para limpar a interface */}

      {/* Input file hidden */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            // Validar tipo de arquivo
            if (!file.type.startsWith('image/')) {
              toast.error('Por favor, selecione apenas imagens');
              return;
            }

            // Validar tamanho (máximo 5MB)
            if (file.size > 5 * 1024 * 1024) {
              toast.error('A imagem deve ter no máximo 5MB');
              return;
            }

            // Usar o professionalId armazenado no estado
            const currentProfessionalId = fileInputRef.current?.dataset.professionalId;
            if (currentProfessionalId) {
              handlePhotoChange(currentProfessionalId, file);
            }
          }
        }}
        data-professional-id=""
      />

      {/* Modal de PIN */}
      {showPinModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96 max-w-[90vw]">
            <div className="flex items-center gap-3 mb-4">
              <Lock className="w-6 h-6 text-blue-600" />
              <h3 className="text-lg font-medium text-gray-900">
                Digite sua senha para alterar a foto
              </h3>
            </div>

            <p className="text-sm text-gray-600 mb-4">
              Para alterar sua foto, você precisa digitar sua senha pessoal.
            </p>

            <input
              type="password"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="Digite sua senha"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 bg-white"
              maxLength={6}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handlePinSubmit();
                }
              }}
            />

            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={() => {
                  setShowPinModal(false);
                  setPin('');
                  setPendingFile(null);
                }}
                className="flex-1 px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handlePinSubmit}
                disabled={isVerifyingPin || !pin.trim()}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isVerifyingPin ? 'Verificando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
