export interface Database {
  public: {
    Tables: {
      appointments: {
        Row: {
          id: string;
          created_at: string;
          establishment_name: string;
          service_name: string;
          service_price: number;
          appointment_date: string;
          appointment_time: string;
          professional_name?: string;
          duration?: number;
        }
      }
    }
  }
}

