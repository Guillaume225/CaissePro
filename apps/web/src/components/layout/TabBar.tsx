import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTabStore, type Tab } from '@/stores/tab-store';
import { useState, useRef } from 'react';

export function TabBar() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { tabs, activeTabId, setActiveTab, closeTab, closeOtherTabs, closeAllTabs } = useTabStore();
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; tabId: string } | null>(
    null,
  );
  const barRef = useRef<HTMLDivElement>(null);

  const handleClick = (tab: Tab) => {
    setActiveTab(tab.id);
    navigate(tab.path);
  };

  const handleClose = (e: React.MouseEvent, tabId: string) => {
    e.stopPropagation();
    closeTab(tabId);
    // Navigate to the new active tab after the store update
    const { activeTabId: newActive, tabs: newTabs } = useTabStore.getState();
    const target = newTabs.find((t) => t.id === newActive);
    navigate(target?.path || '/');
  };

  const handleContextMenu = (e: React.MouseEvent, tabId: string) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, tabId });
  };

  const handleCloseContextMenu = () => setContextMenu(null);

  return (
    <>
      <div
        ref={barRef}
        className="no-print flex h-9 items-end gap-0 border-b border-gray-200 bg-gray-50 px-2 overflow-x-auto scrollbar-thin"
        onClick={handleCloseContextMenu}
      >
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          return (
            <button
              key={tab.id}
              onClick={() => handleClick(tab)}
              onContextMenu={(e) => handleContextMenu(e, tab.id)}
              className={cn(
                'group relative flex h-8 max-w-[180px] items-center gap-1.5 rounded-t-lg border border-b-0 px-3 text-xs font-medium transition-colors',
                isActive
                  ? 'border-gray-200 bg-white text-gray-900 shadow-sm'
                  : 'border-transparent bg-transparent text-gray-500 hover:bg-gray-100 hover:text-gray-700',
              )}
            >
              <span className="truncate">{t(tab.labelKey)}</span>
              {!tab.pinned && (
                <span
                  onClick={(e) => handleClose(e, tab.id)}
                  className={cn(
                    'ml-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-sm transition-colors',
                    isActive
                      ? 'hover:bg-gray-200 text-gray-400 hover:text-gray-700'
                      : 'opacity-0 group-hover:opacity-100 hover:bg-gray-300 text-gray-400 hover:text-gray-700',
                  )}
                >
                  <X className="h-3 w-3" />
                </span>
              )}
              {/* Active indicator */}
              {isActive && (
                <span className="absolute -bottom-px left-0 right-0 h-0.5 bg-brand-gold" />
              )}
            </button>
          );
        })}
      </div>

      {/* Context menu */}
      {contextMenu && (
        <div
          className="fixed z-50 min-w-[160px] rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onMouseLeave={handleCloseContextMenu}
        >
          <button
            onClick={() => {
              closeTab(contextMenu.tabId);
              handleCloseContextMenu();
            }}
            className="flex w-full items-center px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-100"
            disabled={tabs.find((t) => t.id === contextMenu.tabId)?.pinned}
          >
            {t('tabs.close', 'Fermer')}
          </button>
          <button
            onClick={() => {
              closeOtherTabs(contextMenu.tabId);
              handleCloseContextMenu();
            }}
            className="flex w-full items-center px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-100"
          >
            {t('tabs.closeOthers', 'Fermer les autres')}
          </button>
          <button
            onClick={() => {
              closeAllTabs();
              handleCloseContextMenu();
              navigate('/');
            }}
            className="flex w-full items-center px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-100"
          >
            {t('tabs.closeAll', 'Tout fermer')}
          </button>
        </div>
      )}
    </>
  );
}
