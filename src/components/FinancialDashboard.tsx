import React, { useState, useEffect, useRef } from 'react';
import { format, startOfMonth, endOfMonth, parseISO, subMonths, addMonths, isSameMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp } from 'lucide-react';

declare const Chart: any;

interface Appointment {
  id: string;
  client_name: string;
  service: string;
  professional: string;
  appointment_date: string;
  price: number;
  status: string;
  additional_products?: Array<{
    name: string;
    price: number;
  }>;
  total_price?: number;
}

interface Professional {
  id: string;
  name: string;
}

interface FinancialDashboardProps {
  appointments: Appointment[];
  professionals: Professional[];
  selectedMonth: Date;
  onMonthChange: (newMonth: Date) => void;
}

const COLORS = [
  'rgba(54, 162, 235, 0.8)',
  'rgba(75, 192, 192, 0.8)',
  'rgba(255, 206, 86, 0.8)',
  'rgba(255, 99, 132, 0.8)',
  'rgba(153, 102, 255, 0.8)',
  'rgba(255, 159, 64, 0.8)'
];

export const FinancialDashboard = ({ appointments, professionals, selectedMonth, onMonthChange }: FinancialDashboardProps) => {
  const [professionalStats, setProfessionalStats] = useState<any[]>([]);
  const [additionalProductStats, setAdditionalProductStats] = useState<any[]>([]);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [serviceStats, setServiceStats] = useState<any[]>([]);
  const [dailyRevenue, setDailyRevenue] = useState<any[]>([]);
  const [monthlyRevenue, setMonthlyRevenue] = useState<any[]>([]);
  
  // Estado para controlar quais seções estão expandidas
  const [expandedSections, setExpandedSections] = useState({
    summary: true,
    professional: false,
    products: false,
    daily: false,
    monthly: false
  });

  const professionalChartRef = useRef<HTMLCanvasElement>(null);
  const productsChartRef = useRef<HTMLCanvasElement>(null);
  const dailyChartRef = useRef<HTMLCanvasElement>(null);
  const monthlyChartRef = useRef<HTMLCanvasElement>(null);

  const handlePreviousMonth = () => {
    const newMonth = new Date(selectedMonth);
    newMonth.setMonth(newMonth.getMonth() - 1);
    onMonthChange(newMonth);
  };

  const handleNextMonth = () => {
    const newMonth = new Date(selectedMonth);
    newMonth.setMonth(newMonth.getMonth() + 1);
    onMonthChange(newMonth);
  };

  useEffect(() => {
    calculateStats();

    // Cleanup function
    return () => {
      // Destroy all charts when component unmounts
      [professionalChartRef, productsChartRef, dailyChartRef, monthlyChartRef].forEach(ref => {
        if (ref.current) {
          const existingChart = Chart.getChart(ref.current);
          if (existingChart) {
            existingChart.destroy();
          }
        }
      });
    };
  }, [appointments, selectedMonth]);

  useEffect(() => {
    if (professionalChartRef.current && professionalStats.length > 0 && expandedSections.professional) {
      const ctx = professionalChartRef.current.getContext('2d');
      if (ctx) {
        // Limpa o gráfico anterior
        const existingChart = Chart.getChart(professionalChartRef.current);
        if (existingChart) {
          existingChart.destroy();
        }

        new Chart(ctx, {
          type: 'bar',
          data: {
            labels: professionalStats.map(prof => prof.name),
            datasets: [
              {
                label: 'Serviços',
                data: professionalStats.map(prof => prof.baseRevenue),
                backgroundColor: COLORS[0],
              },
              {
                label: 'Produtos Adicionais',
                data: professionalStats.map(prof => prof.additionalRevenue),
                backgroundColor: COLORS[1],
              }
            ]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: {
                position: 'top',
                labels: {
                  color: '#fff'
                }
              }
            },
            scales: {
              x: {
                ticks: {
                  color: '#fff'
                },
                grid: {
                  color: 'rgba(255, 255, 255, 0.1)'
                }
              },
              y: {
                ticks: {
                  color: '#fff',
                  callback: (value: number) => formatCurrency(value)
                },
                grid: {
                  color: 'rgba(255, 255, 255, 0.1)'
                }
              }
            }
          }
        });
      }
    }
  }, [professionalStats, expandedSections.professional]);

  useEffect(() => {
    if (productsChartRef.current && additionalProductStats.length > 0 && expandedSections.products) {
      const ctx = productsChartRef.current.getContext('2d');
      if (ctx) {
        // Limpa o gráfico anterior
        const existingChart = Chart.getChart(productsChartRef.current);
        if (existingChart) {
          existingChart.destroy();
        }

        new Chart(ctx, {
          type: 'pie',
          data: {
            labels: additionalProductStats.map(prod => prod.name),
            datasets: [{
              data: additionalProductStats.map(prod => prod.revenue),
              backgroundColor: COLORS,
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: {
                position: 'right',
                labels: {
                  color: '#fff',
                  font: {
                    size: 12
                  }
                }
              },
              tooltip: {
                callbacks: {
                  label: (context: any) => {
                    const value = context.raw;
                    return formatCurrency(value);
                  }
                }
              }
            }
          }
        });
      }
    }
  }, [additionalProductStats, expandedSections.products]);

  useEffect(() => {
    if (dailyChartRef.current && dailyRevenue.length > 0 && expandedSections.daily) {
      const ctx = dailyChartRef.current.getContext('2d');
      if (ctx) {
        // Limpa o gráfico anterior
        const existingChart = Chart.getChart(dailyChartRef.current);
        if (existingChart) {
          existingChart.destroy();
        }

        new Chart(ctx, {
          type: 'line',
          data: {
            labels: dailyRevenue.map(day => day.date),
            datasets: [{
              label: 'Receita',
              data: dailyRevenue.map(day => day.revenue),
              borderColor: COLORS[0],
              backgroundColor: COLORS[0],
              tension: 0.4
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: {
                display: false
              },
              tooltip: {
                callbacks: {
                  label: (context: any) => {
                    const value = context.raw;
                    return formatCurrency(value);
                  }
                }
              }
            },
            scales: {
              x: {
                ticks: {
                  color: '#fff'
                },
                grid: {
                  color: 'rgba(255, 255, 255, 0.1)'
                }
              },
              y: {
                ticks: {
                  color: '#fff',
                  callback: (value: number) => formatCurrency(value)
                },
                grid: {
                  color: 'rgba(255, 255, 255, 0.1)'
                }
              }
            }
          }
        });
      }
    }
  }, [dailyRevenue, expandedSections.daily]);

  useEffect(() => {
    if (monthlyChartRef.current && monthlyRevenue.length > 0 && expandedSections.monthly) {
      const ctx = monthlyChartRef.current.getContext('2d');
      if (ctx) {
        // Limpa o gráfico anterior
        const existingChart = Chart.getChart(monthlyChartRef.current);
        if (existingChart) {
          existingChart.destroy();
        }

        new Chart(ctx, {
          type: 'bar',
          data: {
            labels: monthlyRevenue.map(month => month.label),
            datasets: [{
              label: 'Receita',
              data: monthlyRevenue.map(month => month.revenue),
              backgroundColor: COLORS[0],
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: {
                display: false
              },
              tooltip: {
                callbacks: {
                  label: (context: any) => {
                    const value = context.raw;
                    return formatCurrency(value);
                  }
                }
              }
            },
            scales: {
              x: {
                ticks: {
                  color: '#fff'
                },
                grid: {
                  color: 'rgba(255, 255, 255, 0.1)'
                }
              },
              y: {
                ticks: {
                  color: '#fff',
                  callback: (value: number) => formatCurrency(value)
                },
                grid: {
                  color: 'rgba(255, 255, 255, 0.1)'
                }
              }
            }
          }
        });
      }
    }
  }, [monthlyRevenue, expandedSections.monthly]);

  const calculateStats = () => {
    const startDate = startOfMonth(selectedMonth);
    const endDate = endOfMonth(selectedMonth);

    // Filtrar agendamentos do mês
    const monthAppointments = appointments.filter(app => {
      const appDate = parseISO(app.appointment_date);
      return appDate >= startDate && appDate <= endDate && app.status !== 'cancelled';
    });

    // Estatísticas por profissional
    const profStats = professionals.map(prof => {
      const profAppointments = monthAppointments.filter(app => app.professional === prof.id);
      const totalServices = profAppointments.length;
      const baseRevenue = profAppointments.reduce((sum, app) => sum + app.price, 0);
      const additionalRevenue = profAppointments.reduce((sum, app) => {
        return sum + ((app.additional_products?.reduce((pSum, p) => pSum + p.price, 0)) || 0);
      }, 0);

      return {
        name: prof.name,
        totalServices,
        baseRevenue,
        additionalRevenue,
        totalRevenue: baseRevenue + additionalRevenue
      };
    });

    // Estatísticas de produtos adicionais
    const addProductsMap = new Map();
    monthAppointments.forEach(app => {
      app.additional_products?.forEach(prod => {
        const current = addProductsMap.get(prod.name) || { count: 0, revenue: 0 };
        addProductsMap.set(prod.name, {
          count: current.count + 1,
          revenue: current.revenue + prod.price
        });
      });
    });

    const addProductStats = Array.from(addProductsMap.entries()).map(([name, stats]) => ({
      name,
      ...stats
    }));

    // Estatísticas por serviço
    const servicesMap = new Map();
    monthAppointments.forEach(app => {
      const current = servicesMap.get(app.service) || { count: 0, revenue: 0 };
      servicesMap.set(app.service, {
        count: current.count + 1,
        revenue: current.revenue + app.price
      });
    });

    const servStats = Array.from(servicesMap.entries()).map(([name, stats]) => ({
      name,
      ...stats
    }));

    // Receita diária
    const dailyMap = new Map();
    monthAppointments.forEach(app => {
      const date = format(parseISO(app.appointment_date), 'dd/MM');
      const current = dailyMap.get(date) || 0;
      dailyMap.set(date, current + (app.total_price || app.price));
    });

    const dailyRev = Array.from(dailyMap.entries()).map(([date, value]) => ({
      date,
      revenue: value
    }));

    // Calcular receita total
    const total = monthAppointments.reduce((sum, app) => {
      return sum + (app.total_price || app.price);
    }, 0);

    // Calcular receita mensal dos últimos 12 meses
    const last12Months = Array.from({ length: 12 }, (_, i) => {
      const monthDate = subMonths(selectedMonth, 11 - i);
      return {
        date: monthDate,
        label: format(monthDate, 'MMM/yy', { locale: ptBR }),
        revenue: 0
      };
    });

    // Agrupar agendamentos por mês
    appointments.forEach(appointment => {
      const appointmentDate = parseISO(appointment.appointment_date);
      const monthIndex = last12Months.findIndex(month => 
        isSameMonth(month.date, appointmentDate)
      );
      
      if (monthIndex !== -1) {
        // Calcular o valor total incluindo produtos adicionais
        let totalValue = appointment.price || 0;

        // Adicionar valores dos produtos adicionais
        if (appointment.additional_products && appointment.additional_products.length > 0) {
          const additionalValue = appointment.additional_products.reduce((sum, product) => 
            sum + (product.price || 0), 0);
          totalValue += additionalValue;
        }

        // Se já tiver um total_price calculado, usar ele
        if (appointment.total_price) {
          totalValue = appointment.total_price;
        }

        last12Months[monthIndex].revenue += totalValue;
      }
    });

    setProfessionalStats(profStats);
    setAdditionalProductStats(addProductStats);
    setServiceStats(servStats);
    setDailyRevenue(dailyRev);
    setTotalRevenue(total);
    setMonthlyRevenue(last12Months);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho com navegação do mês */}
      <div className="flex items-center justify-between bg-[#1a1b1c] p-4 rounded-lg border border-gray-800">
        <button
          onClick={handlePreviousMonth}
          className="p-2 text-gray-400 hover:text-white transition-colors"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
        
        <h2 className="text-xl font-semibold text-white">
          {selectedMonth ? format(selectedMonth, 'MMMM yyyy', { locale: ptBR }) : 'Carregando...'}
        </h2>
        
        <button
          onClick={handleNextMonth}
          className="p-2 text-gray-400 hover:text-white transition-colors"
        >
          <ChevronRight className="h-6 w-6" />
        </button>
      </div>

      {/* Resumo do mês */}
      <div className="bg-[#1a1b1c] p-6 rounded-lg border border-gray-800">
        <div 
          className="flex items-center justify-between cursor-pointer"
          onClick={() => toggleSection('summary')}
        >
          <h3 className="text-lg font-medium text-white">Resumo do Mês</h3>
          <button className="text-gray-400 hover:text-white transition-colors">
            {expandedSections.summary ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
          </button>
        </div>
        {expandedSections.summary && (
          <div className="mt-4 text-3xl font-bold text-white">
            {formatCurrency(totalRevenue)}
          </div>
        )}
      </div>

      {/* Gráfico de receita por profissional */}
      <div className="bg-[#1a1b1c] p-6 rounded-lg border border-gray-800">
        <div 
          className="flex items-center justify-between cursor-pointer"
          onClick={() => toggleSection('professional')}
        >
          <h3 className="text-lg font-medium text-white">Receita por Profissional (Clique para ver)</h3>
          <button className="text-gray-400 hover:text-white transition-colors">
            {expandedSections.professional ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
          </button>
        </div>
        {expandedSections.professional && (
          <div className="mt-4 h-[300px]">
            <canvas ref={professionalChartRef} />
          </div>
        )}
      </div>

      {/* Gráfico de produtos adicionais */}
      {additionalProductStats.length > 0 && (
        <div className="bg-[#1a1b1c] p-6 rounded-lg border border-gray-800">
          <div 
            className="flex items-center justify-between cursor-pointer"
            onClick={() => toggleSection('products')}
          >
            <h3 className="text-lg font-medium text-white">Produtos Adicionais (Clique para ver)</h3>
            <button className="text-gray-400 hover:text-white transition-colors">
              {expandedSections.products ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
            </button>
          </div>
          {expandedSections.products && (
            <div className="mt-4 h-[300px]">
              <canvas ref={productsChartRef} />
            </div>
          )}
        </div>
      )}

      {/* Gráfico de receita diária */}
      <div className="bg-[#1a1b1c] p-6 rounded-lg border border-gray-800">
        <div 
          className="flex items-center justify-between cursor-pointer"
          onClick={() => toggleSection('daily')}
        >
          <h3 className="text-lg font-medium text-white">Receita Diária (Clique para ver)</h3>
          <button className="text-gray-400 hover:text-white transition-colors">
            {expandedSections.daily ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
          </button>
        </div>
        {expandedSections.daily && (
          <div className="mt-4 h-[300px]">
            <canvas ref={dailyChartRef} />
          </div>
        )}
      </div>

      {/* Gráfico de receita mensal */}
      <div className="bg-[#1a1b1c] p-6 rounded-lg border border-gray-800">
        <div 
          className="flex items-center justify-between cursor-pointer"
          onClick={() => toggleSection('monthly')}
        >
          <h3 className="text-lg font-medium text-white">Receita Mensal (Clique para ver)</h3>
          <button className="text-gray-400 hover:text-white transition-colors">
            {expandedSections.monthly ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
          </button>
        </div>
        {expandedSections.monthly && (
          <div className="mt-4 h-[300px]">
            <canvas ref={monthlyChartRef} />
          </div>
        )}
      </div>
    </div>
  );
}; 