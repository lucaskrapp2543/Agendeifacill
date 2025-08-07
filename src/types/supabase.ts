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
        };
        Insert: {
          establishment_id: string;
          name: string;
          value: number;
          duration_months: number;
        };
        Update: {
          name?: string;
          value?: number;
          duration_months?: number;
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

