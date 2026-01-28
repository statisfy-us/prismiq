/**
 * Pin components for embedding pinned dashboards.
 *
 * @example
 * ```tsx
 * import { PinButton, PinMenu, PinnedDashboardList, PinnedDashboardView } from '@prismiq/react/pins';
 *
 * // Simple pin toggle
 * <PinButton dashboardId={id} context="accounts" />
 *
 * // Multi-context pin menu
 * <PinMenu dashboardId={id} contexts={[{ id: 'accounts', label: 'Accounts' }]} />
 *
 * // Full embedded view
 * <PinnedDashboardView
 *   context="accounts"
 *   selectedDashboard={selected}
 *   onSelect={setSelected}
 *   onBack={() => setSelected(null)}
 * />
 * ```
 */

export { PinButton } from './PinButton';
export type { PinButtonProps } from './PinButton';

export { PinMenu } from './PinMenu';
export type { PinMenuProps, PinContextOption } from './PinMenu';

export { PinnedDashboardList } from './PinnedDashboardList';
export type { PinnedDashboardListProps, PinnedDashboardItemActions } from './PinnedDashboardList';

export { PinnedDashboardView } from './PinnedDashboardView';
export type { PinnedDashboardViewProps } from './PinnedDashboardView';
