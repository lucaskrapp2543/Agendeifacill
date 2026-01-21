export interface Database {
  public: {
    Tables: {
      appointments: {
        Row: {
          id: string;
          created_at: string;
          establishment_id: string;
          establishment_name: string;
          service_name: string;
          service_price: number;
          appointment_date: string;
          appointment_time: string;
          professional_name?: string;
          duration?: number;
          client_id: string;
          client_name: string;
          status: 'pending' | 'confirmed' | 'cancelled';
          is_premium: boolean;
          payment_method?: string;
          is_subscriber?: boolean; // Nova coluna para indicar se é assinante
          is_avulso?: boolean; // Nova coluna para indicar se é reserva avulsa
          is_squeeze?: boolean; // Indica se é um encaixe (tempo manual)
          price?: number; // Preço do agendamento
          price_original?: number | null; // Preço original (antes de cupom)
          coupon_code?: string | null; // Cupom aplicado (código)
          coupon_discount_percent?: number | null; // Desconto em %
          coupon_discount_amount?: number | null; // Valor do desconto em R$
          total_price?: number; // Preço total incluindo produtos extras
        }
      },
      establishments: {
        Row: {
          id: string;
          created_at: string;
          updated_at: string;
          name: string;
          description: string;
          code: string;
          owner_id: string;
          business_hours: Record<string, {
            enabled: boolean;
            open1: string;
            close1: string;
            open2: string | null;
            close2: string | null;
          }>;
          services_with_prices: Array<Service>;
          professionals: Array<Professional>;
          profile_image_url?: string;
          affiliate_link?: string;
          custom_photo_1_url?: string;
          custom_photo_2_url?: string;
          custom_photo_3_url?: string;
          pix_key_type?: string;
          pix_key?: string;
          review_link?: string;
          social_media_link?: string;
          pix_payment_link?: string;
          location_link?: string; // Nova coluna para o link do local
          has_wifi?: boolean; // Nova coluna para comodidade Wi-fi
          has_parking?: boolean; // Nova coluna para comodidade Estacionamento
          has_accessibility?: boolean; // Nova coluna para comodidade Acessibilidade
          wifi_password?: string; // Senha do Wi-Fi disponibilizada pelo estabelecimento
          onboarding_step?: number; // Controla o progresso do onboarding (1=página agendamento, 2=profissional, 3=serviço, 4=completo)
        }
      },
      premium_subscribers: {
        Row: {
          id: string;
          created_at: string;
          display_name: string;
          whatsapp: string;
          user_id: string;
          establishment_id: string;
          is_winner?: boolean;
          winner_position?: number;
          last_draw_date?: string;
        }
      },
      favorite_establishments: {
        Row: {
          id: string;
          created_at: string;
          user_id: string;
          establishment_id: string;
          establishment_name: string;
          establishment_code: string;
        }
      },
      subscriptions: {
        Row: {
          id: string;
          created_at: string;
          establishment_id: string;
          name: string;
          value: number;
          duration_months: number;
          custom_link?: string | null;
        };
        Insert: {
          establishment_id: string;
          name: string;
          value: number;
          duration_months: number;
          custom_link?: string | null;
        };
        Update: {
          name?: string;
          value?: number;
          duration_months?: number;
          custom_link?: string | null;
        };
      };
      discount_coupons: {
        Row: {
          id: string;
          establishment_id: string;
          code: string;
          discount_percent: number;
          is_active: boolean;
          usage_count: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          establishment_id: string;
          code: string;
          discount_percent: number;
          is_active?: boolean;
        };
        Update: {
          code?: string;
          discount_percent?: number;
          is_active?: boolean;
        };
      };
      client_subscriptions: {
        Row: {
          id: string;
          created_at: string;
          client_id: string;
          subscription_id: string;
          establishment_id: string;
          start_date: string;
          end_date: string;
          payment_status: 'paid' | 'unpaid';
          last_payment_date: string | null;
        };
        Insert: {
          client_id: string;
          subscription_id: string;
          establishment_id: string;
          start_date: string;
          end_date: string;
          payment_status?: 'paid' | 'unpaid';
          last_payment_date?: string;
        };
        Update: {
          payment_status?: 'paid' | 'unpaid';
          last_payment_date?: string;
        };
      };
      profiles: {
        Row: {
          id: string;
          created_at: string;
          user_id: string;
          full_name: string;
          role: 'client' | 'premium' | 'establishment';
          is_subscriber: boolean; // Nova coluna
          birthday: string | null; // Campo de aniversário
        }
      },
      establishment_expenses: {
        Row: {
          id: string;
          establishment_id: string;
          name: string;
          amount: number;
          professional?: string;
          expense_date: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          establishment_id: string;
          name: string;
          amount: number;
          professional?: string;
          expense_date: string;
        };
        Update: {
          name?: string;
          amount?: number;
          professional?: string;
          expense_date?: string;
        };
      }
    }
  }
}

export type Establishment = Database['public']['Tables']['establishments']['Row'];

export interface Professional {
  id: string;
  name: string;
  specialties: string[];
}

export interface Service {
  id: string;
  name: string;
  price: number;
  duration: number;
}

export interface BusinessHours {
  enabled: boolean;
  open1: string;
  close1: string;
  open2: string | null;
  close2: string | null;
}

