import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Variáveis de ambiente do Supabase não encontradas');
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  try {
    console.log('Adicionando coluna is_premium...');
    const { error } = await supabase
      .from('appointments')
      .select('id')
      .limit(1)
      .single()
      .then(async () => {
        return await supabase.rpc('exec_sql', {
          sql: 'ALTER TABLE appointments ADD COLUMN IF NOT EXISTS is_premium BOOLEAN DEFAULT false;'
        });
      });

    if (error) throw error;
    console.log('Coluna is_premium adicionada com sucesso!');
  } catch (error) {
    console.error('Erro:', error.message);
  }
}

main(); 