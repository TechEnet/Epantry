import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  FileWarning,
  KeyRound,
  LockKeyhole,
  RefreshCw,
  ScrollText,
  ShieldCheck,
  Store,
  UsersRound,
  WalletCards,
  Webhook,
} from 'lucide-react';

import {
  useCallback,
  useEffect,
  useState,
} from 'react';

import {
  Link,
} from 'react-router-dom';

import AdminAiQualityPanel from '../../search/components/AdminAiQualityPanel';

import {
  getAdminCommandCenter,
  getAdminGovernanceErrorMessage,
} from '../../adminGovernance/services/adminGovernance.service';

import {
  useAdmin,
} from '../context/AdminContext';

import AdminShell from '../components/AdminShell';

function formatRoleKey(value) {
  return String(value || '')
      .split('_')
      .filter(Boolean)
      .map(
          (part) =>
              `${part.charAt(0).toUpperCase()}${part.slice(1)}`,
      )
      .join(' ');
}

function DashboardCard({
  icon: Icon,
  title,
  description,
  to,
}) {
  return (
      <Link
          to={to}
          className="focus-ring group rounded-[22px] border border-stone-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-md"
      >
          <div className="flex items-start justify-between gap-4">
              <div className="grid h-11 w-11 place-items-center rounded-2xl bg-emerald-50 text-emerald-700">
                  <Icon
                      size={21}
                      aria-hidden="true"
                  />
              </div>

              <ArrowRight
                  size={18}
                  className="text-stone-300 transition group-hover:translate-x-0.5 group-hover:text-emerald-700"
                  aria-hidden="true"
              />
          </div>

          <h2 className="mt-5 text-base font-black text-stone-950">
              {title}
          </h2>

          <p className="mt-2 text-sm leading-6 text-stone-500">
              {description}
          </p>
      </Link>
  );
}

function CommandMetric({
  icon: Icon,
  label,
  value,
}) {
  return (
      <div className="rounded-2xl border border-stone-800 bg-stone-900 p-4">
          <div className="flex items-center justify-between gap-3">
              <p className="text-[10px] font-black uppercase tracking-[0.1em] text-stone-500">
                  {label}
              </p>

              <Icon
                  size={15}
                  className="text-emerald-400"
                  aria-hidden="true"
              />
          </div>

          <p className="mt-2 text-2xl font-black text-white">
              {value ?? 0}
          </p>
      </div>
  );
}

export default function AdminDashboardPage() {
  const {
      isRootSuperAdmin,
      adminSource,
      adminRoleKeys,
      adminPermissionKeys,
      hasAdminPermission,
  } =
      useAdmin();

  const canReadAiQuality =
      hasAdminPermission(
          'admin.audit.read',
      );

  const [
      commandCenter,
      setCommandCenter,
  ] =
      useState(null);

  const [
      commandCenterLoading,
      setCommandCenterLoading,
  ] =
      useState(true);

  const [
      commandCenterError,
      setCommandCenterError,
  ] =
      useState('');

  const loadCommandCenter =
      useCallback(
          async () => {
              setCommandCenterLoading(
                  true,
              );

              setCommandCenterError(
                  '',
              );

              try {
                  setCommandCenter(
                      await getAdminCommandCenter(),
                  );
              } catch (error) {
                  setCommandCenterError(
                      getAdminGovernanceErrorMessage(
                          error,
                          'Unable to load M17 command-center metrics.',
                      ),
                  );
              } finally {
                  setCommandCenterLoading(
                      false,
                  );
              }
          },
          [],
      );

  useEffect(
      () => {
          loadCommandCenter();
      },
      [loadCommandCenter],
  );

  const accessibleModules = [
      {
          icon:
              FileWarning,

          title:
              'Governance Queues',

          description:
              'Review evidence-backed cases, incidents and support escalations across your permitted domains.',

          to:
              '/admin/trust-safety',

          visible:
              hasAdminPermission(
                  'trust_safety.read',
              ),
      },

      {
          icon:
              Store,

          title:
              'Host Review',

          description:
              'Review pending Host applications and manage the Host access lifecycle.',

          to:
              '/admin/hosts',

          visible:
              hasAdminPermission(
                  'host.review.read',
              ),
      },

      {
          icon:
              UsersRound,

          title:
              'Roles & Permissions',

          description:
              'Manage limited internal admin profiles and delegated authority.',

          to:
              '/admin/roles',

          visible:
              isRootSuperAdmin,
      },

      {
          icon:
              ScrollText,

          title:
              'Audit Explorer',

          description:
              'Inspect privileged activity, reasons, actors and before/after audit context.',

          to:
              '/admin/audit',

          visible:
              canReadAiQuality,
      },
  ].filter(
      (item) =>
          item.visible,
  );

  const metrics =
      commandCenter?.metrics ||
      {};

  const commandMetrics = [
      [
          'Open reviews',
          metrics.reviewQueue?.open,
          FileWarning,
      ],
      [
          'Critical reviews',
          metrics.reviewQueue?.critical,
          AlertTriangle,
      ],
      [
          'Host activation',
          metrics.marketplace?.hostActivationAwaitingReview,
          Store,
      ],
      [
          'Order exceptions',
          metrics.marketplace?.orderExceptions,
          AlertTriangle,
      ],
      [
          'Failed webhooks',
          metrics.marketplace?.failedWebhooks,
          Webhook,
      ],
      [
          'Pending settlements',
          metrics.finance?.pendingSettlements,
          WalletCards,
      ],
  ].filter(
      ([, value]) =>
          value !== undefined &&
          value !== null,
  );

  return (
      <AdminShell
          title="A01 · Admin Command Center"
          description="Permission-aware operational workspace for EPANTRY governance and internal administration. Metrics aggregate existing domain truth; they do not create parallel canonical records."
          actions={
              <button
                  type="button"
                  onClick={loadCommandCenter}
                  disabled={commandCenterLoading}
                  className="focus-ring inline-flex items-center gap-2 rounded-full bg-white px-3 py-2 text-xs font-black text-stone-600 shadow-sm disabled:opacity-50"
              >
                  <RefreshCw
                      size={14}
                      className={
                          commandCenterLoading
                              ? 'animate-spin'
                              : ''
                      }
                  />

                  Refresh
              </button>
          }
      >
          <section className="overflow-hidden rounded-[26px] bg-stone-950 p-6 text-white shadow-sm sm:p-7">
              <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                      <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.15em] text-emerald-300">
                          <CheckCircle2
                              size={14}
                              aria-hidden="true"
                          />

                          Authorized
                      </div>

                      <h2 className="mt-4 text-2xl font-black tracking-tight sm:text-3xl">
                          {isRootSuperAdmin
                              ? 'Super Admin workspace'
                              : 'Internal Admin workspace'}
                      </h2>

                      <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-400">
                          Navigation, global search, queue visibility and actions are generated from effective permissions resolved by the backend.
                      </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3 sm:min-w-[300px]">
                      <div className="rounded-2xl border border-stone-800 bg-stone-900 p-4">
                          <p className="text-[10px] font-black uppercase tracking-[0.12em] text-stone-500">
                              Permissions
                          </p>

                          <p className="mt-2 text-2xl font-black text-white">
                              {adminPermissionKeys.length}
                          </p>
                      </div>

                      <div className="rounded-2xl border border-stone-800 bg-stone-900 p-4">
                          <p className="text-[10px] font-black uppercase tracking-[0.12em] text-stone-500">
                              Source
                          </p>

                          <p className="mt-2 truncate text-sm font-black text-emerald-400">
                              {adminSource ===
                              'super_admin'
                                  ? 'Super Admin'
                                  : 'Assignment'}
                          </p>
                      </div>
                  </div>
              </div>

              {commandMetrics.length ? (
                  <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                      {commandMetrics.map(
                          ([
                              label,
                              value,
                              Icon,
                          ]) => (
                              <CommandMetric
                                  key={label}
                                  label={label}
                                  value={value}
                                  icon={Icon}
                              />
                          ),
                      )}
                  </div>
              ) : null}

              {commandCenterError ? (
                  <p className="mt-4 rounded-2xl border border-red-900/50 bg-red-950/40 p-4 text-xs font-semibold text-red-200">
                      {commandCenterError}
                  </p>
              ) : null}
          </section>

          {(commandCenter?.incidentBanners || []).length ? (
              <section className="mt-5 space-y-2">
                  {(commandCenter.incidentBanners || []).map(
                      (incident) => (
                          <div
                              key={incident.id}
                              className="rounded-2xl border border-amber-200 bg-amber-50 p-4"
                          >
                              <div className="flex items-start gap-3">
                                  <AlertTriangle
                                      size={18}
                                      className="mt-0.5 shrink-0 text-amber-700"
                                  />

                                  <div>
                                      <p className="text-sm font-black text-amber-950">
                                          {incident.title}
                                      </p>

                                      <p className="mt-1 text-xs leading-5 text-amber-800">
                                          {incident.banner?.message ||
                                              incident.summary}
                                      </p>
                                  </div>
                              </div>
                          </div>
                      ),
                  )}
              </section>
          ) : null}

          <section className="mt-6">
              <div className="mb-4">
                  <h2 className="text-lg font-black text-stone-950">
                      Your workspace
                  </h2>

                  <p className="mt-1 text-sm text-stone-500">
                      Only modules available to your current administrative authority are shown.
                  </p>
              </div>

              {accessibleModules.length >
              0 ? (
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                      {accessibleModules.map(
                          (item) => (
                              <DashboardCard
                                  key={item.to}
                                  {...item}
                              />
                          ),
                      )}
                  </div>
              ) : (
                  <div className="rounded-[22px] border border-stone-200 bg-white p-6 text-sm text-stone-500">
                      No administrative modules are currently available for this permission profile.
                  </div>
              )}
          </section>

          <section className="mt-6 grid gap-4 lg:grid-cols-3">
              <div className="rounded-[22px] border border-stone-200 bg-white p-5">
                  <LockKeyhole
                      size={20}
                      className="text-emerald-700"
                      aria-hidden="true"
                  />

                  <h3 className="mt-4 font-black text-stone-950">
                      MFA protected
                  </h3>

                  <p className="mt-2 text-sm leading-6 text-stone-500">
                      Administrative access requires the existing secure MFA assurance flow.
                  </p>
              </div>

              <div className="rounded-[22px] border border-stone-200 bg-white p-5">
                  <KeyRound
                      size={20}
                      className="text-emerald-700"
                      aria-hidden="true"
                  />

                  <h3 className="mt-4 font-black text-stone-950">
                      Permission scoped
                  </h3>

                  <p className="mt-2 text-sm leading-6 text-stone-500">
                      Frontend visibility follows backend-resolved effective permissions; it is never the authorization authority.
                  </p>
              </div>

              <div className="rounded-[22px] border border-stone-200 bg-white p-5">
                  <ShieldCheck
                      size={20}
                      className="text-emerald-700"
                      aria-hidden="true"
                  />

                  <h3 className="mt-4 font-black text-stone-950">
                      Audited actions
                  </h3>

                  <p className="mt-2 text-sm leading-6 text-stone-500">
                      Critical operations retain controlled reasons, evidence and immutable before/after audit context.
                  </p>
              </div>
          </section>

          <section className="mt-6 grid gap-4 lg:grid-cols-2">
              <div className="rounded-[22px] border border-stone-200 bg-white p-5">
                  <h2 className="text-base font-black text-stone-950">
                      Assigned profiles
                  </h2>

                  <div className="mt-4 flex flex-wrap gap-2">
                      {isRootSuperAdmin ? (
                          <span className="rounded-full bg-stone-950 px-3 py-1.5 text-xs font-black text-white">
                              Super Admin
                          </span>
                      ) : null}

                      {adminRoleKeys.map(
                          (roleKey) => (
                              <span
                                  key={roleKey}
                                  className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800"
                              >
                                  {formatRoleKey(
                                      roleKey,
                                  )}
                              </span>
                          ),
                      )}

                      {!isRootSuperAdmin &&
                      adminRoleKeys.length ===
                      0 ? (
                          <p className="text-sm text-stone-500">
                              No named administrative profile returned.
                          </p>
                      ) : null}
                  </div>
              </div>

              <div className="rounded-[22px] border border-stone-200 bg-white p-5">
                  <h2 className="text-base font-black text-stone-950">
                      Effective permissions
                  </h2>

                  <div className="mt-4 flex max-h-44 flex-wrap gap-2 overflow-y-auto">
                      {adminPermissionKeys
                          .slice(
                              0,
                              30,
                          )
                          .map(
                              (permission) => (
                                  <span
                                      key={permission}
                                      className="rounded-full border border-stone-200 bg-stone-50 px-2.5 py-1 text-[11px] font-bold text-stone-600"
                                  >
                                      {permission}
                                  </span>
                              ),
                          )}
                  </div>
              </div>
          </section>

          {canReadAiQuality ? (
              <AdminAiQualityPanel />
          ) : null}
      </AdminShell>
  );
}