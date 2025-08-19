import React, { createContext, useContext, useMemo } from 'react';
import { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { Database } from '../types/supabase';

type SupabaseContextType = {
  supabase: SupabaseClient<Database>;
};

const SupabaseContext = createContext<SupabaseContextType | undefined>(undefined);

export function useSupabase() {
  const context = useContext(SupabaseContext);
  if (!context) {
    throw new Error('useSupabase must be used within a SupabaseProvider');
  }
  return context;
}

type SupabaseProviderProps = {
  children: React.ReactNode;
};

export function SupabaseProvider({ children }: SupabaseProviderProps) {
  const value = useMemo(() => {
    // Verificar se o cliente Supabase foi inicializado corretamente
    if (!supabase) {
      console.error('❌ Supabase client is not initialized');
      throw new Error('Supabase client is not initialized. Check your environment variables.');
    }

    // Verificar se as variáveis de ambiente estão definidas
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('❌ Missing Supabase environment variables:', {
        VITE_SUPABASE_URL: supabaseUrl ? '✅ Defined' : '❌ Missing',
        VITE_SUPABASE_ANON_KEY: supabaseAnonKey ? '✅ Defined' : '❌ Missing'
      });
      throw new Error('Missing Supabase environment variables. Please check your .env file.');
    }

    console.log('✅ Supabase client initialized successfully');
    return { supabase };
  }, []);

  return (
    <SupabaseContext.Provider value={value}>
      {children}
    </SupabaseContext.Provider>
  );
}