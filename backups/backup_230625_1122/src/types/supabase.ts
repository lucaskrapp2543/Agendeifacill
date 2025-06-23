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
            open: string;
            close: string;
          }>;
          services_with_prices: Array<{
            id: string;
            name: string;
            price: number;
            duration: number;
          }>;
          professionals: Array<{
            id: string;
            name: string;
            specialties: string[];
          }>;
          profile_image_url?: string;
          affiliate_link?: string;
          custom_photo_1_url?: string;
          custom_photo_2_url?: string;
          custom_photo_3_url?: string;
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
      }
    }
  }
}

