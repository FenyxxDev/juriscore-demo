import { useState } from 'react';
import { Mail, Scale, UserPlus } from 'lucide-react';
import { Avatar, Button, Card, Field, Input, Modal, SearchInput, Segmented, Select, StatusBadge, useToast } from '../components/ui';
import { AreaList, AreaPicker } from '../components/Areas';
import { MembroDetalhe, perfilLabel, processosDo } from '../components/MembroDetalhe';
import { AREAS, PERFIS, type Perfil } from '../data';
import { useStore } from '../store';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function Equipe() {
  const { advogados, todosProcessos, can } = useStore();
  const [open, setOpen] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [perfil, setPerfil] = useState<'todos' | Perfil>('todos');
  const [area, setArea] = useState('todas');
  const [q, setQ] = useState('');

  const rows = advogados.filter(
    (a) =>
      (perfil === 'todos' || a.perfil === perfil) &&
      (area === 'todas' || a.areas.includes(area)) &&
      (!q || a.nome.toLowerCase().includes(q.toLowerCase())),
  );
  const aberto = advogados.find((a) => a.id === openId);

  return (
    <div className="mx-auto max-w-[1200px] px-6 py-7 md:px-8">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="eyebrow">Escritório</p>
          <h1 className="mt-1 text-[27px] font-semibold tracking-tight text-ink">Equipe</h1>
          <p className="mt-1 text-[13.5px] text-muted">Quem atua em cada área e quantos processos conduz.</p>
        </div>
        {can('gerenciarUsuarios') && (
          <Button onClick={() => setOpen(true)} icon={<UserPlus size={16} />}>
            Cadastrar membro
          </Button>
        )}
      </header>

      <div className="mb-5 flex flex-wrap items-center gap-2.5">
        <Segmented
          size="sm"
          value={perfil}
          onChange={setPerfil}
          options={[{ value: 'todos', label: 'Todos' }, ...PERFIS.map((p) => ({ value: p, label: p === 'Administrador' ? 'Gestores' : p === 'Advogado' ? 'Advogados' : 'Assistentes' }))]}
        />
        <Select value={area} onChange={(e) => setArea(e.target.value)} aria-label="Área jurídica" className="h-8 text-[12.5px] text-muted">
          <option value="todas">Todas as áreas</option>
          {AREAS.map((a) => <option key={a}>{a}</option>)}
        </Select>
        <SearchInput className="ml-auto w-60" placeholder="Buscar membro" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar membro" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((a) => {
          const n = processosDo(a, todosProcessos).filter((p) => !p.arquivado && p.status !== 'encerrado').length;
          return (
            <button key={a.id} onClick={() => setOpenId(a.id)} className="text-left">
              <Card className="h-full p-5 transition-colors hover:border-line-strong">
                <div className="flex items-center gap-3">
                  <Avatar name={a.nome} size={44} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-ink">{a.nome}</p>
                    <p className="text-xs text-muted">{perfilLabel(a.perfil)}{a.cargo ? ` · ${a.cargo}` : ''}</p>
                  </div>
                  <StatusBadge tone={a.ativo ? 'ativo' : 'inativo'} />
                </div>
                <div className="mt-4 min-h-[36px]">
                  <AreaList areas={a.areas} full />
                </div>
                <dl className="mt-4 space-y-1.5 border-t border-line pt-3 text-[12.5px]">
                  <div className="flex items-center gap-2 text-muted">
                    <Mail size={13} className="shrink-0" /> <span className="truncate">{a.email}</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted">
                    <Scale size={13} className="shrink-0" />
                    <span className={a.oab ? 'ident' : ''}>{a.oab || (a.equipe ? `Apoia ${a.equipe}` : 'Sem inscrição OAB')}</span>
                    <span className="tnum ml-auto text-ink">{n} ativo(s)</span>
                  </div>
                </dl>
              </Card>
            </button>
          );
        })}
      </div>
      {!rows.length && <p className="py-16 text-center text-[13px] text-muted">Nenhum membro corresponde aos filtros.</p>}

      {open && <NovoMembroModal onClose={() => setOpen(false)} />}
      {aberto && <MembroDetalhe membro={aberto} onClose={() => setOpenId(null)} />}
    </div>
  );
}

export function NovoMembroModal({ onClose }: { onClose: () => void }) {
  const { dispatch, advogados } = useStore();
  const toast = useToast();
  const [nome, setNome] = useState('');
  const [oab, setOab] = useState('');
  const [email, setEmail] = useState('');
  const [telefone, setTelefone] = useState('');
  const [perfil, setPerfil] = useState<Perfil>('Advogado');
  const [areas, setAreas] = useState<string[]>([]);
  const [errs, setErrs] = useState<Record<string, string>>({});

  return (
    <Modal open onClose={onClose} title="Cadastrar membro" description="O convite é enviado por e-mail." size="lg">
      <form
        className="space-y-4"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          const er: Record<string, string> = {};
          if (!nome.trim()) er.nome = 'Informe o nome completo.';
          if (!EMAIL_RE.test(email.trim())) er.email = 'E-mail inválido.';
          else if (advogados.some((a) => a.email.toLowerCase() === email.trim().toLowerCase())) er.email = 'Este e-mail já está cadastrado.';
          if (perfil === 'Advogado' && !oab.trim()) er.oab = 'Informe a OAB.';
          setErrs(er);
          if (Object.keys(er).length) return;
          dispatch({ type: 'addAdvogado', advogado: { nome: nome.trim(), oab: oab.trim(), email: email.trim().toLowerCase(), telefone, perfil, areas } });
          toast({ tone: 'success', message: `Convite enviado para ${email.trim()}.` });
          onClose();
        }}
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Nome completo" required error={errs.nome}>
            <Input value={nome} invalid={!!errs.nome} onChange={(e) => setNome(e.target.value)} autoFocus />
          </Field>
          <Field label="Perfil de acesso">
            <Select value={perfil} onChange={(e) => setPerfil(e.target.value as Perfil)} className="h-9.5 w-full">
              {PERFIS.map((p) => <option key={p} value={p}>{perfilLabel(p)}</option>)}
            </Select>
          </Field>
          <Field label="E-mail" required error={errs.email}>
            <Input type="email" value={email} invalid={!!errs.email} onChange={(e) => setEmail(e.target.value)} placeholder="membro@juriscore.com.br" />
          </Field>
          <Field label="Telefone">
            <Input value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="(00) 00000-0000" />
          </Field>
          {perfil === 'Advogado' && (
            <Field label="OAB" required error={errs.oab}>
              <Input className="ident" value={oab} invalid={!!errs.oab} onChange={(e) => setOab(e.target.value)} placeholder="OAB/PE 45.678" />
            </Field>
          )}
        </div>
        {perfil !== 'Administrador' && (
          <Field label="Áreas jurídicas">
            <AreaPicker value={areas} onChange={setAreas} />
          </Field>
        )}
        <div className="flex justify-end gap-2 border-t border-line pt-4">
          <Button variant="secondary" type="button" onClick={onClose}>Cancelar</Button>
          <Button type="submit">Enviar convite</Button>
        </div>
      </form>
    </Modal>
  );
}
