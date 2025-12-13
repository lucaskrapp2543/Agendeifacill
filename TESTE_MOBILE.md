# 🧪 Guia de Teste no Celular (IP Local)

## Como testar no celular

### 1. Descobrir seu IP local
No terminal do seu computador, execute:
```bash
# Windows
ipconfig

# Mac/Linux
ifconfig
```

Procure por algo como `192.168.0.2` ou `192.168.1.100`

### 2. Iniciar o servidor de desenvolvimento
Certifique-se de que o Vite está rodando e acessível na rede local:
```bash
npm run dev -- --host
```

### 3. Acessar no celular
No celular, abra o navegador e acesse:
```
http://192.168.0.2:5173/booking/5560
```
(Substitua `192.168.0.2` pelo seu IP e `5560` pelo código do estabelecimento)

### 4. Testar modo Instagram (simular cache agressivo)
Para simular o comportamento do Instagram com cache agressivo, adicione `?test=instagram`:
```
http://192.168.0.2:5173/booking/5560?test=instagram
```

Isso vai:
- ✅ Criar um cache "antigo" para simular o problema
- ✅ Ativar a detecção de página branca
- ✅ Testar se o Service Worker limpa o cache corretamente

### 5. O que observar
- ✅ A página deve carregar normalmente na primeira vez
- ✅ Se simular cache antigo (`?test=instagram`), deve detectar e limpar automaticamente
- ✅ Não deve entrar em loop de recarregamento
- ✅ Console deve mostrar logs de detecção

### 6. Testar em navegador in-app (Instagram/WhatsApp)
1. Compartilhe o link `http://192.168.0.2:5173/booking/5560?test=instagram` via WhatsApp
2. Abra o link no WhatsApp (vai abrir no navegador in-app)
3. Observe se carrega corretamente ou se detecta página branca

## 🔍 Logs para verificar

No console do celular (via Chrome DevTools remoto ou Safari Web Inspector):
- `📱 Modo de teste ativado (IP local detectado)` - Confirma que está em modo de teste
- `Service Worker registrado` - Confirma que Service Worker está ativo
- `⚠️ Página branca detectada` - Se detectar problema (deve limpar automaticamente)

## 🐛 Troubleshooting

**Não consegue acessar pelo IP?**
- Verifique se o firewall permite conexões na porta 5173
- Certifique-se de usar `--host` no comando do Vite
- Verifique se o celular está na mesma rede Wi-Fi

**Service Worker não registra?**
- Verifique o console para erros
- Limpe cache do navegador no celular
- Tente em modo anônimo

**Página branca persiste?**
- Adicione `?clear=all` na URL para forçar limpeza total
- Use `window.clearAppCache()` no console

