import React, { useState, useEffect } from 'react';
import { X, Users, CheckCircle, AlertCircle, Download } from 'lucide-react';
import { recoverClientsFromAppointments, RecoveredClient, migrateRecoveredClients } from '../utils/recoverClientsFromAppointments';
import { useToast } from './ui/Toaster';

interface ClientRecoveryModalProps {
  isOpen: boolean;
  onClose: () => void;
  establishmentId: string;
  onClientsRecovered: () => void;
}

export const ClientRecoveryModal: React.FC<ClientRecoveryModalProps> = ({
  isOpen,
  onClose,
  establishmentId,
  onClientsRecovered
}) => {
  const { toast } = useToast();
  const [recoveredClients, setRecoveredClients] = useState<RecoveredClient[]>([]);
  const [loading, setLoading] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const [selectedClients, setSelectedClients] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (isOpen) {
      loadRecoveredClients();
    }
  }, [isOpen, establishmentId]);

  const loadRecoveredClients = async () => {
    setLoading(true);
    try {
      const clients = await recoverClientsFromAppointments(establishmentId);
      setRecoveredClients(clients);
      
      // Selecionar todos por padrão
      setSelectedClients(new Set(clients.map(c => c.whatsapp)));
      
      if (clients.length === 0) {
        toast('Nenhum cliente encontrado nos agendamentos para recuperar.', 'info');
      }
    } catch (error) {
      console.error('Erro ao carregar clientes:', error);
      toast('Erro ao carregar clientes dos agendamentos.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectClient = (whatsapp: string) => {
    const newSelected = new Set(selectedClients);
    if (newSelected.has(whatsapp)) {
      newSelected.delete(whatsapp);
    } else {
      newSelected.add(whatsapp);
    }
    setSelectedClients(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedClients.size === recoveredClients.length) {
      setSelectedClients(new Set());
    } else {
      setSelectedClients(new Set(recoveredClients.map(c => c.whatsapp)));
    }
  };

  const handleMigrate = async () => {
    if (selectedClients.size === 0) {
      toast('Selecione pelo menos um cliente para migrar.', 'warning');
      return;
    }

    setMigrating(true);
    try {
      const clientsToMigrate = recoveredClients.filter(c => selectedClients.has(c.whatsapp));
      const migratedCount = await migrateRecoveredClients(establishmentId, clientsToMigrate);
      
      toast(`✅ ${migratedCount} clientes recuperados com sucesso!`, 'success');
      onClientsRecovered();
      onClose();
    } catch (error) {
      console.error('Erro ao migrar clientes:', error);
      toast('Erro ao migrar clientes selecionados.', 'error');
    } finally {
      setMigrating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-[#1a1b1c] rounded-lg border border-gray-800 max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <Users className="h-6 w-6 text-blue-500" />
            <h2 className="text-xl font-semibold text-white">Recuperar Clientes dos Agendamentos</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
              <span className="ml-3 text-gray-400">Carregando clientes...</span>
            </div>
          ) : (
            <>
              {/* Info */}
              <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4 mb-6">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-blue-400 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-blue-100">
                    <p className="font-medium mb-1">Recuperação Automática de Clientes</p>
                    <p>
                      Encontramos {recoveredClients.length} clientes únicos nos seus agendamentos. 
                      Selecione quais deseja migrar para o sistema de clientes manuais.
                    </p>
                  </div>
                </div>
              </div>

              {/* Controls */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleSelectAll}
                    className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    {selectedClients.size === recoveredClients.length ? 'Desmarcar Todos' : 'Selecionar Todos'}
                  </button>
                  <span className="text-sm text-gray-400">
                    {selectedClients.size} de {recoveredClients.length} selecionados
                  </span>
                </div>
                <div className="text-sm text-gray-400">
                  Total: {recoveredClients.length} clientes
                </div>
              </div>

              {/* Client List */}
              <div className="space-y-3">
                {recoveredClients.map((client) => (
                  <div
                    key={client.whatsapp}
                    className={`border rounded-lg p-4 transition-all ${
                      selectedClients.has(client.whatsapp)
                        ? 'border-blue-500 bg-blue-900/10'
                        : 'border-gray-700 bg-gray-800/50'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <input
                        type="checkbox"
                        checked={selectedClients.has(client.whatsapp)}
                        onChange={() => handleSelectClient(client.whatsapp)}
                        className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
                      />
                      
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-medium text-white">{client.name}</h3>
                          {client.name === 'Cliente Desconhecido' && (
                            <span className="px-2 py-1 text-xs bg-yellow-900/30 text-yellow-400 rounded">
                              Nome genérico
                            </span>
                          )}
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm text-gray-400">
                          <div className="flex items-center gap-1">
                            <span>📱</span>
                            <span>{client.whatsapp.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span>📅</span>
                            <span>{client.appointmentCount} agendamento{client.appointmentCount !== 1 ? 's' : ''}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span>🕒</span>
                            <span>Último: {new Date(client.lastAppointment).toLocaleDateString('pt-BR')}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {recoveredClients.length === 0 && (
                <div className="text-center py-8">
                  <Users className="h-12 w-12 text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-400">Nenhum cliente encontrado nos agendamentos</p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-800">
          <div className="text-sm text-gray-400">
            {selectedClients.size > 0 && (
              <span>{selectedClients.size} cliente{selectedClients.size !== 1 ? 's' : ''} selecionado{selectedClients.size !== 1 ? 's' : ''}</span>
            )}
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleMigrate}
              disabled={selectedClients.size === 0 || migrating}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center gap-2"
            >
              {migrating ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Migrando...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4" />
                  Migrar Selecionados
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
