import { NextApiRequest, NextApiResponse } from 'next';
import { addIsPremiumColumn } from '../../lib/supabase';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { error } = await addIsPremiumColumn();
    
    if (error) {
      throw error;
    }

    res.status(200).json({ message: 'Coluna is_premium adicionada com sucesso!' });
  } catch (error: any) {
    console.error('Erro ao adicionar coluna:', error);
    res.status(500).json({ error: error.message });
  }
} 