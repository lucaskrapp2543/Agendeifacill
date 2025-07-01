import React, { useState } from 'react';
import { Calendar, Clock, User, DollarSign, CreditCard } from 'lucide-react';

interface TimeSlot {
  time: string;
  isAvailable: boolean;
}

const DemoBooking = () => {
  // Função para formatar a data atual no formato YYYY-MM-DD
  const getCurrentDate = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [selectedService, setSelectedService] = useState('');
  const [selectedProfessional, setSelectedProfessional] = useState('');
  const [selectedDate, setSelectedDate] = useState(getCurrentDate());
  const [selectedTime, setSelectedTime] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');

  const demoServices = [
    { id: '1', name: 'Serviço 1', duration: '30min', price: 'R$ 50,00' },
    { id: '2', name: 'Serviço 2', duration: '45min', price: 'R$ 75,00' },
    { id: '3', name: 'Serviço 3', duration: '60min', price: 'R$ 100,00' },
  ];

  const demoProfessionals = [
    { id: '1', name: 'Profissional 1' },
    { id: '2', name: 'Profissional 2' },
    { id: '3', name: 'Profissional 3' },
  ];

  const demoTimes: TimeSlot[] = [
    { time: '09:00', isAvailable: true },
    { time: '10:00', isAvailable: true },
    { time: '11:00', isAvailable: false },
    { time: '14:00', isAvailable: false },
    { time: '15:00', isAvailable: true },
    { time: '16:00', isAvailable: true }
  ];

  const paymentMethods = [
    { id: 'pix', name: 'PIX', icon: '💸' },
    { id: 'cash', name: 'Dinheiro', icon: '💵' },
    { id: 'card', name: 'Cartão', icon: '💳' },
  ];

  const handleNext = () => {
    if (step < 5) {
      setStep(step + 1);
    } else {
      alert('Esse foi um agendamento simulado. Obrigado!');
      setStep(1);
      setName('');
      setWhatsapp('');
      setSelectedService('');
      setSelectedProfessional('');
      setSelectedDate('');
      setSelectedTime('');
      setPaymentMethod('');
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const isStepValid = () => {
    switch (step) {
      case 1:
        return name && whatsapp;
      case 2:
        return selectedService;
      case 3:
        return selectedProfessional;
      case 4:
        return selectedDate && selectedTime;
      case 5:
        return paymentMethod;
      default:
        return false;
    }
  };

  return (
    <div className="max-w-md mx-auto bg-[#1a1a1a] rounded-xl shadow-xl p-6">
      {/* Imagem de exemplo */}
      <div className="mb-6">
        <img 
          src="/ftexemploagendamento.png" 
          alt="Exemplo de Agendamento" 
          className="w-full rounded-lg shadow-lg"
        />
      </div>

      {/* Barra de Progresso */}
      <div className="flex justify-between mb-8">
        {[1, 2, 3, 4, 5].map((number) => (
          <div
            key={number}
            className={`w-8 h-8 rounded-full flex items-center justify-center ${
              step === number
                ? 'bg-blue-600 text-white'
                : step > number
                ? 'bg-blue-900 text-blue-200'
                : 'bg-[#2a2a2a] text-gray-400'
            }`}
          >
            {number}
          </div>
        ))}
      </div>

      {/* Título */}
      <h2 className="text-2xl font-bold text-center mb-6">Agendar Horário</h2>

      <form className="p-6" onSubmit={(e) => e.preventDefault()}>
        {/* Etapa 1: Dados do Cliente */}
        {step === 1 && (
          <div>
            <div className="mb-6">
              <label className="block text-sm font-medium mb-2">Nome do Cliente</label>
              <input
                type="text"
                placeholder="Digite seu nome"
                className="w-full p-3 bg-[#2a2a2a] rounded-lg text-white placeholder-gray-400"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="mb-6">
              <label className="flex items-center text-sm font-medium mb-2">
                <span className="mr-2">📱</span> WhatsApp
              </label>
              <input
                type="tel"
                placeholder="(00) 00000-0000"
                className="w-full p-3 bg-[#2a2a2a] rounded-lg text-white placeholder-gray-400"
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                required
              />
            </div>
          </div>
        )}

        {/* Etapa 2: Escolha do Serviço */}
        {step === 2 && (
          <div>
            <h3 className="text-lg font-medium mb-4">Escolha o Serviço</h3>
            <div className="space-y-3">
              {demoServices.map((service) => (
                <button
                  key={service.id}
                  type="button"
                  className={`w-full flex items-center justify-between p-4 rounded-lg ${
                    selectedService === service.id
                      ? 'bg-blue-600'
                      : 'bg-[#2a2a2a] hover:bg-[#3a3a3a]'
                  }`}
                  onClick={() => setSelectedService(service.id)}
                >
                  <div className="flex items-center">
                    <span>{service.name}</span>
                  </div>
                  <div className="flex items-center space-x-4 text-sm text-gray-400">
                    <div className="flex items-center">
                      <Clock className="w-4 h-4 mr-1" />
                      <span>{service.duration}</span>
                    </div>
                    <span>{service.price}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Etapa 3: Escolha do Profissional */}
        {step === 3 && (
          <div>
            <h3 className="text-lg font-medium mb-4">Escolha o Profissional</h3>
            <div className="space-y-3">
              {demoProfessionals.map((professional) => (
                <button
                  key={professional.id}
                  type="button"
                  className={`w-full flex items-center p-4 rounded-lg ${
                    selectedProfessional === professional.id
                      ? 'bg-blue-600'
                      : 'bg-[#2a2a2a] hover:bg-[#3a3a3a]'
                  }`}
                  onClick={() => setSelectedProfessional(professional.id)}
                >
                  <User className="w-5 h-5 mr-3" />
                  <span>{professional.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Etapa 4: Data e Hora */}
        {step === 4 && (
          <div>
            <h3 className="text-lg font-medium mb-4">Escolha a Data e Horário</h3>
            <div className="mb-6">
              <label className="block text-sm font-medium mb-2">Data</label>
              <input
                type="date"
                className="w-full p-3 bg-[#2a2a2a] rounded-lg text-white"
                value={selectedDate}
                min={getCurrentDate()}
                onChange={(e) => setSelectedDate(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Horário</label>
              <div className="grid grid-cols-3 gap-3">
                {demoTimes.map((timeSlot) => (
                  <button
                    key={timeSlot.time}
                    type="button"
                    disabled={!timeSlot.isAvailable}
                    className={`p-3 rounded-lg text-center ${
                      !timeSlot.isAvailable
                        ? 'bg-red-900/50 text-red-200 cursor-not-allowed'
                        : selectedTime === timeSlot.time
                        ? 'bg-green-600 text-white'
                        : 'bg-green-900/50 hover:bg-green-800/50 text-green-200'
                    }`}
                    onClick={() => timeSlot.isAvailable && setSelectedTime(timeSlot.time)}
                  >
                    {timeSlot.time}
                    <div className="text-xs mt-1">
                      {timeSlot.isAvailable ? 'Disponível' : 'Reservado'}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Etapa 5: Forma de Pagamento */}
        {step === 5 && (
          <div>
            <h3 className="text-lg font-medium mb-4">Forma de Pagamento</h3>
            <div className="space-y-3">
              {paymentMethods.map((method) => (
                <button
                  key={method.id}
                  type="button"
                  className={`w-full flex items-center p-4 rounded-lg ${
                    paymentMethod === method.id
                      ? 'bg-blue-600'
                      : 'bg-[#2a2a2a] hover:bg-[#3a3a3a]'
                  }`}
                  onClick={() => setPaymentMethod(method.id)}
                >
                  <span className="mr-3">{method.icon}</span>
                  <span>{method.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Botões de Navegação */}
        <div className="flex justify-between mt-8">
          <button
            type="button"
            onClick={handleBack}
            className={`px-6 py-3 rounded-lg ${
              step === 1 ? 'invisible' : 'bg-gray-700 hover:bg-gray-600'
            }`}
          >
            Voltar
          </button>
          <button
            type="button"
            onClick={handleNext}
            disabled={!isStepValid()}
            className="px-6 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {step === 5 ? 'Finalizar Simulação' : 'Próximo'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default DemoBooking; 