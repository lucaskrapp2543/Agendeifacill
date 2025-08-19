import React from 'react';

export const EnvironmentError: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6">
        <div className="text-center">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            Configuração Necessária
          </h1>
          <p className="text-gray-600 mb-6">
            As variáveis de ambiente do Supabase não estão configuradas.
          </p>
          
          <div className="bg-gray-50 rounded-lg p-4 mb-6 text-left">
            <h3 className="font-semibold text-gray-800 mb-2">Para resolver:</h3>
            <ol className="text-sm text-gray-600 space-y-2">
              <li>1. Crie um arquivo <code className="bg-gray-200 px-1 rounded">.env</code> na raiz do projeto</li>
              <li>2. Adicione as seguintes variáveis:</li>
            </ol>
            <div className="mt-3 bg-gray-800 text-green-400 p-3 rounded text-sm font-mono">
              VITE_SUPABASE_URL=sua_url_do_supabase<br/>
              VITE_SUPABASE_ANON_KEY=sua_chave_anonima_do_supabase
            </div>
          </div>
          
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-semibold text-blue-800 mb-2">Como obter essas informações:</h3>
            <ol className="text-sm text-blue-700 space-y-1">
              <li>• Acesse o painel do Supabase</li>
              <li>• Vá em Settings → API</li>
              <li>• Copie a URL e a anon key</li>
            </ol>
          </div>
          
          <button 
            onClick={() => window.location.reload()}
            className="mt-6 bg-blue-500 text-white px-6 py-2 rounded-lg hover:bg-blue-600 transition-colors"
          >
            🔄 Recarregar após configurar
          </button>
        </div>
      </div>
    </div>
  );
};
