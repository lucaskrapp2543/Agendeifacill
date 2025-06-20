import { useState } from 'react';

interface PixProofViewerProps {
  proofUrl: string;
}

export const PixProofViewer = ({ proofUrl }: PixProofViewerProps) => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsModalOpen(true)}
        className="text-blue-500 hover:text-blue-600 flex items-center gap-2"
      >
        🧾 Ver comprovante
      </button>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-4 rounded-lg max-w-2xl w-full mx-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Comprovante de Pagamento</h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            
            <div className="relative aspect-square w-full">
              <img
                src={proofUrl}
                alt="Comprovante de pagamento"
                className="w-full h-full object-contain"
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}; 