import React, { useState } from 'react';
import { Calendar, Trash2 } from 'lucide-react';
import { format } from 'date-fns';

const BusinessDashboard: React.FC = () => {
  const [todayAppointments, setTodayAppointments] = useState([]);
  const [premiumClients, setPremiumClients] = useState([]);
  const [services, setServices] = useState([]);
  const [newServiceName, setNewServiceName] = useState('');
  const [newServicePrice, setNewServicePrice] = useState(0);

  const handleLogout = () => {
    // Implement the logout functionality
  };

  const handleCancelAppointment = (id) => {
    // Implement the cancel appointment functionality
  };

  const handleDeleteService = (id) => {
    // Implement the delete service functionality
  };

  const handleAddService = (e) => {
    e.preventDefault();
    // Implement the add service functionality
  };

  return (
    <div className="min-h-screen bg-[#101112]">
      <header className="bg-[#1a1b1c] border-b border-gray-800">
        <div className="container-custom py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Calendar className="h-6 w-6 text-primary" />
              <span className="text-xl font-bold text-white">AgendaFácil</span>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-gray-400">{user?.email}</span>
              <button onClick={handleLogout} className="btn-outline">
                Sair
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="container-custom py-8">
        <div className="flex flex-col md:flex-row gap-8">
          <div className="w-full md:w-1/3">
            <div className="card mb-6">
              <h2 className="text-lg font-semibold mb-4 text-white">Agendamentos de Hoje</h2>
              <div className="space-y-4">
                {todayAppointments.map((appointment) => (
                  <div key={appointment.id} className="p-4 rounded-lg bg-[#242628] border border-gray-800">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h3 className="font-medium text-white">{appointment.serviceName}</h3>
                        <p className="text-sm text-gray-400">{appointment.clientName}</p>
                      </div>
                      {appointment.isPremium && (
                        <span className="px-2 py-1 text-xs font-medium bg-primary/20 text-primary rounded-full">
                          Premium
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-gray-400">
                      <p>Horário: {appointment.time}</p>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={() => handleCancelAppointment(appointment.id)}
                        className="btn-outline text-sm py-1"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={() => window.open(`https://wa.me/${appointment.clientWhatsApp}`, '_blank')}
                        className="btn-primary text-sm py-1"
                      >
                        WhatsApp
                      </button>
                    </div>
                  </div>
                ))}
                {todayAppointments.length === 0 && (
                  <p className="text-gray-400 text-center py-4">
                    Nenhum agendamento para hoje.
                  </p>
                )}
              </div>
            </div>

            <div className="card">
              <h2 className="text-lg font-semibold mb-4 text-white">Clientes Premium</h2>
              <div className="space-y-4">
                {premiumClients.map((client) => (
                  <div key={client.id} className="p-4 rounded-lg bg-[#242628] border border-gray-800">
                    <h3 className="font-medium text-white mb-1">{client.name}</h3>
                    <p className="text-sm text-gray-400">
                      Desde {format(new Date(client.startDate), 'dd/MM/yyyy')}
                    </p>
                    <button
                      onClick={() => window.open(`https://wa.me/${client.whatsApp}`, '_blank')}
                      className="btn-primary text-sm py-1 mt-2"
                    >
                      WhatsApp
                    </button>
                  </div>
                ))}
                {premiumClients.length === 0 && (
                  <p className="text-gray-400 text-center py-4">
                    Nenhum cliente premium.
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="w-full md:w-2/3">
            <div className="card">
              <h2 className="text-lg font-semibold mb-6 text-white">Gerenciar Serviços</h2>
              
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {services.map((service) => (
                    <div key={service.id} className="p-4 rounded-lg bg-[#242628] border border-gray-800">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h3 className="font-medium text-white">{service.name}</h3>
                          <p className="text-sm text-gray-400">R$ {service.price.toFixed(2)}</p>
                        </div>
                        <button
                          onClick={() => handleDeleteService(service.id)}
                          className="text-gray-400 hover:text-error"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="border-t border-gray-800 pt-6">
                  <h3 className="text-md font-medium mb-4 text-white">Adicionar Novo Serviço</h3>
                  <form onSubmit={handleAddService} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-1">
                        Nome do Serviço
                      </label>
                      <input
                        type="text"
                        value={newServiceName}
                        onChange={(e) => setNewServiceName(e.target.value)}
                        required
                        className="input-field"
                        placeholder="Ex: Corte de Cabelo"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-1">
                        Preço (R$)
                      </label>
                      <input
                        type="number"
                        value={newServicePrice}
                        onChange={(e) => setNewServicePrice(Number(e.target.value))}
                        required
                        min="0"
                        step="0.01"
                        className="input-field"
                        placeholder="0.00"
                      />
                    </div>

                    <button type="submit" className="btn-primary">
                      Adicionar Serviço
                    </button>
                  </form>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default BusinessDashboard; 