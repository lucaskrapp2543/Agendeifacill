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
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

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
    { id: 'cash', name: 'Pagar no local', icon: '💵' },
    { id: 'card', name: 'Cartão', icon: '💳' },
  ];

  const handleNext = () => {
    if (step < 5) {
      setStep(step + 1);
    } else {
      alert('✨ Demonstração concluída com sucesso! ✨\n\nAgora você já sabe como seus clientes irão agendar com você.\nCrie sua conta e comece a receber agendamentos hoje mesmo! 🚀');
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
        return selectedTime !== '';
      case 5:
        return paymentMethod;
      default:
        return false;
    }
  };

  return (
    <div className="max-w-md mx-auto bg-white rounded-xl shadow-xl p-6">
      {/* Imagem de exemplo */}
      <div className="relative mb-6">
        <img 
          src="/ftexemploagendamento.png" 
          alt="Exemplo de Agendamento" 
          className="w-full rounded-lg shadow-lg"
        />
        {/* Logo sobreposta */}
        <div className="absolute top-[85%] left-1/2 transform -translate-x-1/2 -translate-y-1/2">
          <img 
            src="/sualogoaqui.png" 
            alt="Logo do Estabelecimento" 
            className="w-24 h-24 rounded-full object-cover border-2 border-white"
          />
        </div>
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
                ? 'bg-blue-200 text-blue-600'
                : 'bg-gray-200 text-gray-600'
            }`}
          >
            {number}
          </div>
        ))}
      </div>

      {/* Título */}
      <h2 className="text-2xl font-bold text-center mb-6 text-gray-800">Agendar Horário</h2>

      <form className="p-6" onSubmit={(e) => e.preventDefault()}>
        {/* Etapa 1: Dados do Cliente */}
        {step === 1 && (
          <div>
            <div className="mb-6">
              <label className="block text-sm font-medium mb-2 text-gray-700">Nome do Cliente</label>
              <input
                type="text"
                placeholder="Digite seu nome"
                className="w-full p-3 bg-gray-100 rounded-lg text-gray-800 placeholder-gray-500 border border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="mb-6">
              <label className="flex items-center text-sm font-medium mb-2 text-gray-700">
                <img src="/wppicon.png" alt="WhatsApp" className="w-5 h-5 mr-2" /> WhatsApp
              </label>
              <input
                type="tel"
                placeholder="(00) 00000-0000"
                className="w-full p-3 bg-gray-100 rounded-lg text-gray-800 placeholder-gray-500 border border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
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
            <h3 className="text-lg font-medium mb-4 text-gray-800">Escolha o Serviço</h3>
            <div className="space-y-3">
              {demoServices.map((service) => (
                <button
                  key={service.id}
                  className={`w-full p-4 rounded-lg text-left ${
                    selectedService === service.id
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-800'
                  }`}
                  onClick={() => setSelectedService(service.id)}
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="text-lg">Serviço {service.id}</span>
                      <div className="flex items-center gap-2 text-sm mt-1">
                        <Clock size={14} />
                        <span>{service.duration}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-sm">R$</span>
                      <span className="text-lg ml-1">{service.price.replace('R$ ', '')}</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Etapa 3: Escolha do Profissional */}
        {step === 3 && (
          <div>
            <h3 className="text-lg font-medium mb-4 text-gray-800">Escolha o Profissional</h3>
            <div className="space-y-3">
              {demoProfessionals.map((professional) => (
                <button
                  key={professional.id}
                  className={`w-full p-4 rounded-lg text-left ${
                    selectedProfessional === professional.id
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-800'
                  }`}
                  onClick={() => setSelectedProfessional(professional.id)}
                >
                  <div className="flex items-center">
                    <User className="mr-3" />
                    <span className="text-lg">{professional.name}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Etapa 4: Escolha da Data e Hora */}
        {step === 4 && (
          <div>
            <h3 className="text-lg font-medium mb-4 text-gray-800">Escolha a Data e Hora</h3>
            <div className="mb-6">
              <label className="block text-sm font-medium mb-2 text-gray-700">Data</label>
              <input
                type="date"
                className="w-full p-3 bg-gray-100 rounded-lg text-gray-800 border border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                value={getCurrentDate()}
                readOnly
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-700">Horário</label>
              <div className="grid grid-cols-2 gap-3">
                {demoTimes.map((slot) => (
                  <button
                    key={slot.time}
                    className={`p-3 rounded-lg text-center ${
                      !slot.isAvailable
                        ? 'bg-red-600 text-white cursor-not-allowed'
                        : selectedTime === slot.time
                        ? 'bg-green-600 text-white'
                        : 'bg-green-600 hover:bg-green-700 text-white'
                    }`}
                    onClick={() => slot.isAvailable && setSelectedTime(slot.time)}
                    disabled={!slot.isAvailable}
                  >
                    <div className="text-lg mb-1">{slot.time}</div>
                    <div className="text-sm">
                      {slot.isAvailable ? 'Disponível' : 'Reservado'}
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
            <h3 className="text-lg font-medium mb-4 text-gray-800">Forma de Pagamento</h3>
            <div className="space-y-3">
              {paymentMethods.map((method) => (
                <button
                  key={method.id}
                  className={`w-full p-4 rounded-lg text-left ${
                    paymentMethod === method.id
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-800'
                  }`}
                  onClick={() => setPaymentMethod(method.id)}
                >
                  <div className="flex items-center">
                    <span className="text-2xl mr-3">{method.icon}</span>
                    <span className="text-lg">{method.name}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Botões de Navegação */}
        <div className="flex justify-between mt-8">
          {step > 1 && (
            <button
              onClick={handleBack}
              className="px-6 py-2 bg-gray-100 text-gray-800 rounded-lg hover:bg-gray-200"
            >
              Voltar
            </button>
          )}
          <button
            onClick={handleNext}
            disabled={!isStepValid()}
            className={`px-6 py-2 rounded-lg ml-auto font-medium ${
              isStepValid()
                ? 'bg-green-600 text-white hover:bg-green-700'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            {step === 5 ? 'Concluir' : 'Próximo'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default DemoBooking; 