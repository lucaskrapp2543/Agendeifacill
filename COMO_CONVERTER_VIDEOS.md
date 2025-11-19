# Como Converter Vídeos para Funcionar no Navegador

## Problema
Seus vídeos funcionam no PC, mas não aparecem no navegador. Isso acontece porque navegadores web só suportam certos codecs.

## Solução: Converter para H.264 + AAC

### Opção 1: HandBrake (Mais Fácil) ⭐ RECOMENDADO

1. **Baixar HandBrake** (gratuito):
   - Site: https://handbrake.fr/
   - Baixe a versão para Windows

2. **Abrir o HandBrake**:
   - Clique em "Open Source" e selecione `vistadocliente.mp4`
   - Faça o mesmo para `vistadoprofissional.mp4`

3. **Configurações**:
   - **Preset**: Escolha "Fast 720p30" ou "Web - Gmail Large 3 Minutes 720p30"
   - **Destination**: Escolha onde salvar (pode ser na pasta `public` mesmo)
   - **Output Settings**:
     - Container: **MP4**
     - ✅ Marque "Web Optimized" (importante!)

4. **Aba Video**:
   - Video Codec: **H.264 (x264)**
   - Framerate: 30 FPS
   - Quality: 21 (ou mantenha o padrão)

5. **Aba Audio**:
   - Codec: **AAC (avcodec)**
   - Bitrate: 128 kbps (ou mantenha o padrão)

6. **Converter**:
   - Clique em "Start Encode"
   - Aguarde a conversão terminar
   - Repita para o segundo vídeo

7. **Substituir os arquivos**:
   - Substitua os arquivos antigos na pasta `public` pelos novos convertidos
   - Mantenha os mesmos nomes: `vistadocliente.mp4` e `vistadoprofissional.mp4`

### Opção 2: FFmpeg (Linha de Comando)

Se você tem FFmpeg instalado:

```bash
# Converter vistadocliente.mp4
ffmpeg -i public\vistadocliente.mp4 -c:v libx264 -preset medium -crf 23 -c:a aac -b:a 128k -movflags +faststart public\vistadocliente_convertido.mp4

# Converter vistadoprofissional.mp4
ffmpeg -i public\vistadoprofissional.mp4 -c:v libx264 -preset medium -crf 23 -c:a aac -b:a 128k -movflags +faststart public\vistadoprofissional_convertido.mp4
```

Depois renomeie os arquivos convertidos para substituir os originais.

### Opção 3: Conversor Online

Se preferir online:
- https://cloudconvert.com/mp4-converter
- https://www.freeconvert.com/mp4-converter

**Importante**: Configure para:
- Codec de vídeo: H.264
- Codec de áudio: AAC
- Formato: MP4

## Verificar se Funcionou

Após converter e substituir os arquivos:

1. Recarregue a página (Ctrl + Shift + R)
2. Abra o console do navegador (F12)
3. Procure por: `✅ Vídeo tem dimensões válidas!`
4. Os vídeos devem aparecer com imagem e áudio

## Por que isso acontece?

- **Windows Media Player/VLC**: Suportam muitos codecs (H.265, VP9, etc.)
- **Navegadores Web**: Só suportam H.264 (vídeo) + AAC (áudio)
- Mesmo sendo MP4, o codec interno pode ser incompatível

## Dica

O HandBrake tem a opção "Web Optimized" que adiciona `faststart` ao MP4, permitindo que o vídeo comece a tocar antes de baixar completamente - perfeito para web!

