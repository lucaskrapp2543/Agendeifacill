{activeTab === 'settings' && (
  <div className="space-y-6">
    {/* Informações Básicas */}
    <div className="bg-[#1a1b1c] rounded-lg p-6 border border-gray-800">
      <h3 className="text-lg font-medium text-white mb-4">Informações Básicas</h3>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">
            Nome do Estabelecimento
          </label>
          <input
            type="text"
            value={establishmentName}
            onChange={(e) => setEstablishmentName(e.target.value)}
            className="w-full px-4 py-2 bg-[#242628] border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="Nome do seu estabelecimento"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">
            Descrição
          </label>
          <textarea
            value={establishmentDescription}
            onChange={(e) => setEstablishmentDescription(e.target.value)}
            className="w-full px-4 py-2 bg-[#242628] border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="Descreva seu estabelecimento"
            rows={3}
          />
        </div>
      </div>
    </div>

    {/* Horário de Funcionamento */}
    <div className="bg-[#1a1b1c] rounded-lg p-6 border border-gray-800">
      <h3 className="text-lg font-medium text-white mb-4">Horário de Funcionamento</h3>
      <div className="space-y-4">
        {Object.entries(businessHours).map(([day, hours]) => (
          <div key={day} className="bg-[#242628] p-4 rounded-lg space-y-3 border border-gray-700">
            {/* Cabeçalho do dia com checkbox */}
            <div className="flex items-center justify-between">
              <label className="inline-flex items-center">
                <input
                  type="checkbox"
                  checked={hours.enabled}
                  onChange={(e) => handleBusinessHoursChange(day as keyof typeof businessHours, 'enabled', e.target.checked)}
                  className="form-checkbox h-4 w-4 text-primary bg-[#1a1b1c] border-gray-700 rounded"
                />
                <span className="ml-2 font-medium text-white">
                  {day === 'monday' ? 'Segunda-feira' :
                   day === 'tuesday' ? 'Terça-feira' :
                   day === 'wednesday' ? 'Quarta-feira' :
                   day === 'thursday' ? 'Quinta-feira' :
                   day === 'friday' ? 'Sexta-feira' :
                   day === 'saturday' ? 'Sábado' : 'Domingo'}
                </span>
              </label>
              {!hours.enabled && (
                <span className="text-sm text-gray-400 bg-[#1a1b1c] px-2 py-1 rounded">
                  Fechado
                </span>
              )}
            </div>
            
            {/* Horários - Layout responsivo */}
            {hours.enabled && (
              <div className="space-y-3">
                {/* Período da manhã */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <label className="block text-xs font-medium text-gray-400 uppercase tracking-wide">
                      Abertura
                    </label>
                    <TimeSelector
                      value={hours.open1}
                      onChange={(value) => handleBusinessHoursChange(day as keyof typeof businessHours, 'open1', value)}
                      disabled={!hours.enabled}
                      className="w-full"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-xs font-medium text-gray-400 uppercase tracking-wide">
                      Fecha p/ Intervalo
                    </label>
                    <TimeSelector
                      value={hours.close1}
                      onChange={(value) => handleBusinessHoursChange(day as keyof typeof businessHours, 'close1', value)}
                      disabled={!hours.enabled}
                      className="w-full"
                    />
                  </div>
                </div>
                
                {/* Período da tarde */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <label className="block text-xs font-medium text-gray-400 uppercase tracking-wide">
                      Reabertura
                    </label>
                    <TimeSelector
                      value={hours.open2}
                      onChange={(value) => handleBusinessHoursChange(day as keyof typeof businessHours, 'open2', value)}
                      disabled={!hours.enabled}
                      className="w-full"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-xs font-medium text-gray-400 uppercase tracking-wide">
                      Fechamento
                    </label>
                    <TimeSelector
                      value={hours.close2}
                      onChange={(value) => handleBusinessHoursChange(day as keyof typeof businessHours, 'close2', value)}
                      disabled={!hours.enabled}
                      className="w-full"
                    />
                  </div>
                </div>
                
                {/* Resumo visual dos horários */}
                <div className="mt-3 p-2 bg-[#1a1b1c] rounded text-sm text-primary">
                  <span className="font-medium">Funcionamento:</span> {hours.open1} - {hours.close1} e {hours.open2} - {hours.close2}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>

    {/* Profissionais */}
    <div className="bg-[#1a1b1c] rounded-lg p-6 border border-gray-800">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-medium text-white">Profissionais</h3>
        <button
          type="button"
          onClick={handleAddProfessional}
          disabled={professionals.length >= 10}
          className="px-4 py-2 bg-[#242628] text-white rounded-lg hover:bg-[#2a2b2d] transition-colors flex items-center gap-2 border border-gray-700"
        >
          <Plus className="h-4 w-4" />
          <span>Adicionar</span>
        </button>
      </div>
      
      <div className="space-y-4">
        {professionals.map((professional) => (
          <div key={professional.id} className="bg-[#242628] p-4 rounded-lg space-y-3 border border-gray-700">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <input
                  type="text"
                  value={professional.name}
                  onChange={(e) => handleProfessionalChange(professional.id, 'name', e.target.value)}
                  className="w-full px-4 py-2 bg-[#1a1b1c] border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Nome do profissional"
                />
              </div>
              <button
                type="button"
                onClick={() => handleRemoveProfessional(professional.id)}
                className="ml-2 text-red-500 hover:text-red-400 transition-colors"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
        {professionals.length === 0 && (
          <p className="text-gray-400 text-center py-4">
            Nenhum profissional cadastrado. Clique em "Adicionar" para começar.
          </p>
        )}
      </div>
    </div>

    {/* Configurações do PIX */}
    <EstablishmentPixSettings
      establishment={establishment}
      onSave={handleSavePixSettings}
    />

    {/* Botão de Salvar */}
    <div className="flex justify-end">
      <button
        onClick={handleUpdateEstablishment}
        disabled={isUpdating}
        className={`px-6 py-3 bg-primary text-white rounded-lg font-medium ${
          isUpdating ? 'opacity-50 cursor-not-allowed' : 'hover:bg-primary/80'
        } transition-colors flex items-center gap-2`}
      >
        {isUpdating ? (
          <>
            <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white" />
            Salvando...
          </>
        ) : (
          <>
            <Check className="h-5 w-5" />
            Salvar Alterações
          </>
        )}
      </button>
    </div>
  </div>
)} 