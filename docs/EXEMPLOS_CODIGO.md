# 📋 Exemplos de Código - AgendaFácil

## 🎯 Componentes React

### Componente Básico com TypeScript
```tsx
import React, { useState } from 'react';

interface MeuComponenteProps {
  titulo: string;
  onAction?: () => void;
}

const MeuComponente: React.FC<MeuComponenteProps> = ({ titulo, onAction }) => {
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    setLoading(true);
    try {
      onAction?.();
    } catch (error) {
      console.error('Erro:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-xl font-bold mb-4">{titulo}</h2>
      <button 
        onClick={handleClick}
        disabled={loading}
        className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-4 py-2 rounded"
      >
        {loading ? 'Carregando...' : 'Executar Ação'}
      </button>
    </div>
  );
};

export default MeuComponente;
```

### Modal/Popup Reutilizável
```tsx
import React from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="flex justify-between items-center p-6 border-b">
          <h2 className="text-xl font-bold">{title}</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X size={24} />
          </button>
        </div>
        <div className="p-6">
          {children}
        </div>
      </div>
    </div>
  );
};

export default Modal;
```

### Formulário com Validação
```tsx
import React, { useState } from 'react';

interface FormData {
  name: string;
  email: string;
  phone: string;
}

const FormularioContato: React.FC = () => {
  const [formData, setFormData] = useState<FormData>({
    name: '',
    email: '',
    phone: ''
  });
  const [errors, setErrors] = useState<Partial<FormData>>({});
  const [loading, setLoading] = useState(false);

  const validateForm = (): boolean => {
    const newErrors: Partial<FormData> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Nome é obrigatório';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email é obrigatório';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Email inválido';
    }

    if (!formData.phone.trim()) {
      newErrors.phone = 'Telefone é obrigatório';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setLoading(true);
    try {
      // Aqui você faria a chamada para a API
      console.log('Dados do formulário:', formData);
      
      // Reset do formulário após sucesso
      setFormData({ name: '', email: '', phone: '' });
      setErrors({});
      
    } catch (error) {
      console.error('Erro ao enviar formulário:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Nome
        </label>
        <input
          type="text"
          value={formData.name}
          onChange={(e) => handleChange('name', e.target.value)}
          className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            errors.name ? 'border-red-500' : 'border-gray-300'
          }`}
          placeholder="Seu nome"
        />
        {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Email
        </label>
        <input
          type="email"
          value={formData.email}
          onChange={(e) => handleChange('email', e.target.value)}
          className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            errors.email ? 'border-red-500' : 'border-gray-300'
          }`}
          placeholder="seu@email.com"
        />
        {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Telefone
        </label>
        <input
          type="tel"
          value={formData.phone}
          onChange={(e) => handleChange('phone', e.target.value)}
          className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            errors.phone ? 'border-red-500' : 'border-gray-300'
          }`}
          placeholder="(11) 99999-9999"
        />
        {errors.phone && <p className="text-red-500 text-sm mt-1">{errors.phone}</p>}
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white py-2 px-4 rounded-md transition-colors"
      >
        {loading ? 'Enviando...' : 'Enviar'}
      </button>
    </form>
  );
};

export default FormularioContato;
```

## 🗄️ Funções Supabase

### Função CRUD Completa
```typescript
// src/lib/exemplo-crud.ts
import { supabase } from './supabase';

export interface ExemploData {
  id?: string;
  nome: string;
  descricao: string;
  ativo: boolean;
  created_at?: string;
  updated_at?: string;
}

// CREATE - Criar novo registro
export const criarExemplo = async (data: Omit<ExemploData, 'id' | 'created_at' | 'updated_at'>) => {
  try {
    console.log('Criando exemplo:', data);
    
    const { data: resultado, error } = await supabase
      .from('exemplos')
      .insert([data])
      .select()
      .single();

    if (error) {
      console.error('Erro ao criar exemplo:', error);
      throw error;
    }

    console.log('Exemplo criado com sucesso:', resultado);
    return { data: resultado, error: null };
    
  } catch (error: any) {
    console.error('Erro capturado:', error);
    return { data: null, error };
  }
};

// READ - Buscar todos os registros
export const buscarExemplos = async () => {
  try {
    console.log('Buscando todos os exemplos...');
    
    const { data, error } = await supabase
      .from('exemplos')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Erro ao buscar exemplos:', error);
      throw error;
    }

    console.log(`Encontrados ${data.length} exemplos`);
    return { data, error: null };
    
  } catch (error: any) {
    console.error('Erro capturado:', error);
    return { data: null, error };
  }
};

// READ - Buscar por ID
export const buscarExemploPorId = async (id: string) => {
  try {
    console.log('Buscando exemplo por ID:', id);
    
    const { data, error } = await supabase
      .from('exemplos')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Erro ao buscar exemplo:', error);
      throw error;
    }

    console.log('Exemplo encontrado:', data);
    return { data, error: null };
    
  } catch (error: any) {
    console.error('Erro capturado:', error);
    return { data: null, error };
  }
};

// UPDATE - Atualizar registro
export const atualizarExemplo = async (id: string, updates: Partial<ExemploData>) => {
  try {
    console.log('Atualizando exemplo:', id, updates);
    
    const { data, error } = await supabase
      .from('exemplos')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Erro ao atualizar exemplo:', error);
      throw error;
    }

    console.log('Exemplo atualizado:', data);
    return { data, error: null };
    
  } catch (error: any) {
    console.error('Erro capturado:', error);
    return { data: null, error };
  }
};

// DELETE - Deletar registro
export const deletarExemplo = async (id: string) => {
  try {
    console.log('Deletando exemplo:', id);
    
    const { error } = await supabase
      .from('exemplos')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Erro ao deletar exemplo:', error);
      throw error;
    }

    console.log('Exemplo deletado com sucesso');
    return { error: null };
    
  } catch (error: any) {
    console.error('Erro capturado:', error);
    return { error };
  }
};
```

### Função com Upload de Arquivo
```typescript
// Upload de imagem para Supabase Storage
export const uploadImagem = async (file: File, pasta: string = 'uploads') => {
  try {
    console.log('Fazendo upload da imagem:', file.name);
    
    // Gerar nome único para o arquivo
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
    const filePath = `${pasta}/${fileName}`;

    // Upload do arquivo
    const { data, error } = await supabase.storage
      .from('images')
      .upload(filePath, file);

    if (error) {
      console.error('Erro no upload:', error);
      throw error;
    }

    // Obter URL público
    const { data: { publicUrl } } = supabase.storage
      .from('images')
      .getPublicUrl(filePath);

    console.log('Upload concluído:', publicUrl);
    return { url: publicUrl, path: filePath, error: null };
    
  } catch (error: any) {
    console.error('Erro no upload:', error);
    return { url: null, path: null, error };
  }
};
```

## 🎣 Custom Hooks

### Hook para Dados Assíncronos
```tsx
// src/hooks/useAsyncData.ts
import { useState, useEffect } from 'react';

export function useAsyncData<T>(
  asyncFunction: () => Promise<{ data: T | null; error: any }>,
  dependencies: any[] = []
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<any>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await asyncFunction();
      
      if (result.error) {
        setError(result.error);
      } else {
        setData(result.data);
      }
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, dependencies);

  return { data, loading, error, refetch: fetchData };
}

// Uso do hook
const MeuComponente = () => {
  const { data, loading, error, refetch } = useAsyncData(
    () => buscarExemplos(),
    [] // dependencies
  );

  if (loading) return <div>Carregando...</div>;
  if (error) return <div>Erro: {error.message}</div>;

  return (
    <div>
      <button onClick={refetch}>Recarregar</button>
      {data?.map(item => (
        <div key={item.id}>{item.nome}</div>
      ))}
    </div>
  );
};
```

### Hook para Formulários
```tsx
// src/hooks/useForm.ts
import { useState } from 'react';

export function useForm<T extends Record<string, any>>(
  initialValues: T,
  validationRules?: Partial<Record<keyof T, (value: any) => string | undefined>>
) {
  const [values, setValues] = useState<T>(initialValues);
  const [errors, setErrors] = useState<Partial<Record<keyof T, string>>>({});
  const [touched, setTouched] = useState<Partial<Record<keyof T, boolean>>>({});

  const setValue = (field: keyof T, value: any) => {
    setValues(prev => ({ ...prev, [field]: value }));
    
    // Limpar erro se existe
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  const setTouched = (field: keyof T) => {
    setTouched(prev => ({ ...prev, [field]: true }));
  };

  const validate = (): boolean => {
    if (!validationRules) return true;

    const newErrors: Partial<Record<keyof T, string>> = {};

    Object.keys(validationRules).forEach(field => {
      const rule = validationRules[field as keyof T];
      if (rule) {
        const error = rule(values[field as keyof T]);
        if (error) {
          newErrors[field as keyof T] = error;
        }
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const reset = () => {
    setValues(initialValues);
    setErrors({});
    setTouched({});
  };

  return {
    values,
    errors,
    touched,
    setValue,
    setTouched,
    validate,
    reset,
    isValid: Object.keys(errors).length === 0
  };
}

// Exemplo de uso
const FormularioExemplo = () => {
  const { values, errors, setValue, validate, reset } = useForm(
    { nome: '', email: '' },
    {
      nome: (value) => !value ? 'Nome é obrigatório' : undefined,
      email: (value) => {
        if (!value) return 'Email é obrigatório';
        if (!/\S+@\S+\.\S+/.test(value)) return 'Email inválido';
        return undefined;
      }
    }
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) {
      console.log('Formulário válido:', values);
      reset();
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        value={values.nome}
        onChange={(e) => setValue('nome', e.target.value)}
        placeholder="Nome"
      />
      {errors.nome && <span>{errors.nome}</span>}
      
      <input
        value={values.email}
        onChange={(e) => setValue('email', e.target.value)}
        placeholder="Email"
      />
      {errors.email && <span>{errors.email}</span>}
      
      <button type="submit">Enviar</button>
    </form>
  );
};
```

## 🎨 Componentes de Interface

### Loading Spinner
```tsx
// src/components/ui/LoadingSpinner.tsx
import React from 'react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  color?: string;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ 
  size = 'md', 
  color = 'text-blue-600' 
}) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12'
  };

  return (
    <div className="flex justify-center items-center">
      <div 
        className={`${sizeClasses[size]} ${color} animate-spin`}
      >
        <svg 
          className="w-full h-full" 
          viewBox="0 0 24 24" 
          fill="none"
        >
          <circle 
            className="opacity-25" 
            cx="12" 
            cy="12" 
            r="10" 
            stroke="currentColor" 
            strokeWidth="4"
          />
          <path 
            className="opacity-75" 
            fill="currentColor" 
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      </div>
    </div>
  );
};

export default LoadingSpinner;
```

### Toast/Notificação
```tsx
// src/components/ui/Toast.tsx
import React, { useEffect } from 'react';
import { CheckCircle, XCircle, AlertCircle, X } from 'lucide-react';

interface ToastProps {
  type: 'success' | 'error' | 'warning';
  title: string;
  message?: string;
  onClose: () => void;
  autoClose?: boolean;
  duration?: number;
}

const Toast: React.FC<ToastProps> = ({ 
  type, 
  title, 
  message, 
  onClose, 
  autoClose = true, 
  duration = 5000 
}) => {
  useEffect(() => {
    if (autoClose) {
      const timer = setTimeout(onClose, duration);
      return () => clearTimeout(timer);
    }
  }, [autoClose, duration, onClose]);

  const icons = {
    success: <CheckCircle className="w-6 h-6 text-green-500" />,
    error: <XCircle className="w-6 h-6 text-red-500" />,
    warning: <AlertCircle className="w-6 h-6 text-yellow-500" />
  };

  const backgroundColors = {
    success: 'bg-green-50 border-green-200',
    error: 'bg-red-50 border-red-200',
    warning: 'bg-yellow-50 border-yellow-200'
  };

  return (
    <div className={`fixed top-4 right-4 max-w-sm w-full ${backgroundColors[type]} border rounded-lg shadow-lg p-4 z-50`}>
      <div className="flex items-start">
        <div className="flex-shrink-0">
          {icons[type]}
        </div>
        <div className="ml-3 flex-1">
          <h3 className="text-sm font-medium text-gray-900">
            {title}
          </h3>
          {message && (
            <p className="mt-1 text-sm text-gray-500">
              {message}
            </p>
          )}
        </div>
        <button
          onClick={onClose}
          className="ml-4 flex-shrink-0 text-gray-400 hover:text-gray-600"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default Toast;
```

## 📝 Context Examples

### Context para Notificações
```tsx
// src/context/ToastContext.tsx
import React, { createContext, useContext, useState, ReactNode } from 'react';
import Toast from '../components/ui/Toast';

interface ToastData {
  id: string;
  type: 'success' | 'error' | 'warning';
  title: string;
  message?: string;
}

interface ToastContextType {
  showToast: (toast: Omit<ToastData, 'id'>) => void;
  showSuccess: (title: string, message?: string) => void;
  showError: (title: string, message?: string) => void;
  showWarning: (title: string, message?: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastData[]>([]);

  const showToast = (toast: Omit<ToastData, 'id'>) => {
    const id = Math.random().toString(36).substring(2);
    setToasts(prev => [...prev, { ...toast, id }]);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  };

  const showSuccess = (title: string, message?: string) => {
    showToast({ type: 'success', title, message });
  };

  const showError = (title: string, message?: string) => {
    showToast({ type: 'error', title, message });
  };

  const showWarning = (title: string, message?: string) => {
    showToast({ type: 'warning', title, message });
  };

  return (
    <ToastContext.Provider value={{ showToast, showSuccess, showError, showWarning }}>
      {children}
      <div className="fixed top-0 right-0 z-50 space-y-2 p-4">
        {toasts.map(toast => (
          <Toast
            key={toast.id}
            type={toast.type}
            title={toast.title}
            message={toast.message}
            onClose={() => removeToast(toast.id)}
          />
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast deve ser usado dentro de ToastProvider');
  }
  return context;
};

// Uso do Context
const MeuComponente = () => {
  const { showSuccess, showError } = useToast();

  const handleAction = async () => {
    try {
      // Sua lógica aqui
      showSuccess('Sucesso!', 'Ação executada com sucesso');
    } catch (error) {
      showError('Erro!', 'Falha ao executar ação');
    }
  };

  return (
    <button onClick={handleAction}>
      Executar Ação
    </button>
  );
};
```

---

*Exemplos atualizados em: Novembro 2024*