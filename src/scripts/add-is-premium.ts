import { createAddIsPremiumFunction, addIsPremiumColumn } from '../lib/supabase';

async function main() {
  try {
    console.log('Criando função SQL...');
    const { error: createError } = await createAddIsPremiumFunction();
    if (createError) throw createError;
    
    console.log('Adicionando coluna is_premium...');
    const { error: addError } = await addIsPremiumColumn();
    if (addError) throw addError;
    
    console.log('Coluna is_premium adicionada com sucesso!');
  } catch (error: any) {
    console.error('Erro:', error.message);
  }
}

main(); 