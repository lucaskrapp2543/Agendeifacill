// Exemplo de configuração do Supabase
// Copie este arquivo para .env.local e preencha com suas credenciais

export const supabaseConfig = {
  // Vá em https://app.supabase.com
  // Selecione seu projeto
  // Vá em Settings > API
  // Copie os valores abaixo:
  
  url: 'https://your-project.supabase.co',
  anonKey: 'your-anon-key-here'
};

// Para usar no projeto:
// 1. Crie um arquivo .env.local na raiz do projeto
// 2. Adicione as linhas:
//    VITE_SUPABASE_URL=https://your-project.supabase.co
//    VITE_SUPABASE_ANON_KEY=your-anon-key-here
// 3. Reinicie o servidor (npm run dev) 