import { Save, User, X } from 'lucide-react';
import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';

interface EditUserDataModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentName: string;
  currentPhone: string;
  userId: string;
  onUpdate: (newName: string, newPhone: string) => void;
}

export const EditUserDataModal: React.FC<EditUserDataModalProps> = ({
  isOpen,
  onClose,
  currentName,
  currentPhone,
  userId,
  onUpdate
}) => {
  const [name, setName] = useState(currentName);
  const [phone, setPhone] = useState(currentPhone);
  const [isLoading, setIsLoading] = useState(false);

  const handleSave = async () => {
    if (!name.trim() || !phone.trim()) {
      toast.error('Nome e telefone são obrigatórios');
      return;
    }

    setIsLoading(true);
    try {
      // Atualizar o perfil do usuário na tabela profiles
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          name: name.trim(),
          phone: phone.trim()
        })
        .eq('id', userId);

      if (profileError) {
        throw profileError;
      }

      // Atualizar os metadados do usuário também
      const { error: authError } = await supabase.auth.updateUser({
        data: {
          name: name.trim(),
          whatsapp: phone.trim()
        }
      });

      if (authError) {
        console.warn('Aviso: Não foi possível atualizar metadados de autenticação:', authError);
      }

      toast.success('Dados atualizados com sucesso!');
      onUpdate(name.trim(), phone.trim());
      onClose();
    } catch (error) {
      console.error('Erro ao atualizar dados:', error);
      toast.error('Erro ao atualizar dados. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-md mx-auto">
        <div className="p-6">
          {/* Ícone */}
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
              <User className="w-8 h-8 text-blue-600" />
            </div>
          </div>

          {/* Título */}
          <h2 className="text-xl font-bold text-gray-900 text-center mb-2">
            Editar Meus Dados
          </h2>

          {/* Mensagem */}
          <p className="text-gray-600 text-center mb-6">
            Atualize suas informações pessoais
          </p>

          {/* Formulário */}
          <div className="space-y-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nome Completo
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 bg-white"
                placeholder="Digite seu nome completo"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Telefone
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 bg-white"
                placeholder="Digite seu telefone"
              />
            </div>
          </div>

          {/* Botões */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={isLoading}
              className="flex-1 px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
            >
              <X className="w-4 h-4" />
              Cancelar
            </button>

            <button
              onClick={handleSave}
              disabled={isLoading}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {isLoading ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
