import { AREAS } from '../data';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Check, Plus, Trash2 } from 'lucide-react';
import { Button, Field, Input, Modal, Select, cx, useToast } from './ui';
import { supabase } from '../lib/supabase';
import { createProcess } from '../lib/processes';
import { useStore } from '../store';

const STEPS = ['Dados', 'Responsável', 'Partes', 'Documentos'];

type ClientOption = { id: string; name: string };

export function NovoProcessoModal({
  open,
  onClose,
  fixedClienteId,
}: {
  open: boolean;
  onClose: () => void;
  fixedClienteId?: string;
}) {
  const navigate = useNavigate();
  const toast = useToast();
  const { refreshWorkspace, user } = useStore();

  const [clients, setClients] = useState<ClientOption[]>([]);
  const [loadingClients, setLoadingClients] = useState(false);
  const [clientError, setClientError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [numero, setNumero] = useState('');
  const [step, setStep] = useState(0);
  const [clienteId, setClienteId] = useState(fixedClienteId ?? '');
  const [area, setArea] = useState('Direito Civil');
  const [tribunal, setTribunal] = useState('TJPE');
  const [comarca, setComarca] = useState('Recife');
  const [vara, setVara] = useState('1ª Vara Cível');
  const [resumo, setResumo] = useState('');
  const [responsavel, setResponsavel] = useState('');
  const [partes, setPartes] = useState<{ nome: string; papel: string }[]>([
    { nome: '', papel: 'Autor' },
  ]);

  useEffect(() => {
    if (!open) return;
    let active = true;
    setLoadingClients(true);
    setClientError(false);
    async function loadOptions() {
      try {
        if (!supabase) throw new Error('Supabase não configurado.');
        const { data: auth, error: authError } = await supabase.auth.getUser();
        if (authError) throw authError;
        if (!auth.user) throw new Error('Sessão expirada.');
        const { data, error } = await supabase.from('clients').select('id, name')
          .eq('owner_id', auth.user.id).order('name', { ascending: true });
        if (error) throw error;
        const options = (data ?? []) as ClientOption[];
        const metadata = auth.user.user_metadata ?? {};
        const label = String(metadata.nome ?? metadata.full_name ?? metadata.name ?? auth.user.email ?? 'Utilizador');
        if (active) {
          setClients(options);
          setClienteId((current) => fixedClienteId ?? (current || options[0]?.id || ''));
          setResponsavel((current) => current || label);
        }
      } catch {
        if (active) setClientError(true);
      } finally {
        if (active) setLoadingClients(false);
      }
    }
    void loadOptions();
    return () => { active = false; };
  }, [open, fixedClienteId]);

  const reset = () => {
    setStep(0);
    setNumero('');
    setArea('Direito Civil');
    setResumo('');
    setPartes([{ nome: '', papel: 'Autor' }]);
    setFormError('');
  };

  const finish = async () => {
    setFormError('');
    setSaving(true);
    try {
      await createProcess({
        numero,
        clienteId,
        responsavel,
        area,
        tribunal,
        comarca,
        vara,
        resumo,
        partes: partes.filter((party) => party.nome.trim()).map((party) => ({ ...party, rep: responsavel })),
      });
      try {
        await refreshWorkspace(user.id);
      } catch {
        toast({ tone: 'error', message: 'Processo salvo, mas os dados da conta não puderam ser atualizados. Atualize a página.' });
      }
      toast({ tone: 'success', message: 'Processo criado e guardado na sua conta.' });
      onClose();
      reset();
      navigate(`/processos/${encodeURIComponent(numero.trim())}`);
    } catch (error) {
      const code = (error as { code?: string })?.code;
      setFormError(code === '23505'
        ? 'Já existe um processo com este número na sua conta.'
        : error instanceof Error ? error.message : 'Não foi possível criar o processo. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  const canNext = step === 0 ? !!clienteId && !!numero.trim() : step === 1 ? !!responsavel.trim() : true;

  return (
    <Modal
      open={open}
      onClose={() => {
        onClose();
        reset();
      }}
      title="Novo processo"
      footer={
        <>
          <Button
            variant="secondary"
            disabled={saving}
            onClick={() => (step === 0 ? (onClose(), reset()) : setStep((s) => s - 1))}
          >
            {step === 0 ? 'Cancelar' : 'Voltar'}
          </Button>
          {step < STEPS.length - 1 ? (
            <Button disabled={!canNext || saving || (step === 0 && (loadingClients || clients.length === 0))} onClick={() => setStep((s) => s + 1)}>
              Continuar
            </Button>
          ) : (
            <Button icon={<Check size={16} />} loading={saving} onClick={() => void finish()}>
              Criar processo
            </Button>
          )}
        </>
      }
    >
      {/* Stepper */}
      <ol className="mb-5 flex items-center gap-1.5">
        {STEPS.map((s, i) => (
          <li key={s} className="flex flex-1 items-center gap-1.5">
            <span
              className={cx(
                'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                i < step
                  ? 'bg-teal text-white'
                  : i === step
                    ? 'bg-brand text-white'
                    : 'bg-slate-100 text-muted',
              )}
            >
              {i < step ? <Check size={13} /> : i + 1}
            </span>
            <span className={cx('text-[13px] font-medium', i === step ? 'text-ink' : 'text-muted')}>
              {s}
            </span>
            {i < STEPS.length - 1 && <span className="h-px flex-1 bg-line" />}
          </li>
        ))}
      </ol>

      {formError && <p role="alert" className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-danger">{formError}</p>}

      {step === 0 && (
        <div className="flex flex-col gap-4">
          <Field label="Número do processo" htmlFor="np-numero" required>
            <Input id="np-numero" value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="Ex.: 0001234-56.2026.8.17.0001" />
          </Field>
          <Field label="Cliente" htmlFor="np-cliente">
            <Select
              id="np-cliente"
              className="h-10 w-full"
              value={clienteId}
              disabled={!!fixedClienteId}
              onChange={(e) => setClienteId(e.target.value)}
            >
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          {loadingClients && <p className="text-[13px] text-muted">A carregar os clientes da sua conta…</p>}
          {clientError && <p role="alert" className="text-[13px] text-danger">Não foi possível carregar os clientes desta conta.</p>}
          {!loadingClients && !clientError && clients.length === 0 && (
            <p className="text-[13px] text-muted">Cadastre primeiro um cliente em <Link to="/clientes" className="font-medium text-teal hover:underline">Clientes</Link>.</p>
          )}
          <div className="grid grid-cols-2 gap-4">
            <Field label="Área jurídica" htmlFor="np-area">
              <Select id="np-area" className="h-10 w-full" value={area} onChange={(e) => setArea(e.target.value)}>
                {AREAS.map((a) => (
                  <option key={a}>{a}</option>
                ))}
              </Select>
            </Field>
            <Field label="Tribunal" htmlFor="np-trib">
              <Input id="np-trib" value={tribunal} onChange={(e) => setTribunal(e.target.value)} />
            </Field>
            <Field label="Comarca" htmlFor="np-com">
              <Input id="np-com" value={comarca} onChange={(e) => setComarca(e.target.value)} />
            </Field>
            <Field label="Vara" htmlFor="np-vara">
              <Input id="np-vara" value={vara} onChange={(e) => setVara(e.target.value)} />
            </Field>
          </div>
          <Field label="Resumo (opcional)" htmlFor="np-resumo">
            <textarea
              id="np-resumo"
              rows={2}
              value={resumo}
              onChange={(e) => setResumo(e.target.value)}
              placeholder="Breve descrição do objeto do processo..."
              className="w-full resize-none rounded-lg border border-line bg-white px-3 py-2.5 text-sm text-ink placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal/40 focus:border-teal"
            />
          </Field>
        </div>
      )}

      {step === 1 && (
        <Field label="Advogado responsável" htmlFor="np-resp" hint="Atribua quem conduzirá o processo.">
          <Input id="np-resp" value={responsavel} onChange={(e) => setResponsavel(e.target.value)} />
        </Field>
      )}

      {step === 2 && (
        <div className="flex flex-col gap-3">
          {partes.map((p, i) => (
            <div key={i} className="flex items-end gap-2">
              <div className="flex-1">
                <Field label={i === 0 ? 'Nome da parte' : ''} htmlFor={`np-parte-${i}`}>
                  <Input
                    id={`np-parte-${i}`}
                    value={p.nome}
                    onChange={(e) =>
                      setPartes((ps) => ps.map((x, j) => (j === i ? { ...x, nome: e.target.value } : x)))
                    }
                    placeholder="Ex.: Comércio Vega Ltda."
                  />
                </Field>
              </div>
              <Select
                aria-label="Papel"
                className="h-10 w-36"
                value={p.papel}
                onChange={(e) =>
                  setPartes((ps) => ps.map((x, j) => (j === i ? { ...x, papel: e.target.value } : x)))
                }
              >
                {['Autor', 'Réu', 'Reclamante', 'Reclamada', 'Terceiro'].map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </Select>
              <button
                onClick={() => setPartes((ps) => ps.filter((_, j) => j !== i))}
                aria-label="Remover parte"
                className="mb-1 rounded-md p-2 text-muted hover:bg-slate-100 hover:text-danger"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
          <button
            onClick={() => setPartes((ps) => [...ps, { nome: '', papel: 'Réu' }])}
            className="flex w-fit items-center gap-1.5 text-sm font-medium text-teal hover:underline"
          >
            <Plus size={15} /> Adicionar parte
          </button>
        </div>
      )}

      {step === 3 && (
        <div className="rounded-lg border border-line bg-slate-50 p-4 text-sm leading-relaxed text-muted">
          O envio de ficheiros ainda não está ligado ao armazenamento privado. Não vamos registar nomes como se os ficheiros tivessem sido enviados. Depois de criar o processo, o módulo Documentos será integrado para aceitar anexos reais.
        </div>
      )}
    </Modal>
  );
}
