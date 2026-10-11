import { AREAS } from '../data';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Check, Plus, Trash2 } from 'lucide-react';
import { Button, Field, Input, Modal, Select, cx, useToast } from './ui';
import { useStore } from '../store';

const STEPS = ['Dados', 'Responsável', 'Partes', 'Documentos'];

const genNumero = () => {
  const seq = String(Math.floor(1000 + Math.random() * 8999)) + '000';
  return `${seq.slice(0, 7)}-${String(Math.floor(10 + Math.random() * 89))}.2026.8.17.0001`;
};

export function NovoProcessoModal({
  open,
  onClose,
  fixedClienteId,
}: {
  open: boolean;
  onClose: () => void;
  fixedClienteId?: string;
}) {
  const { clientes, advogados, dispatch } = useStore();
  const navigate = useNavigate();
  const toast = useToast();

  const [step, setStep] = useState(0);
  const [clienteId, setClienteId] = useState(fixedClienteId ?? clientes[0]?.id ?? '');
  const [area, setArea] = useState('Direito Civil');
  const [tribunal, setTribunal] = useState('TJPE');
  const [comarca, setComarca] = useState('Recife');
  const [vara, setVara] = useState('1ª Vara Cível');
  const [resumo, setResumo] = useState('');
  const [responsavel, setResponsavel] = useState(advogados[0]?.nome ?? '');
  const [partes, setPartes] = useState<{ nome: string; papel: string }[]>([
    { nome: '', papel: 'Autor' },
  ]);
  const [docs, setDocs] = useState<string[]>([]);
  const [docNome, setDocNome] = useState('');

  const cliente = clientes.find((c) => c.id === clienteId);

  const reset = () => {
    setStep(0);
    setArea('Cível');
    setResumo('');
    setPartes([{ nome: '', papel: 'Autor' }]);
    setDocs([]);
    setDocNome('');
  };

  const finish = () => {
    const numero = genNumero();
    dispatch({
      type: 'addProcesso',
      processo: {
        numero,
        clienteId,
        cliente: cliente?.nome ?? '-',
        responsavel,
        area,
        tribunal,
        comarca,
        vara,
        resumo: resumo.trim() || 'Processo recém-cadastrado. Resumo a ser complementado.',
        partes: partes
          .filter((p) => p.nome.trim())
          .map((p, i) => ({ id: `np-${i}`, nome: p.nome.trim(), papel: p.papel, doc: '-', rep: responsavel })),
        documentos: docs.map((nome, i) => ({
          id: `nd-${i}`,
          nome,
          tipo: 'Anexo',
          data: '',
          tamanho: '-',
        })),
        prazos: [],
        audiencias: [],
      },
    });
    toast({ tone: 'success', message: 'Processo criado com sucesso.' });
    onClose();
    reset();
    navigate(`/processos/${encodeURIComponent(numero)}`);
  };

  const canNext = step === 0 ? !!clienteId : step === 1 ? !!responsavel : true;

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
            onClick={() => (step === 0 ? (onClose(), reset()) : setStep((s) => s - 1))}
          >
            {step === 0 ? 'Cancelar' : 'Voltar'}
          </Button>
          {step < STEPS.length - 1 ? (
            <Button disabled={!canNext} onClick={() => setStep((s) => s + 1)}>
              Continuar
            </Button>
          ) : (
            <Button icon={<Check size={16} />} onClick={finish}>
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

      {step === 0 && (
        <div className="flex flex-col gap-4">
          <Field label="Cliente" htmlFor="np-cliente">
            <Select
              id="np-cliente"
              className="h-10 w-full"
              value={clienteId}
              disabled={!!fixedClienteId}
              onChange={(e) => setClienteId(e.target.value)}
            >
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </Select>
          </Field>
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
          <Select
            id="np-resp"
            className="h-10 w-full"
            value={responsavel}
            onChange={(e) => setResponsavel(e.target.value)}
          >
            {advogados.filter((a) => a.perfil !== 'Assistente' && a.ativo).map((a) => (
              <option key={a.id} value={a.nome}>
                {a.nome}{a.oab ? ` · ${a.oab}` : ''}
              </option>
            ))}
          </Select>
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
        <div className="flex flex-col gap-3">
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Field label="Documento" htmlFor="np-doc">
                <Input
                  id="np-doc"
                  value={docNome}
                  onChange={(e) => setDocNome(e.target.value)}
                  placeholder="Ex.: Petição inicial.pdf"
                />
              </Field>
            </div>
            <Button
              variant="secondary"
              className="mb-0"
              icon={<Plus size={16} />}
              onClick={() => {
                if (!docNome.trim()) return;
                setDocs((d) => [...d, docNome.trim()]);
                setDocNome('');
              }}
            >
              Anexar
            </Button>
          </div>
          {docs.length === 0 ? (
            <p className="text-[13px] text-muted">Nenhum documento anexado ainda. É opcional.</p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {docs.map((d, i) => (
                <li
                  key={i}
                  className="flex items-center justify-between rounded-lg border border-line bg-slate-50 px-3 py-2 text-sm text-ink"
                >
                  {d}
                  <button
                    onClick={() => setDocs((x) => x.filter((_, j) => j !== i))}
                    aria-label={`Remover ${d}`}
                    className="text-muted hover:text-danger"
                  >
                    <Trash2 size={15} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Modal>
  );
}
