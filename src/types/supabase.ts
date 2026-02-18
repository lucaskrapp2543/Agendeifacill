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
          subscription_id?: string | null;
          subscriber_service_id?: string | null;
          subscriber_service_name?: string | null;
          subscriber_service_limit?: number | null;
          payment_split_details?: Array<{
            method: string;
            amount: number;
            card_brand?: string | null;
          }> | null;
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
          // ✅ Fila de Espera
          fila_espera_ativa?: boolean;
          fila_espera_fechada?: boolean;
          fila_espera_profissional_id?: string | null; // modo legado (fila única)
          fila_espera_profissional_ids?: string[] | null; // novo: até 3 filas (por profissional)
          show_subscriptions_fullpage?: boolean; // Mostrar assinaturas por completo no Booking
          use_60_minute_schedule?: boolean; // Mostrar horários de 1 em 1 hora no booking
          booking_min_advance_hours?: number; // Antecedencia minima (em horas) para agendamento no booking
          hide_from_top10_ranking?: boolean; // Se true, estabelecimento não entra no ranking TOP 10
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
          sort_order?: number;
          custom_link?: string | null;
          credit_card_link?: string | null;
          is_hidden?: boolean;
          description?: string | null;
          weekdays?: string[] | null;
          service_duration?: number | null;
          fixed_commission_value?: number | null;
          monthly_service_limit?: number | null;
          divide_total_enabled?: boolean | null;
          divide_total_attendances?: number | null;
          divide_services_enabled?: boolean | null;
          divided_services?: any[] | null;
        };
        Insert: {
          establishment_id: string;
          name: string;
          value: number;
          duration_months: number;
          sort_order?: number;
          custom_link?: string | null;
          credit_card_link?: string | null;
          is_hidden?: boolean;
          description?: string | null;
          weekdays?: string[] | null;
          service_duration?: number | null;
          fixed_commission_value?: number | null;
          monthly_service_limit?: number | null;
          divide_total_enabled?: boolean | null;
          divide_total_attendances?: number | null;
          divide_services_enabled?: boolean | null;
          divided_services?: any[] | null;
        };
        Update: {
          name?: string;
          value?: number;
          duration_months?: number;
          sort_order?: number;
          custom_link?: string | null;
          credit_card_link?: string | null;
          is_hidden?: boolean;
          description?: string | null;
          weekdays?: string[] | null;
          service_duration?: number | null;
          fixed_commission_value?: number | null;
          monthly_service_limit?: number | null;
          divide_total_enabled?: boolean | null;
          divide_total_attendances?: number | null;
          divide_services_enabled?: boolean | null;
          divided_services?: any[] | null;
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
          subscriber_payment_method?: string | null;
          subscriber_observation?: string | null;
        };
        Insert: {
          client_id: string;
          subscription_id: string;
          establishment_id: string;
          start_date: string;
          end_date: string;
          payment_status?: 'paid' | 'unpaid';
          last_payment_date?: string;
          subscriber_payment_method?: string | null;
          subscriber_observation?: string | null;
        };
        Update: {
          payment_status?: 'paid' | 'unpaid';
          last_payment_date?: string;
          subscriber_payment_method?: string | null;
          subscriber_observation?: string | null;
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
          professional_id?: string;
          observation?: string | null;
          expense_context?: 'financial' | 'sidebar' | null;
          expense_date: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          establishment_id: string;
          name: string;
          amount: number;
          professional?: string;
          professional_id?: string;
          observation?: string | null;
          expense_context?: 'financial' | 'sidebar' | null;
          expense_date: string;
        };
        Update: {
          name?: string;
          amount?: number;
          professional?: string;
          professional_id?: string;
          observation?: string | null;
          expense_context?: 'financial' | 'sidebar' | null;
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

