/**
 * /cadastrar — o cliente NOVO cria a conta depois de pagar o Plano Diamante na Cakto.
 * (É a "página de obrigado" do produto: a Cakto manda o cliente para cá depois do pagamento.)
 *
 * A conta só é criada se o e-mail tiver pagamento confirmado. Quem confere é o servidor
 * (netlify/functions/cakto-cadastro.ts) — esta tela só mostra a resposta.
 *
 * Cores escritas uma a uma de propósito: a página não herda cor de nenhum painel.
 */
import { CheckCircle2, Eye, EyeOff, Loader2, Lock, MessageCircle } from 'lucide-react';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { CAKTO_CHECKOUT_URL } from '../lib/caktoConfig';
import { emailValido } from '../lib/caktoPayload';
import { iniciarPixel, lerCarimbosDoMeta, pixelEvento, pixelIdentificar, pixelPageView } from '../lib/metaPixel';
import { META_VALOR_PLANO } from '../lib/metaPixelConfig';
import {
  PAISES_TELEFONE,
  formatarTelefone,
  limparTelefone,
  paisTelefone,
  validarTelefone,
  type PaisTelefoneCode,
} from '../lib/telefonePais';

const WHATSAPP_SUPORTE = '5548991265320';
const linkSuporte = (texto: string) => `https://wa.me/${WHATSAPP_SUPORTE}?text=${encodeURIComponent(texto)}`;

type Campo = 'email' | 'senha' | 'nomeBarbearia' | 'telefone';
type Aviso = { tipo: 'erro' | 'info'; texto: string; code?: string } | null;

const campoBase =
  'w-full rounded-xl border bg-white px-4 py-3 text-base text-slate-900 placeholder-slate-400 outline-none transition focus:ring-2 focus:ring-emerald-500';
const classeCampo = (comErro: boolean) => `${campoBase} ${comErro ? 'border-red-500' : 'border-slate-300'}`;

export default function Cadastrar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { signIn } = useAuth();

  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [nomeBarbearia, setNomeBarbearia] = useState('');
  const [pais, setPais] = useState<PaisTelefoneCode>('BR');
  const [telefone, setTelefone] = useState('');
  const [erros, setErros] = useState<Partial<Record<Campo, string>>>({});
  const [aviso, setAviso] = useState<Aviso>(null);
  const [enviando, setEnviando] = useState(false);
  const [contaCriada, setContaCriada] = useState<{ codigo: string } | null>(null);

  const paisAtual = useMemo(() => paisTelefone(pais), [pais]);

  useEffect(() => {
    document.title = 'Criar conta | Agendei Fácil';
    // Pixel do Meta: abriu a página de criar a conta. Só avisa; não muda nada.
    iniciarPixel();
    pixelPageView();
    // Se o link trouxer o e-mail (?email=...), já deixa preenchido.
    const doLink = new URLSearchParams(location.search).get('email');
    if (doLink && emailValido(doLink)) setEmail(doLink.trim().toLowerCase());
  }, [location.search]);

  const trocarPais = (novo: PaisTelefoneCode) => {
    setPais(novo);
    setTelefone((atual) => limparTelefone(atual, novo));
    setErros((e) => ({ ...e, telefone: undefined }));
  };

  const validar = (): Partial<Record<Campo, string>> => {
    const novo: Partial<Record<Campo, string>> = {};
    if (!emailValido(email.trim())) novo.email = 'Digite o e-mail que você usou para pagar.';
    if (senha.length < 6) novo.senha = 'A senha precisa ter pelo menos 6 caracteres.';
    else if (senha !== senha.trim()) novo.senha = 'A senha não pode começar nem terminar com espaço.';
    else if (senha.length > 72) novo.senha = 'A senha pode ter no máximo 72 caracteres.';
    if (nomeBarbearia.trim().length < 2) novo.nomeBarbearia = 'Digite o nome da sua barbearia.';
    const conferencia = validarTelefone(telefone, pais);
    if (!conferencia.ok) novo.telefone = conferencia.erro;
    return novo;
  };

  const enviar = async (evento: FormEvent) => {
    evento.preventDefault();
    if (enviando) return;
    const novosErros = validar();
    setErros(novosErros);
    setAviso(null);
    if (Object.keys(novosErros).length > 0) return;

    setEnviando(true);
    const emailLimpo = email.trim().toLowerCase();
    try {
      const resposta = await fetch('/.netlify/functions/cakto-cadastro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: emailLimpo,
          senha,
          nomeBarbearia: nomeBarbearia.trim(),
          pais,
          telefone,
          // Carimbos do pixel do Meta (qual visita / qual anúncio). O servidor só usa no aviso de compra.
          meta_pixel: lerCarimbosDoMeta(),
        }),
      });
      let dados: any = null;
      try {
        dados = await resposta.json();
      } catch {
        dados = null;
      }

      if (resposta.ok && dados?.ok) {
        setContaCriada({ codigo: String(dados.establishmentCode || '') });
        // Pixel do Meta: conta criada = compra confirmada. Mesmo nome do aviso do servidor (não conta em dobro).
        pixelIdentificar({ email: emailLimpo, telefone: `${paisAtual.ddi}${telefone}` });
        pixelEvento('CompleteRegistration', { content_name: 'Plano Diamante', status: true }, { umaVez: 'visita', chave: 'CompleteRegistration' });
        if (dados.compraMeta?.eventId) {
          pixelEvento(
            'Purchase',
            {
              content_name: 'Plano Diamante',
              value: Number(dados.compraMeta.valor) > 0 ? Number(dados.compraMeta.valor) : META_VALOR_PLANO.diamante,
              currency: 'BRL',
              num_items: 1,
            },
            { eventId: String(dados.compraMeta.eventId), umaVez: 'sempre', chave: `Purchase:${dados.compraMeta.eventId}` }
          );
        }
        // Entra sozinho. Se o login falhar por qualquer motivo, a conta já existe: manda para a tela de entrar.
        try {
          const { user } = await signIn(emailLimpo, senha);
          if (user) {
            navigate('/dashboard/establishment', { replace: true });
            return;
          }
        } catch {
          // segue para o login
        }
        navigate('/login?registered=success', { replace: true });
        return;
      }

      if (dados?.campo && dados?.mensagem) {
        setErros((e) => ({ ...e, [dados.campo as Campo]: String(dados.mensagem) }));
      }
      setAviso({
        tipo: 'erro',
        code: String(dados?.code || ''),
        texto: String(dados?.mensagem || 'Não foi possível criar a conta agora. Tente de novo em instantes.'),
      });
    } catch {
      setAviso({ tipo: 'erro', texto: 'Sem conexão com o servidor. Confira a sua internet e toque de novo.' });
    } finally {
      setEnviando(false);
    }
  };

  const podeEntrar = aviso?.code === 'pagamento_ja_usado' || aviso?.code === 'em_andamento';

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-8 text-white sm:py-12">
      <div className="mx-auto w-full max-w-md">
        <div className="mb-6 text-center">
          <p className="text-sm font-bold uppercase tracking-widest text-emerald-400">Agendei Fácil</p>
          <h1 className="mt-2 text-2xl font-black text-white sm:text-3xl">Crie a sua conta</h1>
          <p className="mt-2 text-sm text-slate-300">
            Pagamento feito? Agora é só preencher abaixo. Use o <b className="text-white">mesmo e-mail da compra</b>.
          </p>
        </div>

        <div className="rounded-2xl bg-white p-5 shadow-xl sm:p-6">
          {contaCriada ? (
            <div className="py-6 text-center">
              <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" />
              <p className="mt-3 text-lg font-black text-slate-900">Conta criada!</p>
              {contaCriada.codigo ? (
                <p className="mt-1 text-sm text-slate-600">
                  Código da sua barbearia: <b className="text-slate-900">{contaCriada.codigo}</b>
                </p>
              ) : null}
              <p className="mt-3 flex items-center justify-center gap-2 text-sm text-slate-600">
                <Loader2 className="h-4 w-4 animate-spin text-emerald-600" /> Entrando no seu painel…
              </p>
            </div>
          ) : (
            <form onSubmit={enviar} noValidate className="space-y-4">
              <div>
                <label htmlFor="cad-email" className="mb-1 block text-sm font-bold text-slate-800">
                  Qual e-mail você usou para efetuar o pagamento?
                </label>
                <input
                  id="cad-email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  autoCapitalize="none"
                  spellCheck={false}
                  maxLength={254}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seuemail@exemplo.com"
                  className={classeCampo(Boolean(erros.email))}
                />
                {erros.email ? <p className="mt-1 text-sm text-red-600">{erros.email}</p> : null}
              </div>

              <div>
                <label htmlFor="cad-senha" className="mb-1 block text-sm font-bold text-slate-800">
                  Crie a sua senha
                </label>
                <div className="relative">
                  <input
                    id="cad-senha"
                    type={mostrarSenha ? 'text' : 'password'}
                    autoComplete="new-password"
                    maxLength={72}
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    placeholder="Pelo menos 6 caracteres"
                    className={`${classeCampo(Boolean(erros.senha))} pr-12`}
                  />
                  <button
                    type="button"
                    onClick={() => setMostrarSenha((v) => !v)}
                    aria-label={mostrarSenha ? 'Esconder senha' : 'Mostrar senha'}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-slate-500 hover:text-slate-800"
                  >
                    {mostrarSenha ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
                {erros.senha ? <p className="mt-1 text-sm text-red-600">{erros.senha}</p> : null}
              </div>

              <div>
                <label htmlFor="cad-barbearia" className="mb-1 block text-sm font-bold text-slate-800">
                  Nome da sua barbearia
                </label>
                <input
                  id="cad-barbearia"
                  type="text"
                  autoComplete="organization"
                  maxLength={80}
                  value={nomeBarbearia}
                  onChange={(e) => setNomeBarbearia(e.target.value)}
                  placeholder="Ex.: Barbearia do João"
                  className={classeCampo(Boolean(erros.nomeBarbearia))}
                />
                {erros.nomeBarbearia ? <p className="mt-1 text-sm text-red-600">{erros.nomeBarbearia}</p> : null}
              </div>

              <div>
                <label htmlFor="cad-telefone" className="mb-1 block text-sm font-bold text-slate-800">
                  Seu número de telefone (WhatsApp)
                </label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <select
                    aria-label="País"
                    value={pais}
                    onChange={(e) => trocarPais(e.target.value as PaisTelefoneCode)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-base text-slate-900 outline-none focus:ring-2 focus:ring-emerald-500 sm:w-48"
                  >
                    {PAISES_TELEFONE.map((p) => (
                      <option key={p.code} value={p.code}>
                        {p.nome} (+{p.ddi})
                      </option>
                    ))}
                  </select>
                  <input
                    id="cad-telefone"
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel-national"
                    value={formatarTelefone(telefone, pais)}
                    onChange={(e) => setTelefone(limparTelefone(e.target.value, pais))}
                    placeholder={paisAtual.exemplo}
                    className={`${classeCampo(Boolean(erros.telefone))} min-w-0 flex-1`}
                  />
                </div>
                {erros.telefone ? (
                  <p className="mt-1 text-sm text-red-600">{erros.telefone}</p>
                ) : (
                  <p className="mt-1 text-xs text-slate-500">
                    {paisAtual.code === 'BR'
                      ? 'Coloque o DDD e o número. Ex.: (48) 99999-9999'
                      : `Só os números, sem o +${paisAtual.ddi}. Ex.: ${paisAtual.exemplo}`}
                  </p>
                )}
              </div>

              {aviso ? (
                <div
                  role="alert"
                  className={`rounded-xl border p-3 text-sm ${
                    aviso.tipo === 'erro' ? 'border-red-300 bg-red-50 text-red-800' : 'border-emerald-300 bg-emerald-50 text-emerald-800'
                  }`}
                >
                  <p>{aviso.texto}</p>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                    {podeEntrar ? (
                      <Link to="/login" className="font-bold text-emerald-700 underline">
                        Entrar na minha conta
                      </Link>
                    ) : null}
                    <a
                      href={linkSuporte(`Oi! Paguei o Agendei Fácil e preciso de ajuda para criar a conta. Meu e-mail: ${email.trim()}`)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 font-bold text-emerald-700 underline"
                    >
                      <MessageCircle className="h-4 w-4" /> Falar com o suporte
                    </a>
                  </div>
                </div>
              ) : null}

              <button
                type="submit"
                disabled={enviando}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3.5 text-base font-black text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {enviando ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" /> Criando a sua conta…
                  </>
                ) : (
                  'Criar minha conta'
                )}
              </button>

              <p className="flex items-center justify-center gap-1 text-xs text-slate-500">
                <Lock className="h-3.5 w-3.5" /> Só quem pagou consegue criar a conta.
              </p>
              {/* A conta nova já nasce pronta e não passa mais pelo passo a passo onde os termos eram aceitos. */}
              <p className="text-center text-xs text-slate-500">
                Ao criar a conta, você concorda com os{' '}
                <Link to="/terms" className="font-semibold text-slate-700 underline">
                  Termos de Uso
                </Link>{' '}
                e a{' '}
                <Link to="/privacy" className="font-semibold text-slate-700 underline">
                  Política de Privacidade
                </Link>
                .
              </p>
            </form>
          )}
        </div>

        <div className="mt-5 space-y-2 text-center text-sm text-slate-300">
          <p>
            Já tem conta?{' '}
            <Link to="/login" className="font-bold text-emerald-400 underline">
              Entrar
            </Link>
          </p>
          <p>
            Ainda não assinou?{' '}
            <a href={CAKTO_CHECKOUT_URL} className="font-bold text-emerald-400 underline">
              Assinar por R$ 67,90/mês
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
