import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Users, Plus, Pencil, Trash2, Search, UserCheck, UserX,
  Briefcase, Mail, Phone, Hash, Building2, Copy, CheckCircle2,
} from 'lucide-react';
import { Button, Input, Select, Modal, Badge, DataTable } from '@/components/ui';
import type { Column } from '@/components/ui/DataTable';
import { useEmployees, useCreateEmployee, useUpdateEmployee, useDeleteEmployee } from '@/hooks/useAdmin';
import type { EmployeeAccount, CreateEmployeeDto, UpdateEmployeeDto } from '@/types/admin';

type AnyRow = Record<string, unknown>;

const SERVICE_OPTIONS = [
  'Comptabilité', 'Logistique', 'Marketing', 'Ressources Humaines',
  'Direction Générale', 'Informatique', 'Commercial', 'Production',
  'Finance', 'Juridique', 'Achats', 'Qualité',
];

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

  // Form state
  const [form, setForm] = useState<CreateEmployeeDto>({
    matricule: '', firstName: '', lastName: '', email: '',
    service: '', position: '', phone: '',
  });

  const filtered = employees.filter((emp) => {
    const q = search.toLowerCase();
    const matchSearch = !q ||
      emp.matricule.toLowerCase().includes(q) ||
      emp.email.toLowerCase().includes(q) ||
      `${emp.firstName} ${emp.lastName}`.toLowerCase().includes(q) ||
      emp.service.toLowerCase().includes(q);
    const matchService = !serviceFilter || emp.service === serviceFilter;
    return matchSearch && matchService;
  });

  const services = [...new Set(employees.map((e) => e.service))].sort();

  const openCreate = () => {
    setEditEmp(null);
    const nextNum = employees.length > 0
      ? Math.max(...employees.map((e) => parseInt(e.matricule.replace(/\D/g, '') || '0', 10))) + 1
      : 1;
    setForm({
      matricule: `MAT-${String(nextNum).padStart(3, '0')}`,
      firstName: '', lastName: '', email: '',
      service: '', position: '', phone: '',
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
    const text = `Matricule: ${emp.matricule}\nEmail: ${emp.email}\nConnexion: http://localhost:5173/demande/login`;
    navigator.clipboard.writeText(text);
    setCopied(emp.id);
    setTimeout(() => setCopied(null), 2000);
  };

  const columns: Column<AnyRow>[] = [
    {
      key: 'matricule',
      header: 'Matricule',
      sortable: true,
      render: (row) => (
        <span className="font-mono text-xs font-semibold text-brand-gold">
          {row.matricule as string}
        </span>
      ),
    },
    {
      key: 'name',
      header: 'Nom complet',
      sortable: true,
      render: (row) => (
        <div>
          <div className="font-medium text-gray-200">{row.firstName as string} {row.lastName as string}</div>
          <div className="text-[10px] text-gray-500">{row.email as string}</div>
        </div>
      ),
    },
    {
      key: 'service',
      header: 'Service',
      sortable: true,
      render: (row) => (
        <div>
          <div className="text-sm text-gray-300">{row.service as string}</div>
          <div className="text-[10px] text-gray-500">{row.position as string}</div>
        </div>
      ),
    },
    {
      key: 'phone',
      header: 'Téléphone',
      render: (row) => <span className="text-sm text-gray-400">{row.phone as string}</span>,
    },
    {
      key: 'isActive',
      header: 'Statut',
      sortable: true,
      render: (row) => (
        <Badge variant={row.isActive ? 'default' : 'destructive'} className="text-[10px]">
          {row.isActive ? 'Actif' : 'Désactivé'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: '',
      className: 'w-36',
      render: (row) => {
        const emp = row as unknown as EmployeeAccount;
        return (
          <div className="flex items-center gap-1">
            <button onClick={(e) => { e.stopPropagation(); copyCredentials(emp); }}
              className="p-1.5 rounded hover:bg-white/10 text-gray-500 hover:text-brand-gold transition-colors"
              title="Copier les identifiants">
              {copied === emp.id ? <CheckCircle2 size={14} className="text-green-400" /> : <Copy size={14} />}
            </button>
            <button onClick={(e) => { e.stopPropagation(); handleToggleActive(emp); }}
              className={`p-1.5 rounded hover:bg-white/10 transition-colors ${emp.isActive ? 'text-gray-500 hover:text-red-400' : 'text-gray-500 hover:text-green-400'}`}
              title={emp.isActive ? 'Désactiver' : 'Activer'}>
              {emp.isActive ? <UserX size={14} /> : <UserCheck size={14} />}
            </button>
            <button onClick={(e) => { e.stopPropagation(); openEdit(emp); }}
              className="p-1.5 rounded hover:bg-white/10 text-gray-500 hover:text-blue-400 transition-colors"
              title="Modifier">
              <Pencil size={14} />
            </button>
            <button onClick={(e) => { e.stopPropagation(); setConfirmDelete(emp); }}
              className="p-1.5 rounded hover:bg-white/10 text-gray-500 hover:text-red-400 transition-colors"
              title="Supprimer">
              <Trash2 size={14} />
            </button>
          </div>
        );
      },
    },
  ];

  const isFormValid = form.matricule && form.firstName && form.lastName && form.email && form.service && form.position;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-100 flex items-center gap-2">
            <Users className="text-brand-gold" size={24} />
            {t('admin.employees.title', 'Gestion des salariés')}
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            {t('admin.employees.subtitle', 'Créez et gérez les comptes salariés pour la connexion aux demandes de décaissement')}
          </p>
        </div>
        <Button onClick={openCreate} className="bg-brand-gold hover:bg-brand-gold-dark text-white">
          <Plus size={16} className="mr-2" />{t('admin.employees.create', 'Nouveau salarié')}
        </Button>
      </div>

      {/* Info banner */}
      <div className="rounded-xl border border-brand-gold/20 bg-brand-gold/5 p-4">
        <p className="text-sm text-brand-gold font-medium">Portail salarié</p>
        <p className="text-xs text-gray-400 mt-1">
          Les salariés se connectent sur <a href="http://localhost:5173/demande/login" target="_blank" rel="noreferrer"
            className="text-brand-gold underline hover:text-brand-gold-dark">http://localhost:5173/demande/login</a> avec
          leur <strong>matricule</strong> et <strong>email</strong> pour soumettre des demandes de décaissement.
          Utilisez le bouton <Copy size={10} className="inline" /> pour copier les identifiants.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl bg-white/5 border border-white/10 p-4">
          <div className="text-2xl font-bold text-gray-100">{employees.length}</div>
          <div className="text-xs text-gray-500">Total salariés</div>
        </div>
        <div className="rounded-xl bg-white/5 border border-white/10 p-4">
          <div className="text-2xl font-bold text-green-400">{employees.filter((e) => e.isActive).length}</div>
          <div className="text-xs text-gray-500">Actifs</div>
        </div>
        <div className="rounded-xl bg-white/5 border border-white/10 p-4">
          <div className="text-2xl font-bold text-red-400">{employees.filter((e) => !e.isActive).length}</div>
          <div className="text-xs text-gray-500">Désactivés</div>
        </div>
        <div className="rounded-xl bg-white/5 border border-white/10 p-4">
          <div className="text-2xl font-bold text-blue-400">{services.length}</div>
          <div className="text-xs text-gray-500">Services</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher par matricule, nom, email ou service…"
            className="pl-10 bg-white/5 border-white/10"
          />
        </div>
        <Select
          value={serviceFilter}
          onChange={(e) => setServiceFilter(e.target.value)}
          className="w-48 bg-white/5 border-white/10"
          placeholder="Tous les services"
          options={[{ value: '', label: 'Tous les services' }, ...services.map((s) => ({ value: s, label: s }))]}
        />
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        data={filtered as unknown as AnyRow[]}
        pageSize={10}
        emptyMessage={isLoading ? 'Chargement…' : 'Aucun salarié trouvé'}
      />

      {/* Create / Edit Modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)}
        title={editEmp ? 'Modifier le salarié' : 'Créer un compte salarié'}>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">
                <Hash size={12} className="inline mr-1" />Matricule
              </label>
              <Input
                value={form.matricule}
                onChange={(e) => setForm((f) => ({ ...f, matricule: e.target.value }))}
                placeholder="MAT-001"
                disabled={!!editEmp}
                className="bg-white/5 border-white/10"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">
                <Mail size={12} className="inline mr-1" />Email
              </label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="prenom.nom@entreprise.com"
                className="bg-white/5 border-white/10"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Prénom</label>
              <Input
                value={form.firstName}
                onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
                placeholder="Amadou"
                className="bg-white/5 border-white/10"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Nom</label>
              <Input
                value={form.lastName}
                onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
                placeholder="Diallo"
                className="bg-white/5 border-white/10"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">
                <Building2 size={12} className="inline mr-1" />Service
              </label>
              <Select
                value={form.service}
                onChange={(e) => setForm((f) => ({ ...f, service: e.target.value }))}
                className="bg-white/5 border-white/10"
                placeholder="Sélectionner…"
                options={SERVICE_OPTIONS.map((s) => ({ value: s, label: s }))}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">
                <Briefcase size={12} className="inline mr-1" />Poste
              </label>
              <Input
                value={form.position}
                onChange={(e) => setForm((f) => ({ ...f, position: e.target.value }))}
                placeholder="Comptable, Chef de projet…"
                className="bg-white/5 border-white/10"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">
              <Phone size={12} className="inline mr-1" />Téléphone
            </label>
            <Input
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              placeholder="+225 07 00 00 00"
              className="bg-white/5 border-white/10"
            />
          </div>

          {!editEmp && (
            <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3">
              <p className="text-xs text-amber-400">
                Le salarié pourra se connecter immédiatement sur le portail de demande avec son <strong>matricule</strong> ({form.matricule || '…'}) et son <strong>email</strong>.
              </p>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-white/10">
          <Button variant="outline" onClick={() => setShowModal(false)}>
            {t('common.cancel', 'Annuler')}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!isFormValid || createEmployee.isPending || updateEmployee.isPending}
            className="bg-brand-gold hover:bg-brand-gold-dark text-white"
          >
            {(createEmployee.isPending || updateEmployee.isPending) ? 'Enregistrement…' : editEmp ? 'Mettre à jour' : 'Créer le compte'}
          </Button>
        </div>
      </Modal>

      {/* Delete confirm modal */}
      <Modal open={!!confirmDelete} onClose={() => setConfirmDelete(null)} title="Confirmer la suppression">
        <p className="text-sm text-gray-300 py-4">
          Supprimer définitivement le compte de <strong>{confirmDelete?.firstName} {confirmDelete?.lastName}</strong> ({confirmDelete?.matricule}) ?
          Cette action est irréversible.
        </p>
        <div className="flex justify-end gap-2 pt-2 border-t border-white/10">
          <Button variant="outline" onClick={() => setConfirmDelete(null)}>Annuler</Button>
          <Button onClick={handleDelete} className="bg-red-600 hover:bg-red-700 text-white"
            disabled={deleteEmployee.isPending}>
            {deleteEmployee.isPending ? 'Suppression…' : 'Supprimer'}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
