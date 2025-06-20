import { useState } from 'react';
import { useToast } from './ui/Toaster';

interface PixPaymentFormProps {
  establishmentPixKey?: string;
  establishmentPixType?: string;
  onComprovantUpload: (url: string) => void;
  onPaymentMethodSelect: (method: 'pix_now' | 'pix_local') => void;
}

export const PixPaymentForm = ({
  establishmentPixKey,
  establishmentPixType,
  onComprovantUpload,
  onPaymentMethodSelect
}: PixPaymentFormProps) => {
  const [paymentMethod, setPaymentMethod] = useState<'pix_now' | 'pix_local' | null>(null);
  const [comprovantUrl, setComprovantUrl] = useState<string | null>(null);
  const { toast } = useToast();

  const handlePaymentMethodSelect = (method: 'pix_now' | 'pix_local') => {
    setPaymentMethod(method);
    onPaymentMethodSelect(method);
  };

  const copyPixKey = async () => {
    if (establishmentPixKey) {
      await navigator.clipboard.writeText(establishmentPixKey);
      toast('Chave PIX copiada!', 'success');
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Aqui você deve implementar o upload para o bucket do Supabase
    // e então chamar onComprovantUpload com a URL retornada
    
    // Por enquanto, vamos apenas simular com uma URL local
    const reader = new FileReader();
    reader.onload = (e) => {
      const url = e.target?.result as string;
      setComprovantUrl(url);
      onComprovantUpload(url);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-4">
        <button
          onClick={() => handlePaymentMethodSelect('pix_now')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            paymentMethod === 'pix_now' 
              ? 'bg-primary text-white' 
              : 'bg-[#242628] text-gray-300 hover:bg-[#2a2d30] hover:text-white border border-gray-700'
          }`}
        >
          ✅ Pagar agora
        </button>
        <button
          onClick={() => handlePaymentMethodSelect('pix_local')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            paymentMethod === 'pix_local' 
              ? 'bg-primary text-white' 
              : 'bg-[#242628] text-gray-300 hover:bg-[#2a2d30] hover:text-white border border-gray-700'
          }`}
        >
          🏪 Pagar no local
        </button>
      </div>

      {paymentMethod === 'pix_now' && (
        <div className="space-y-4">
          {!establishmentPixKey ? (
            <div className="text-red-500">
              Este estabelecimento ainda não cadastrou uma chave PIX para pagamento.
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <div className="font-medium text-white">Chave PIX ({establishmentPixType}):</div>
                <div className="flex gap-2 items-center">
                  <input
                    type="text"
                    readOnly
                    value={establishmentPixKey}
                    className="flex-1 px-4 py-2 bg-[#242628] text-white border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  <button
                    onClick={copyPixKey}
                    className="px-4 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition-colors"
                  >
                    📋 Copiar PIX
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <div className="font-medium text-white">Envie o comprovante:</div>
                <label className="flex flex-col items-center justify-center w-full h-32 bg-[#242628] border-2 border-dashed border-gray-700 rounded-lg cursor-pointer hover:bg-[#2a2d30] transition-colors">
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <svg className="w-8 h-8 mb-4 text-gray-400" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 20 16">
                      <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 13h3a3 3 0 0 0 0-6h-.025A5.56 5.56 0 0 0 16 6.5 5.5 5.5 0 0 0 5.207 5.021C5.137 5.017 5.071 5 5 5a4 4 0 0 0 0 8h2.167M10 15V6m0 0L8 8m2-2 2 2"/>
                    </svg>
                    <p className="mb-2 text-sm text-gray-400">Clique para enviar o comprovante</p>
                    <p className="text-xs text-gray-400">PNG ou JPG</p>
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
                {comprovantUrl && (
                  <div className="relative w-32 h-32">
                    <img
                      src={comprovantUrl}
                      alt="Comprovante"
                      className="w-full h-full object-cover rounded-lg border border-gray-700"
                    />
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-lg opacity-0 hover:opacity-100 transition-opacity">
                      <span className="text-white text-sm">Comprovante enviado</span>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}; 