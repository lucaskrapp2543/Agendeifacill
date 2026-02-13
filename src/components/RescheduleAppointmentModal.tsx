import React, { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { TimeSlotSelector } from './TimeSlotSelector';
import { useToast } from './ui/Toaster';

interface EstablishmentForReschedule {
  id: string;
  business_hours: Record<string, {
    enabled: boolean;
    open1: string;
    close1: string;
    open2: string | null;
    close2: string | null;
  }>;
  professionals: Array<{
    id: string;
    name: string;
    work_hours?: {
      [key: string]: {
        enabled: boolean;
        entry_time?: string;
        break_start?: string;
        break_end?: string;
        exit_time?: string;
      };
    } | null;
    absences?: string[];
    blocked_hours?: Record<string, string[]>;
  }>;
}

interface AppointmentForReschedule {
  id: string;
  client_name: string;
  service: string;
  professional: string; // id do profissional
  appointment_date: string; // yyyy-MM-dd
  appointment_time: string; // HH:mm
  duration: number;
}

interface RescheduleAppointmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (appointmentId: string, newDate: string, newTime: string) => Promise<void>;
  appointment: AppointmentForReschedule | null;
  establishment: EstablishmentForReschedule;
  use15MinuteInterval?: boolean;
  use20MinuteSchedule?: boolean;
  use60MinuteSchedule?: boolean;
  closedTimeEnabled?: boolean;
}

const parseYyyyMmDdToDateNoon = (yyyyMmDd: string): Date => {
  const [y, m, d] = String(yyyyMmDd || '').split('-').map(Number);
  return new Date(y || 1970, (m || 1) - 1, d || 1, 12, 0, 0);
};

export function RescheduleAppointmentModal({
  isOpen,
  onClose,
  onConfirm,
  appointment,
  establishment,
  use15MinuteInterval = false,
  use20MinuteSchedule = false,
  use60MinuteSchedule = false,
  closedTimeEnabled = false,
}: RescheduleAppointmentModalProps) {
  const { toast } = useToast();
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [existingAppointments, setExistingAppointments] = useState<Array<{
    id: string;
    appointment_date: string;
    appointment_time: string;
    duration: number;
    status?: string;
  }>>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const professional = useMemo(() => {
    if (!appointment) return null;
    return establishment.professionals.find((p) => p.id === appointment.professional) || null;
  }, [appointment, establishment.professionals]);

  const professionalAbsences = useMemo(() => {
    const a = (professional as any)?.absences;
    return Array.isArray(a) ? a : [];
  }, [professional]);

  const professionalBlockedHours = useMemo(() => {
    if (!professional || !selectedDate) return [];
    const bh = (professional as any)?.blocked_hours || {};
    const list = bh?.[selectedDate];
    return Array.isArray(list) ? list : [];
  }, [professional, selectedDate]);

  const businessHoursForSelectedDay = useMemo(() => {
    const d = parseYyyyMmDdToDateNoon(selectedDate || appointment?.appointment_date || '');
    const dayKey = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][d.getDay()];
    const bh = establishment.business_hours?.[dayKey];
    return (
      bh || {
        enabled: false,
        open1: '',
        close1: '',
        open2: null,
        close2: null,
      }
    );
  }, [selectedDate, appointment?.appointment_date, establishment.business_hours]);

  // Inicializar quando abrir
  useEffect(() => {
    if (!isOpen || !appointment) return;
    setSelectedDate(String(appointment.appointment_date || ''));
    setSelectedTime(String(appointment.appointment_time || ''));
    setExistingAppointments([]);
  }, [isOpen, appointment]);

  // Buscar agendamentos do profissional no dia selecionado (para bloquear horários ocupados)
  useEffect(() => {
    const run = async () => {
      if (!isOpen || !appointment || !selectedDate) return;
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('appointments')
          .select('id, appointment_date, appointment_time, duration, status, professional')
          .eq('establishment_id', establishment.id)
          .eq('professional', appointment.professional)
          .eq('appointment_date', selectedDate)
          .order('appointment_time', { ascending: true });

        if (error) throw error;

        const rows = (data || [])
          .filter((row: any) => String(row?.id) !== String(appointment.id))
          .map((row: any) => ({
            id: String(row.id),
            appointment_date: String(row.appointment_date),
            appointment_time: String(row.appointment_time),
            duration: Number(row.duration || 30),
            status: row.status ? String(row.status) : undefined,
          }));

        setExistingAppointments(rows);
      } catch (e) {
        console.error('❌ Erro ao buscar horários ocupados:', e);
        toast('Não consegui carregar os horários disponíveis. Tente novamente.', 'error');
        setExistingAppointments([]);
      } finally {
        setIsLoading(false);
      }
    };

    run();
  }, [isOpen, appointment, selectedDate, establishment.id, toast]);

  const handleClose = () => {
    if (isSaving) return;
    onClose();
  };

  const handleSave = async () => {
    if (!appointment) return;
    if (!selectedDate || !selectedTime) {
      toast('Selecione uma data e um horário.', 'error');
      return;
    }

    setIsSaving(true);
    try {
      await onConfirm(appointment.id, selectedDate, selectedTime);
      onClose();
    } catch (e) {
      // erro já tratado no caller
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen || !appointment) return null;

  const selectedDateObj = parseYyyyMmDdToDateNoon(selectedDate);
  const profName = professional?.name || 'Profissional';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Trocar horário</h3>
              <p className="text-sm text-gray-600">
                {appointment.client_name} • {appointment.service} • {profName}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Atual: {appointment.appointment_date} às {appointment.appointment_time}
              </p>
            </div>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
              disabled={isSaving}
              title="Fechar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="md:col-span-1">
              <label className="block text-sm font-medium text-gray-800 mb-2">Data</label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => {
                  const v = e.target.value;
                  setSelectedDate(v);
                  setSelectedTime('');
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
                disabled={isSaving}
              />

              <div className="mt-3 text-xs text-gray-600">
                <div><strong>Duração:</strong> {appointment.duration || 30} min</div>
                <div><strong>Carregando:</strong> {isLoading ? 'sim' : 'não'}</div>
              </div>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-800 mb-2">Horários disponíveis</label>

              <div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                <TimeSlotSelector
                  selectedDate={selectedDateObj}
                  selectedDuration={Number(appointment.duration || 30)}
                  existingAppointments={existingAppointments}
                  selectedTime={selectedTime}
                  onTimeSelect={(t) => setSelectedTime(t)}
                  businessHours={businessHoursForSelectedDay}
                  selectedProfessional={appointment.professional}
                  professionalAbsences={professionalAbsences}
                  professionalBlockedHours={professionalBlockedHours}
                  professionalWorkHours={professional?.work_hours || null}
                  filterPastTimes={true}
                  use15MinuteInterval={use15MinuteInterval}
                  use20MinuteSchedule={use20MinuteSchedule}
                  use60MinuteSchedule={use60MinuteSchedule}
                  closedTimeEnabled={closedTimeEnabled}
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isSaving}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isSaving || !selectedDate || !selectedTime}
              title={!selectedTime ? 'Selecione um horário' : 'Salvar'}
            >
              {isSaving ? 'Salvando...' : `Salvar (${selectedDate || ''} ${selectedTime || ''})`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

