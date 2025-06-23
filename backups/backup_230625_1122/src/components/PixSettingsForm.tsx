import { useState } from 'react';
import { useToast } from './ui/Toaster';

interface PixSettingsFormProps {
  initialPixKey?: string;
  initialPixType?: string;
  onSave: (pixKey: string, pixType: string) => Promise<void>;
}

export const PixSettingsForm = ({
  initialPixKey = '',
  initialPixType = 'telefone',
  onSave
}: PixSettingsFormProps) => {
  const [pixKey, setPixKey] = useState(initialPixKey);
  const [pixType, setPixType] = useState(initialPixType);
  const [isSaving, setIsSaving] = useState(false);
  const toast = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!pixKey.trim()) {
      toast.error('Por favor, insira uma chave PIX');
      return;
    }

    try {
      setIsSaving(true);
      await onSave(pixKey, pixType);
      toast.success('Configurações de PIX salvas com sucesso!');
    } catch (error) {
      toast.error('Erro ao salvar configurações de PIX');
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <label className="block font-medium">
          Tipo de chave PIX
        </label>
        <select
          value={pixType}
          onChange={(e) => setPixType(e.target.value)}
          className="w-full p-2 border rounded"
          required
        >
          <option value="telefone">Telefone</option>
          <option value="email">E-mail</option>
          <option value="cpf">CPF</option>
          <option value="cnpj">CNPJ</option>
          <option value="chave_aleatoria">Chave Aleatória</option>
        </select>
      </div>

      <div className="space-y-2">
        <label className="block font-medium">
          Chave PIX
        </label>
        <input
          type="text"
          value={pixKey}
          onChange={(e) => setPixKey(e.target.value)}
          className="w-full p-2 border rounded"
          placeholder="Digite sua chave PIX"
          required
        />
      </div>

      <button
        type="submit"
        disabled={isSaving}
        className={`w-full p-2 rounded text-white ${
          isSaving ? 'bg-gray-400' : 'bg-blue-500 hover:bg-blue-600'
        }`}
      >
        {isSaving ? 'Salvando...' : 'Salvar configurações de PIX'}
      </button>
    </form>
  );
}; 