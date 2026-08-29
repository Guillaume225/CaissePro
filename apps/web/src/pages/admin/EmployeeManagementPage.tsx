import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Users,
  Plus,
  Pencil,
  Trash2,
  Search,
  UserCheck,
  UserX,
  Briefcase,
  Mail,
  Phone,
  Hash,
  Building2,
  Copy,
  CheckCircle2,
  X,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
} from 'lucide-react';
import {
  useEmployees,
  useCreateEmployee,
  useUpdateEmployee,
  useDeleteEmployee,
} from '@/hooks/useAdmin';
import type { EmployeeAccount, CreateEmployeeDto, UpdateEmployeeDto } from '@/types/admin';

const SERVICE_OPTIONS = [
  'Comptabilité',
  'Logistique',
  'Marketing',
  'Ressources Humaines',
  'Direction Générale',
  'Informatique',
  'Commercial',
  'Production',
  'Finance',
  'Juridique',
  'Achats',
  'Qualité',
];

const PAGE_SIZE = 10;

function ModalShell({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handler);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-md bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#e0e6eb] px-6 py-4">
          <h2 className="text-lg font-semibold text-[#0a2540]">{title}</h2>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-md text-[#697386] hover:bg-zinc-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="max-h-[75vh] overflow-y-auto px-6 py-4">{children}</div>
      </div>
    </div>
  );
}

function SortIcon({ active, dir }: { active: boolean; dir: 'asc' | 'desc' | null }) {
  if (!active || !dir) return <ArrowUpDown className="h-3 w-3 text-[#aab7c4]" />;
  return dir === 'asc' ? (
    <ArrowUp className="h-3 w-3 text-[#0a2540]" />
  ) : (
    <ArrowDown className="h-3 w-3 text-[#0a2540]" />
  );
}

export default function EmployeeManagementPage() {
  const { t } = useTranslation();
  const { data: employees = [], isLoading } = useEmployees();
  const createEmployee = useCreateEmployee();
  const updateEmployee = useUpdateEmployee();
  const deleteEmployee = useDeleteEmployee();

  const [search, setSearch] = useState('');
  const [serviceFilter, setServiceFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editEmp, setEditEmp] = useState<EmployeeAccount | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<EmployeeAccount | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<'matricule' | 'name' | 'service' | 'isActive' | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc' | null>(null);
  const [page, setPage] = useState(1);

  const [form, setForm] = useState<CreateEmployeeDto>({
    matricule: '',
    firstName: '',
    lastName: '',
    email: '',
    service: '',
    position: '',
    phone: '',
  });

  const filtered = employees.filter((emp) => {
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      emp.matricule.toLowerCase().includes(q) ||
      emp.email.toLowerCase().includes(q) ||
      `${emp.firstName} ${emp.lastName}`.toLowerCase().includes(q) ||
      emp.service.toLowerCase().includes(q);
    const matchService = !serviceFilter || emp.service === serviceFilter;
    return matchSearch && matchService;
  });

  const toggleSort = (key: typeof sortKey) => {
    if (sortKey !== key) {
      setSortKey(key);
      setSortDir('asc');
    } else if (sortDir === 'asc') {
      setSortDir('desc');
    } else {
      setSortKey(null);
      setSortDir(null);
    }
    setPage(1);
  };

  const sorted = useMemo(() => {
    if (!sortKey || !sortDir) return filtered;
    return [...filtered].sort((a, b) => {
      const av = sortKey === 'name' ? `${a.firstName} ${a.lastName}` : a[sortKey];
      const bv = sortKey === 'name' ? `${b.firstName} ${b.lastName}` : b[sortKey];
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filtered, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const pageData = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const services = [...new Set(employees.map((e) => e.service))].sort();

  const openCreate = () => {
    setEditEmp(null);
    const nextNum =
      employees.length > 0
        ? Math.max(...employees.map((e) => parseInt(e.matricule.replace(/\D/g, '') || '0', 10))) + 1
        : 1;
    setForm({
      matricule: `MAT-${String(nextNum).padStart(3, '0')}`,
      firstName: '',
      lastName: '',
      email: '',
      service: '',
      position: '',
      phone: '',
    });
    setShowModal(true);
  };

  const openEdit = (emp: EmployeeAccount) => {
    setEditEmp(emp);
    setForm({
      matricule: emp.matricule,
      firstName: emp.firstName,
      lastName: emp.lastName,
      email: emp.email,
      service: emp.service,
      position: emp.position,
      phone: emp.phone,
    });
    setShowModal(true);
  };

  const handleSubmit = async () => {
    try {
      if (editEmp) {
        const dto: UpdateEmployeeDto & { id: string } = {
          id: editEmp.id,
          firstName: form.firstName,
          lastName: form.lastName,
          email: form.email,
          service: form.service,
          position: form.position,
          phone: form.phone,
        };
        await updateEmployee.mutateAsync(dto);
      } else {
        await createEmployee.mutateAsync(form);
      }
      setShowModal(false);
    } catch {
      // Error handled by react-query
    }
  };

  const handleToggleActive = async (emp: EmployeeAccount) => {
    await updateEmployee.mutateAsync({ id: emp.id, isActive: !emp.isActive });
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    await deleteEmployee.mutateAsync(confirmDelete.id);
    setConfirmDelete(null);
  };

  const copyCredentials = (emp: EmployeeAccount) => {
    const text = `Matricule: ${emp.matricule}\nEmail: ${emp.email}\nConnexion: https://gestion.i-management.website/demande/login`;
    navigator.clipboard.writeText(text);
    setCopied(emp.id);
    setTimeout(() => setCopied(null), 2000);
  };

  const isFormValid =
    form.matricule && form.firstName && form.lastName && form.email && form.service && form.position;

  const Th = ({ label, sortKeyName }: { label: string; sortKeyName: typeof sortKey }) => (
    <th
      className="cursor-pointer select-none px-3 py-2 text-left text-xs font-medium text-[#697386]"
      onClick={() => toggleSort(sortKeyName)}
    >
      <span className="flex items-center gap-1">
        {label}
        <SortIcon active={sortKey === sortKeyName} dir={sortDir} />
      </span>
    </th>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-[#0a2540]">
            <Users className="text-brand-gold" size={24} />
            {t('admin.employees.title', 'Gestion des salariés')}
          </h1>
          <p className="mt-1 text-sm text-[#697386]">
            {t(
              'admin.employees.subtitle',
              'Créez et gérez les comptes salariés pour la connexion aux demandes de décaissement',
            )}
          </p>
        </div>
        <button className="btn-primary" onClick={openCreate}>
          <Plus size={16} />
          {t('admin.employees.create', 'Nouveau salarié')}
        </button>
      </div>

      {/* Info banner */}
      <div className="card border-brand-gold/20 bg-brand-gold/5">
        <p className="text-sm font-medium text-brand-gold">Portail salarié</p>
        <p className="mt-1 text-xs text-[#697386]">
          Les salariés se connectent sur{' '}
          <a
            href="https://gestion.i-management.website/demande/login"
            target="_blank"
            rel="noreferrer"
            className="text-brand-gold underline hover:text-brand-gold-hover"
          >
            https://gestion.i-management.website/demande/login
          </a>{' '}
          avec leur <strong>matricule</strong> et <strong>email</strong> pour soumettre des demandes
          de décaissement. Utilisez le bouton <Copy size={10} className="inline" /> pour copier les
          identifiants.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="card">
          <div className="text-2xl font-bold text-[#0a2540]">{employees.length}</div>
          <div className="text-xs text-[#697386]">Total salariés</div>
        </div>
        <div className="card">
          <div className="text-2xl font-bold text-emerald-600">
            {employees.filter((e) => e.isActive).length}
          </div>
          <div className="text-xs text-[#697386]">Actifs</div>
        </div>
        <div className="card">
          <div className="text-2xl font-bold text-red-600">
            {employees.filter((e) => !e.isActive).length}
          </div>
          <div className="text-xs text-[#697386]">Désactivés</div>
        </div>
        <div className="card">
          <div className="text-2xl font-bold text-blue-600">{services.length}</div>
          <div className="text-xs text-[#697386]">Services</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#aab7c4]" />
          <input
            className="input pl-10"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher par matricule, nom, email ou service…"
          />
        </div>
        <select
          className="input w-48"
          value={serviceFilter}
          onChange={(e) => setServiceFilter(e.target.value)}
        >
          <option value="">Tous les services</option>
          {services.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="card animate-pulse text-sm text-[#697386]">Chargement…</div>
      ) : (
        <div className="card overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead className="border-b border-[#e0e6eb] bg-[#f6f9fc]">
                <tr>
                  <Th label="Matricule" sortKeyName="matricule" />
                  <Th label="Nom complet" sortKeyName="name" />
                  <Th label="Service" sortKeyName="service" />
                  <th className="px-3 py-2 text-left text-xs font-medium text-[#697386]">
                    Téléphone
                  </th>
                  <Th label="Statut" sortKeyName="isActive" />
                  <th className="w-36 px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {pageData.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-3 py-6 text-center text-sm text-[#aab7c4]">
                      Aucun salarié trouvé
                    </td>
                  </tr>
                )}
                {pageData.map((emp, i) => (
                  <tr
                    key={emp.id}
                    className={`border-b border-[#e0e6eb] ${i % 2 === 1 ? 'bg-[#fafbfc]' : ''}`}
                  >
                    <td className="px-3 py-2 font-mono text-xs font-semibold text-brand-gold">
                      {emp.matricule}
                    </td>
                    <td className="px-3 py-2">
                      <div className="font-medium text-[#0a2540]">
                        {emp.firstName} {emp.lastName}
                      </div>
                      <div className="text-[10px] text-[#aab7c4]">{emp.email}</div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="text-sm text-[#0a2540]">{emp.service}</div>
                      <div className="text-[10px] text-[#aab7c4]">{emp.position}</div>
                    </td>
                    <td className="px-3 py-2 text-sm text-[#697386]">{emp.phone}</td>
                    <td className="px-3 py-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          emp.isActive
                            ? 'bg-[#dcfce7] text-[#166534]'
                            : 'bg-[#fee2e2] text-[#991b1b]'
                        }`}
                      >
                        {emp.isActive ? 'Actif' : 'Désactivé'}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => copyCredentials(emp)}
                          className="rounded p-1.5 text-[#697386] hover:bg-zinc-100 hover:text-brand-gold"
                          title="Copier les identifiants"
                        >
                          {copied === emp.id ? (
                            <CheckCircle2 size={14} className="text-emerald-600" />
                          ) : (
                            <Copy size={14} />
                          )}
                        </button>
                        <button
                          onClick={() => handleToggleActive(emp)}
                          className="rounded p-1.5 text-[#697386] hover:bg-zinc-100"
                          title={emp.isActive ? 'Désactiver' : 'Activer'}
                        >
                          {emp.isActive ? <UserX size={14} /> : <UserCheck size={14} />}
                        </button>
                        <button
                          onClick={() => openEdit(emp)}
                          className="rounded p-1.5 text-[#697386] hover:bg-zinc-100"
                          title="Modifier"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => setConfirmDelete(emp)}
                          className="rounded p-1.5 text-[#697386] hover:bg-red-50 hover:text-red-600"
                          title="Supprimer"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-[#e0e6eb] px-3 py-2 text-xs text-[#697386]">
              <span>
                {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, sorted.length)} sur{' '}
                {sorted.length}
              </span>
              <div className="flex items-center gap-1">
                <button
                  className="rounded p-1 hover:bg-zinc-100 disabled:opacity-40"
                  disabled={page === 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Précédent
                </button>
                <button
                  className="rounded p-1 hover:bg-zinc-100 disabled:opacity-40"
                  disabled={page === totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Suivant
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Create / Edit Modal */}
      <ModalShell
        open={showModal}
        onClose={() => setShowModal(false)}
        title={editEmp ? 'Modifier le salarié' : 'Créer un compte salarié'}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">
                <Hash size={12} className="mr-1 inline" />
                Matricule
              </label>
              <input
                className="input"
                value={form.matricule}
                onChange={(e) => setForm((f) => ({ ...f, matricule: e.target.value }))}
                placeholder="MAT-001"
                disabled={!!editEmp}
              />
            </div>
            <div>
              <label className="label">
                <Mail size={12} className="mr-1 inline" />
                Email
              </label>
              <input
                className="input"
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="prenom.nom@entreprise.com"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Prénom</label>
              <input
                className="input"
                value={form.firstName}
                onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
                placeholder="Amadou"
              />
            </div>
            <div>
              <label className="label">Nom</label>
              <input
                className="input"
                value={form.lastName}
                onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
                placeholder="Diallo"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">
                <Building2 size={12} className="mr-1 inline" />
                Service
              </label>
              <select
                className="input"
                value={form.service}
                onChange={(e) => setForm((f) => ({ ...f, service: e.target.value }))}
              >
                <option value="">Sélectionner…</option>
                {SERVICE_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">
                <Briefcase size={12} className="mr-1 inline" />
                Poste
              </label>
              <input
                className="input"
                value={form.position}
                onChange={(e) => setForm((f) => ({ ...f, position: e.target.value }))}
                placeholder="Comptable, Chef de projet…"
              />
            </div>
          </div>

          <div>
            <label className="label">
              <Phone size={12} className="mr-1 inline" />
              Téléphone
            </label>
            <input
              className="input"
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              placeholder="+225 07 00 00 00"
            />
          </div>

          {!editEmp && (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
              <p className="text-xs text-amber-800">
                Le salarié pourra se connecter immédiatement sur le portail de demande avec son{' '}
                <strong>matricule</strong> ({form.matricule || '…'}) et son <strong>email</strong>.
              </p>
            </div>
          )}
        </div>

        <div className="mt-4 flex justify-end gap-2 border-t border-[#e0e6eb] pt-4">
          <button className="btn-secondary" onClick={() => setShowModal(false)}>
            {t('common.cancel', 'Annuler')}
          </button>
          <button
            className="btn-primary disabled:opacity-50"
            onClick={handleSubmit}
            disabled={!isFormValid || createEmployee.isPending || updateEmployee.isPending}
          >
            {createEmployee.isPending || updateEmployee.isPending
              ? 'Enregistrement…'
              : editEmp
                ? 'Mettre à jour'
                : 'Créer le compte'}
          </button>
        </div>
      </ModalShell>

      {/* Delete confirm modal */}
      <ModalShell
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        title="Confirmer la suppression"
      >
        <p className="py-2 text-sm text-[#697386]">
          Supprimer définitivement le compte de{' '}
          <strong>
            {confirmDelete?.firstName} {confirmDelete?.lastName}
          </strong>{' '}
          ({confirmDelete?.matricule}) ? Cette action est irréversible.
        </p>
        <div className="flex justify-end gap-2 border-t border-[#e0e6eb] pt-4">
          <button className="btn-secondary" onClick={() => setConfirmDelete(null)}>
            Annuler
          </button>
          <button
            className="btn-primary bg-red-600 hover:bg-red-700 disabled:opacity-50"
            onClick={handleDelete}
            disabled={deleteEmployee.isPending}
          >
            {deleteEmployee.isPending ? 'Suppression…' : 'Supprimer'}
          </button>
        </div>
      </ModalShell>
    </div>
  );
}
