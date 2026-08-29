import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  FolderTree,
  Plus,
  Pencil,
  Trash2,
  GripVertical,
  ChevronRight,
  ChevronDown,
  X,
} from 'lucide-react';
import {
  useCategories,
  useCreateCategory,
  useUpdateCategory,
  useDeleteCategory,
  useReorderCategories,
} from '@/hooks/useAdmin';
import type { ExpenseCategory, CreateCategoryDto } from '@/types/admin';

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
      <div className="relative w-full max-w-md rounded-md bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#e0e6eb] px-6 py-4">
          <h2 className="text-lg font-semibold text-[#0a2540]">{title}</h2>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-md text-[#697386] hover:bg-zinc-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-6 py-4">{children}</div>
      </div>
    </div>
  );
}

export default function CategoryManagementPage() {
  const { t } = useTranslation();
  const { data: categories = [], isLoading } = useCategories();
  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();
  const deleteCategory = useDeleteCategory();
  const reorderCategories = useReorderCategories();

  const [showModal, setShowModal] = useState(false);
  const [editCat, setEditCat] = useState<ExpenseCategory | null>(null);
  const [parentId, setParentId] = useState<string | null>(null);
  const [form, setForm] = useState<CreateCategoryDto>({
    name: '',
    parentId: null,
    direction: 'EXIT',
  });
  const [confirmDelete, setConfirmDelete] = useState<ExpenseCategory | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [dragItem, setDragItem] = useState<string | null>(null);

  const openCreate = (pid: string | null = null) => {
    setEditCat(null);
    setParentId(pid);
    setForm({ name: '', parentId: pid, direction: 'EXIT' });
    setShowModal(true);
  };

  const openEdit = (cat: ExpenseCategory) => {
    setEditCat(cat);
    setForm({ name: cat.name, parentId: cat.parentId, direction: cat.direction || 'EXIT' });
    setShowModal(true);
  };

  const handleSubmit = async () => {
    if (editCat) {
      await updateCategory.mutateAsync({ id: editCat.id, ...form });
    } else {
      await createCategory.mutateAsync(form);
    }
    setShowModal(false);
  };

  const handleDelete = async () => {
    if (confirmDelete) {
      await deleteCategory.mutateAsync(confirmDelete.id);
      setConfirmDelete(null);
    }
  };

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleDragStart = (id: string) => {
    setDragItem(id);
  };

  const handleDrop = (targetId: string) => {
    if (!dragItem || dragItem === targetId) return;
    // Build new order: move dragItem before targetId at same level
    const flatIds = categories.map((c) => c.id);
    const fromIdx = flatIds.indexOf(dragItem);
    const toIdx = flatIds.indexOf(targetId);
    if (fromIdx === -1 || toIdx === -1) return;
    const newOrder = [...flatIds];
    newOrder.splice(fromIdx, 1);
    newOrder.splice(toIdx, 0, dragItem);
    reorderCategories.mutate(newOrder);
    setDragItem(null);
  };

  // Build tree from flat list
  const rootCats = categories.filter((c) => !c.parentId);

  const renderCategory = (cat: ExpenseCategory, depth: number) => {
    const children = categories.filter((c) => c.parentId === cat.id);
    const isExpanded = expanded.has(cat.id);

    return (
      <div key={cat.id}>
        <div
          draggable
          onDragStart={() => handleDragStart(cat.id)}
          onDragOver={(e) => e.preventDefault()}
          onDrop={() => handleDrop(cat.id)}
          className={`flex items-center gap-2 rounded-lg border border-transparent px-3 py-2.5 transition-colors hover:bg-gray-50 ${
            dragItem === cat.id ? 'opacity-50' : ''
          }`}
          style={{ paddingLeft: `${12 + depth * 24}px` }}
        >
          <GripVertical className="h-4 w-4 cursor-grab text-gray-300" />

          {children.length > 0 ? (
            <button
              onClick={() => toggleExpand(cat.id)}
              className="text-gray-400 hover:text-gray-600"
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </button>
          ) : (
            <span className="w-4" />
          )}

          <span className="flex-1 text-sm font-medium text-gray-800">{cat.name}</span>

          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
              cat.direction === 'ENTRY' ? 'bg-[#eff6ff] text-[#1e40af]' : 'bg-amber-50 text-amber-800'
            }`}
          >
            {cat.direction === 'ENTRY' ? t('admin.categories.entry') : t('admin.categories.exit')}
          </span>

          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
              cat.isActive ? 'bg-[#dcfce7] text-[#166534]' : 'border border-zinc-300 text-zinc-600'
            }`}
          >
            {cat.isActive ? t('admin.categories.active') : t('admin.categories.inactive')}
          </span>

          <div className="flex items-center gap-1">
            <button
              onClick={() => openCreate(cat.id)}
              className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-brand-gold"
              title={t('admin.categories.addChild')}
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => openEdit(cat)}
              className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setConfirmDelete(cat)}
              className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {isExpanded && children.map((child) => renderCategory(child, depth + 1))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('admin.categories.title')}</h1>
          <p className="text-sm text-gray-500">{t('admin.categories.subtitle')}</p>
        </div>
        <button className="btn-primary" onClick={() => openCreate()}>
          <Plus className="h-4 w-4" />
          {t('admin.categories.addCategory')}
        </button>
      </div>

      {isLoading ? (
        <p className="text-sm text-gray-500">{t('common.loading')}</p>
      ) : categories.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 py-16">
          <FolderTree className="mb-3 h-10 w-10 text-gray-300" />
          <p className="text-sm text-gray-500">{t('admin.categories.empty')}</p>
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm divide-y divide-gray-100">
          {rootCats.map((cat) => renderCategory(cat, 0))}
        </div>
      )}

      {/* Create / Edit Modal */}
      <ModalShell
        open={showModal}
        onClose={() => setShowModal(false)}
        title={editCat ? t('admin.categories.editCategory') : t('admin.categories.addCategory')}
      >
        <div className="space-y-4">
          <div>
            <label className="label">{t('admin.categories.name')}</label>
            <input
              className="input"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div>
            <label className="label">{t('admin.categories.direction')}</label>
            <select
              className="input"
              value={form.direction || 'EXIT'}
              onChange={(e) => setForm({ ...form, direction: e.target.value as 'ENTRY' | 'EXIT' })}
            >
              <option value="EXIT">{t('admin.categories.exit')}</option>
              <option value="ENTRY">{t('admin.categories.entry')}</option>
            </select>
          </div>
          {parentId && (
            <p className="text-xs text-[#697386]">
              {t('admin.categories.parentLabel')}: {categories.find((c) => c.id === parentId)?.name}
            </p>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <button className="btn-secondary" onClick={() => setShowModal(false)}>
              {t('common.cancel')}
            </button>
            <button
              className="btn-primary disabled:opacity-50"
              onClick={handleSubmit}
              disabled={createCategory.isPending || updateCategory.isPending}
            >
              {(createCategory.isPending || updateCategory.isPending) && (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              )}
              {editCat ? t('common.save') : t('common.create')}
            </button>
          </div>
        </div>
      </ModalShell>

      {/* Delete Confirmation */}
      <ModalShell
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        title={t('admin.categories.confirmDelete')}
      >
        <p className="mb-4 text-sm text-[#697386]">
          {t('admin.categories.confirmDeleteMsg', { name: confirmDelete?.name })}
        </p>
        <div className="flex justify-end gap-3">
          <button className="btn-secondary" onClick={() => setConfirmDelete(null)}>
            {t('common.cancel')}
          </button>
          <button
            className="btn-primary bg-red-600 hover:bg-red-700 disabled:opacity-50"
            onClick={handleDelete}
            disabled={deleteCategory.isPending}
          >
            {deleteCategory.isPending && (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            )}
            {t('common.delete')}
          </button>
        </div>
      </ModalShell>
    </div>
  );
}
