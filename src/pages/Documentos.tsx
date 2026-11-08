import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { Download, FileText, Upload } from 'lucide-react';
import { Button, Card, Field, Input, Modal, SearchInput, Select, useToast } from '../components/ui';
import { AreaTag } from '../components/Areas';
import { AREAS, type Processo } from '../data';
import { procLink, useStore } from '../store';
import { listProcesses } from '../lib/processes';
import { DOCUMENT_ACCEPT, downloadDocument, listDocuments, MAX_DOCUMENT_BYTES, type StoredDocument, uploadDocument } from '../lib/documents';

export function Documentos() {
  const { can } = useStore();
  const toast = useToast();
  const [documents, setDocuments] = useState<StoredDocument[]>([]);
  const [processes, setProcesses] = useState<Processo[]>([]);
  const [q, setQ] = useState('');
  const [tipo, setTipo] = useState('todos');
  const [cliente, setCliente] = useState('todos');
  const [area, setArea] = useState('todos');
  const [periodo, setPeriodo] = useState('todos');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [reload, setReload] = useState(0);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError(false);
    void Promise.all([listDocuments(), listProcesses()])
      .then(([loadedDocuments, loadedProcesses]) => {
        if (!active) return;
        setDocuments(loadedDocuments);
        setProcesses(loadedProcesses);
      })
      .catch(() => { if (active) setLoadError(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [reload]);

  const areaOf = useMemo(() => new Map(processes.map((process) => [process.numero, process.area])), [processes]);
  const tipos = useMemo(() => [...new Set(documents.map((document) => document.tipo))].sort(), [documents]);
  const clientes = useMemo(() => [...new Set(documents.map((document) => document.cliente))].sort(), [documents]);
  const areas = AREAS.filter((item) => documents.some((document) => areaOf.get(document.numero) === item));
  const filtered = documents.filter((document) => {
    if (tipo !== 'todos' && document.tipo !== tipo) return false;
    if (cliente !== 'todos' && document.cliente !== cliente) return false;
    if (area !== 'todos' && areaOf.get(document.numero) !== area) return false;
    if (periodo !== 'todos') {
      const daysAgo = Math.floor((Date.now() - new Date(`${document.data.split('/').reverse().join('-')}T12:00:00`).getTime()) / 86_400_000);
      if (!(daysAgo >= 0 && daysAgo <= Number(periodo))) return false;
    }
    return q === '' || `${document.nome} ${document.cliente} ${document.numero} ${document.tipo}`.toLowerCase().includes(q.toLowerCase());
  });
  const activeFilters = [tipo, cliente, area, periodo].filter((filter) => filter !== 'todos').length + (q ? 1 : 0);
  const resetFilters = () => {
    setQ('');
    setTipo('todos');
    setCliente('todos');
    setArea('todos');
    setPeriodo('todos');
  };

  const handleDownload = async (document: StoredDocument) => {
    setDownloadingId(document.id);
    try {
      await downloadDocument(document.id);
    } catch (error) {
      toast({ tone: 'error', message: error instanceof Error ? error.message : 'Não foi possível descarregar o documento.' });
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <div className="mx-auto max-w-[1400px] px-5 py-7 md:px-8">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[28px] font-semibold text-ink">Documentos</h1>
          <p className="mt-1 text-muted">Repositório privado de ficheiros anexados aos processos desta conta.</p>
        </div>
        {can('anexarDocumentos') && (
          <Button onClick={() => setUploadOpen(true)} icon={<Upload size={16} />}>
            Enviar documento
          </Button>
        )}
      </header>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="min-w-[260px] flex-1">
          <SearchInput value={q} onChange={(event) => setQ(event.target.value)} placeholder="Buscar por nome, cliente ou processo..." />
        </div>
        <Select value={tipo} onChange={(event) => setTipo(event.target.value)} aria-label="Tipo de documento">
          <option value="todos">Todos os tipos</option>
          {tipos.map((item) => <option key={item}>{item}</option>)}
        </Select>
        <Select value={cliente} onChange={(event) => setCliente(event.target.value)} aria-label="Cliente">
          <option value="todos">Todos os clientes</option>
          {clientes.map((item) => <option key={item}>{item}</option>)}
        </Select>
        <Select value={area} onChange={(event) => setArea(event.target.value)} aria-label="Área jurídica">
          <option value="todos">Todas as áreas</option>
          {areas.map((item) => <option key={item}>{item}</option>)}
        </Select>
        <Select value={periodo} onChange={(event) => setPeriodo(event.target.value)} aria-label="Período">
          <option value="todos">Qualquer data</option>
          <option value="7">Últimos 7 dias</option>
          <option value="30">Últimos 30 dias</option>
        </Select>
        {activeFilters > 0 && (
          <button onClick={resetFilters} className="text-[13px] font-medium text-teal hover:underline">
            Limpar filtros ({activeFilters})
          </button>
        )}
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-muted">
                <th className="px-5 py-3">Documento</th>
                <th className="px-5 py-3">Processo</th>
                <th className="px-5 py-3">Cliente</th>
                <th className="px-5 py-3">Enviado em</th>
                <th className="px-5 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {filtered.map((document) => (
                <tr key={document.id} className="hover:bg-slate-50/60">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand">
                        <FileText size={17} />
                      </span>
                      <div className="min-w-0">
                        <Link to={procLink(document.numero, 'Documentos', document.id)} className="block truncate font-medium text-ink hover:text-teal">
                          {document.nome}
                        </Link>
                        <p className="text-xs text-muted">{document.tipo} · {document.tamanho}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <Link to={procLink(document.numero, 'Documentos', document.id)} className="font-medium text-teal hover:underline">
                      {document.numero.split('.')[0]}
                    </Link>
                    {areaOf.get(document.numero) && <span className="mt-0.5 block"><AreaTag area={areaOf.get(document.numero)!} /></span>}
                  </td>
                  <td className="px-5 py-3.5 text-muted">{document.cliente}</td>
                  <td className="px-5 py-3.5 text-muted">{document.data}</td>
                  <td className="px-5 py-3.5">
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => void handleDownload(document)}
                        disabled={downloadingId === document.id}
                        aria-label={`Descarregar ${document.nome}`}
                        title="Descarregar documento privado"
                        className="flex h-8 w-8 items-center justify-center rounded-md border border-line text-muted hover:bg-slate-50 disabled:opacity-50"
                      >
                        <Download size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {loading ? (
          <p className="px-5 py-12 text-center text-sm text-muted">A carregar documentos privados…</p>
        ) : loadError ? (
          <div className="px-5 py-10 text-center text-sm text-muted">
            <p>Não foi possível carregar os documentos desta conta.</p>
            <Button variant="secondary" className="mt-3" onClick={() => setReload((value) => value + 1)}>Tentar novamente</Button>
          </div>
        ) : filtered.length === 0 ? (
          <p className="px-5 py-12 text-center text-sm text-muted">
            {documents.length === 0 ? 'Nenhum documento anexado ainda.' : 'Nenhum documento corresponde à busca ou aos filtros.'}
          </p>
        ) : null}
      </Card>

      {uploadOpen && (
        <UploadModal
          processes={processes}
          onClose={() => setUploadOpen(false)}
          onUploaded={(document) => {
            setDocuments((current) => [document, ...current]);
            setUploadOpen(false);
            toast({ tone: 'success', message: 'Documento carregado para o Storage privado.' });
          }}
        />
      )}
    </div>
  );
}

function UploadModal({
  processes,
  onClose,
  onUploaded,
}: {
  processes: Processo[];
  onClose: () => void;
  onUploaded: (document: StoredDocument) => void;
}) {
  const toast = useToast();
  const [caseNumber, setCaseNumber] = useState(processes[0]?.numero ?? '');
  const [documentType, setDocumentType] = useState('Petição');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!caseNumber || !file || busy) return;
    setBusy(true);
    try {
      const document = await uploadDocument({ caseNumber, file, documentType });
      onUploaded(document);
    } catch (error) {
      toast({ tone: 'error', message: error instanceof Error ? error.message : 'Não foi possível carregar o documento.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="Enviar documento">
      <form className="space-y-4" onSubmit={(event) => void handleSubmit(event)}>
        {processes.length === 0 ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            É necessário criar um processo nesta conta antes de anexar documentos.
          </div>
        ) : (
          <Field label="Processo">
            <Select value={caseNumber} onChange={(event) => setCaseNumber(event.target.value)} required>
              {processes.map((process) => (
                <option key={process.numero} value={process.numero}>
                  {process.numero.split('.')[0]} · {process.cliente}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <Field label="Tipo de documento">
          <Select value={documentType} onChange={(event) => setDocumentType(event.target.value)}>
            {['Petição', 'Contrato', 'Procuração', 'Prova', 'Decisão', 'Comprovante', 'Outros'].map((item) => <option key={item}>{item}</option>)}
          </Select>
        </Field>
        <Field label="Ficheiro (PDF, imagem, Word, Excel ou TXT; máximo 25 MiB)">
          <Input
            type="file"
            accept={DOCUMENT_ACCEPT}
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            required
          />
        </Field>
        {file && (
          <p className="text-xs text-muted">
            {file.name} · {(file.size / (1024 * 1024)).toFixed(2)} MiB
            {file.size > MAX_DOCUMENT_BYTES ? ' — excede o limite permitido.' : ''}
          </p>
        )}
        <p className="text-xs text-muted">O ficheiro fica num bucket privado e só a sua conta o pode consultar. Não são criadas ligações públicas.</p>
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" type="button" onClick={onClose} disabled={busy}>Cancelar</Button>
          <Button type="submit" disabled={busy || processes.length === 0 || !file || file.size > MAX_DOCUMENT_BYTES}>
            {busy ? 'A carregar…' : 'Anexar documento'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
