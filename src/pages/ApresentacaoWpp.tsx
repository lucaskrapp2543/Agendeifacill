import React, { useRef, useEffect, useState } from 'react';

const ApresentacaoWpp = () => {
  const videoClienteRef = useRef<HTMLVideoElement>(null);
  const videoProfissionalRef = useRef<HTMLVideoElement>(null);
  const [errorCliente, setErrorCliente] = useState<string | null>(null);
  const [errorProfissional, setErrorProfissional] = useState<string | null>(null);
  const [loadingCliente, setLoadingCliente] = useState(true);
  const [loadingProfissional, setLoadingProfissional] = useState(true);
  const [videoSemImagemCliente, setVideoSemImagemCliente] = useState(false);
  const [videoSemImagemProfissional, setVideoSemImagemProfissional] = useState(false);
  const [showVideoProfissional, setShowVideoProfissional] = useState(false);
  const [showVerValorButton, setShowVerValorButton] = useState(false);
  const [showVerValorButtonFinal, setShowVerValorButtonFinal] = useState(false);

  useEffect(() => {
    // Timeout para detectar vídeos que não carregam
    const timeoutDuration = 30000; // 30 segundos
    
    // Carregar primeiro vídeo
    if (videoClienteRef.current) {
      const video = videoClienteRef.current;
      console.log('🎬 Iniciando carregamento do vídeo do cliente...');
      
      let loadingState = true;
      const timeoutId = setTimeout(() => {
        if (loadingState) {
          console.warn('⏱️ Timeout ao carregar vídeo do cliente');
          setErrorCliente('O vídeo está demorando para carregar. Verifique sua conexão.');
          setLoadingCliente(false);
          loadingState = false;
        }
      }, timeoutDuration);
      
      const handleLoadedMetadata = () => {
        console.log('✅ Vídeo do cliente carregado:', video.duration, 'segundos');
        console.log('📐 Dimensões do vídeo:', video.videoWidth, 'x', video.videoHeight);
        
        // Testar diferentes codecs
        const codecTests = {
          'video/mp4': video.canPlayType('video/mp4'),
          'video/mp4; codecs="avc1.42E01E, mp4a.40.2"': video.canPlayType('video/mp4; codecs="avc1.42E01E, mp4a.40.2"'),
          'video/mp4; codecs="hvc1.1.6.L93.B0, mp4a.40.2"': video.canPlayType('video/mp4; codecs="hvc1.1.6.L93.B0, mp4a.40.2"'),
          'video/mp4; codecs="vp9"': video.canPlayType('video/mp4; codecs="vp9"')
        };
        console.log('🎬 Suporte a codecs:', codecTests);
        
        // Verificar se o vídeo tem dimensões válidas (se não tiver, pode ser apenas áudio)
        // Aguardar um pouco mais para garantir que as dimensões sejam carregadas
        setTimeout(() => {
          if (video.videoWidth === 0 || video.videoHeight === 0) {
            console.warn('⚠️ Vídeo sem dimensões visuais detectadas - pode ser apenas áudio');
            console.warn('📊 Estado completo:', {
              videoWidth: video.videoWidth,
              videoHeight: video.videoHeight,
              readyState: video.readyState,
              networkState: video.networkState,
              duration: video.duration,
              videoTracks: video.getVideoTracks ? video.getVideoTracks().length : 'N/A',
              currentSrc: video.currentSrc
            });
            setVideoSemImagemCliente(true);
          } else {
            console.log('✅ Vídeo tem dimensões válidas!');
            setVideoSemImagemCliente(false);
          }
        }, 2000); // Aumentar tempo para dar chance ao codec carregar
        
        clearTimeout(timeoutId);
        loadingState = false;
        setLoadingCliente(false);
        setErrorCliente(null);
      };

      const handleError = (e: Event) => {
        const error = video.error;
        console.error('❌ Erro ao carregar vídeo do cliente:', {
          error,
          code: error?.code,
          message: error?.message,
          networkState: video.networkState,
          readyState: video.readyState
        });
        clearTimeout(timeoutId);
        loadingState = false;
        setErrorCliente('Erro ao carregar vídeo. Tente recarregar a página.');
        setLoadingCliente(false);
      };

      const handleCanPlay = () => {
        console.log('▶️ Vídeo do cliente pode ser reproduzido');
        console.log('📐 Dimensões no canPlay:', video.videoWidth, 'x', video.videoHeight);
        clearTimeout(timeoutId);
        loadingState = false;
        setLoadingCliente(false);
      };

      const handleLoadedData = () => {
        console.log('📦 Dados do vídeo do cliente carregados');
        console.log('📐 Dimensões:', video.videoWidth, 'x', video.videoHeight);
      };

      const handleLoadStart = () => {
        console.log('📥 Iniciando download do vídeo do cliente...');
      };

      const handleProgress = () => {
        if (video.buffered.length > 0) {
          const buffered = video.buffered.end(video.buffered.length - 1);
          const duration = video.duration;
          if (duration > 0) {
            const percent = (buffered / duration) * 100;
            console.log(`📊 Progresso do vídeo do cliente: ${percent.toFixed(1)}%`);
          }
        }
      };

      video.addEventListener('loadedmetadata', handleLoadedMetadata);
      video.addEventListener('loadeddata', handleLoadedData);
      video.addEventListener('error', handleError);
      video.addEventListener('canplay', handleCanPlay);
      video.addEventListener('loadstart', handleLoadStart);
      video.addEventListener('progress', handleProgress);
      
      // Definir src após adicionar listeners
      // Remover timestamp do src e usar diretamente para evitar problemas de cache
      video.src = `/vistadocliente.mp4`;
      console.log('🔗 URL do vídeo do cliente:', video.src);
      
      // Forçar carregamento e verificar dimensões após um tempo
      video.load();
      
      // Verificar dimensões após carregar metadata
      setTimeout(() => {
        if (video.videoWidth === 0 || video.videoHeight === 0) {
          console.warn('⚠️ Vídeo sem dimensões - pode ser apenas áudio');
          console.warn('📊 Estado do vídeo:', {
            videoWidth: video.videoWidth,
            videoHeight: video.videoHeight,
            readyState: video.readyState,
            networkState: video.networkState
          });
        }
      }, 2000);

      return () => {
        clearTimeout(timeoutId);
        video.removeEventListener('loadedmetadata', handleLoadedMetadata);
        video.removeEventListener('loadeddata', handleLoadedData);
        video.removeEventListener('error', handleError);
        video.removeEventListener('canplay', handleCanPlay);
        video.removeEventListener('loadstart', handleLoadStart);
        video.removeEventListener('progress', handleProgress);
      };
    }

    // O vídeo do profissional agora carrega diretamente via JSX (onLoadStart, onLoadedMetadata, etc.)
    // Não precisa mais de lógica complexa aqui
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Verificar se os refs estão disponíveis após o primeiro render
  useEffect(() => {
    console.log('🔍 Verificação de refs após render:', {
      videoCliente: !!videoClienteRef.current,
      videoProfissional: !!videoProfissionalRef.current
    });
  }, []);

  return (
    <div className="min-h-screen bg-gray-900 py-8 px-4">
      <style>{`
        /* Esconder controles de tempo dos vídeos, mas manter play/pause */
        video::-webkit-media-controls-timeline {
          display: none !important;
        }
        video::-webkit-media-controls-current-time-display {
          display: none !important;
        }
        video::-webkit-media-controls-time-remaining-display {
          display: none !important;
        }
        video::-webkit-media-controls-duration {
          display: none !important;
        }
        /* Manter botão de play central visível */
        video::-webkit-media-controls-play-button {
          display: block !important;
        }
        video::-webkit-media-controls-start-playback-button {
          display: block !important;
        }
        /* Firefox */
        video::-moz-media-controls-timeline {
          display: none !important;
        }
        video::-moz-media-controls-current-time-display {
          display: none !important;
        }
        video::-moz-media-controls-time-remaining-display {
          display: none !important;
        }
      `}</style>
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Imagem Topo */}
        <div className="text-center mb-6">
          <img 
            src="/toptop.png" 
            alt="Topo" 
            className="mx-auto max-w-full h-auto"
            onError={(e) => {
              // Tentar outras extensões se PNG não funcionar
              const target = e.currentTarget;
              if (target.src.includes('.png')) {
                target.src = '/toptop.jpg';
              } else if (target.src.includes('.jpg')) {
                target.src = '/toptop.jpeg';
              }
            }}
          />
        </div>

        {/* Título */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">
            Apresentação WhatsApp
          </h1>
          <p className="text-gray-400">
            Veja como o sistema funciona na prática
          </p>
        </div>

        {/* Vídeo 1 - Vista do Cliente */}
        <div className="bg-[#1a1b1c] rounded-lg p-6 border border-gray-800">
          <h2 className="text-xl font-semibold text-white mb-2 text-center">
            👤 Vista do Cliente
          </h2>
          <p className="text-center mb-4 text-primary font-semibold text-sm">
            Aqui é um vídeo mostrando como é passo a passo do seu cliente o que ele irá ver antes de agendar
          </p>
          <div className="relative w-full rounded-lg overflow-hidden bg-black" style={{ minHeight: '400px' }}>
            {loadingCliente && (
              <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 z-10">
                <div className="text-white text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-2"></div>
                  <p>Carregando vídeo...</p>
                </div>
              </div>
            )}
            {errorCliente && (
              <div className="absolute inset-0 flex items-center justify-center bg-red-900 bg-opacity-50 z-10">
                <div className="text-white text-center p-4">
                  <p className="text-red-200 mb-2">{errorCliente}</p>
                  <button
                    onClick={() => window.location.reload()}
                    className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                  >
                    Recarregar Página
                  </button>
                </div>
              </div>
            )}
            {videoSemImagemCliente && !loadingCliente && (
              <div className="absolute top-4 left-4 right-4 bg-yellow-900 bg-opacity-95 border-2 border-yellow-500 rounded-lg p-4 z-20 shadow-xl">
                <div className="flex items-start gap-3">
                  <span className="text-2xl">⚠️</span>
                  <div className="flex-1">
                    <p className="text-yellow-100 text-sm font-bold mb-2">
                      Problema Detectado: Codec Incompatível
                    </p>
                    <p className="text-yellow-200 text-xs mb-2">
                      O arquivo <code className="bg-black px-2 py-1 rounded text-yellow-300">vistadocliente.mp4</code> funciona no seu PC, mas o navegador não consegue exibir o vídeo. Isso geralmente acontece quando o vídeo usa um codec não suportado pelos navegadores.
                    </p>
                    <p className="text-yellow-200 text-xs mb-2 font-semibold">
                      🔧 Solução: Converta o vídeo para H.264 (AVC) + AAC:
                    </p>
                    <ul className="text-yellow-200 text-xs list-disc list-inside mb-2 space-y-1 ml-2">
                      <li>Use o <strong>HandBrake</strong> (gratuito) ou <strong>FFmpeg</strong></li>
                      <li>Codec de vídeo: <code className="bg-black px-1 rounded">H.264 (x264)</code></li>
                      <li>Codec de áudio: <code className="bg-black px-1 rounded">AAC</code></li>
                      <li>Formato: <code className="bg-black px-1 rounded">MP4</code></li>
                    </ul>
                    <p className="text-yellow-300 text-xs font-semibold">
                      💡 Navegadores web só suportam H.264, mesmo que outros codecs funcionem no Windows Media Player.
                    </p>
                  </div>
                </div>
              </div>
            )}
            <video
              ref={videoClienteRef}
              controls
              controlsList="nodownload nofullscreen noremoteplayback"
              className="w-full h-auto"
              preload="auto"
              playsInline
              muted={false}
              loop={false}
              onEnded={(e) => {
                // Garantir que o vídeo não reinicie automaticamente
                const video = e.currentTarget;
                video.pause();
                video.currentTime = 0;
              }}
            >
              <source src="/vistadocliente.mp4" type="video/mp4; codecs=avc1.42E01E,mp4a.40.2" />
              <source src="/vistadocliente.mp4" type="video/mp4" />
              Seu navegador não suporta o elemento de vídeo.
            </video>
          </div>
          
          {/* Botão para mostrar vídeo do profissional */}
          {!showVideoProfissional && (
            <div className="mt-6 text-center">
              <button
                onClick={() => {
                  setShowVideoProfissional(true);
                  setShowVerValorButton(false); // Resetar quando mostrar o vídeo
                  setShowVerValorButtonFinal(false); // Resetar botão final também
                }}
                className="px-6 py-3 bg-primary text-white font-semibold rounded-lg hover:bg-primary/90 transition-all shadow-lg hover:shadow-xl transform hover:scale-105"
              >
                Já vi o vídeo de cima, quero ver por dentro agora
              </button>
            </div>
          )}
        </div>

        {/* Vídeo 2 - Vista do Profissional */}
        {showVideoProfissional && (
        <div className="bg-[#1a1b1c] rounded-lg p-6 border border-gray-800">
          <h2 className="text-xl font-semibold text-white mb-2 text-center">
            💼 Vista do Profissional
          </h2>
          <p className="text-center mb-4 text-primary font-semibold text-sm">
            Aqui mostra como funciona dentro do sistema do agendei facil
          </p>
          <div className="relative w-full rounded-lg overflow-hidden bg-black" style={{ minHeight: '400px' }}>
            {loadingProfissional && (
              <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 z-10">
                <div className="text-white text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-2"></div>
                  <p>Carregando vídeo...</p>
                </div>
              </div>
            )}
            {errorProfissional && (
              <div className="absolute inset-0 flex items-center justify-center bg-red-900 bg-opacity-50 z-10">
                <div className="text-white text-center p-4">
                  <p className="text-red-200 mb-2">{errorProfissional}</p>
                  <button
                    onClick={() => window.location.reload()}
                    className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                  >
                    Recarregar Página
                  </button>
                </div>
              </div>
            )}
            {videoSemImagemProfissional && !loadingProfissional && (
              <div className="absolute top-4 left-4 right-4 bg-yellow-900 bg-opacity-95 border-2 border-yellow-500 rounded-lg p-4 z-20 shadow-xl">
                <div className="flex items-start gap-3">
                  <span className="text-2xl">⚠️</span>
                  <div className="flex-1">
                    <p className="text-yellow-100 text-sm font-bold mb-2">
                      Problema Detectado: Codec Incompatível
                    </p>
                    <p className="text-yellow-200 text-xs mb-2">
                      O arquivo <code className="bg-black px-2 py-1 rounded text-yellow-300">vistadoprofissional.mp4</code> funciona no seu PC, mas o navegador não consegue exibir o vídeo. Isso geralmente acontece quando o vídeo usa um codec não suportado pelos navegadores.
                    </p>
                    <p className="text-yellow-200 text-xs mb-2 font-semibold">
                      🔧 Solução: Converta o vídeo para H.264 (AVC) + AAC:
                    </p>
                    <ul className="text-yellow-200 text-xs list-disc list-inside mb-2 space-y-1 ml-2">
                      <li>Use o <strong>HandBrake</strong> (gratuito) ou <strong>FFmpeg</strong></li>
                      <li>Codec de vídeo: <code className="bg-black px-1 rounded">H.264 (x264)</code></li>
                      <li>Codec de áudio: <code className="bg-black px-1 rounded">AAC</code></li>
                      <li>Formato: <code className="bg-black px-1 rounded">MP4</code></li>
                    </ul>
                    <p className="text-yellow-300 text-xs font-semibold">
                      💡 Navegadores web só suportam H.264, mesmo que outros codecs funcionem no Windows Media Player.
                    </p>
                  </div>
                </div>
              </div>
            )}
            <video
              ref={videoProfissionalRef}
              src="/vistadoprofissional.mp4"
              controls
              controlsList="nodownload nofullscreen noremoteplayback"
              className="w-full h-auto"
              preload="auto"
              playsInline
              muted={false}
              loop={false}
              onLoadStart={() => {
                console.log('📥 onLoadStart: Vídeo do profissional iniciou carregamento');
              }}
              onLoadedMetadata={(e) => {
                const video = e.currentTarget;
                console.log('✅ onLoadedMetadata: Vídeo do profissional carregado:', {
                  duration: video.duration,
                  width: video.videoWidth,
                  height: video.videoHeight
                });
                setLoadingProfissional(false);
                if (video.videoWidth === 0 || video.videoHeight === 0) {
                  setVideoSemImagemProfissional(true);
                } else {
                  setVideoSemImagemProfissional(false);
                }
              }}
              onTimeUpdate={(e) => {
                const video = e.currentTarget;
                // Mostrar botão embaixo após 2 minutos e meio (150 segundos) de vídeo
                if (video.currentTime >= 150 && !showVerValorButton) {
                  setShowVerValorButton(true);
                  console.log('✅ 2 minutos e meio de vídeo assistido - mostrando botão Ver Valor embaixo');
                }
              }}
              onError={(e) => {
                const video = e.currentTarget;
                console.error('❌ onError: Erro no vídeo do profissional:', video.error);
                setErrorProfissional('Erro ao carregar vídeo. Verifique o arquivo.');
                setLoadingProfissional(false);
              }}
              onEnded={(e) => {
                // Quando o vídeo terminar, mostrar botão no meio da tela
                const video = e.currentTarget;
                video.pause();
                setShowVerValorButtonFinal(true); // Mostrar botão no centro quando terminar
                console.log('✅ Vídeo terminou - mostrando botão Ver Valor no centro da tela');
              }}
            >
              Seu navegador não suporta o elemento de vídeo.
            </video>
            
            {/* Botão Ver Valor - aparece no meio da tela quando vídeo termina */}
            {showVerValorButtonFinal && (
              <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-90 z-30">
                <div className="text-center p-6">
                  <button
                    onClick={() => {
                      const phoneNumber = '48991484275';
                      const message = 'qual valor do sistema';
                      const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;
                      window.open(whatsappUrl, '_blank');
                    }}
                    className="px-8 py-4 bg-green-600 text-white font-bold text-lg rounded-lg hover:bg-green-700 transition-all shadow-2xl hover:shadow-green-500/50 transform hover:scale-110 flex items-center gap-3 mx-auto animate-pulse"
                    style={{ animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' }}
                  >
                    <span className="text-2xl">💬</span>
                    <span>Já vi o vídeo, ir pro whatsapp ver valor clique aqui</span>
                  </button>
                  <p className="text-white text-sm mt-4 opacity-75">
                    Clique no botão acima para continuar
                  </p>
                </div>
              </div>
            )}
          </div>
          
          {/* Botão Ver Valor - aparece embaixo após 2 minutos e meio */}
          {showVerValorButton && !showVerValorButtonFinal && (
            <div className="mt-6 text-center">
              <button
                onClick={() => {
                  const phoneNumber = '48991484275';
                  const message = 'qual valor do sistema';
                  const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;
                  window.open(whatsappUrl, '_blank');
                }}
                className="px-6 py-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-all shadow-lg hover:shadow-xl transform hover:scale-105 flex items-center gap-2 mx-auto"
              >
                <span>💬</span>
                Já vi o vídeo, ir pro whatsapp ver valor clique aqui
              </button>
            </div>
          )}
        </div>
        )}
      </div>
    </div>
  );
};

export default ApresentacaoWpp;

