import { useState } from 'react';
import { useToast } from './ui/Toaster';
import { AlertTriangle } from 'lucide-react';

interface EstablishmentPixSettingsProps {
  establishment: {
    pix_key?: string;
    pix_key_type?: string;
  };
  onSave: (pixKey: string, pixType: string) => Promise<void>;
}

export const EstablishmentPixSettings = ({
  establishment,
  onSave
}: EstablishmentPixSettingsProps) => {
  const [pixKey, setPixKey] = useState(establishment.pix_key || '');
  const [pixType, setPixType] = useState(establishment.pix_key_type || 'telefone');
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

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
    <div className="bg-[#1a1b1c] rounded-lg p-6 border border-gray-800">
      <h3 className="text-lg font-medium text-white mb-4">Seu PIX para pagamento</h3>
      
      <div className="flex items-start gap-2 p-4 bg-[#242628] rounded-lg mb-6 border border-yellow-600/50">
        <AlertTriangle className="h-5 w-5 text-yellow-500 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-gray-300">
          Obrigatório preencher e salvar. Caso não queira botar seu PIX, coloque <span className="text-yellow-500 font-medium">naotenhopix</span> na chave e salve o PIX. Após isso, você conseguirá salvar as alterações normais como nomes entre outros.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-300">
            Tipo de chave PIX
          </label>
          <select
            value={pixType}
            onChange={(e) => setPixType(e.target.value)}
            className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-gray-200"
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
          <label className="block text-sm font-medium text-gray-300">
            Chave PIX
          </label>
          <input
            type="text"
            value={pixKey}
            onChange={(e) => setPixKey(e.target.value)}
            className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-gray-200"
            placeholder="Digite sua chave PIX"
            required
          />
          <p className="text-sm text-gray-400">
            Esta chave será usada para receber pagamentos via PIX dos seus clientes.
          </p>
        </div>

        <button
          type="submit"
          disabled={isSaving}
          className={`w-full p-3 rounded font-medium ${
            isSaving
              ? 'bg-gray-600 cursor-not-allowed'
              : 'bg-primary hover:bg-primary/90'
          }`}
        >
          {isSaving ? 'Salvando...' : 'Salvar configurações de PIX'}
        </button>
      </form>
    </div>
  );
}; 